import type { ArchiveData, AlbumInfo, PhotoInfo } from '$lib/stores/archive';
import { parseAlbumPhotos } from './albumParser';
import type { ImageInfo } from './imageExtractor';

export interface AlbumImageExtractionProgress {
	albumsProcessed: number;
	totalAlbums: number;
	currentAlbum: string;
	photosFound: number;
	status: string;
}

export async function extractImagesFromAlbums(
	archiveData: ArchiveData,
	selectedAlbumIds: string[],
	onProgress?: (progress: AlbumImageExtractionProgress) => void
): Promise<ImageInfo[]> {
	if (!archiveData.zip) {
		throw new Error('Archive ZIP not loaded');
	}

	const selectedAlbums = archiveData.albums.filter(album => 
		selectedAlbumIds.includes(album.id)
	);

	if (selectedAlbums.length === 0) {
		throw new Error('No valid albums found for the provided IDs');
	}

	const allImages: ImageInfo[] = [];
	
	for (let i = 0; i < selectedAlbums.length; i++) {
		const album = selectedAlbums[i];
		
		onProgress?.({
			albumsProcessed: i,
			totalAlbums: selectedAlbums.length,
			currentAlbum: album.name,
			photosFound: allImages.length,
			status: `Processing album "${album.name}"...`
		});

		try {
			const photos = await parseAlbumPhotos(archiveData.zip, album.id);
			
			// Convert PhotoInfo to ImageInfo format
			for (const photo of photos) {
				const imageInfo: ImageInfo = {
					url: photo.url,
					chatName: album.name, // Use album name as chat name
					chatId: album.id, // Use album ID as chat ID
					timestamp: photo.timestamp || new Date(), // Provide fallback date
					filename: `${photo.id}.jpg`, // Default extension
					messageId: photo.id // Use photo ID as message ID
				};

				// Try to determine file extension from URL
				const urlMatch = photo.url.match(/\.(jpg|jpeg|png|gif|webp)(?:\?|$)/i);
				if (urlMatch) {
					const extension = urlMatch[1];
					imageInfo.filename = `${photo.id}.${extension}`;
				}

				allImages.push(imageInfo);
			}

			onProgress?.({
				albumsProcessed: i + 1,
				totalAlbums: selectedAlbums.length,
				currentAlbum: album.name,
				photosFound: allImages.length,
				status: `Found ${photos.length} photos in "${album.name}"`
			});

		} catch (error) {
			console.warn(`Failed to extract photos from album ${album.id}:`, error);
			onProgress?.({
				albumsProcessed: i + 1,
				totalAlbums: selectedAlbums.length,
				currentAlbum: album.name,
				photosFound: allImages.length,
				status: `Failed to process "${album.name}"`
			});
		}
	}

	// Final progress update
	onProgress?.({
		albumsProcessed: selectedAlbums.length,
		totalAlbums: selectedAlbums.length,
		currentAlbum: '',
		photosFound: allImages.length,
		status: `Extraction complete: ${allImages.length} photos found`
	});

	return allImages;
}