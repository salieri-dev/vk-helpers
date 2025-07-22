<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { archiveStore } from '$lib/stores/archive';
	import { parseAlbumPhotos } from '$lib/utils/albumParser';
	import type { AlbumInfo, PhotoInfo } from '$lib/stores/archive';

	let archiveData: typeof $archiveStore;
	let selectedAlbums: Set<string> = new Set();
	let searchQuery = '';
	let currentPage = 1;
	let itemsPerPage = 20;
	let expandedAlbum: string | null = null;
	let albumPhotos: { [albumId: string]: PhotoInfo[] } = {};
	let isLoadingPhotos = false;

	$: filteredAlbums = archiveData?.albums
		.filter(album =>
			album.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			album.id.includes(searchQuery)
		)
		.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)) || [];

	$: totalPages = Math.ceil(filteredAlbums.length / itemsPerPage);
	$: paginatedAlbums = filteredAlbums.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	onMount(() => {
		archiveStore.subscribe(data => {
			archiveData = data;
			
			// If no archive loaded, redirect to home
			if (!data.file) {
				goto('/');
			}
		});
	});

	function toggleAlbum(albumId: string) {
		if (selectedAlbums.has(albumId)) {
			selectedAlbums.delete(albumId);
		} else {
			selectedAlbums.add(albumId);
		}
		selectedAlbums = new Set(selectedAlbums); // Trigger reactivity
	}

	function selectAll() {
		selectedAlbums = new Set(paginatedAlbums.map(album => album.id));
	}

	function selectAllFiltered() {
		selectedAlbums = new Set(filteredAlbums.map(album => album.id));
	}

	function selectNone() {
		selectedAlbums = new Set();
	}

	function goToPage(page: number) {
		currentPage = Math.max(1, Math.min(page, totalPages));
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
		}
	}

	function prevPage() {
		if (currentPage > 1) {
			currentPage--;
		}
	}

	// Reset to page 1 when search query changes
	$: if (searchQuery !== undefined) {
		currentPage = 1;
	}

	async function expandAlbum(albumId: string) {
		if (expandedAlbum === albumId) {
			expandedAlbum = null;
			return;
		}

		expandedAlbum = albumId;
		
		// Load photos if not already loaded
		if (!albumPhotos[albumId] && archiveData?.zip) {
			isLoadingPhotos = true;
			try {
				const photos = await parseAlbumPhotos(archiveData.zip, albumId);
				albumPhotos[albumId] = photos;
				albumPhotos = { ...albumPhotos }; // Trigger reactivity
			} catch (error) {
				console.error(`Failed to load photos for album ${albumId}:`, error);
				alert(`Failed to load photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
				expandedAlbum = null;
			} finally {
				isLoadingPhotos = false;
			}
		}
	}

	async function downloadAlbums() {
		if (selectedAlbums.size === 0) {
			alert('Please select at least one album to download.');
			return;
		}

		// Store selected albums and navigate to download page
		const selectedAlbumIds = Array.from(selectedAlbums);
		goto(`/download?albums=${selectedAlbumIds.join(',')}`);
	}

	function formatDate(date: Date | null): string {
		if (!date) return 'Unknown';
		return new Intl.DateTimeFormat('ru-RU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(date);
	}

	function goBack() {
		goto('/');
	}
</script>

<svelte:head>
	<title>Photo Albums - VK Archive Analytics</title>
</svelte:head>

<main class="container">
	<header>
		<button class="back-button" on:click={goBack}>← Back</button>
		<h1>Photo Albums</h1>
		<p>Browse and download photos from your VK albums.</p>
	</header>

	{#if archiveData?.isLoading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Processing your archive...</p>
		</div>
	{:else if archiveData?.error}
		<div class="error">
			<p>Error: {archiveData.error}</p>
			<button on:click={goBack}>Go Back</button>
		</div>
	{:else if archiveData?.albums.length > 0}
		<section class="controls">
			<div class="search">
				<input
					type="text"
					placeholder="Search albums..."
					bind:value={searchQuery}
				/>
			</div>
			<div class="selection-controls">
				<button on:click={selectAll}>Select Page</button>
				<button on:click={selectAllFiltered}>Select All ({filteredAlbums.length})</button>
				<button on:click={selectNone}>Clear Selection</button>
				<span class="selected-count">
					{selectedAlbums.size} selected
				</span>
			</div>
			{#if totalPages > 1}
				<div class="pagination-info">
					<span>Page {currentPage} of {totalPages} ({filteredAlbums.length} total albums)</span>
				</div>
			{/if}
		</section>

		{#if selectedAlbums.size > 0}
			<section class="action-controls" transition:slide={{ duration: 300 }}>
				<div class="action-header">
					<h3>Download Albums</h3>
					<span class="selection-summary">{selectedAlbums.size} album{selectedAlbums.size !== 1 ? 's' : ''} selected</span>
				</div>
				<div class="action-buttons">
					<button
						class="action-btn download-btn"
						on:click={downloadAlbums}
						aria-label="Download {selectedAlbums.size} selected albums"
					>
						<span class="btn-icon">💾</span>
						<span class="btn-text">Download Selected Albums</span>
						<span class="btn-count">({selectedAlbums.size})</span>
					</button>
				</div>
			</section>
		{/if}

		{#if totalPages > 1}
			<section class="pagination">
				<button
					class="pagination-btn"
					on:click={prevPage}
					disabled={currentPage <= 1}
				>
					← Previous
				</button>
				
				<div class="page-numbers">
					{#each Array.from({length: Math.min(5, totalPages)}, (_, i) => {
						const start = Math.max(1, currentPage - 2);
						const end = Math.min(totalPages, start + 4);
						return start + i;
					}).filter(p => p <= totalPages) as page}
						<button
							class="page-number"
							class:active={page === currentPage}
							on:click={() => goToPage(page)}
						>
							{page}
						</button>
					{/each}
				</div>
				
				<button
					class="pagination-btn"
					on:click={nextPage}
					disabled={currentPage >= totalPages}
				>
					Next →
				</button>
			</section>
		{/if}

		<section class="albums-grid">
			{#each paginatedAlbums as album (album.id)}
				<div class="album-card" class:selected={selectedAlbums.has(album.id)}>
					<div class="album-header" 
						role="button"
						tabindex="0"
						on:click={() => toggleAlbum(album.id)}
						on:keydown={(e) => e.key === 'Enter' && toggleAlbum(album.id)}
					>
						<div class="album-checkbox">
							<input
								type="checkbox"
								checked={selectedAlbums.has(album.id)}
								on:change={() => toggleAlbum(album.id)}
							/>
						</div>
						<div class="album-info">
							<h3 class="album-name">{album.name}</h3>
							<div class="album-stats">
								<span class="photo-count">📸 {album.photoCount} photos</span>
								{#if album.updatedAt}
									<span class="updated-date">📅 {formatDate(album.updatedAt)}</span>
								{/if}
							</div>
						</div>
						<button 
							class="expand-button"
							class:expanded={expandedAlbum === album.id}
							on:click|stopPropagation={() => expandAlbum(album.id)}
						>
							{expandedAlbum === album.id ? '−' : '+'}
						</button>
					</div>

					{#if expandedAlbum === album.id}
						<div class="album-content" transition:slide={{ duration: 300 }}>
							{#if isLoadingPhotos}
								<div class="loading-photos">
									<div class="spinner-small"></div>
									<p>Loading photos...</p>
								</div>
							{:else if albumPhotos[album.id]}
								<div class="photos-grid">
									{#each albumPhotos[album.id].slice(0, 12) as photo (photo.id)}
										<div class="photo-thumbnail">
											<img src={photo.url} alt={photo.altText} loading="lazy" />
											<div class="photo-info">
												<small>{formatDate(photo.timestamp)}</small>
											</div>
										</div>
									{/each}
									{#if albumPhotos[album.id].length > 12}
										<div class="more-photos">
											<p>+{albumPhotos[album.id].length - 12} more photos</p>
										</div>
									{/if}
								</div>
							{:else}
								<p class="no-photos">Failed to load photos</p>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{:else}
		<div class="no-albums">
			<p>No photo albums found in the archive.</p>
			<button on:click={goBack}>Go Back</button>
		</div>
	{/if}
</main>

<style>
	.container {
		max-width: 1000px;
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

	.loading, .error, .no-albums {
		text-align: center;
		padding: 3rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #f3f3f3;
		border-top: 4px solid #4a90e2;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	.spinner-small {
		width: 24px;
		height: 24px;
		border: 2px solid #f3f3f3;
		border-top: 2px solid #4a90e2;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 0.5rem;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.controls {
		background: #f8f9fa;
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	.search input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		margin-bottom: 1rem;
	}

	.selection-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.selection-controls button {
		padding: 0.5rem 1rem;
		border: 1px solid #4a90e2;
		background: white;
		color: #4a90e2;
		border-radius: 4px;
		cursor: pointer;
	}

	.selection-controls button:hover {
		background: #4a90e2;
		color: white;
	}

	.selected-count {
		color: #666;
		font-size: 0.9rem;
	}

	.pagination-info {
		margin-top: 1rem;
		text-align: center;
		color: #666;
		font-size: 0.9rem;
	}

	/* Action Controls - same as chats page */
	.action-controls {
		background: linear-gradient(135deg, #f3e5f5 0%, #e8f5e8 100%);
		border: 2px solid #28a745;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 4px 12px rgba(40, 167, 69, 0.15);
		position: relative;
		overflow: hidden;
	}

	.action-controls::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: linear-gradient(90deg, #28a745, #20c997, #28a745);
		animation: shimmer 2s ease-in-out infinite;
	}

	@keyframes shimmer {
		0%, 100% { opacity: 0.7; }
		50% { opacity: 1; }
	}

	.action-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(40, 167, 69, 0.2);
	}

	.action-header h3 {
		margin: 0;
		color: #1e7e34;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.selection-summary {
		color: #666;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.875rem 1.5rem;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 250px;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.action-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}

	.download-btn {
		background: linear-gradient(135deg, #28a745 0%, #218838 100%);
		color: white;
	}

	.download-btn:hover {
		background: linear-gradient(135deg, #218838 0%, #1e7e34 100%);
	}

	.btn-icon {
		font-size: 1.2rem;
	}

	.btn-count {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 8px;
	}

	.pagination-btn, .page-number {
		padding: 0.5rem 0.75rem;
		border: 1px solid #ddd;
		background: white;
		color: #333;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.pagination-btn:hover:not(:disabled), .page-number:hover {
		background: #4a90e2;
		color: white;
		border-color: #4a90e2;
	}

	.page-number.active {
		background: #4a90e2;
		color: white;
		border-color: #4a90e2;
	}

	.pagination-btn:disabled {
		background: #f5f5f5;
		color: #999;
		cursor: not-allowed;
	}

	.page-numbers {
		display: flex;
		gap: 0.25rem;
	}

	.albums-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
		gap: 1.5rem;
	}

	.album-card {
		border: 1px solid #ddd;
		border-radius: 8px;
		background: white;
		transition: all 0.2s ease;
	}

	.album-card:hover {
		border-color: #28a745;
		box-shadow: 0 4px 12px rgba(40, 167, 69, 0.1);
	}

	.album-card.selected {
		border-color: #28a745;
		background: #f8fff9;
	}

	.album-header {
		display: flex;
		align-items: flex-start;
		padding: 1rem;
		cursor: pointer;
	}

	.album-checkbox {
		margin-right: 0.75rem;
		margin-top: 0.125rem;
	}

	.album-info {
		flex: 1;
		min-width: 0;
	}

	.album-name {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 1.1rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.album-stats {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.9rem;
		color: #666;
	}

	.expand-button {
		background: #f8f9fa;
		border: 1px solid #ddd;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
		color: #666;
		transition: all 0.2s ease;
	}

	.expand-button:hover {
		background: #28a745;
		color: white;
		border-color: #28a745;
	}

	.album-content {
		border-top: 1px solid #e9ecef;
		padding: 1rem;
		background: #f8f9fa;
	}

	.loading-photos {
		text-align: center;
		padding: 2rem;
	}

	.photos-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.5rem;
	}

	.photo-thumbnail {
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 4px;
		background: #f0f0f0;
	}

	.photo-thumbnail img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.2s ease;
	}

	.photo-thumbnail:hover img {
		transform: scale(1.05);
	}

	.photo-info {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, rgba(0,0,0,0.7));
		color: white;
		padding: 0.5rem;
		font-size: 0.75rem;
	}

	.more-photos {
		display: flex;
		align-items: center;
		justify-content: center;
		background: #e9ecef;
		border-radius: 4px;
		color: #666;
		font-weight: 500;
	}

	.no-photos {
		text-align: center;
		color: #666;
		padding: 2rem;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.albums-grid {
			grid-template-columns: 1fr;
		}

		.action-btn {
			min-width: 100%;
		}

		.action-header {
			flex-direction: column;
			gap: 0.5rem;
			text-align: center;
		}

		.photos-grid {
			grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		}
	}
</style>