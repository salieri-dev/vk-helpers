import { databaseService } from '../db/database';
import { generateDownloadQueueId } from '../db/schema';
import type { 
	DownloadWorkerCommand, 
	DownloadWorkerResponse, 
	ProgressData, 
	DownloadCompletionData, 
	ErrorData,
	FileWriteData,
	DownloadOptions
} from './worker-types';
import type { PhotoRecord, DownloadQueueRecord } from '../db/schema';

// Worker context
declare const self: any;

class ImageDownloader {
	private currentQueueId: string = '';
	private startTime: number = 0;
	private downloadedImages: number = 0;
	private failedImages: number = 0;
	private totalImages: number = 0;

	private postProgress(step: string, currentItem?: string): void {
		const percentage = this.totalImages > 0 ? Math.round((this.downloadedImages / this.totalImages) * 100) : 0;
		const elapsedTime = Date.now() - this.startTime;
		const estimatedTotal = this.downloadedImages > 0 ? (elapsedTime / this.downloadedImages) * this.totalImages : 0;
		const remainingTime = estimatedTotal - elapsedTime;

		const progressData: ProgressData = {
			step,
			percentage,
			processed: this.downloadedImages,
			total: this.totalImages,
			currentItem,
			estimatedTimeRemaining: this.formatTime(remainingTime)
		};

		self.postMessage({
			type: 'PROGRESS',
			data: progressData
		} as DownloadWorkerResponse);
	}

	private postFileWritten(data: FileWriteData): void {
		self.postMessage({
			type: 'FILE_WRITTEN',
			data
		} as DownloadWorkerResponse);
	}

	private postComplete(data: DownloadCompletionData): void {
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

	async downloadImages(archiveId: string, photoIds: string[], options: DownloadOptions): Promise<void> {
		this.startTime = Date.now();
		this.currentQueueId = generateDownloadQueueId();
		this.downloadedImages = 0;
		this.failedImages = 0;
		this.totalImages = photoIds.length;

		const {
			useFileSystem = false,
			directoryHandle,
			concurrentDownloads = 3,
			batchSize = 10,
			retryAttempts = 2,
			addExifMetadata = false,
			createSubdirectories = true
		} = options;

		try {
			// Create download queue record
			const queueRecord: DownloadQueueRecord = {
				id: this.currentQueueId,
				archiveId,
				photoIds,
				status: 'downloading',
				totalImages: this.totalImages,
				downloadedImages: 0,
				failedImages: 0,
				createdAt: new Date(),
				startedAt: new Date()
			};

			await databaseService.createDownloadQueue(queueRecord);
			this.postProgress('🔍 Loading photo metadata...');

			// Get photo records
			const photos: PhotoRecord[] = [];
			for (const photoId of photoIds) {
				const photo = await databaseService.getPhotosByArchive(archiveId);
				const foundPhoto = photo.find(p => p.id === photoId);
				if (foundPhoto) {
					photos.push(foundPhoto);
				}
			}

			if (photos.length === 0) {
				throw new Error('No photos found for download');
			}

			this.totalImages = photos.length;
			this.postProgress('🚀 Starting downloads...');

			if (useFileSystem && directoryHandle) {
				await this.downloadWithFileSystemAPI(photos, directoryHandle, {
					concurrentDownloads,
					batchSize,
					retryAttempts,
					addExifMetadata,
					createSubdirectories
				});
			} else {
				await this.downloadWithZipFallback(photos, {
					concurrentDownloads,
					batchSize,
					retryAttempts,
					addExifMetadata,
					createSubdirectories
				});
			}

			// Update queue record
			const processingTime = Date.now() - this.startTime;
			await databaseService.updateDownloadQueue({
				id: this.currentQueueId,
				status: 'complete',
				downloadedImages: this.downloadedImages,
				failedImages: this.failedImages,
				completedAt: new Date()
			});

			this.postComplete({
				queueId: this.currentQueueId,
				totalImages: this.totalImages,
				downloadedImages: this.downloadedImages,
				failedImages: this.failedImages,
				processingTime
			});

		} catch (error) {
			console.error('Download error:', error);
			
			// Update queue status
			await databaseService.updateDownloadQueue({
				id: this.currentQueueId,
				status: 'failed'
			}).catch(console.error);

			this.postError({
				message: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined
			});
		}
	}

	private async downloadWithFileSystemAPI(
		photos: PhotoRecord[],
		rootHandle: FileSystemDirectoryHandle,
		options: {
			concurrentDownloads: number;
			batchSize: number;
			retryAttempts: number;
			addExifMetadata: boolean;
			createSubdirectories: boolean;
		}
	): Promise<void> {
		const { concurrentDownloads, batchSize, retryAttempts, createSubdirectories } = options;

		// Create folder structure and track filenames for flat structure
		const folderCache = new Map<string, FileSystemDirectoryHandle>();
		const usedFilenames = new Set<string>();

		// Process photos in batches
		for (let i = 0; i < photos.length; i += batchSize) {
			const batch = photos.slice(i, i + batchSize);
			
			// Process batch with concurrency limit
			const semaphore = new Array(concurrentDownloads).fill(null);
			const promises = batch.map(async (photo, index) => {
				// Wait for available slot
				await this.waitForSlot(semaphore);
				const slotIndex = semaphore.findIndex(slot => slot === null);
				semaphore[slotIndex] = photo;

				try {
					await this.downloadAndWritePhoto(photo, rootHandle, folderCache, retryAttempts, createSubdirectories, usedFilenames);
					this.downloadedImages++;
					
					// Update photo record
					await databaseService.updatePhoto({
						id: photo.id,
						downloadStatus: 'downloaded'
					});

				} catch (error) {
					console.warn(`Failed to download ${photo.filename}:`, error);
					this.failedImages++;
					
					await databaseService.updatePhoto({
						id: photo.id,
						downloadStatus: 'failed'
					});
				} finally {
					semaphore[slotIndex] = null;
					this.postProgress('📥 Downloading images...', photo.filename);
				}
			});

			await Promise.all(promises);
		}
	}

	private async downloadAndWritePhoto(
		photo: PhotoRecord,
		rootHandle: FileSystemDirectoryHandle,
		folderCache: Map<string, FileSystemDirectoryHandle>,
		retryAttempts: number,
		createSubdirectories: boolean = true,
		usedFilenames?: Set<string>
	): Promise<void> {
		// Download the image
		const blob = await this.downloadImageWithRetry(photo.url, retryAttempts);
		if (!blob) {
			throw new Error(`Failed to download ${photo.url}`);
		}

		// Determine file path and filename
		let folderHandle: FileSystemDirectoryHandle;
		let finalFilename = photo.filename;
		let localPath = '';

		if (createSubdirectories) {
			// Create folder structure
			const folderPath = this.getFolderPath(photo);
			folderHandle = await this.ensureFolderExists(rootHandle, folderPath, folderCache);
			localPath = `${folderPath}/${finalFilename}`;
		} else {
			// Flat structure - save all files to root directory
			folderHandle = rootHandle;
			
			// Generate unique filename if needed
			if (usedFilenames) {
				finalFilename = this.generateUniqueFilename(photo.filename, usedFilenames);
			}
			localPath = finalFilename;
		}

		// Create file and write
		const fileHandle = await folderHandle.getFileHandle(finalFilename, { create: true });
		const writable = await fileHandle.createWritable();
		
		await writable.write(blob);
		await writable.close();

		// Update photo record with local path
		await databaseService.updatePhoto({
			id: photo.id,
			localPath
		});

		this.postFileWritten({
			filename: finalFilename,
			path: localPath,
			size: blob.size
		});
	}

	private async downloadWithZipFallback(
		photos: PhotoRecord[],
		options: {
			concurrentDownloads: number;
			batchSize: number;
			retryAttempts: number;
			addExifMetadata: boolean;
			createSubdirectories: boolean;
		}
	): Promise<void> {
		// Import JSZip dynamically to avoid loading it unless needed
		const JSZip = (await import('jszip')).default;
		const zip = new JSZip();

		const { concurrentDownloads, batchSize, retryAttempts, createSubdirectories } = options;
		const usedFilenames = new Set<string>(); // Track used filenames for flat structure

		// Process photos in batches
		for (let i = 0; i < photos.length; i += batchSize) {
			const batch = photos.slice(i, i + batchSize);
			
			// Download batch concurrently
			const downloadPromises = batch.map(photo =>
				this.downloadImageWithRetry(photo.url, retryAttempts)
			);

			const results = await this.processConcurrentDownloads(downloadPromises, concurrentDownloads);

			// Add successful downloads to ZIP
			for (let j = 0; j < results.length; j++) {
				const blob = results[j];
				const photo = batch[j];
				
				if (blob) {
					let zipPath: string;
					let finalFilename = photo.filename;
					
					if (createSubdirectories) {
						const folderPath = this.getFolderPath(photo);
						zipPath = `${folderPath}/${finalFilename}`;
					} else {
						finalFilename = this.generateUniqueFilename(photo.filename, usedFilenames);
						zipPath = finalFilename;
					}
					
					zip.file(zipPath, blob);
					this.downloadedImages++;
					
					await databaseService.updatePhoto({
						id: photo.id,
						downloadStatus: 'downloaded'
					});
				} else {
					this.failedImages++;
					
					await databaseService.updatePhoto({
						id: photo.id,
						downloadStatus: 'failed'
					});
				}

				this.postProgress('📥 Downloading images...', photo.filename);
			}
		}

		// Generate ZIP
		this.postProgress('📦 Creating ZIP file...');
		const zipBlob = await zip.generateAsync({
			type: 'blob',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 }
		});

		// Send ZIP blob back to main thread
		this.postComplete({
			queueId: this.currentQueueId,
			totalImages: this.totalImages,
			downloadedImages: this.downloadedImages,
			failedImages: this.failedImages,
			zipBlob,
			processingTime: Date.now() - this.startTime
		});
	}

	private async downloadImageWithRetry(url: string, retryAttempts: number): Promise<Blob | null> {
		for (let attempt = 0; attempt <= retryAttempts; attempt++) {
			try {
				const response = await fetch(url);
				
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const contentType = response.headers.get('content-type') || '';
				if (!contentType.startsWith('image/')) {
					throw new Error(`Invalid content type: ${contentType}`);
				}

				return await response.blob();

			} catch (error) {
				console.warn(`Attempt ${attempt + 1} failed for ${url}:`, error);
				
				if (attempt === retryAttempts) {
					return null;
				}

				// Exponential backoff
				await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
			}
		}

		return null;
	}

	private async processConcurrentDownloads<T>(
		promises: Promise<T>[],
		concurrency: number
	): Promise<T[]> {
		const results: T[] = [];
		
		for (let i = 0; i < promises.length; i += concurrency) {
			const batch = promises.slice(i, i + concurrency);
			const batchResults = await Promise.allSettled(batch);
			
			for (const result of batchResults) {
				if (result.status === 'fulfilled') {
					results.push(result.value);
				} else {
					results.push(null as any);
				}
			}
		}
		
		return results;
	}

	private getFolderPath(photo: PhotoRecord): string {
		if (photo.chatId) {
			// Chat photo: organize by chat and date
			const date = photo.timestamp ? new Date(photo.timestamp) : new Date();
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			return `chats/${this.sanitizeFilename(photo.chatId)}/${year}-${month}`;
		} else if (photo.albumId) {
			// Album photo: organize by album
			return `albums/${this.sanitizeFilename(photo.albumId)}`;
		} else {
			return 'photos';
		}
	}

	private async ensureFolderExists(
		rootHandle: FileSystemDirectoryHandle,
		folderPath: string,
		cache: Map<string, FileSystemDirectoryHandle>
	): Promise<FileSystemDirectoryHandle> {
		if (cache.has(folderPath)) {
			return cache.get(folderPath)!;
		}

		const pathParts = folderPath.split('/');
		let currentHandle = rootHandle;

		for (const part of pathParts) {
			if (part) {
				currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
			}
		}

		cache.set(folderPath, currentHandle);
		return currentHandle;
	}

	private sanitizeFilename(filename: string): string {
		return filename
			.replace(/[<>:"/\\|?*]/g, '_')
			.replace(/\s+/g, ' ')
			.trim()
			.substring(0, 100);
	}

	private generateUniqueFilename(filename: string, existingNames: Set<string>): string {
		const baseName = filename;
		const extension = baseName.substring(baseName.lastIndexOf('.'));
		const nameWithoutExt = baseName.substring(0, baseName.lastIndexOf('.'));
		
		let uniqueName = baseName;
		let counter = 1;
		
		while (existingNames.has(uniqueName)) {
			uniqueName = `${nameWithoutExt}_${counter}${extension}`;
			counter++;
		}
		
		existingNames.add(uniqueName);
		return uniqueName;
	}

	private async waitForSlot(semaphore: any[]): Promise<void> {
		while (!semaphore.includes(null)) {
			await new Promise(resolve => setTimeout(resolve, 10));
		}
	}
}

// Worker message handler
const downloader = new ImageDownloader();

self.onmessage = async (event: MessageEvent<DownloadWorkerCommand>) => {
	const { type, archiveId, photoIds, options } = event.data;
	
	if (type === 'DOWNLOAD_IMAGES') {
		await downloader.downloadImages(archiveId, photoIds, options);
	}
};

// Export for testing
export { ImageDownloader };