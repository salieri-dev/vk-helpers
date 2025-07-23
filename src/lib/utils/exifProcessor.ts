import piexif from 'piexifjs';
import type { ImageInfo } from './imageExtractor';
import { cleanForExif, transliterateCyrillic } from './transliterator';

export interface ExifOptions {
	includeChat?: boolean;
	includeMessageId?: boolean;
}

/**
 * Add EXIF metadata to an image blob with message timestamp and VK context
 * @param imageBlob - Original image blob
 * @param imageInfo - Message and timestamp information
 * @param options - What metadata to include
 * @returns New blob with EXIF metadata
 */
export async function addExifMetadata(
	imageBlob: Blob, 
	imageInfo: ImageInfo, 
	options: ExifOptions = {}
): Promise<Blob> {
	const { includeChat = true, includeMessageId = true } = options;
	
	try {
		// Only process JPEG images as EXIF is primarily for JPEG
		if (!imageBlob.type.includes('jpeg') && !imageBlob.type.includes('jpg')) {
			console.log(`Skipping EXIF for non-JPEG image: ${imageInfo.filename}`);
			return imageBlob;
		}

		// Convert blob to data URL for piexifjs
		const originalDataUrl = await blobToDataUrl(imageBlob);
		// Strip existing EXIF data to prevent encoding issues
		const dataUrl = piexif.remove(originalDataUrl);
		
		// Create a minimal EXIF structure with only essential fields
		const timestamp = imageInfo.timestamp;
		const exifDateString = formatDateForExif(timestamp);
		
		// Create comprehensive VK metadata with transliteration
		const metadata: string[] = [];
		
		// Transliterate chat name
		const transliteratedChatName = cleanForExif(imageInfo.chatName, 30);
		
		if (includeChat) {
			metadata.push(`Chat: ${transliteratedChatName}`);
		}
		
		// Add VK-specific IDs
		if (includeMessageId) {
			metadata.push(`MsgID: ${imageInfo.messageId}`);
		}
		
		// Add chat ID
		metadata.push(`ChatID: ${imageInfo.chatId}`);
		
		// Add sender info if available
		if (imageInfo.senderName) {
			const transliteratedSender = cleanForExif(imageInfo.senderName, 25);
			metadata.push(`From: ${transliteratedSender}`);
		}
		
		// Add source URL (shortened)
		const shortUrl = imageInfo.url.length > 50 ?
			imageInfo.url.substring(0, 50) + '...' : imageInfo.url;
		// URL is cleaned to prevent invalid characters in EXIF metadata
		metadata.push(`URL: ${cleanForExif(shortUrl, 60)}`);
		
		const description = metadata.join(' | '); // Join without substring first
		
		// Clean and truncate the FINAL description string to ensure Latin1 compatibility
		const cleanDescription = cleanForExif(description, 200);
		
		// Create minimal EXIF dictionary with only well-supported fields
		const exifDict = {
			"0th": {
				[piexif.ImageIFD.DateTime]: exifDateString,
				[piexif.ImageIFD.Software]: "VK Analytics PWA",
				[piexif.ImageIFD.ImageDescription]: cleanDescription
			},
			"Exif": {
				[piexif.ExifIFD.DateTimeOriginal]: exifDateString,
				[piexif.ExifIFD.DateTimeDigitized]: exifDateString
			},
			"GPS": {},
			"1st": {},
			"thumbnail": null
		};

		// Add artist field only if chat name is provided and not too long
		if (includeChat && imageInfo.chatName.length < 50) {
			const safeArtistName = cleanForExif(imageInfo.chatName, 30);
			exifDict["0th"][piexif.ImageIFD.Artist] = safeArtistName;
		}

		// Convert to EXIF bytes and insert into image
		const exifBytes = piexif.dump(exifDict);
		const newDataUrl = piexif.insert(exifBytes, dataUrl);
		
		// Convert back to blob
		const newBlob = dataUrlToBlob(newDataUrl);
		
		return newBlob;

	} catch (error) {
		console.warn(`Failed to add EXIF metadata to ${imageInfo.filename}:`, error);
		// Return original blob if EXIF processing fails
		return imageBlob;
	}
}

/**
 * Batch process multiple images with EXIF metadata
 * @param images - Array of {blob, info} pairs
 * @param options - EXIF options
 * @param onProgress - Progress callback
 * @returns Array of processed blobs
 */
export async function batchAddExifMetadata(
	images: { blob: Blob; info: ImageInfo }[],
	options: ExifOptions = {},
	onProgress?: (processed: number, total: number) => void
): Promise<Blob[]> {
	const results: Blob[] = [];
	
	for (let i = 0; i < images.length; i++) {
		const { blob, info } = images[i];
		
		try {
			const processedBlob = await addExifMetadata(blob, info, options);
			results.push(processedBlob);
		} catch (error) {
			console.warn(`Failed to process EXIF for image ${i}:`, error);
			results.push(blob); // Use original on failure
		}
		
		onProgress?.(i + 1, images.length);
	}
	
	return results;
}

/**
 * Extract message information from existing EXIF data
 * @param imageBlob - Image blob to read EXIF from
 * @returns Extracted VK message info or null
 */
export async function extractVkInfoFromExif(imageBlob: Blob): Promise<{
	chatName?: string;
	messageId?: string;
	originalTimestamp?: Date;
	sourceUrl?: string;
} | null> {
	try {
		if (!imageBlob.type.includes('jpeg') && !imageBlob.type.includes('jpg')) {
			return null;
		}

		const dataUrl = await blobToDataUrl(imageBlob);
		const exifDict = piexif.load(dataUrl);
		
		const description = exifDict["0th"][piexif.ImageIFD.ImageDescription];
		const artist = exifDict["0th"][piexif.ImageIFD.Artist];
		const dateTime = exifDict["Exif"][piexif.ExifIFD.DateTimeOriginal];
		
		if (!description) return null;

		// Parse metadata from description
		const info: any = {};
		
		const chatMatch = description.match(/Chat: ([^|]+)/);
		if (chatMatch) info.chatName = chatMatch[1].trim();
		
		const messageIdMatch = description.match(/VK Message ID: ([^|]+)/);
		if (messageIdMatch) info.messageId = messageIdMatch[1].trim();
		
		const sourceMatch = description.match(/Source: ([^|]+)/);
		if (sourceMatch) info.sourceUrl = sourceMatch[1].trim();
		
		if (dateTime) {
			info.originalTimestamp = parseExifDate(dateTime);
		}
		
		return Object.keys(info).length > 0 ? info : null;

	} catch (error) {
		console.warn('Failed to extract VK info from EXIF:', error);
		return null;
	}
}

/**
 * Helper: Convert blob to data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

/**
 * Helper: Convert data URL to blob (with Unicode-safe base64 decoding)
 */
function dataUrlToBlob(dataUrl: string): Blob {
	const arr = dataUrl.split(',');
	const mime = arr[0].match(/:(.*?);/)![1];
	
	// Use a Unicode-safe base64 decoder instead of atob()
	const bstr = base64ToBytes(arr[1]);
	const u8arr = new Uint8Array(bstr.length);
	
	for (let i = 0; i < bstr.length; i++) {
		u8arr[i] = bstr.charCodeAt(i);
	}
	
	return new Blob([u8arr], { type: mime });
}

/**
 * Unicode-safe base64 decoder (replacement for atob)
 */
function base64ToBytes(base64: string): string {
	// Always use the manual, Unicode-safe decoder. This is more robust than atob().
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let result = '';
	let i = 0;

	// Remove padding and invalid characters
	base64 = base64.replace(/[^A-Za-z0-9+/]/g, '');

	while (i < base64.length) {
		const encoded1 = chars.indexOf(base64.charAt(i++));
		const encoded2 = chars.indexOf(base64.charAt(i++));
		const encoded3 = chars.indexOf(base64.charAt(i++));
		const encoded4 = chars.indexOf(base64.charAt(i++));

		const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;

		result += String.fromCharCode((bitmap >> 16) & 255);
		if (encoded3 !== 64) result += String.fromCharCode((bitmap >> 8) & 255);
		if (encoded4 !== 64) result += String.fromCharCode(bitmap & 255);
	}
	
	return result;
}

/**
 * Helper: Format Date for EXIF (YYYY:MM:DD HH:MM:SS)
 */
function formatDateForExif(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	const second = String(date.getSeconds()).padStart(2, '0');
	
	return `${year}:${month}:${day} ${hour}:${minute}:${second}`;
}

/**
 * Helper: Parse EXIF date string to Date object
 */
function parseExifDate(exifDate: string): Date {
	const [datePart, timePart] = exifDate.split(' ');
	const [year, month, day] = datePart.split(':').map(Number);
	const [hour, minute, second] = timePart.split(':').map(Number);
	
	return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Helper: Convert string to Uint8Array for EXIF comment field
 */
function stringToUint8Array(str: string): Uint8Array {
	const encoder = new TextEncoder();
	return encoder.encode(str);
}

/**
 * Verify EXIF data was added correctly (for debugging)
 */
export async function verifyExifData(imageBlob: Blob): Promise<{
	hasExif: boolean;
	dateTime?: string;
	description?: string;
	software?: string;
	artist?: string;
}> {
	try {
		const dataUrl = await blobToDataUrl(imageBlob);
		const exifDict = piexif.load(dataUrl);
		
		return {
			hasExif: true,
			dateTime: exifDict["Exif"][piexif.ExifIFD.DateTimeOriginal],
			description: exifDict["0th"][piexif.ImageIFD.ImageDescription],
			software: exifDict["0th"][piexif.ImageIFD.Software],
			artist: exifDict["0th"][piexif.ImageIFD.Artist]
		};
	} catch (error) {
		return { hasExif: false };
	}
}