<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { archiveStore } from '$lib/stores/archive';
	import { extractImagesFromChats } from '$lib/utils/imageExtractor';
	import { downloadImagesAsZip, downloadZipFile, generateZipFilename } from '$lib/utils/imageDownloader';
	import type { ImageInfo, ImageExtractionProgress } from '$lib/utils/imageExtractor';
	import type { DownloadProgress, DownloadResult } from '$lib/utils/imageDownloader';

	let archiveData: typeof $archiveStore;
	let selectedChatIds: string[] = [];
	let selectedChats: { id: string; name: string }[] = [];
	
	// State management
	let currentPhase: 'extraction' | 'download' | 'complete' | 'error' = 'extraction';
	let isProcessing = false;
	let extractionProgress: ImageExtractionProgress | null = null;
	let downloadProgress: DownloadProgress | null = null;
	let extractedImages: ImageInfo[] = [];
	let downloadResult: DownloadResult | null = null;
	let error: string | null = null;

	onMount(() => {
		archiveStore.subscribe(data => {
			archiveData = data;
			
			// If no archive loaded, redirect to home
			if (!data.file) {
				goto('/');
				return;
			}
		});

		// Get selected chat IDs from URL parameters
		const chatIds = $page.url.searchParams.get('chats');
		if (chatIds) {
			selectedChatIds = chatIds.split(',');
			selectedChats = selectedChatIds.map(id => ({
				id,
				name: archiveData?.chats.find(c => c.id === id)?.name || `Chat ${id}`
			}));

			// Start the process automatically
			startImageExtraction();
		} else {
			goto('/chats');
		}
	});

	async function startImageExtraction() {
		if (!archiveData || selectedChatIds.length === 0) return;

		isProcessing = true;
		currentPhase = 'extraction';
		error = null;

		try {
			extractedImages = await extractImagesFromChats(
				archiveData,
				selectedChatIds,
				(progress) => {
					extractionProgress = progress;
				}
			);

			if (extractedImages.length === 0) {
				error = 'No images found in the selected chats.';
				currentPhase = 'error';
				isProcessing = false;
				return;
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
			downloadResult = await downloadImagesAsZip(extractedImages, {
				addExifMetadata: true,
				onProgress: (progress) => {
					downloadProgress = progress;
				}
			});

			currentPhase = 'complete';
			isProcessing = false;

			// Auto-download the ZIP file
			const filename = generateZipFilename(extractedImages);
			downloadZipFile(downloadResult.zipBlob, filename);

		} catch (err) {
			console.error('Error downloading images:', err);
			error = err instanceof Error ? err.message : 'Failed to download images';
			currentPhase = 'error';
			isProcessing = false;
		}
	}

	function goBack() {
		goto('/chats');
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
			const filename = generateZipFilename(extractedImages);
			downloadZipFile(downloadResult.zipBlob, filename);
		}
	}
</script>

<svelte:head>
	<title>Download Images - VK Archive Analytics</title>
</svelte:head>

<main class="container">
	<header>
		<button class="back-button" on:click={goBack}>← Back to Chat Selection</button>
		<h1>Download Images</h1>
		<p>Downloading images from {selectedChats.length} selected chat{selectedChats.length !== 1 ? 's' : ''}</p>
	</header>

	<div class="selected-chats">
		<h3>Selected Chats:</h3>
		<ul>
			{#each selectedChats as chat}
				<li>{chat.name}</li>
			{/each}
		</ul>
	</div>

	{#if currentPhase === 'extraction' && isProcessing}
		<section class="progress-section">
			<div class="progress-header">
				<h2>🔍 Extracting Images</h2>
				<p>Scanning message files for images...</p>
			</div>

			{#if extractionProgress}
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
			{/if}
		</section>
	{/if}

	{#if currentPhase === 'download' && isProcessing}
		<section class="progress-section">
			<div class="progress-header">
				<h2>📸 Downloading Images</h2>
				<p>Downloading {extractedImages.length} images, adding EXIF metadata, and creating ZIP archive...</p>
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
					<button class="primary-button" on:click={downloadAgain}>
						📦 Download ZIP Again
					</button>
					<button class="secondary-button" on:click={goBack}>
						← Back to Chat Selection
					</button>
				</div>

				{#if downloadResult.failedUrls.length > 0}
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

	.selected-chats {
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
</style>