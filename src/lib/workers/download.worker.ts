import JSZip from 'jszip';
import { extractImagesFromChats, type ImageInfo } from '../utils/imageExtractor';
import { extractImagesFromAlbums } from '../utils/albumImageExtractor';
import { extractChatListFromIndex, extractAlbumListFromIndex } from '../utils/indexParsers';
import type { ArchiveData } from '../stores/archive';

// Worker context
declare const self: any;

export interface DownloadWorkerCommand {
	type: 'EXTRACT_IMAGES';
	archiveFile: File;
	chatIds?: string[];
	albumIds?: string[];
	extractionType: 'chats' | 'albums';
}

export interface DownloadWorkerResponse {
	type: 'PROGRESS' | 'COMPLETE' | 'ERROR';
	data: any;
}

interface ProgressData {
	step: string;
	processed: number;
	total: number;
	currentItem?: string;
	percentage: number;
}

interface CompletionData {
	extractedImages: ImageInfo[];
	extractionTime: number;
}

interface ErrorData {
	message: string;
	stack?: string;
}

class DownloadProcessor {
	private startTime: number = 0;

	private postProgress(step: string, processed: number, total: number, currentItem?: string): void {
		const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

		const progressData: ProgressData = {
			step,
			percentage,
			processed,
			total,
			currentItem
		};

		self.postMessage({
			type: 'PROGRESS',
			data: progressData
		} as DownloadWorkerResponse);
	}

	private postComplete(data: CompletionData): void {
		self.postMessage({
			type: 'COMPLETE',
			data
		} as DownloadWorkerResponse);
	}

	private postError(error: ErrorData): void {
		self.postMessage({
			type: 'ERROR',
			data: error
		} as DownloadWorkerResponse);
	}

	async extractImages(
		archiveFile: File,
		chatIds: string[] = [],
		albumIds: string[] = [],
		extractionType: 'chats' | 'albums'
	): Promise<void> {
		this.startTime = Date.now();

		try {
			this.postProgress('Loading ZIP file...', 0, 100);

			// Load ZIP file
			const zip = await JSZip.loadAsync(archiveFile);

			this.postProgress('Reading archive structure...', 5, 100);

			// Build ArchiveData structure needed by the extraction functions
			const chats = await extractChatListFromIndex(zip);
			const albums = await extractAlbumListFromIndex(zip);

			const archiveData: ArchiveData = {
				file: archiveFile,
				zip: zip,
				chats: chats,
				albums: albums,
				isLoading: false,
				error: null
			};

			this.postProgress('Extracting images...', 10, 100);

			let extractedImages: ImageInfo[] = [];

			if (extractionType === 'chats') {
				// Extract images from chats
				extractedImages = await extractImagesFromChats(archiveData, chatIds, (progress) => {
					// Map the progress to 10-90% range
					const percentage = 10 + Math.round((progress.processedChats / progress.totalChats) * 80);
					this.postProgress(
						progress.currentStep,
						percentage,
						100,
						`Processing chat ${progress.processedChats} of ${progress.totalChats}`
					);
				});
			} else {
				// Extract images from albums
				extractedImages = await extractImagesFromAlbums(archiveData, albumIds, (progress) => {
					// Map the progress to 10-90% range
					const percentage = 10 + Math.round((progress.albumsProcessed / progress.totalAlbums) * 80);
					this.postProgress(
						progress.status,
						percentage,
						100,
						`Processing album ${progress.albumsProcessed} of ${progress.totalAlbums}`
					);
				});
			}

			this.postProgress('Image extraction complete!', 100, 100);

			const extractionTime = Date.now() - this.startTime;

			// Send completion data
			this.postComplete({
				extractedImages,
				extractionTime
			});

		} catch (error) {
			console.error('Download processing error:', error);

			this.postError({
				message: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined
			});
		}
	}
}

// Worker message handler
const processor = new DownloadProcessor();

self.onmessage = async (event: MessageEvent<DownloadWorkerCommand>) => {
	const { type, archiveFile, chatIds, albumIds, extractionType } = event.data;

	if (type === 'EXTRACT_IMAGES') {
		await processor.extractImages(archiveFile, chatIds || [], albumIds || [], extractionType);
	}
};

// Export for testing
export { DownloadProcessor };