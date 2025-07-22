import JSZip from 'jszip';
import type { ImageInfo } from './imageExtractor';
import { addExifMetadata as processExifMetadata } from './exifProcessor';

export interface DownloadProgress {
	currentImage: string;
	downloadedImages: number;
	totalImages: number;
	failedImages: number;
	currentStep: string;
	percentage: number;
	estimatedTimeRemaining?: string;
}

export interface DownloadResult {
	zipBlob: Blob;
	totalImages: number;
	downloadedImages: number;
	failedImages: number;
	failedUrls: string[];
}

export interface DownloadOptions {
	concurrentDownloads?: number;
	batchSize?: number;
	retryAttempts?: number;
	addExifMetadata?: boolean;
	onProgress?: (progress: DownloadProgress) => void;
}

/**
 * Download images and create a ZIP file
 * @param images - Array of ImageInfo objects to download
 * @param options - Download options and callbacks
 * @returns Promise resolving to DownloadResult
 */
export async function downloadImagesAsZip(
	images: ImageInfo[],
	options: DownloadOptions = {}
): Promise<DownloadResult> {
	const {
		concurrentDownloads = 3,
		batchSize = 10,
		retryAttempts = 2,
		addExifMetadata = true,
		onProgress
	} = options;

	const totalImages = images.length;
	let downloadedImages = 0;
	let failedImages = 0;
	const failedUrls: string[] = [];
	const zip = new JSZip();
	const startTime = Date.now();

	// Create folder structure
	const folderStructure = createFolderStructure(images);
	
	onProgress?.({
		currentImage: 'Initializing...',
		downloadedImages: 0,
		totalImages,
		failedImages: 0,
		currentStep: 'Starting downloads...',
		percentage: 0
	});

	// Process images in batches to manage memory
	for (let i = 0; i < images.length; i += batchSize) {
		const batch = images.slice(i, i + batchSize);
		
		// Download batch concurrently
		const downloadPromises = batch.map(image => 
			downloadImageWithRetry(image, retryAttempts)
		);

		// Process concurrent downloads within batch
		const batchResults = await processConcurrentDownloads(
			downloadPromises,
			concurrentDownloads
		);

		// Add successful downloads to ZIP
		for (let j = 0; j < batchResults.length; j++) {
			const result = batchResults[j];
			const image = batch[j];
			
			if (result.success && result.blob) {
				let finalBlob = result.blob;
				
				// Add EXIF metadata if enabled
				if (addExifMetadata) {
					try {
						finalBlob = await processExifMetadata(result.blob, image);
					} catch (error) {
						console.warn(`Failed to add EXIF to ${image.filename}:`, error);
						// Continue with original blob if EXIF fails
					}
				}
				
				// Create new File with correct timestamp for filesystem dates
				const fileWithTimestamp = new File([finalBlob], image.filename, {
					type: finalBlob.type,
					lastModified: image.timestamp.getTime() // Set file modification date to VK message timestamp
				});
				
				const folderPath = getFolderPath(image, folderStructure);
				zip.file(`${folderPath}/${image.filename}`, fileWithTimestamp);
				downloadedImages++;
			} else {
				failedImages++;
				failedUrls.push(image.url);
			}

			// Update progress
			const percentage = Math.round(((downloadedImages + failedImages) / totalImages) * 100);
			const elapsedTime = Date.now() - startTime;
			const estimatedTotal = (elapsedTime / (downloadedImages + failedImages)) * totalImages;
			const remainingTime = estimatedTotal - elapsedTime;

			onProgress?.({
				currentImage: image.filename,
				downloadedImages,
				totalImages,
				failedImages,
				currentStep: `Downloaded ${downloadedImages} of ${totalImages} images`,
				percentage,
				estimatedTimeRemaining: formatTime(remainingTime)
			});
		}
	}

	// Generate ZIP file
	onProgress?.({
		currentImage: 'Creating ZIP file...',
		downloadedImages,
		totalImages,
		failedImages,
		currentStep: 'Generating ZIP archive...',
		percentage: 100
	});

	const zipBlob = await zip.generateAsync({
		type: 'blob',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 }
	});

	return {
		zipBlob,
		totalImages,
		downloadedImages,
		failedImages,
		failedUrls
	};
}

/**
 * Download a single image with retry logic
 */
async function downloadImageWithRetry(
	image: ImageInfo,
	retryAttempts: number
): Promise<{ success: boolean; blob?: Blob; error?: string }> {
	for (let attempt = 0; attempt <= retryAttempts; attempt++) {
		try {
			const response = await fetch(image.url);
			
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			// Verify content type
			const contentType = response.headers.get('content-type') || '';
			if (!contentType.startsWith('image/')) {
				throw new Error(`Invalid content type: ${contentType}`);
			}

			const blob = await response.blob();
			return { success: true, blob };

		} catch (error) {
			console.warn(`Attempt ${attempt + 1} failed for ${image.url}:`, error);
			
			if (attempt === retryAttempts) {
				return {
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				};
			}

			// Wait before retry (exponential backoff)
			await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
		}
	}

	return { success: false, error: 'Max retries exceeded' };
}

/**
 * Process downloads with concurrency limit
 */
async function processConcurrentDownloads<T>(
	promises: Promise<T>[],
	concurrency: number
): Promise<T[]> {
	const results: T[] = [];
	
	for (let i = 0; i < promises.length; i += concurrency) {
		const batch = promises.slice(i, i + concurrency);
		const batchResults = await Promise.all(batch);
		results.push(...batchResults);
	}
	
	return results;
}

/**
 * Create organized folder structure for images
 */
function createFolderStructure(images: ImageInfo[]): Map<string, string[]> {
	const structure = new Map<string, string[]>();
	
	for (const image of images) {
		const year = image.timestamp.getFullYear();
		const month = String(image.timestamp.getMonth() + 1).padStart(2, '0');
		const chatFolder = sanitizeFilename(image.chatName);
		const monthFolder = `${year}-${month}`;
		
		const path = `${chatFolder}/${monthFolder}`;
		
		if (!structure.has(chatFolder)) {
			structure.set(chatFolder, []);
		}
		
		const months = structure.get(chatFolder)!;
		if (!months.includes(monthFolder)) {
			months.push(monthFolder);
		}
	}
	
	return structure;
}

/**
 * Get folder path for an image
 */
function getFolderPath(image: ImageInfo, structure: Map<string, string[]>): string {
	const year = image.timestamp.getFullYear();
	const month = String(image.timestamp.getMonth() + 1).padStart(2, '0');
	const chatFolder = sanitizeFilename(image.chatName);
	const monthFolder = `${year}-${month}`;
	
	return `${chatFolder}/${monthFolder}`;
}

/**
 * Sanitize filename for file system compatibility
 */
function sanitizeFilename(filename: string): string {
	return filename
		.replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
		.replace(/\s+/g, ' ')          // Normalize whitespace
		.trim()                        // Remove leading/trailing spaces
		.substring(0, 100);            // Limit length
}

/**
 * Format time in human readable format
 */
function formatTime(ms: number): string {
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

/**
 * Trigger download of the ZIP file
 */
export function downloadZipFile(zipBlob: Blob, filename: string = 'vk_images.zip'): void {
	const url = URL.createObjectURL(zipBlob);
	const link = document.createElement('a');
	
	link.href = url;
	link.download = filename;
	link.style.display = 'none';
	
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	
	// Clean up object URL after a delay
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generate filename for ZIP based on selected chats
 */
export function generateZipFilename(images: ImageInfo[]): string {
	if (images.length === 0) {
		return 'vk_images.zip';
	}
	
	// Get unique chat names
	const chatNames = [...new Set(images.map(img => img.chatName))];
	
	const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
	
	if (chatNames.length === 1) {
		const chatName = sanitizeFilename(chatNames[0]);
		return `vk_images_${chatName}_${timestamp}.zip`;
	} else {
		return `vk_images_${chatNames.length}chats_${timestamp}.zip`;
	}
}