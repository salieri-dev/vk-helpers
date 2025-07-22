<script lang="ts">
	import { goto } from '$app/navigation';
	import { archiveStore } from '$lib/stores/archive';
	import FileUpload from '$lib/components/FileUpload.svelte';

	// Subscribe to archive store to get loading state
	$: archiveData = $archiveStore;
	$: isProcessing = archiveData.isLoading;

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		
		const size = bytes / Math.pow(k, i);
		const formattedSize = i >= 2 ? size.toFixed(1) : Math.round(size);
		
		return `${formattedSize} ${sizes[i]}`;
	}

	async function handleFileUploaded(event: CustomEvent<{ file: File }>) {
		console.log('🔍 handleFileUploaded called with file:', event.detail.file);
		const { file } = event.detail;
		
		console.log('🔍 File details:', {
			name: file.name,
			size: file.size,
			type: file.type
		});
		
		try {
			console.log('🔍 Calling archiveStore.setFile...');
			// Store the file in the archive store
			await archiveStore.setFile(file);
			
			console.log('✅ archiveStore.setFile completed, navigating to /chats');
			// Navigate to chat selection page
			await goto('/chats');
		} catch (error) {
			console.error('❌ Error processing archive:', error);
			alert('Error processing archive file. Please try again.');
		}
	}
</script>

<svelte:head>
	<title>VK Archive Analytics</title>
</svelte:head>

<main class="container">
	<header>
		<h1>VK Archive Analytics</h1>
		<p>Analyze your VK GDPR archive data locally in your browser</p>
	</header>

	{#if isProcessing}
		<!-- Loading Overlay -->
		<div class="processing-overlay">
			<div class="processing-content">
				<div class="spinner"></div>
				<h3>Processing Archive...</h3>
				<p>Analyzing your VK archive data</p>
				<small>This may take a few moments for large archives</small>
				<div class="progress-info">
					<p>✅ ZIP file loaded ({formatFileSize(archiveData.file?.size || 0)})</p>
					<p>{archiveData.processingStep || '🔍 Extracting chat data...'}</p>
					{#if archiveData.processedChats !== undefined}
						<p>📊 Found {archiveData.processedChats} chat{archiveData.processedChats !== 1 ? 's' : ''}</p>
					{/if}
					{#if archiveData.totalFiles !== undefined}
						<p>📁 Processing {archiveData.totalFiles} archive files</p>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<section class="upload-section">
			<h2>Upload Your Archive</h2>
			<p>Select your VK GDPR archive ZIP file to begin analysis. All processing happens locally in your browser - no data is sent to any server.</p>
			
			<FileUpload on:fileUploaded={handleFileUploaded} />
		</section>

		<section class="features">
			<h3>What you can analyze:</h3>
			<ul>
				<li>Message frequency and patterns</li>
				<li>Chat statistics and activity</li>
				<li>Timeline analysis</li>
				<li>Word frequency and trends</li>
			</ul>
		</section>
	{/if}

	{#if archiveData.error}
		<div class="error-message">
			<h3>Error Processing Archive</h3>
			<p>{archiveData.error}</p>
			<button on:click={() => archiveStore.reset()}>Try Again</button>
		</div>
	{/if}
</main>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 3rem;
	}

	h1 {
		color: #4a90e2;
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
	}

	.upload-section {
		background: #f8f9fa;
		padding: 2rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.features {
		background: #e8f4fd;
		padding: 1.5rem;
		border-radius: 8px;
	}

	.features ul {
		list-style-type: none;
		padding: 0;
	}

	.features li {
		padding: 0.5rem 0;
		position: relative;
		padding-left: 1.5rem;
	}

	.features li::before {
		content: '✓';
		position: absolute;
		left: 0;
		color: #4a90e2;
		font-weight: bold;
	}

	h2, h3 {
		color: #333;
		margin-bottom: 1rem;
	}

	p {
		color: #666;
		line-height: 1.6;
	}

	/* Processing Overlay Styles */
	.processing-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.processing-content {
		background: white;
		padding: 3rem;
		border-radius: 12px;
		text-align: center;
		max-width: 400px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
	}

	.spinner {
		width: 60px;
		height: 60px;
		border: 4px solid #f3f3f3;
		border-top: 4px solid #4a90e2;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 2rem;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.processing-content h3 {
		color: #4a90e2;
		margin-bottom: 1rem;
		font-size: 1.5rem;
	}

	.processing-content p {
		color: #666;
		margin-bottom: 0.5rem;
	}

	.processing-content small {
		color: #888;
		font-size: 0.9rem;
	}

	.progress-info {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #eee;
	}

	.progress-info p {
		font-size: 0.9rem;
		margin-bottom: 0.5rem;
		text-align: left;
	}

	/* Error Message Styles */
	.error-message {
		background: #fee;
		border: 1px solid #fcc;
		border-radius: 8px;
		padding: 2rem;
		margin-top: 2rem;
		text-align: center;
	}

	.error-message h3 {
		color: #c33;
		margin-bottom: 1rem;
	}

	.error-message button {
		background: #4a90e2;
		color: white;
		border: none;
		padding: 0.8rem 2rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 1rem;
		margin-top: 1rem;
	}

	.error-message button:hover {
		background: #357abd;
	}
</style>
