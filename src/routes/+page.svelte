<script lang="ts">
	import { goto } from '$app/navigation';
	import { archiveStore } from '$lib/stores/archive';
	import FileUpload from '$lib/components/FileUpload.svelte';
	import StatusView from '$lib/components/StatusView.svelte';

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
			
			console.log('✅ archiveStore.setFile completed, showing navigation options');
			// The archive is loaded, now user can choose between albums and chats
			// No automatic navigation - let them choose on this page
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
					<p>{archiveData.processingStep || '🔍 Reading archive index...'}</p>
					<p>⚡ Using fast indexing for better performance</p>
				</div>
			</div>
		</div>
	{:else if archiveData.file && archiveData.zip}
		<!-- Archive loaded - show navigation options -->
		<section class="navigation-section">
			<h2>Choose What to Explore</h2>
			<p>Your archive has been loaded successfully! What would you like to explore?</p>
			
			<div class="navigation-grid">
				<div class="nav-card">
					<div class="nav-card-icon">💬</div>
					<h3>Chats & Messages</h3>
					<p>Analyze your conversations, message patterns, and chat statistics</p>
					<div class="nav-card-stats">
						<span class="stats-number">{archiveData.chats.length}</span>
						<span class="stats-label">chat{archiveData.chats.length !== 1 ? 's' : ''} found</span>
					</div>
					<ul class="feature-list">
						<li>📊 Message frequency analysis</li>
						<li>📈 Timeline and activity patterns</li>
						<li>☁️ Word clouds and trends</li>
						<li>📸 Download chat images</li>
					</ul>
					<button class="nav-button primary" on:click={() => goto('/chats')}>
						Explore Chats
					</button>
				</div>
				
				<div class="nav-card">
					<div class="nav-card-icon">📸</div>
					<h3>Photo Albums</h3>
					<p>Browse and download photos from your VK albums</p>
					<div class="nav-card-stats">
						<span class="stats-number">{archiveData.albums.length}</span>
						<span class="stats-label">album{archiveData.albums.length !== 1 ? 's' : ''} found</span>
					</div>
					<ul class="feature-list">
						<li>🖼️ Browse album collections</li>
						<li>📅 View photo timelines</li>
						<li>💾 Bulk download photos</li>
						<li>🔍 Search by date ranges</li>
					</ul>
					<button class="nav-button secondary" on:click={() => goto('/albums')}>
						Explore Albums
					</button>
				</div>
			</div>
			
			<div class="archive-info">
				<h4>Archive Information</h4>
				<div class="archive-details">
					<span>📁 File: {archiveData.file.name}</span>
					<span>📊 Size: {formatFileSize(archiveData.file.size)}</span>
					<button class="reset-button" on:click={() => archiveStore.reset()}>
						Load Different Archive
					</button>
				</div>
			</div>
		</section>
	{:else}
		<!-- No archive loaded - show upload -->
		<section class="upload-section">
			<h2>Upload Your Archive</h2>
			<p>Select your VK GDPR archive ZIP file to begin analysis. All processing happens locally in your browser - no data is sent to any server.</p>
			
			<FileUpload on:fileUploaded={handleFileUploaded} />
		</section>

		<section class="features">
			<h3>What you can analyze:</h3>
			<ul>
				<li>💬 Message frequency and patterns</li>
				<li>📊 Chat statistics and activity</li>
				<li>📈 Timeline analysis</li>
				<li>☁️ Word frequency and trends</li>
				<li>📸 Photo albums and collections</li>
				<li>💾 Bulk download capabilities</li>
			</ul>
		</section>
	{/if}

	{#if archiveData.error}
		<StatusView
			status="error"
			title="Error Processing Archive"
			message={archiveData.error}
			buttonText="Try Again"
			on:action={() => archiveStore.reset()}
		/>
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

	/* Navigation Section Styles */
	.navigation-section {
		margin: 2rem 0;
	}

	.navigation-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 2rem;
		margin: 2rem 0;
	}

	.nav-card {
		background: white;
		border: 2px solid #e0e0e0;
		border-radius: 12px;
		padding: 2rem;
		text-align: center;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.nav-card:hover {
		border-color: #4a90e2;
		transform: translateY(-4px);
		box-shadow: 0 8px 25px rgba(74, 144, 226, 0.15);
	}

	.nav-card-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.nav-card h3 {
		color: #333;
		margin-bottom: 1rem;
		font-size: 1.5rem;
	}

	.nav-card p {
		color: #666;
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}

	.nav-card-stats {
		background: #f8f9fa;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1.5rem;
		border: 1px solid #e9ecef;
	}

	.stats-number {
		font-size: 2rem;
		font-weight: bold;
		color: #4a90e2;
		display: block;
	}

	.stats-label {
		font-size: 0.9rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.feature-list {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0;
		text-align: left;
	}

	.feature-list li {
		padding: 0.5rem 0;
		color: #555;
		font-size: 0.9rem;
	}

	.nav-button {
		border: none;
		padding: 1rem 2rem;
		border-radius: 8px;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 200px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.nav-button.primary {
		background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
		color: white;
	}

	.nav-button.primary:hover {
		background: linear-gradient(135deg, #357abd 0%, #2c5aa0 100%);
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(74, 144, 226, 0.3);
	}

	.nav-button.secondary {
		background: linear-gradient(135deg, #28a745 0%, #218838 100%);
		color: white;
	}

	.nav-button.secondary:hover {
		background: linear-gradient(135deg, #218838 0%, #1e7e34 100%);
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
	}

	.archive-info {
		background: #f8f9fa;
		border-radius: 8px;
		padding: 1.5rem;
		margin-top: 2rem;
		border: 1px solid #e9ecef;
	}

	.archive-info h4 {
		margin-bottom: 1rem;
		color: #495057;
	}

	.archive-details {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.archive-details span {
		color: #6c757d;
		font-size: 0.9rem;
	}

	.reset-button {
		background: #6c757d;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.reset-button:hover {
		background: #5a6268;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.navigation-grid {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.nav-card {
			padding: 1.5rem;
		}

		.nav-card-icon {
			font-size: 2.5rem;
		}

		.nav-button {
			min-width: 100%;
			padding: 0.875rem 1.5rem;
		}

		.archive-details {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}
	}
</style>
