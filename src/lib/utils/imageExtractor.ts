import { decodeWindows1251 } from './encoding';
import type { ArchiveData } from '$lib/stores/archive';
import JSZip from 'jszip';

export interface ImageInfo {
	url: string;
	chatName: string;
	chatId: string;
	timestamp: Date;
	filename: string;
	messageId: string;
	originalFilename?: string;
	senderName?: string;
	senderId?: string;
}

export interface ImageExtractionProgress {
	currentChat: string;
	processedChats: number;
	totalChats: number;
	foundImages: number;
	currentStep: string;
}

/**
 * Extract image URLs from VK message HTML content
 * @param htmlContent - The raw HTML content from VK message files
 * @param chatName - Name of the chat for organization
 * @param chatId - ID of the chat
 * @returns Array of ImageInfo objects
 */
export function extractImagesFromHtml(htmlContent: string, chatName: string, chatId: string): ImageInfo[] {
	const images: ImageInfo[] = [];
	const parser = new DOMParser();
	
	try {
		const doc = parser.parseFromString(htmlContent, 'text/html');
		
		// Find all message elements
		const messageElements = doc.querySelectorAll('.message[data-id]');
		
		for (const messageElement of messageElements) {
			const messageId = messageElement.getAttribute('data-id') || '';
			
			// Extract timestamp and sender from message header
			const headerElement = messageElement.querySelector('.message__header');
			const headerText = headerElement?.textContent || '';
			const timestamp = parseMessageTimestamp(headerText);
			// Extract sender name from header text (format: "Name, date...")
			const senderName = headerText.split(',')[0]?.trim() || undefined;
			const senderId = undefined; // VK doesn't expose user IDs in HTML
			
			// Look for image links in attachment elements
			const attachmentLinks = messageElement.querySelectorAll('.attachment__link');
			
			for (const link of attachmentLinks) {
				const href = link.getAttribute('href') || link.textContent?.trim() || '';
				
				// Check if this is an image URL (VK CDN patterns)
				if (isImageUrl(href)) {
					const filename = generateImageFilename(timestamp, messageId, href);
					
					images.push({
						url: href,
						chatName,
						chatId,
						timestamp,
						filename,
						messageId,
						originalFilename: extractOriginalFilename(href),
						senderName,
						senderId
					});
				}
			}
			
			// Also check for img tags directly (alternative format)
			const imgElements = messageElement.querySelectorAll('img[src]');
			for (const img of imgElements) {
				const src = img.getAttribute('src') || '';
				
				if (isImageUrl(src)) {
					const filename = generateImageFilename(timestamp, messageId, src);
					
					images.push({
						url: src,
						chatName,
						chatId,
						timestamp,
						filename,
						messageId,
						originalFilename: extractOriginalFilename(src),
						senderName,
						senderId
					});
				}
			}
		}
	} catch (error) {
		console.warn('Error parsing HTML for images:', error);
	}
	
	return images;
}

/**
 * Extract images from selected chats with progress tracking
 * @param archiveData - Archive data containing ZIP file
 * @param selectedChatIds - Array of chat IDs to process
 * @param onProgress - Progress callback function
 * @returns Promise resolving to array of all found images
 */
export async function extractImagesFromChats(
	archiveData: ArchiveData,
	selectedChatIds: string[],
	onProgress?: (progress: ImageExtractionProgress) => void
): Promise<ImageInfo[]> {
	if (!archiveData.zip) {
		throw new Error('Archive ZIP file not available');
	}
	
	const allImages: ImageInfo[] = [];
	const totalChats = selectedChatIds.length;
	
	for (let i = 0; i < selectedChatIds.length; i++) {
		const chatId = selectedChatIds[i];
		const chat = archiveData.chats.find(c => c.id === chatId);
		const chatName = chat?.name || `Chat ${chatId}`;
		
		onProgress?.({
			currentChat: chatName,
			processedChats: i,
			totalChats,
			foundImages: allImages.length,
			currentStep: `Processing ${chatName}...`
		});
		
		// Find all message files for this chat
		const messageFiles = Object.keys(archiveData.zip.files).filter(filename =>
			filename.startsWith(`messages/${chatId}/`) &&
			filename.includes('/messages') &&
			filename.endsWith('.html')
		);
		
		// Process each message file
		for (const messageFile of messageFiles) {
			try {
				const file = archiveData.zip.file(messageFile);
				if (!file) continue;
				
				const buffer = await file.async('arraybuffer');
				const htmlContent = decodeWindows1251(buffer);
				
				const chatImages = extractImagesFromHtml(htmlContent, chatName, chatId);
				allImages.push(...chatImages);
				
				// Update progress with new image count
				onProgress?.({
					currentChat: chatName,
					processedChats: i,
					totalChats,
					foundImages: allImages.length,
					currentStep: `Found ${chatImages.length} images in ${messageFile.split('/').pop()}`
				});
				
			} catch (error) {
				console.warn(`Error processing message file ${messageFile}:`, error);
			}
		}
	}
	
	// Final progress update
	onProgress?.({
		currentChat: 'Complete',
		processedChats: totalChats,
		totalChats,
		foundImages: allImages.length,
		currentStep: `Found ${allImages.length} total images`
	});
	
	return allImages;
}

/**
 * Check if a URL is likely an image
 */
function isImageUrl(url: string): boolean {
	if (!url || typeof url !== 'string') return false;
	
	// VK CDN domains
	const vkCdnPatterns = [
		/sun\d+-\d+\.userapi\.com/,
		/psv4\.userapi\.com/,
		/impg/
	];
	
	// Check if URL matches VK CDN patterns
	const isVkCdn = vkCdnPatterns.some(pattern => pattern.test(url));
	
	// Common image extensions
	const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i;
	
	// VK specific image URL patterns
	const vkImagePatterns = /\.(jpg|jpeg|png|gif|webp)(\?size=|&size=|$)/i;
	
	return isVkCdn && (imageExtensions.test(url) || vkImagePatterns.test(url));
}

/**
 * Parse timestamp from VK message header text
 */
function parseMessageTimestamp(headerText: string): Date {
	// Extract date from VK header format: "Имя Пользователя, 13 июн 2019 в 13:30:27"
	const dateMatch = headerText.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})\s+в\s+(\d{1,2}):(\d{2}):(\d{2})/i);
	
	if (dateMatch) {
		const [, day, monthName, year, hour, minute, second] = dateMatch;
		
		// Russian month names to numbers
		const months: { [key: string]: number } = {
			'янв': 0, 'января': 0,
			'фев': 1, 'февраля': 1,
			'мар': 2, 'марта': 2,
			'апр': 3, 'апреля': 3,
			'май': 4, 'мая': 4,
			'июн': 5, 'июня': 5,
			'июл': 6, 'июля': 6,
			'авг': 7, 'августа': 7,
			'сен': 8, 'сентября': 8,
			'окт': 9, 'октября': 9,
			'ноя': 10, 'ноября': 10,
			'дек': 11, 'декабря': 11
		};
		
		const monthNumber = months[monthName.toLowerCase()];
		if (monthNumber !== undefined) {
			return new Date(
				parseInt(year),
				monthNumber,
				parseInt(day),
				parseInt(hour),
				parseInt(minute),
				parseInt(second)
			);
		}
	}
	
	// Fallback to current date if parsing fails
	return new Date();
}

/**
 * Generate a unique filename for an image
 */
function generateImageFilename(timestamp: Date, messageId: string, url: string): string {
	// Format: YYYYMMDD_HHMMSS_messageId_original.extension
	const year = timestamp.getFullYear();
	const month = String(timestamp.getMonth() + 1).padStart(2, '0');
	const day = String(timestamp.getDate()).padStart(2, '0');
	const hour = String(timestamp.getHours()).padStart(2, '0');
	const minute = String(timestamp.getMinutes()).padStart(2, '0');
	const second = String(timestamp.getSeconds()).padStart(2, '0');
	
	const datePrefix = `${year}${month}${day}_${hour}${minute}${second}`;
	
	// Extract file extension from URL
	const extensionMatch = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(?:\?|$)/i);
	const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpg';
	
	// Truncate message ID if too long
	const shortMessageId = messageId.length > 8 ? messageId.substring(0, 8) : messageId;
	
	return `${datePrefix}_${shortMessageId}.${extension}`;
}

/**
 * Extract original filename from VK URL if available
 */
function extractOriginalFilename(url: string): string | undefined {
	// VK sometimes includes original filename in URL parameters
	const filenameMatch = url.match(/filename=([^&]+)/);
	if (filenameMatch) {
		return decodeURIComponent(filenameMatch[1]);
	}
	
	// Extract from path
	const pathMatch = url.match(/\/([^\/\?]+\.(jpg|jpeg|png|gif|webp|bmp))(?:\?|$)/i);
	if (pathMatch) {
		return pathMatch[1];
	}
	
	return undefined;
}