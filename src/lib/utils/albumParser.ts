import type { AlbumInfo, PhotoInfo } from '$lib/stores/archive';
import { decodeWindows1251 } from './encoding';
import { parseVkDateString } from './dateParser';
import JSZip from 'jszip';

export async function parseAlbumsFromZip(
	zip: JSZip,
	onProgress?: (step: string, processedAlbums?: number) => void
): Promise<AlbumInfo[]> {
	const albums: AlbumInfo[] = [];
	
	onProgress?.('🔍 Looking for photo albums index...');
	
	// Look for the photo albums index file
	const albumsIndexFile = zip.file('photos/photo-albums.html');
	if (!albumsIndexFile) {
		// No albums found, return empty array
		return albums;
	}
	
	try {
		const indexContent = await albumsIndexFile.async('uint8array');
		const indexHtml = decodeWindows1251(indexContent.buffer as ArrayBuffer);
		
		onProgress?.('📋 Parsing albums index...');
		
		// Parse album entries from the index - handle both regular and special albums
		const albumMatches = indexHtml.matchAll(/<div class="item">[\s\S]*?<a href="photo-albums\/(.*?)\.html">(.*?)<\/a>([\s\S]*?)<\/div>/g);
		
		let processedCount = 0;
		for (const match of albumMatches) {
			let [fullMatch, albumId, albumName, restOfContent] = match;
			
			// Debug: Log what we're extracting BEFORE cleanup
			console.log(`🔍 Raw albumId from regex:`, albumId);
			console.log(`🔍 Full match href:`, fullMatch.match(/href="([^"]+)"/)?.[1]);
			
			// Clean up albumId - remove any photo-albums/ prefix if it exists
			const originalId = albumId;
			if (albumId.startsWith('photo-albums/')) {
				albumId = albumId.replace('photo-albums/', '');
				console.log(`🔧 Cleaned albumId from "${originalId}" to "${albumId}"`);
			}
			
			// Debug: Final values
			console.log(`✅ Final albumId:`, albumId);
			console.log(`✅ Album name:`, albumName?.trim());
			
			// Parse dates from the rest of content if they exist
			const dateMatches = restOfContent.match(/<div class='item__tertiary'>(.*?)<\/div>[\s\S]*?<div class='item__tertiary'>(.*?)<\/div>/);
			let createdAt: Date | null = null;
			let updatedAt: Date | null = null;
			
			if (dateMatches) {
				const [, createdText, updatedText] = dateMatches;
				createdAt = parseVkDateString(createdText);
				updatedAt = parseVkDateString(updatedText);
			}
			
			const album: AlbumInfo = {
				id: albumId,
				name: albumName.trim(),
				photoCount: 0, // Will be calculated when parsing individual albums
				createdAt,
				updatedAt,
				filename: `photo-albums/${albumId}.html`
			};
			
			albums.push(album);
			processedCount++;
			
			if (processedCount % 5 === 0) {
				onProgress?.(`📋 Parsing albums index... (${processedCount} found)`, processedCount);
			}
		}
		
		onProgress?.(`🔍 Counting photos in albums... (${albums.length} albums found)`, albums.length);
		
		// Count photos in each album by parsing individual album files
		for (let i = 0; i < albums.length; i++) {
			const album = albums[i];
			const filePath = `photos/${album.filename}`;
			console.log(`🔍 Counting photos in album "${album.name}" (ID: ${album.id}), looking for file: ${filePath}`);
			
			const albumFile = zip.file(filePath);
			console.log(`📁 Album file found for counting:`, !!albumFile);
			
			if (albumFile) {
				try {
					const albumContent = await albumFile.async('uint8array');
					const albumHtml = decodeWindows1251(albumContent.buffer as ArrayBuffer);
					
					// Count photo items - try both patterns
					let photoMatches = Array.from(albumHtml.matchAll(/<div class="item">[\s\S]*?<a href="(https:\/\/vk\.com\/photo.*?)"><img src="(.*?)" alt="(.*?)"><\/a>[\s\S]*?<div class='item__tertiary'><\/div><div class='item__tertiary'><div class="clear_fix">(.*?) <\/div><\/div>/g));
					
					// If no photos found with standard pattern, try simpler pattern
					if (photoMatches.length === 0) {
						photoMatches = Array.from(albumHtml.matchAll(/<div class="item">[\s\S]*?<a href="(https:\/\/vk\.com\/photo.*?)"><img src="(.*?)" alt="(.*?)"><\/a>/g));
					}
					
					album.photoCount = photoMatches.length;
				} catch (error) {
					console.warn(`Failed to parse album ${album.id}:`, error);
					album.photoCount = 0;
				}
			}
			
			if ((i + 1) % 3 === 0) {
				onProgress?.(`🔍 Counting photos... (${i + 1}/${albums.length})`, i + 1);
			}
		}
		
		return albums.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
		
	} catch (error) {
		console.error('Error parsing albums:', error);
		throw new Error(`Failed to parse photo albums: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

export async function parseAlbumPhotos(
	zip: JSZip,
	albumId: string
): Promise<PhotoInfo[]> {
	const photos: PhotoInfo[] = [];
	
	// Debug: Show what album ID we received
	console.log(`🔍 parseAlbumPhotos called with albumId:`, albumId);
	
	// Clean up the album ID - remove photo-albums/ prefix if present
	let cleanAlbumId = albumId;
	if (albumId.startsWith('photo-albums/')) {
		cleanAlbumId = albumId.replace('photo-albums/', '');
		console.log(`🔧 Cleaned albumId from "${albumId}" to "${cleanAlbumId}"`);
	}
	
	// Try both possible paths for album files
	let albumFile = zip.file(`photos/photo-albums/${cleanAlbumId}.html`);
	let searchPath = `photos/photo-albums/${cleanAlbumId}.html`;
	
	// If not found, try the path without 'photos/' prefix
	if (!albumFile) {
		albumFile = zip.file(`photo-albums/${cleanAlbumId}.html`);
		searchPath = `photo-albums/${cleanAlbumId}.html`;
	}
	
	console.log(`🔍 Looking for album file at: ${searchPath}`);
	console.log(`📁 Album file found:`, !!albumFile);
	
	// Debug: List all files in the zip that match the pattern
	const allFiles = Object.keys(zip.files);
	const albumFiles = allFiles.filter(f => f.includes(`${cleanAlbumId}.html`));
	console.log(`🔍 All files matching "${cleanAlbumId}.html":`, albumFiles);
	
	if (!albumFile) {
		throw new Error(`Album ${albumId} not found in archive. Searched: ${searchPath}. Available files: ${albumFiles.join(', ')}`);
	}
	
	try {
		const albumContent = await albumFile.async('uint8array');
		const albumHtml = decodeWindows1251(albumContent.buffer as ArrayBuffer);
		
		// Parse photo entries - handle different album structures
		let photoMatches = albumHtml.matchAll(/<div class="item">[\s\S]*?<a href="(https:\/\/vk\.com\/photo.*?)"><img src="(.*?)" alt="(.*?)"><\/a>[\s\S]*?<div class='item__tertiary'><\/div><div class='item__tertiary'><div class="clear_fix">(.*?) <\/div><\/div>/g);
		
		// First try the standard format with dates
		for (const match of photoMatches) {
			const [, vkUrl, imageUrl, altText, dateText] = match;
			
			// Extract photo ID from alt text or VK URL
			const photoId = altText || vkUrl.split('/').pop() || `unknown_${Date.now()}`;
			
			// Parse timestamp
			const timestamp = parseVkDateString(dateText);
			
			const photo: PhotoInfo = {
				id: photoId,
				url: imageUrl,
				vkUrl,
				timestamp,
				altText: altText || ''
			};
			
			photos.push(photo);
		}
		
		// If no photos found with the standard format, try a simpler pattern for system albums
		if (photos.length === 0) {
			const simplePhotoMatches = albumHtml.matchAll(/<div class="item">[\s\S]*?<a href="(https:\/\/vk\.com\/photo.*?)"><img src="(.*?)" alt="(.*?)"><\/a>/g);
			
			for (const match of simplePhotoMatches) {
				const [, vkUrl, imageUrl, altText] = match;
				
				// Extract photo ID from alt text or VK URL
				const photoId = altText || vkUrl.split('/').pop() || `unknown_${Date.now()}`;
				
				const photo: PhotoInfo = {
					id: photoId,
					url: imageUrl,
					vkUrl,
					timestamp: null, // System albums might not have timestamps
					altText: altText || ''
				};
				
				photos.push(photo);
			}
		}
		
		// Sort by timestamp (newest first)
		return photos.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
		
	} catch (error) {
		console.error(`Error parsing album ${albumId}:`, error);
		throw new Error(`Failed to parse album photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
