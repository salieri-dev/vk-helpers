import JSZip from 'jszip';
import { decodeWindows1251 } from './encoding';
import type { ChatInfo, AlbumInfo } from '$lib/stores/archive';

/**
 * Fast extraction of chat list from index file only
 * This is much faster than the full chat extraction
 */
export async function extractChatListFromIndex(zip: JSZip): Promise<ChatInfo[]> {
	const chats: ChatInfo[] = [];
	
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
	
	// Extract chat links - they should be in the format: <peer_id>/messages0.html
	const chatLinks = doc.querySelectorAll('a[href*="messages"]');
	
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
	}
	
	return chats.sort((a, b) => {
		// Sort by name for now since we don't have lastMessage dates
		return a.name.localeCompare(b.name);
	});
}

/**
 * Fast extraction of album list from index file only
 * This is much faster than full album parsing
 */
export async function extractAlbumListFromIndex(zip: JSZip): Promise<AlbumInfo[]> {
	const albums: AlbumInfo[] = [];
	
	try {
		// Look for the photo albums index file
		const indexFile = zip.file('photos/photo-albums.html');
		if (!indexFile) {
			// No albums found, return empty array
			return albums;
		}

		// Read and decode the index file
		const indexBuffer = await indexFile.async('arraybuffer');
		const indexContent = decodeWindows1251(indexBuffer);
		
		// Parse the HTML to extract album information
		const parser = new DOMParser();
		const doc = parser.parseFromString(indexContent, 'text/html');
		
		// Look for album links - they should reference album HTML files
		const albumLinks = doc.querySelectorAll('a[href$=".html"]');
		
		for (const link of albumLinks) {
			const href = link.getAttribute('href');
			if (!href) continue;
			
			const albumName = link.textContent?.trim() || 'Unnamed Album';
			let albumId = href.replace('.html', '');
			
			// Clean up albumId - remove photo-albums/ prefix if present
			if (albumId.startsWith('photo-albums/')) {
				albumId = albumId.replace('photo-albums/', '');
			}
			
			console.log(`🔍 IndexParser - href: ${href}, cleaned albumId: ${albumId}`);
			
			// Count photos by looking for the album file in ZIP
			const albumFile = zip.file(`photos/${href}`);
			let photoCount = 0;
			
			// Skip albums that don't have corresponding files
			if (!albumFile) {
				console.log(`⚠️ Skipping album "${albumName}" - no file found for ${href}`);
				continue;
			}
			
			if (albumFile) {
				try {
					// Quick scan to estimate photo count without full parsing
					const albumBuffer = await albumFile.async('arraybuffer');
					const albumContent = decodeWindows1251(albumBuffer);
					
					// Count photo references in the HTML using same patterns as albumParser
					let photoMatches = albumContent.match(/<div class="item">[\s\S]*?<a href="https:\/\/vk\.com\/photo.*?"><img src=".*?" alt=".*?"><\/a>/g);
					photoCount = photoMatches ? photoMatches.length : 0;
					
					console.log(`📸 IndexParser - Album ${albumId}: found ${photoCount} photos`);
				} catch (error) {
					console.warn(`Failed to parse album ${href}:`, error);
				}
			}
			
			albums.push({
				id: albumId,
				name: albumName,
				photoCount,
				createdAt: null, // Will be populated on-demand
				updatedAt: null, // Will be populated on-demand
				filename: href
			});
		}
		
		return albums.sort((a, b) => a.name.localeCompare(b.name));
		
	} catch (error) {
		console.warn('Failed to extract album list from index:', error);
		return albums;
	}
}

/**
 * Generate analytics ID for caching
 */
export function generateAnalyticsId(archiveId: string, chatIds: string[], type: string): string {
	const sortedChatIds = [...chatIds].sort().join(',');
	return `${archiveId}_${type}_${btoa(sortedChatIds).replace(/[/+=]/g, '')}`;
}

/**
 * Check if analytics cache is still valid
 */
export function isAnalyticsCacheValid(validUntil: Date): boolean {
	return validUntil > new Date();
}