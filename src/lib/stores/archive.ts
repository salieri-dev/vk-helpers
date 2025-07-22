import { writable } from 'svelte/store';
import JSZip from 'jszip';
import { decodeWindows1251 } from '$lib/utils/encoding';
import { parseAlbumsFromZip } from '$lib/utils/albumParser';

export interface ChatInfo {
	id: string;
	name: string;
	messageCount: number;
	lastMessage: Date | null;
}

export interface PhotoInfo {
	id: string;
	url: string;
	vkUrl: string;
	timestamp: Date | null;
	altText: string;
}

export interface AlbumInfo {
	id: string;
	name: string;
	photoCount: number;
	createdAt: Date | null;
	updatedAt: Date | null;
	filename: string;
	photos?: PhotoInfo[];
}

export interface ArchiveData {
	file: File | null;
	zip: JSZip | null;
	chats: ChatInfo[];
	albums: AlbumInfo[];
	isLoading: boolean;
	error: string | null;
	processingStep?: string;
	processedChats?: number;
	processedAlbums?: number;
	totalFiles?: number;
}

function createArchiveStore() {
	const { subscribe, set, update } = writable<ArchiveData>({
		file: null,
		zip: null,
		chats: [],
		albums: [],
		isLoading: false,
		error: null
	});

	return {
		subscribe,
		setFile: async (file: File) => {
			// console.log('🔍 archiveStore.setFile called with file:', file.name, 'Size:', file.size);
			update(state => ({
				...state,
				file, // Set the file immediately
				isLoading: true,
				error: null,
				processingStep: '📁 Loading ZIP file...',
				processedChats: undefined,
				totalFiles: undefined
			}));
			
			try {
				// console.log('🔍 Loading ZIP file with JSZip...');
				const zip = await JSZip.loadAsync(file);
				const totalFiles = Object.keys(zip.files).length;
				// console.log('✅ ZIP loaded, file count:', totalFiles);
				// console.log('🔍 ZIP contents:', Object.keys(zip.files).slice(0, 10)); // Show first 10 files
				
				update(state => ({
					...state,
					processingStep: '🔍 Scanning archive structure...',
					totalFiles
				}));
				
				// console.log('🔍 Extracting chats from ZIP...');
				const chats = await extractChatsFromZip(zip, (step, processedChats) => {
					update(state => ({
						...state,
						processingStep: step,
						processedChats
					}));
				});
				// console.log('✅ Chats extracted:', chats.length, 'chats found');
				
				// console.log('🔍 Extracting albums from ZIP...');
				const albums = await parseAlbumsFromZip(zip, (step, processedAlbums) => {
					update(state => ({
						...state,
						processingStep: step,
						processedAlbums
					}));
				});
				// console.log('✅ Albums extracted:', albums.length, 'albums found');
				
				update(state => ({
					...state,
					file,
					zip,
					chats,
					albums,
					isLoading: false,
					processingStep: undefined,
					processedChats: undefined,
					processedAlbums: undefined,
					totalFiles: undefined
				}));
				// console.log('✅ Archive store updated successfully');
			} catch (error) {
				console.error('❌ Error in archiveStore.setFile:', error);
				update(state => ({
					...state,
					error: error instanceof Error ? error.message : 'Unknown error',
					isLoading: false,
					processingStep: undefined,
					processedChats: undefined,
					totalFiles: undefined
				}));
			}
		},
		reset: () => {
			set({
				file: null,
				zip: null,
				chats: [],
				albums: [],
				isLoading: false,
				error: null,
				processingStep: undefined,
				processedChats: undefined,
				processedAlbums: undefined,
				totalFiles: undefined
			});
		}
	};
}

async function extractChatsFromZip(
	zip: JSZip,
	onProgress?: (step: string, processedChats?: number) => void
): Promise<ChatInfo[]> {
	const chats: ChatInfo[] = [];
	
	onProgress?.('🔍 Looking for message index file...');
	
	// Look for the messages index file
	const indexFile = zip.file('messages/index-messages.html');
	if (!indexFile) {
		throw new Error('Messages index file not found in archive');
	}

	onProgress?.('📖 Reading message index file...');
	
	// Read and decode the index file
	const indexBuffer = await indexFile.async('arraybuffer');
	const indexContent = decodeWindows1251(indexBuffer);
	
	onProgress?.('🔍 Parsing chat information...');
	
	// Parse the HTML to extract chat information
	const parser = new DOMParser();
	const doc = parser.parseFromString(indexContent, 'text/html');
	
	// Extract chat links - they should be in the format: <peer_id>/messages0.html
	const chatLinks = doc.querySelectorAll('a[href*="messages"]');
	
	onProgress?.('📊 Processing chat data...', 0);
	
	// Pre-filter message files once for better performance
	const allMessageFiles = Object.keys(zip.files).filter(fileName =>
		fileName.startsWith('messages/') &&
		fileName.includes('/messages') &&
		fileName.endsWith('.html')
	);
	
	// Group message files by chat ID for efficient lookup
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
		
		// Use pre-computed message files for this chat
		const messageFiles = messageFilesByChat[chatId] || [];
		const messageCount = messageFiles.length * 50; // Estimate: 50 messages per file
		
		// Skip expensive date parsing during initial extraction - we'll do this only when needed
		// This speeds up the initial chat list loading significantly
		const lastMessage: Date | null = null;
		
		chats.push({
			id: chatId,
			name: chatName,
			messageCount,
			lastMessage
		});
		
		// Update progress more frequently for better UX
		if ((i + 1) % 3 === 0 || i === chatLinks.length - 1) {
			onProgress?.('📊 Processing chat data...', chats.length);
		}
	}
	
	onProgress?.('✅ Finalizing chat list...');
	
	return chats.sort((a, b) => {
		// Sort by last message date, most recent first
		if (!a.lastMessage && !b.lastMessage) return 0;
		if (!a.lastMessage) return 1;
		if (!b.lastMessage) return -1;
		return b.lastMessage.getTime() - a.lastMessage.getTime();
	});
}

export const archiveStore = createArchiveStore();