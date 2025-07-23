import JSZip from 'jszip';
import { databaseService } from '../db/database';
import { 
	generateArchiveId, 
	generateChatId, 
	generateMessageId, 
	generateAlbumId, 
	generatePhotoId,
	type ArchiveRecord,
	type ChatRecord,
	type MessageRecord,
	type AlbumRecord,
	type PhotoRecord
} from '../db/schema';
import { decodeWindows1251 } from '../utils/encoding';
import { parseAlbumsFromZip } from '../utils/albumParser';
import type { 
	ArchiveWorkerCommand, 
	ArchiveWorkerResponse, 
	ProgressData, 
	CompletionData, 
	ErrorData 
} from './worker-types';

// Worker context - we'll use 'self' as any to avoid TypeScript issues in worker context
declare const self: any;

class ArchiveProcessor {
	private currentArchiveId: string = '';
	private startTime: number = 0;
	private processedItems: number = 0;
	private totalItems: number = 0;

	private postProgress(step: string, processed: number, total: number, currentItem?: string): void {
		const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
		const elapsedTime = Date.now() - this.startTime;
		const estimatedTotal = processed > 0 ? (elapsedTime / processed) * total : 0;
		const remainingTime = estimatedTotal - elapsedTime;

		const progressData: ProgressData = {
			step,
			percentage,
			processed,
			total,
			currentItem,
			estimatedTimeRemaining: this.formatTime(remainingTime)
		};

		self.postMessage({
			type: 'PROGRESS',
			data: progressData
		} as ArchiveWorkerResponse);
	}

	private postComplete(data: CompletionData): void {
		self.postMessage({
			type: 'COMPLETE',
			data
		} as ArchiveWorkerResponse);
	}

	private postError(error: ErrorData): void {
		self.postMessage({
			type: 'ERROR',
			data: error
		} as ArchiveWorkerResponse);
	}

	private formatTime(ms: number): string {
		if (ms <= 0) return '0s';
		
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		
		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}

	async processArchive(file: File, options: any = {}): Promise<void> {
		this.startTime = Date.now();
		this.currentArchiveId = generateArchiveId(file.name, file.size);

		try {
			// Create archive record
			const archiveRecord: ArchiveRecord = {
				id: this.currentArchiveId,
				filename: file.name,
				size: file.size,
				uploadedAt: new Date(),
				totalChats: 0,
				totalMessages: 0,
				totalAlbums: 0,
				totalPhotos: 0,
				processingStatus: 'processing'
			};

			await databaseService.createArchive(archiveRecord);
			this.postProgress('📁 Loading ZIP file...', 0, 100);

			// Load ZIP file
			const zip = await JSZip.loadAsync(file);
			const allFiles = Object.keys(zip.files);
			this.totalItems = allFiles.length;

			this.postProgress('🔍 Scanning archive structure...', 10, 100);

			// Process chats
			const chats = await this.extractChats(zip);
			await databaseService.updateArchive({
				id: this.currentArchiveId,
				totalChats: chats.length
			});

			this.postProgress('📊 Processing messages...', 30, 100);

			// Process messages
			let totalMessages = 0;
			for (let i = 0; i < chats.length; i++) {
				const messageCount = await this.processMessagesForChat(zip, chats[i]);
				totalMessages += messageCount;
				this.postProgress('📊 Processing messages...', 30 + (i / chats.length) * 40, 100, chats[i].name);
			}

			this.postProgress('📸 Processing albums...', 70, 100);

			// Process albums
			const albums = await this.processAlbums(zip);
			
			this.postProgress('🖼️ Processing photos...', 85, 100);

			// Process photos
			let totalPhotos = 0;
			for (const chat of chats) {
				totalPhotos += await this.processPhotosForChat(zip, chat);
			}
			
			for (const album of albums) {
				totalPhotos += await this.processPhotosForAlbum(zip, album);
			}

			// Update final archive status
			const processingTime = Date.now() - this.startTime;
			await databaseService.updateArchive({
				id: this.currentArchiveId,
				totalMessages,
				totalAlbums: albums.length,
				totalPhotos,
				processingStatus: 'complete',
				processedAt: new Date()
			});

			this.postProgress('✅ Processing complete!', 100, 100);

			// Send completion data
			this.postComplete({
				archiveId: this.currentArchiveId,
				totalChats: chats.length,
				totalMessages,
				totalAlbums: albums.length,
				totalPhotos,
				processingTime
			});

		} catch (error) {
			console.error('Archive processing error:', error);
			
			// Update archive status to error
			await databaseService.updateArchive({
				id: this.currentArchiveId,
				processingStatus: 'error',
				error: error instanceof Error ? error.message : 'Unknown error'
			}).catch(console.error);

			this.postError({
				message: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined
			});
		}
	}

	private async extractChats(zip: JSZip): Promise<ChatRecord[]> {
		const chats: ChatRecord[] = [];
		
		// Look for the messages index file
		const indexFile = zip.file('messages/index-messages.html');
		if (!indexFile) {
			throw new Error('Messages index file not found in archive');
		}

		// Read and decode the index file
		const indexBuffer = await indexFile.async('arraybuffer');
		const indexContent = decodeWindows1251(indexBuffer);
		
		// Parse the HTML to extract chat information
		const parser = new DOMParser();
		const doc = parser.parseFromString(indexContent, 'text/html');
		
		// Extract chat links
		const chatLinks = doc.querySelectorAll('a[href*="messages"]');
		
		// Pre-filter message files for better performance
		const allMessageFiles = Object.keys(zip.files).filter(fileName =>
			fileName.startsWith('messages/') &&
			fileName.includes('/messages') &&
			fileName.endsWith('.html')
		);
		
		// Group message files by chat ID
		const messageFilesByChat: { [chatId: string]: string[] } = {};
		for (const fileName of allMessageFiles) {
			const pathParts = fileName.split('/');
			if (pathParts.length >= 3) {
				const chatId = pathParts[1];
				if (!messageFilesByChat[chatId]) {
					messageFilesByChat[chatId] = [];
				}
				messageFilesByChat[chatId].push(fileName);
			}
		}
		
		for (let i = 0; i < chatLinks.length; i++) {
			const link = chatLinks[i];
			const href = link.getAttribute('href');
			if (!href || !href.includes('/messages0.html')) continue;
			
			const chatId = href.split('/')[0];
			const chatName = link.textContent?.trim() || `Chat ${chatId}`;
			
			const messageFiles = messageFilesByChat[chatId] || [];
			const messageCount = messageFiles.length * 50; // Estimate
			
			const chatRecord: ChatRecord = {
				archiveId: this.currentArchiveId,
				id: generateChatId(this.currentArchiveId, chatId),
				chatId,
				name: chatName,
				messageCount,
				lastMessage: null,
				firstMessage: null,
				totalWords: 0,
				avgMessageLength: 0,
				createdAt: new Date()
			};
			
			await databaseService.createChat(chatRecord);
			chats.push(chatRecord);
		}
		
		return chats.sort((a, b) => a.name.localeCompare(b.name));
	}

	private async processMessagesForChat(zip: JSZip, chat: ChatRecord): Promise<number> {
		const messageFiles = Object.keys(zip.files).filter(fileName =>
			fileName.startsWith(`messages/${chat.chatId}/`) &&
			fileName.includes('messages') &&
			fileName.endsWith('.html')
		);

		let totalMessages = 0;
		let totalWords = 0;
		let totalLength = 0;
		let firstMessage: Date | null = null;
		let lastMessage: Date | null = null;

		for (const fileName of messageFiles) {
			const file = zip.files[fileName];
			if (!file || file.dir) continue;

			try {
				const content = await file.async('arraybuffer');
				const htmlContent = decodeWindows1251(content);
				const messages = this.parseMessages(htmlContent, chat.chatId);
				
				// Save messages in batches
				const messageRecords: MessageRecord[] = messages.map(msg => ({
					archiveId: this.currentArchiveId,
					chatId: chat.chatId,
					id: generateMessageId(this.currentArchiveId, chat.chatId, msg.id),
					messageId: msg.id,
					sender: msg.sender,
					isFromUser: msg.isFromUser,
					timestamp: msg.timestamp,
					content: msg.content,
					hasAttachment: msg.hasAttachment,
					attachmentInfo: msg.attachmentInfo,
					edited: msg.edited,
					wordCount: this.countWords(msg.content),
					hasPhotos: msg.hasAttachment && msg.attachmentInfo.includes('photo'),
					photoIds: [] // Will be populated later
				}));

				if (messageRecords.length > 0) {
					await databaseService.createMessages(messageRecords);
					totalMessages += messageRecords.length;
					
					// Update statistics
					for (const record of messageRecords) {
						totalWords += record.wordCount;
						totalLength += record.content.length;
						
						if (!firstMessage || record.timestamp < firstMessage) {
							firstMessage = record.timestamp;
						}
						if (!lastMessage || record.timestamp > lastMessage) {
							lastMessage = record.timestamp;
						}
					}
				}

			} catch (error) {
				console.warn(`Failed to process messages file ${fileName}:`, error);
			}
		}

		// Update chat statistics
		await databaseService.updateChat({
			id: chat.id,
			messageCount: totalMessages,
			totalWords,
			avgMessageLength: totalMessages > 0 ? Math.round(totalLength / totalMessages) : 0,
			firstMessage,
			lastMessage
		});

		return totalMessages;
	}

	private parseMessages(htmlContent: string, chatId: string): any[] {
		const messages: any[] = [];
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlContent, 'text/html');
		
		const messageElements = doc.querySelectorAll('.message');
		
		for (const element of messageElements) {
			try {
				const id = element.getAttribute('id') || `${chatId}_${Date.now()}_${Math.random()}`;
				const sender = element.querySelector('.message__header')?.textContent?.trim() || 'Unknown';
				const content = element.querySelector('.message__text')?.textContent?.trim() || '';
				const timeElement = element.querySelector('time');
				const timestamp = timeElement ? new Date(timeElement.getAttribute('datetime') || timeElement.textContent || '') : new Date();
				
				const attachmentElement = element.querySelector('.attachment');
				const hasAttachment = !!attachmentElement;
				const attachmentInfo = attachmentElement ? attachmentElement.outerHTML : '';
				
				const edited = element.classList.contains('message--edited');
				const isFromUser = element.classList.contains('message--out');

				messages.push({
					id,
					sender,
					isFromUser,
					timestamp,
					content,
					hasAttachment,
					attachmentInfo,
					edited
				});
			} catch (error) {
				console.warn('Failed to parse message:', error);
			}
		}
		
		return messages;
	}

	private async processAlbums(zip: JSZip): Promise<AlbumRecord[]> {
		try {
			const albums = await parseAlbumsFromZip(zip, (step, processed) => {
				// Progress is handled by parent function
			});

			const albumRecords: AlbumRecord[] = [];
			
			for (const album of albums) {
				const record: AlbumRecord = {
					archiveId: this.currentArchiveId,
					id: generateAlbumId(this.currentArchiveId, album.id),
					albumId: album.id,
					name: album.name,
					photoCount: album.photoCount,
					createdAt: album.createdAt,
					updatedAt: album.updatedAt,
					filename: album.filename,
					processedAt: new Date()
				};
				
				await databaseService.createAlbum(record);
				albumRecords.push(record);
			}

			return albumRecords;
		} catch (error) {
			console.warn('Failed to process albums:', error);
			return [];
		}
	}

	private async processPhotosForChat(zip: JSZip, chat: ChatRecord): Promise<number> {
		// This is a simplified implementation - in a real scenario,
		// you'd extract photo URLs from message content
		return 0;
	}

	private async processPhotosForAlbum(zip: JSZip, album: AlbumRecord): Promise<number> {
		// This is a simplified implementation - in a real scenario,
		// you'd extract photo information from album HTML files
		return album.photoCount;
	}

	private countWords(text: string): number {
		return text.trim().split(/\s+/).filter(word => word.length > 0).length;
	}
}

// Worker message handler
const processor = new ArchiveProcessor();

self.onmessage = async (event: MessageEvent<ArchiveWorkerCommand>) => {
	const { type, file, options } = event.data;
	
	if (type === 'PROCESS_ARCHIVE') {
		await processor.processArchive(file, options);
	}
};

// Export for testing
export { ArchiveProcessor };