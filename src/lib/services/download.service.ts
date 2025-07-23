/**
 * Download Service
 * High-level service for managing image downloads
 * Orchestrates workers, file system operations, and progress tracking
 */
import { progressStore, trackImageDownload } from '../stores/progress';
import { databaseService } from '../db/database';
import { fileSystemService } from './filesystem.service';
import { addExifMetadata as processExifMetadata } from '../utils/exifProcessor';
import type { ImageInfo } from '../utils/imageExtractor';
import type {
	DownloadWorkerCommand,
	DownloadWorkerResponse,
	DownloadOptions,
	FileWriteData
} from '../workers/worker-types';
import type { PhotoRecord } from '../db/schema';

export interface DownloadRequest {
	archiveId: string;
	photoIds: string[];
	options: DownloadServiceOptions;
}

export interface DownloadServiceOptions {
	useFileSystem?: boolean;
	directoryHandle?: FileSystemDirectoryHandle;
	concurrentDownloads?: number;
	batchSize?: number;
	retryAttempts?: number;
	addExifMetadata?: boolean;
	createSubdirectories?: boolean;
	createProgressLog?: boolean;
}

export interface DownloadResult {
	queueId: string;
	totalImages: number;
	downloadedImages: number;
	failedImages: number;
	failedUrls?: string[]; // For compatibility with ZIP download results
	downloadPath?: string;
	zipBlob?: Blob;
	processingTime: number;
}

export class DownloadService {
	private static instance: DownloadService;
	private worker: Worker | null = null;
	private currentOperationId: string | null = null;
	private progressLogHandle: FileSystemFileHandle | null = null;

	static getInstance(): DownloadService {
		if (!DownloadService.instance) {
			DownloadService.instance = new DownloadService();
		}
		return DownloadService.instance;
	}

	/**
	 * Initialize the download worker
	 */
	private initWorker(): Worker {
		if (this.worker) {
			return this.worker;
		}

		this.worker = new Worker(
			new URL('../workers/download.worker.ts', import.meta.url),
			{ type: 'module' }
		);

		this.worker.onmessage = (event: MessageEvent<DownloadWorkerResponse>) => {
			if (!this.currentOperationId) return;

			const { type, data } = event.data;

			switch (type) {
				case 'PROGRESS':
					progressStore.updateOperationProgress(this.currentOperationId, data as any);
					break;

				case 'FILE_WRITTEN':
					this.handleFileWritten(data as FileWriteData);
					break;

				case 'COMPLETE':
					const completionData = data as any;
					progressStore.completeOperation(this.currentOperationId, completionData);
					this.currentOperationId = null;
					this.progressLogHandle = null;
					break;

				case 'ERROR':
					const errorData = data as any;
					progressStore.errorOperation(this.currentOperationId, errorData.message);
					this.currentOperationId = null;
					this.progressLogHandle = null;
					break;
			}
		};

		this.worker.onerror = (error) => {
			console.error('Download worker error:', error);
			if (this.currentOperationId) {
				progressStore.errorOperation(this.currentOperationId, 'Worker error occurred');
				this.currentOperationId = null;
			}
		};

		return this.worker;
	}

	/**
	 * Start downloading images
	 */
	async downloadImages(request: DownloadRequest): Promise<DownloadResult> {
		const { archiveId, photoIds, options } = request;

		// Validate photos exist
		if (photoIds.length === 0) {
			throw new Error('No photos selected for download');
		}

		// Get photos from database to validate they exist
		const photos = await this.getPhotosForDownload(archiveId, photoIds);
		if (photos.length === 0) {
			throw new Error('No valid photos found for download');
		}

		// Check File System Access API support if requested
		if (options.useFileSystem && !fileSystemService.isSupported()) {
			throw new Error('File System Access API is not supported in this browser');
		}

		// Request directory if using File System API and no handle provided
		let directoryHandle = options.directoryHandle;
		if (options.useFileSystem && !directoryHandle) {
			const pickedHandle = await fileSystemService.pickDirectory();
			if (!pickedHandle) {
				throw new Error('No directory selected');
			}
			directoryHandle = pickedHandle;
		}

		// Create progress log if requested
		if (options.createProgressLog && directoryHandle) {
			const archive = await databaseService.getArchive(archiveId);
			if (archive) {
				this.progressLogHandle = await fileSystemService.createProgressLog(
					directoryHandle,
					archive.filename
				);
			}
		}

		// Start progress tracking
		this.currentOperationId = trackImageDownload(photos.length, !!options.useFileSystem);

		// Initialize worker
		const worker = this.initWorker();

		// Prepare worker options (exclude directoryHandle from serialized data)
		const workerOptions: DownloadOptions = {
			useFileSystem: options.useFileSystem || false,
			concurrentDownloads: options.concurrentDownloads || 3,
			batchSize: options.batchSize || 10,
			retryAttempts: options.retryAttempts || 2,
			addExifMetadata: options.addExifMetadata || false,
			createSubdirectories: options.createSubdirectories !== false // Default to true
		};

		// Send command to worker
		const command: DownloadWorkerCommand = {
			type: 'DOWNLOAD_IMAGES',
			archiveId,
			photoIds,
			options: workerOptions,
			directoryHandle: directoryHandle // Pass handle separately for transfer
		};

		// FileSystemDirectoryHandle cannot be transferred to workers
		// For File System Access downloads, don't use worker
		if (options.useFileSystem && directoryHandle) {
			// Handle File System Access API downloads directly in main thread
			// This is a temporary workaround until we redesign the worker communication
			return this.downloadImagesDirectly(archiveId, photoIds, directoryHandle, {
				...options,
				concurrentDownloads: options.concurrentDownloads || 3,
				batchSize: options.batchSize || 10,
				retryAttempts: options.retryAttempts || 2,
				addExifMetadata: options.addExifMetadata || false,
				createSubdirectories: options.createSubdirectories !== false // Default to true
			});
		}

		// For ZIP downloads (no directoryHandle), use worker
		worker.postMessage(command, []);

		// Return a promise that resolves when download completes
		return new Promise((resolve, reject) => {
			const checkComplete = () => {
				const operation = progressStore.getOperation(this.currentOperationId!);
				if (!operation) {
					reject(new Error('Operation not found'));
					return;
				}

				if (operation.status === 'complete' && operation.metadata?.result) {
					resolve(operation.metadata.result);
				} else if (operation.status === 'error') {
					reject(new Error(operation.error || 'Download failed'));
				} else {
					// Check again in 100ms
					setTimeout(checkComplete, 100);
				}
			};

			// Start checking after a brief delay
			setTimeout(checkComplete, 100);
		});
	}

	/**
	 * Handle file written notification
	 */
	private async handleFileWritten(data: FileWriteData): Promise<void> {
		// Log to progress file if available
		if (this.progressLogHandle) {
			const message = `Downloaded: ${data.filename} (${this.formatFileSize(data.size)}) -> ${data.path}`;
			await fileSystemService.logProgress(this.progressLogHandle, message);
		}
	}

	/**
	 * Get photos for download with filtering
	 */
	private async getPhotosForDownload(archiveId: string, photoIds: string[]): Promise<PhotoRecord[]> {
		const allPhotos = await databaseService.getPhotosByArchive(archiveId);
		const matchingPhotos = allPhotos.filter(photo =>
			photoIds.includes(photo.id)
		);

		// Reset any existing photos to pending status for re-download
		for (const photo of matchingPhotos) {
			if (photo.downloadStatus !== 'pending') {
				await databaseService.updatePhoto({
					id: photo.id,
					downloadStatus: 'pending'
				});
				photo.downloadStatus = 'pending';
			}
		}

		return matchingPhotos;
	}

	/**
	 * Get available photos for download
	 */
	async getAvailablePhotos(archiveId: string, filters?: {
		chatIds?: string[];
		albumIds?: string[];
		dateRange?: { start: Date; end: Date };
	}): Promise<PhotoRecord[]> {
		let photos = await databaseService.getPhotosByArchive(archiveId);
		
		// Filter to only pending downloads
		photos = photos.filter(photo => photo.downloadStatus === 'pending');
		
		// Apply additional filters
		if (filters) {
			if (filters.chatIds && filters.chatIds.length > 0) {
				photos = photos.filter(photo => 
					photo.chatId && filters.chatIds!.includes(photo.chatId)
				);
			}
			
			if (filters.albumIds && filters.albumIds.length > 0) {
				photos = photos.filter(photo => 
					photo.albumId && filters.albumIds!.includes(photo.albumId)
				);
			}
			
			if (filters.dateRange) {
				photos = photos.filter(photo => {
					if (!photo.timestamp) return false;
					const photoDate = new Date(photo.timestamp);
					return photoDate >= filters.dateRange!.start && photoDate <= filters.dateRange!.end;
				});
			}
		}
		
		return photos;
	}

	/**
	 * Get download statistics
	 */
	async getDownloadStats(archiveId: string): Promise<{
		total: number;
		pending: number;
		downloaded: number;
		failed: number;
		totalSize: number;
	}> {
		const photos = await databaseService.getPhotosByArchive(archiveId);
		
		return {
			total: photos.length,
			pending: photos.filter(p => p.downloadStatus === 'pending').length,
			downloaded: photos.filter(p => p.downloadStatus === 'downloaded').length,
			failed: photos.filter(p => p.downloadStatus === 'failed').length,
			totalSize: photos.reduce((sum, photo) => sum + (photo.filesize || 0), 0)
		};
	}

	/**
	 * Reset failed downloads back to pending
	 */
	async retryFailedDownloads(archiveId: string): Promise<number> {
		const photos = await databaseService.getPhotosByArchive(archiveId);
		const failedPhotos = photos.filter(p => p.downloadStatus === 'failed');
		
		for (const photo of failedPhotos) {
			await databaseService.updatePhoto({
				id: photo.id,
				downloadStatus: 'pending'
			});
		}
		
		return failedPhotos.length;
	}

	/**
	 * Cancel current download operation
	 */
	cancelDownload(): void {
		if (this.currentOperationId) {
			progressStore.cancelOperation(this.currentOperationId);
			this.currentOperationId = null;
		}

		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}

		this.progressLogHandle = null;
	}

	/**
	 * Direct download method for File System Access API (bypasses worker)
	 * This is used because FileSystemDirectoryHandle cannot be transferred to workers
	 */
	private async downloadImagesDirectly(
		archiveId: string,
		photoIds: string[],
		directoryHandle: FileSystemDirectoryHandle,
		options: {
			concurrentDownloads: number;
			batchSize: number;
			retryAttempts: number;
			addExifMetadata: boolean;
			createSubdirectories: boolean;
		}
	): Promise<DownloadResult> {
		const startTime = Date.now();

		// Get photos from database
		const photos = await this.getPhotosForDownload(archiveId, photoIds);
		if (photos.length === 0) {
			throw new Error('No valid photos found for download');
		}

		// Update progress
		progressStore.updateOperationProgress(this.currentOperationId!, {
			step: 'Downloading images with File System Access API',
			percentage: 0,
			processed: 0,
			total: photos.length,
			currentItem: 'Starting download...'
		});

		let downloadedImages = 0;
		let failedImages = 0;
		const failedUrls: string[] = [];
		const usedFilenames = new Set<string>(); // Track used filenames for flat structure

		// Process photos in batches
		for (let i = 0; i < photos.length; i += options.batchSize) {
			const batch = photos.slice(i, i + options.batchSize);
			
			await Promise.allSettled(
				batch.map(async (photo) => {
					try {
						await this.downloadSinglePhoto(photo, directoryHandle, options.retryAttempts, options.addExifMetadata, options.createSubdirectories, usedFilenames);
						downloadedImages++;
						
						// Update progress
						progressStore.updateOperationProgress(this.currentOperationId!, {
							step: 'Downloading images',
							percentage: Math.round((downloadedImages / photos.length) * 100),
							processed: downloadedImages,
							total: photos.length,
							currentItem: photo.filename
						});
						
					} catch (error) {
						failedImages++;
						failedUrls.push(photo.url);
						console.error(`Failed to download ${photo.filename}:`, error);
					}
				})
			);
		}

		const processingTime = Date.now() - startTime;

		return {
			queueId: this.currentOperationId!,
			totalImages: photos.length,
			downloadedImages,
			failedImages,
			failedUrls,
			processingTime
		};
	}

	/**
	 * Download a single photo using File System Access API
	 */
	private async downloadSinglePhoto(
		photo: PhotoRecord,
		rootHandle: FileSystemDirectoryHandle,
		retryAttempts: number,
		addExifMetadata: boolean,
		createSubdirectories: boolean = true,
		usedFilenames?: Set<string>
	): Promise<void> {
		let attempt = 0;
		let lastError: Error | null = null;

		while (attempt <= retryAttempts) {
			try {
				// Fetch the image
				const response = await fetch(photo.url);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				let blob = await response.blob();

				// Process EXIF metadata if requested
				if (addExifMetadata && photo.timestamp) {
					try {
						// Create ImageInfo object for EXIF processing
						const imageInfo: ImageInfo = {
							filename: photo.filename,
							timestamp: photo.timestamp,
							messageId: photo.photoId, // Use photoId as messageId
							chatName: photo.chatId || 'Unknown Chat',
							chatId: photo.chatId || 'unknown',
							url: photo.url
						};

						// Add EXIF metadata to the image
						blob = await processExifMetadata(blob, imageInfo, {
							includeChat: true,
							includeMessageId: true
						});
					} catch (exifError) {
						// Log the error but continue with the original blob
						console.warn(`Failed to add EXIF metadata to ${photo.filename}:`, exifError);
					}
				}

				// Determine file path and filename
				let folderHandle: FileSystemDirectoryHandle;
				let finalFilename = photo.filename;
				let localPath = '';

				if (createSubdirectories) {
					// Create subdirectory structure (use chat folder if available)
					const folderName = photo.chatId || 'images';
					try {
						folderHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });
						localPath = `${folderName}/${finalFilename}`;
					} catch (error) {
						// If folder creation fails, save to root
						folderHandle = rootHandle;
						localPath = finalFilename;
					}
				} else {
					// Flat structure - save all files to root directory
					folderHandle = rootHandle;
					
					// Generate unique filename if needed
					if (usedFilenames) {
						finalFilename = this.generateUniqueFilename(photo.filename, usedFilenames);
					}
					localPath = finalFilename;
				}

				// Create and write file
				const fileHandle = await folderHandle.getFileHandle(finalFilename, { create: true });
				const writable = await fileHandle.createWritable();
				
				await writable.write(blob);
				await writable.close();

				// Update photo status in database
				await databaseService.updatePhoto({
					id: photo.id,
					downloadStatus: 'downloaded',
					localPath: localPath
				});

				return; // Success!

			} catch (error) {
				lastError = error as Error;
				attempt++;
				
				if (attempt <= retryAttempts) {
					// Wait before retry (exponential backoff)
					await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
				}
			}
		}

		// All attempts failed
		await databaseService.updatePhoto({
			id: photo.id,
			downloadStatus: 'failed'
		});

		throw lastError || new Error('Unknown download error');
	}

	/**
	 * Check if File System Access API is supported
	 */
	isFileSystemSupported(): boolean {
		return fileSystemService.isSupported();
	}

	/**
	 * Show directory picker
	 */
	async pickDownloadDirectory(): Promise<FileSystemDirectoryHandle | null> {
		return await fileSystemService.pickDirectory();
	}

	/**
	 * Format file size for display
	 */
	private formatFileSize(bytes: number): string {
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = bytes;
		let unitIndex = 0;
		
		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}
		
		return `${size.toFixed(1)} ${units[unitIndex]}`;
	}

	/**
		* Generate a unique filename when not using subdirectories
		*/
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

	/**
		* Cleanup resources
		*/
	destroy(): void {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
		this.currentOperationId = null;
		this.progressLogHandle = null;
	}
}

// Export singleton instance
export const downloadService = DownloadService.getInstance();

// Helper functions
export async function canUseFileSystemAPI(): Promise<boolean> {
	return fileSystemService.isSupported();
}

export async function estimateDownloadSize(photoIds: string[]): Promise<number> {
	// This would require photo metadata - simplified for now
	return photoIds.length * 2 * 1024 * 1024; // Estimate 2MB per photo
}

export function getOptimalBatchSize(totalImages: number, memoryLimit: number = 256 * 1024 * 1024): number {
	// Calculate optimal batch size based on estimated memory usage
	const avgImageSize = 2 * 1024 * 1024; // 2MB per image
	const maxImagesInMemory = Math.floor(memoryLimit / avgImageSize);
	return Math.min(Math.max(maxImagesInMemory, 5), 50); // Between 5 and 50 images
}