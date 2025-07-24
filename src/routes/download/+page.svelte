<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { archiveStore } from '$lib/stores/archive';
	import { progressStore } from '$lib/stores/progress';
	import { downloadService } from '$lib/services/download.service';
	import { databaseService } from '$lib/db/database';
	import { extractImagesFromChats } from '$lib/utils/imageExtractor';
	import { extractImagesFromAlbums } from '$lib/utils/albumImageExtractor';
	import { downloadImagesAsZip, downloadZipFile, generateZipFilename } from '$lib/utils/imageDownloader';
	import type { ImageInfo, ImageExtractionProgress } from '$lib/utils/imageExtractor';
	import type { AlbumImageExtractionProgress } from '$lib/utils/albumImageExtractor';
	import type { DownloadProgress, DownloadResult } from '$lib/utils/imageDownloader';

	// Define download phase type for better type safety
	type DownloadPhase = 'config' | 'extraction' | 'download' | 'complete' | 'error';

	let archiveData: typeof $archiveStore;
	let selectedChatIds: string[] = [];
	let selectedChats: { id: string; name: string }[] = [];
	let selectedAlbumIds: string[] = [];
	let selectedAlbums: { id: string; name: string }[] = [];
	let downloadType: 'chats' | 'albums' = 'chats';
	
	// State management
	let currentPhase: DownloadPhase = 'config';
	let isProcessing = false;
	let extractionProgress: ImageExtractionProgress | null = null;
	let albumExtractionProgress: AlbumImageExtractionProgress | null = null;
	let downloadProgress: DownloadProgress | null = null;
	let extractedImages: ImageInfo[] = [];
	let downloadResult: any = null; // Can be either old or new DownloadResult type
	let error: string | null = null;

	// Configuration options
	let downloadConfig = {
		batchSize: 10,
		concurrentDownloads: 3,
		retryAttempts: 2,
		addExifMetadata: true,
		createSubdirectories: true
	};

	// File System Access API detection
	let supportsFileSystemAccess = false;
	let downloadMethod = 'zip'; // 'filesystem' or 'zip'
	let selectedDownloadMethod = 'auto'; // User's choice: 'auto', 'filesystem', 'zip'
	let operationId: string | null = null;
	let currentProgress: any = null;
	let selectedDirectoryHandle: FileSystemDirectoryHandle | null = null;

	onMount(() => {
		// Detect File System Access API support
		supportsFileSystemAccess = downloadService.isFileSystemSupported();
		downloadMethod = supportsFileSystemAccess ? 'filesystem' : 'zip';
		selectedDownloadMethod = supportsFileSystemAccess ? 'filesystem' : 'zip';

		archiveStore.subscribe(data => {
			archiveData = data;
			
			// If no archive loaded, redirect to home
			if (!data.file) {
				goto('/');
				return;
			}
		});

		// Subscribe to progress updates
		progressStore.subscribe(progressData => {
			// For File System downloads, check all active operations since we might not have the exact ID
			if (currentPhase === 'download') {
				for (const [opId, operation] of progressData.activeOperations) {
					if (operation && (operationId === opId || opId.startsWith('download_'))) {
						currentProgress = operation?.progress;

						// Update downloadProgress for consistent UI display
						if (currentProgress) {
							// Debug log to see what we're receiving
							// console.log('UI Progress Update:', {
							// 	received: currentProgress,
							// 	processed: currentProgress.processed,
							// 	total: currentProgress.total,
							// 	percentage: currentProgress.percentage
							// });
							
							downloadProgress = {
								currentStep: currentProgress.step || 'Downloading...',
								currentImage: currentProgress.currentItem || '',
								downloadedImages: currentProgress.processed || 0,
								totalImages: currentProgress.total || 0,
								failedImages: 0, // This would need to be tracked separately
								percentage: Math.round(currentProgress.percentage || 0),
								estimatedTimeRemaining: undefined // Not available from current progress
							};
						}

						if (operation?.status === 'complete') {
							currentPhase = 'complete';
							downloadResult = operation.metadata?.result;
							operationId = null;
						} else if (operation?.status === 'error') {
							currentPhase = 'error';
							error = operation.error || 'Download failed';
							operationId = null;
						}
						break; // Found the relevant operation
					}
				}
			}
		});

		// Get selected chat IDs from URL parameters
		const chatIds = $page.url.searchParams.get('chats');
		const albumIds = $page.url.searchParams.get('albums');
		
		if (chatIds) {
			downloadType = 'chats';
			selectedChatIds = chatIds.split(',');
			selectedChats = selectedChatIds.map(id => ({
				id,
				name: archiveData?.chats.find(c => c.id === id)?.name || `Chat ${id}`
			}));

			// Show configuration first
			currentPhase = 'config';
		} else if (albumIds) {
			downloadType = 'albums';
			selectedAlbumIds = albumIds.split(',');
			selectedAlbums = selectedAlbumIds.map(id => ({
				id,
				name: archiveData?.albums.find(a => a.id === id)?.name || `Album ${id}`
			}));

			// Show configuration first
			currentPhase = 'config';
		} else {
			// No valid parameters, redirect back
			goto('/');
		}
	});

	async function startImageExtraction() {
		if (!archiveData) return;
		
		if (downloadType === 'chats' && selectedChatIds.length === 0) return;
		if (downloadType === 'albums' && selectedAlbumIds.length === 0) return;

		isProcessing = true;
		currentPhase = 'extraction';
		error = null;
		extractionProgress = null;
		albumExtractionProgress = null;

		try {
			if (downloadType === 'chats') {
				console.log('Starting chat image extraction for chats:', selectedChatIds);
				console.log('Archive contains:', archiveData.chats.length, 'total chats');
				
				extractedImages = await extractImagesFromChats(
					archiveData,
					selectedChatIds,
					(progress) => {
						extractionProgress = progress;
						console.log('Extraction progress:', progress);
					}
				);

				console.log('Extraction completed. Found', extractedImages.length, 'images');
				console.log('First few images:', extractedImages.slice(0, 3));

				if (extractedImages.length === 0) {
					error = 'No images found in the selected chats.';
					currentPhase = 'error';
					isProcessing = false;
					return;
				}
			} else if (downloadType === 'albums') {
				extractedImages = await extractImagesFromAlbums(
					archiveData,
					selectedAlbumIds,
					(progress) => {
						albumExtractionProgress = progress;
					}
				);

				if (extractedImages.length === 0) {
					error = 'No photos found in the selected albums.';
					currentPhase = 'error';
					isProcessing = false;
					return;
				}
			}

			// Start download phase
			startImageDownload();

		} catch (err) {
			console.error('Error extracting images:', err);
			error = err instanceof Error ? err.message : 'Failed to extract images';
			currentPhase = 'error';
			isProcessing = false;
		}
	}

	async function startImageDownload() {
		if (extractedImages.length === 0) return;

		currentPhase = 'download';

		try {
			if (selectedDownloadMethod === 'filesystem') {
				// Use new File System Access API
				const archiveId = 'current_archive';
				const photoRecords = extractedImages.map((img, index) => ({
					id: `${archiveId}_photo_${index}`,
					archiveId: archiveId,
					photoId: `photo_${index}`,
					chatId: img.chatName,
					url: img.url,
					vkUrl: img.url, // Using the same URL for now
					filename: img.filename,
					timestamp: img.timestamp,
					altText: '',
					downloadStatus: 'pending' as const
				}));

				console.log('Created', photoRecords.length, 'photo records for download');
				console.log('Photo record IDs:', photoRecords.map(p => p.id).slice(0, 5));

				// Check if photos already exist in database first
				const existingPhotos = await databaseService.getPhotosByArchive(archiveId);
				const existingPhotoIds = new Set(existingPhotos.map(p => p.id));
				
				// Only create photos that don't already exist
				const newPhotoRecords = photoRecords.filter(photo => !existingPhotoIds.has(photo.id));
				
				if (newPhotoRecords.length > 0) {
					try {
						await databaseService.createPhotos(newPhotoRecords);
					} catch (error) {
						// If there's still a constraint error, log it but continue
						if (error instanceof Error && error.name === 'ConstraintError') {
							console.log('Some photos already exist, continuing...');
						} else {
							throw error;
						}
					}
				} else {
					console.log('All photos already exist in database, proceeding with download');
				}

				const downloadRequest = {
					archiveId: archiveId,
					photoIds: photoRecords.map(p => p.id),
					options: {
						useFileSystem: true,
						directoryHandle: selectedDirectoryHandle || undefined, // Use pre-selected directory
						concurrentDownloads: downloadConfig.concurrentDownloads,
						batchSize: downloadConfig.batchSize,
						retryAttempts: downloadConfig.retryAttempts,
						addExifMetadata: downloadConfig.addExifMetadata,
						createSubdirectories: downloadConfig.createSubdirectories,
						createProgressLog: true
					}
				};

				// Set initial download progress
				downloadProgress = {
					currentStep: 'Starting download...',
					currentImage: '',
					downloadedImages: 0,
					totalImages: photoRecords.length,
					failedImages: 0,
					percentage: 0,
					estimatedTimeRemaining: undefined
				};
				
				downloadResult = await downloadService.downloadImages(downloadRequest);

			} else {
				// Fallback to old ZIP method
				downloadResult = await downloadImagesAsZip(extractedImages, {
					batchSize: downloadConfig.batchSize,
					concurrentDownloads: downloadConfig.concurrentDownloads,
					retryAttempts: downloadConfig.retryAttempts,
					addExifMetadata: downloadConfig.addExifMetadata,
					createSubdirectories: downloadConfig.createSubdirectories,
					onProgress: (progress) => {
						downloadProgress = progress;
					}
				});

				// Auto-download the ZIP file
				const filename = generateZipFilename(extractedImages);
				downloadZipFile(downloadResult.zipBlob, filename);
			}

			currentPhase = 'complete';
			isProcessing = false;

		} catch (err) {
			console.error('Error downloading images:', err);
			error = err instanceof Error ? err.message : 'Failed to download images';
			currentPhase = 'error';
			isProcessing = false;
		}
	}

	async function startDownloadProcess() {
		// If using filesystem method, show folder picker immediately
		// to preserve user gesture for browser security
		if (selectedDownloadMethod === 'filesystem') {
			try {
				selectedDirectoryHandle = await downloadService.pickDownloadDirectory();
				if (!selectedDirectoryHandle) {
					// User cancelled folder selection
					return;
				}
			} catch (error) {
				console.error('Failed to pick directory:', error);
				error = error instanceof Error ? error.message : 'Failed to select download folder';
				currentPhase = 'error';
				return;
			}
		}
		
		startImageExtraction();
	}

	function goBack() {
		if (downloadType === 'chats') {
			goto('/chats');
		} else {
			goto('/albums');
		}
	}

	function retryDownload() {
		if (extractedImages.length > 0) {
			startImageDownload();
		} else {
			startImageExtraction();
		}
	}

	function downloadAgain() {
		if (downloadResult) {
			// If we have a zipBlob, download it; otherwise retry the download process
			if (downloadResult.zipBlob) {
				const filename = generateZipFilename(extractedImages);
				downloadZipFile(downloadResult.zipBlob, filename);
			} else {
				// For File System Access downloads, restart the download process
				retryDownload();
			}
		}
	}
</script>

<svelte:head>
	<title>Download {downloadType === 'chats' ? 'Images' : 'Photos'} - VK Archive Analytics</title>
</svelte:head>

<main class="container">
	<header>
		<button class="back-button" on:click={goBack}>← Back to {downloadType === 'chats' ? 'Chat' : 'Album'} Selection</button>
		<h1>Download {downloadType === 'chats' ? 'Images' : 'Photos'}</h1>
		{#if downloadType === 'chats'}
			<p>Downloading images from {selectedChats.length} selected chat{selectedChats.length !== 1 ? 's' : ''}</p>
		{:else}
			<p>Downloading photos from {selectedAlbums.length} selected album{selectedAlbums.length !== 1 ? 's' : ''}</p>
		{/if}
	</header>

	<div class="selected-items">
		{#if downloadType === 'chats'}
			<h3>Selected Chats:</h3>
			<ul>
				{#each selectedChats as chat}
					<li>{chat.name}</li>
				{/each}
			</ul>
		{:else}
			<h3>Selected Albums:</h3>
			<ul>
				{#each selectedAlbums as album}
					<li>{album.name}</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if currentPhase === 'config'}
		<section class="config-section">
			<div class="config-header">
				<h2>🔧 Download Configuration</h2>
				<p>Configure download settings to optimize performance and control the process</p>
			</div>

			<!-- Download Method Indicator -->
			<div class="download-method-selection">
				<h4>Choose Download Method</h4>
				<div class="method-options">
					<label class="method-option" class:disabled={!supportsFileSystemAccess}>
						<input
							type="radio"
							bind:group={selectedDownloadMethod}
							value="filesystem"
							disabled={!supportsFileSystemAccess}
						/>
						<div class="method-content">
							<div class="method-header">
								<span class="status-bulb">{supportsFileSystemAccess ? '🟢' : '🔴'}</span>
								<strong>📁 Save to Folder</strong>
							</div>
							<small>
								{#if supportsFileSystemAccess}
									Direct file system access - choose exactly where files go
								{:else}
									Not available in your browser
								{/if}
							</small>
						</div>
					</label>
					
					<label class="method-option">
						<input
							type="radio"
							bind:group={selectedDownloadMethod}
							value="zip"
						/>
						<div class="method-content">
							<div class="method-header">
								<span class="status-bulb">🟢</span>
								<strong>📦 Download as ZIP</strong>
							</div>
							<small>Compatible with all browsers - creates a single ZIP file</small>
						</div>
					</label>
				</div>
			</div>

			<div class="config-options">
				<div class="config-group">
					<label for="batchSize">
						<span class="config-label">Batch Size</span>
						<small class="config-description">Number of images processed in each batch</small>
					</label>
					<select id="batchSize" bind:value={downloadConfig.batchSize}>
						<option value={5}>5 (Slow, stable)</option>
						<option value={10}>10 (Balanced)</option>
						<option value={20}>20 (Fast)</option>
						<option value={50}>50 (Very fast)</option>
					</select>
				</div>

				<div class="config-group">
					<label for="concurrentDownloads">
						<span class="config-label">Concurrent Downloads</span>
						<small class="config-description">Number of simultaneous downloads</small>
					</label>
					<select id="concurrentDownloads" bind:value={downloadConfig.concurrentDownloads}>
						<option value={1}>1 (Conservative)</option>
						<option value={2}>2 (Careful)</option>
						<option value={3}>3 (Balanced)</option>
						<option value={5}>5 (Aggressive)</option>
						<option value={8}>8 (Maximum)</option>
					</select>
				</div>

				<div class="config-group">
					<label for="retryAttempts">
						<span class="config-label">Retry Attempts</span>
						<small class="config-description">How many times to retry failed downloads</small>
					</label>
					<select id="retryAttempts" bind:value={downloadConfig.retryAttempts}>
						<option value={0}>0 (No retries)</option>
						<option value={1}>1 (Single retry)</option>
						<option value={2}>2 (Double retry)</option>
						<option value={3}>3 (Triple retry)</option>
					</select>
				</div>

				<div class="config-group checkbox-group">
					<label for="addExifMetadata" class="checkbox-label">
						<input
							type="checkbox"
							id="addExifMetadata"
							bind:checked={downloadConfig.addExifMetadata}
						/>
						<span class="config-label">Add EXIF Metadata</span>
						<small class="config-description">Include timestamp and source information in image files</small>
					</label>
				</div>

				<div class="config-group checkbox-group">
					<label for="createSubdirectories" class="checkbox-label">
						<input
							type="checkbox"
							id="createSubdirectories"
							bind:checked={downloadConfig.createSubdirectories}
						/>
						<span class="config-label">Create Subdirectories</span>
						<small class="config-description">Organize images into folders by chat and date (when disabled, all images go into a single folder)</small>
					</label>
				</div>
			</div>

			<div class="config-summary">
				<h4>Configuration Summary</h4>
				<ul>
					<li>Will process <strong>{downloadConfig.batchSize} images</strong> at a time</li>
					<li>Up to <strong>{downloadConfig.concurrentDownloads} simultaneous</strong> downloads</li>
					<li>Will retry failed downloads <strong>{downloadConfig.retryAttempts} time{downloadConfig.retryAttempts !== 1 ? 's' : ''}</strong></li>
					<li>{downloadConfig.addExifMetadata ? 'Will add' : 'Will not add'} <strong>EXIF metadata</strong></li>
					<li>{downloadConfig.createSubdirectories ? 'Will organize' : 'Will not organize'} images <strong>into subdirectories</strong></li>
				</ul>
			</div>

			<div class="config-actions">
				<button class="config-btn secondary" on:click={goBack}>
					← Back
				</button>
				<button class="config-btn primary" on:click={startDownloadProcess}>
					{#if selectedDownloadMethod === 'filesystem'}
						📁 Choose Folder & Start Download
					{:else}
						📦 Start ZIP Download
					{/if}
				</button>
			</div>
		</section>
	{/if}

	{#if currentPhase === 'extraction' && isProcessing}
		<section class="progress-section">
			<div class="progress-header">
				{#if downloadType === 'chats'}
					<h2>🔍 Extracting Images</h2>
					<p>Scanning message files for images...</p>
				{:else}
					<h2>📸 Extracting Photos</h2>
					<p>Processing photo albums...</p>
				{/if}
			</div>

			{#if downloadType === 'chats' && extractionProgress}
				<div class="progress-details">
					<div class="current-step">{extractionProgress.currentStep}</div>
					<div class="progress-stats">
						<span>Chat: {extractionProgress.currentChat}</span>
						<span>Progress: {extractionProgress.processedChats}/{extractionProgress.totalChats}</span>
						<span>Found: {extractionProgress.foundImages} images</span>
					</div>
					<div class="progress-bar">
						<div
							class="progress-fill"
							style="width: {Math.round((extractionProgress.processedChats / extractionProgress.totalChats) * 100)}%"
						></div>
					</div>
				</div>
			{:else if downloadType === 'albums' && albumExtractionProgress}
				<div class="progress-details">
					<div class="current-step">{albumExtractionProgress.status}</div>
					<div class="progress-stats">
						<span>Album: {albumExtractionProgress.currentAlbum}</span>
						<span>Progress: {albumExtractionProgress.albumsProcessed}/{albumExtractionProgress.totalAlbums}</span>
						<span>Found: {albumExtractionProgress.photosFound} photos</span>
					</div>
					<div class="progress-bar">
						<div
							class="progress-fill"
							style="width: {Math.round((albumExtractionProgress.albumsProcessed / albumExtractionProgress.totalAlbums) * 100)}%"
						></div>
					</div>
				</div>
			{/if}
		</section>
	{/if}

	{#if currentPhase === 'download' && isProcessing}
		<section class="progress-section">
			<div class="progress-header">
				<h2>📸 Downloading Images</h2>
				{#if selectedDownloadMethod === 'filesystem'}
					<p>Downloading {extractedImages.length} images with EXIF metadata directly to your selected folder...</p>
				{:else}
					<p>Downloading {extractedImages.length} images, adding EXIF metadata, and creating ZIP archive...</p>
				{/if}
			</div>

			{#if downloadProgress}
				<div class="progress-details">
					<div class="current-step">{downloadProgress.currentStep}</div>
					<div class="progress-stats">
						<span>Current: {downloadProgress.currentImage}</span>
						<span>Downloaded: {downloadProgress.downloadedImages}/{downloadProgress.totalImages}</span>
						<span>Failed: {downloadProgress.failedImages}</span>
						{#if downloadProgress.estimatedTimeRemaining}
							<span>ETA: {downloadProgress.estimatedTimeRemaining}</span>
						{/if}
					</div>
					<div class="progress-bar">
						<div 
							class="progress-fill" 
							style="width: {downloadProgress.percentage}%"
						></div>
					</div>
					<div class="progress-percentage">{downloadProgress.percentage}%</div>
				</div>
			{/if}
		</section>
	{/if}

	{#if currentPhase === 'complete'}
		<section class="completion-section">
			<div class="success-icon">✅</div>
			<h2>Download Complete!</h2>
			
			{#if downloadResult}
				<div class="results-summary">
					<div class="result-stat">
						<strong>Total Images Found:</strong> {downloadResult.totalImages}
					</div>
					<div class="result-stat">
						<strong>Successfully Downloaded:</strong> {downloadResult.downloadedImages}
					</div>
					{#if downloadResult.failedImages > 0}
						<div class="result-stat error">
							<strong>Failed Downloads:</strong> {downloadResult.failedImages}
						</div>
					{/if}
				</div>

				<div class="action-buttons">
					{#if selectedDownloadMethod !== 'filesystem'}
						<button class="primary-button" on:click={retryDownload}>
							🔄 Download Again
						</button>
					{/if}
					<button class="secondary-button" on:click={goBack}>
						← Back to Selection
					</button>
				</div>

				{#if downloadResult.failedUrls && downloadResult.failedUrls.length > 0}
					<details class="failed-urls">
						<summary>View Failed Downloads ({downloadResult.failedUrls.length})</summary>
						<ul>
							{#each downloadResult.failedUrls as url}
								<li><a href={url} target="_blank" rel="noopener">{url}</a></li>
							{/each}
						</ul>
					</details>
				{/if}
			{/if}
		</section>
	{/if}

	{#if currentPhase === 'error'}
		<section class="error-section">
			<div class="error-icon">❌</div>
			<h2>Download Error</h2>
			<p class="error-message">{error}</p>
			
			<div class="action-buttons">
				<button class="primary-button" on:click={retryDownload}>
					🔄 Retry Download
				</button>
				<button class="secondary-button" on:click={goBack}>
					← Back to Chat Selection
				</button>
			</div>
		</section>
	{/if}
</main>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		margin-bottom: 2rem;
	}

	.back-button {
		background: none;
		border: none;
		color: #4a90e2;
		font-size: 1rem;
		cursor: pointer;
		padding: 0.5rem;
		margin-bottom: 1rem;
	}

	.back-button:hover {
		text-decoration: underline;
	}

	h1 {
		color: #333;
		margin-bottom: 0.5rem;
	}

	.selected-items {
		background: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.selected-chats h3 {
		margin: 0 0 1rem 0;
		color: #333;
	}

	.selected-chats ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.selected-chats li {
		padding: 0.25rem 0;
		color: #666;
	}

	/* Download Method Indicator Styles */
	.download-method-indicator {
		background: white;
		border: 1px solid #e9ecef;
		border-radius: 8px;
		padding: 1.5rem;
		margin: 1.5rem 0;
	}

	.method-status {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.status-bulb {
		font-size: 1.5rem;
		margin-top: 0.2rem;
	}

	.method-info {
		flex: 1;
	}

	.method-info strong {
		display: block;
		font-size: 1.1rem;
		margin-bottom: 0.5rem;
		color: #333;
	}

	.method-info small {
		color: #666;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.method-status.supported {
		border-left: 4px solid #28a745;
		padding-left: 1rem;
		margin-left: -1rem;
		background: #f8fff9;
	}

	.method-status.fallback {
		border-left: 4px solid #dc3545;
		padding-left: 1rem;
		margin-left: -1rem;
		background: #fff8f8;
	}

	.progress-section {
		background: #f8f9fa;
		border-radius: 8px;
		padding: 2rem;
		text-align: center;
	}

	.progress-header h2 {
		color: #4a90e2;
		margin-bottom: 0.5rem;
	}

	.progress-header p {
		color: #666;
		margin-bottom: 2rem;
	}

	.progress-details {
		max-width: 600px;
		margin: 0 auto;
	}

	.current-step {
		font-size: 1.1rem;
		color: #333;
		margin-bottom: 1rem;
	}

	.progress-stats {
		display: flex;
		justify-content: space-between;
		margin-bottom: 1rem;
		font-size: 0.9rem;
		color: #666;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.progress-bar {
		width: 100%;
		height: 20px;
		background: #e0e0e0;
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #4a90e2, #28a745);
		transition: width 0.3s ease;
	}

	.progress-percentage {
		font-size: 1.2rem;
		font-weight: bold;
		color: #4a90e2;
	}

	.completion-section, .error-section {
		text-align: center;
		padding: 3rem 2rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.success-icon, .error-icon {
		font-size: 4rem;
		margin-bottom: 1rem;
	}

	.completion-section h2 {
		color: #28a745;
		margin-bottom: 2rem;
	}

	.error-section h2 {
		color: #dc3545;
		margin-bottom: 1rem;
	}

	.error-message {
		color: #666;
		margin-bottom: 2rem;
		padding: 1rem;
		background: #fff;
		border-radius: 4px;
		border-left: 4px solid #dc3545;
	}

	.results-summary {
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		text-align: left;
	}

	.result-stat {
		padding: 0.5rem 0;
		border-bottom: 1px solid #eee;
	}

	.result-stat:last-child {
		border-bottom: none;
	}

	.result-stat.error {
		color: #dc3545;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-bottom: 2rem;
	}

	.primary-button, .secondary-button {
		padding: 1rem 2rem;
		border-radius: 8px;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.2s ease;
		min-width: 200px;
	}

	.primary-button {
		background: #4a90e2;
		color: white;
		border: none;
	}

	.primary-button:hover {
		background: #357abd;
	}

	.secondary-button {
		background: white;
		color: #666;
		border: 1px solid #ddd;
	}

	.secondary-button:hover {
		background: #f5f5f5;
	}

	.failed-urls {
		background: white;
		padding: 1rem;
		border-radius: 8px;
		text-align: left;
		max-width: 600px;
		margin: 0 auto;
	}

	.failed-urls summary {
		cursor: pointer;
		font-weight: bold;
		margin-bottom: 0.5rem;
	}

	.failed-urls ul {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0 0;
	}

	.failed-urls li {
		padding: 0.25rem 0;
		word-break: break-all;
	}

	.failed-urls a {
		color: #4a90e2;
		text-decoration: none;
		font-size: 0.9rem;
	}

	.failed-urls a:hover {
		text-decoration: underline;
	}

	/* Configuration Section Styles */
	.config-section {
		background: white;
		padding: 2rem;
		border-radius: 12px;
		margin-bottom: 2rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		border: 2px solid #e3f2fd;
	}

	.config-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.config-header h2 {
		color: #4a90e2;
		margin-bottom: 0.5rem;
	}

	.config-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.config-group {
		display: flex;
		flex-direction: column;
	}

	.config-group label {
		margin-bottom: 0.5rem;
		font-weight: 500;
	}

	.config-label {
		color: #333;
		font-size: 1rem;
		display: block;
		margin-bottom: 0.25rem;
	}

	.config-description {
		color: #666;
		font-size: 0.85rem;
		font-weight: normal;
	}

	.config-group select {
		padding: 0.75rem;
		border: 2px solid #e0e0e0;
		border-radius: 6px;
		font-size: 1rem;
		background: white;
		transition: border-color 0.2s ease;
	}

	.config-group select:focus {
		outline: none;
		border-color: #4a90e2;
		box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
	}

	.checkbox-group {
		flex-direction: row;
		align-items: flex-start;
	}

	.checkbox-label {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		cursor: pointer;
	}

	.checkbox-label input[type="checkbox"] {
		margin-right: 0.75rem;
		margin-bottom: 0.5rem;
		transform: scale(1.2);
		accent-color: #4a90e2;
	}

	.config-summary {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.config-summary h4 {
		color: #495057;
		margin-bottom: 1rem;
	}

	.config-summary ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.config-summary li {
		padding: 0.5rem 0;
		color: #6c757d;
		border-bottom: 1px solid #e9ecef;
	}

	.config-summary li:last-child {
		border-bottom: none;
	}

	.config-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.config-btn {
		padding: 1rem 2rem;
		border-radius: 8px;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
		min-width: 160px;
	}

	.config-btn.primary {
		background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
		color: white;
	}

	.config-btn.primary:hover {
		background: linear-gradient(135deg, #357abd 0%, #2c5aa0 100%);
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(74, 144, 226, 0.3);
	}

	.config-btn.secondary {
		background: #6c757d;
		color: white;
	}

	.config-btn.secondary:hover {
		background: #5a6268;
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(108, 117, 125, 0.3);
	}

	@media (max-width: 768px) {
		.config-options {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
		
		.config-actions {
			flex-direction: column;
		}
		
		.config-btn {
			min-width: 100%;
		}
	}

	@media (max-width: 600px) {
		.progress-stats {
			flex-direction: column;
			text-align: center;
		}

		.action-buttons {
			flex-direction: column;
		}

		.primary-button, .secondary-button {
			min-width: auto;
		}
	}

	/* Download Method Selection Styles */
	.download-method-selection {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.download-method-selection h4 {
		color: #495057;
		margin-bottom: 1rem;
		font-size: 1.1rem;
	}

	.method-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.method-option {
		display: flex;
		align-items: flex-start;
		padding: 1rem;
		background: white;
		border: 2px solid #e9ecef;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.method-option:hover {
		border-color: #4a90e2;
		background: #f0f7ff;
	}

	.method-option.disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background: #f8f9fa;
	}

	.method-option.disabled:hover {
		border-color: #e9ecef;
		background: #f8f9fa;
	}

	.method-option input[type="radio"] {
		margin-right: 0.75rem;
		margin-top: 0.2rem;
		transform: scale(1.2);
		accent-color: #4a90e2;
	}

	.method-option.disabled input[type="radio"] {
		cursor: not-allowed;
	}

	.method-content {
		flex: 1;
	}

	.method-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.method-header strong {
		color: #333;
		font-size: 1rem;
	}

	.method-content small {
		color: #6c757d;
		font-size: 0.85rem;
		line-height: 1.3;
	}

	.method-option.disabled .method-header strong {
		color: #adb5bd;
	}

	.method-option.disabled .method-content small {
		color: #adb5bd;
	}

	@media (min-width: 600px) {
		.method-options {
			flex-direction: row;
			gap: 1rem;
		}

		.method-option {
			flex: 1;
		}
	}
</style>