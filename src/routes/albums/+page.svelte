<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { archiveStore } from '$lib/stores/archive';
	import { parseAlbumPhotos } from '$lib/utils/albumParser';
	import type { AlbumInfo, PhotoInfo } from '$lib/stores/archive';
	import SelectionControls from '$lib/components/SelectionControls.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import ActionToolbar from '$lib/components/ActionToolbar.svelte';
	import StatusView from '$lib/components/StatusView.svelte';

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

	function handleSelectPage() {
		selectedAlbums = new Set(paginatedAlbums.map(album => album.id));
	}

	function handleSelectAll() {
		selectedAlbums = new Set(filteredAlbums.map(album => album.id));
	}

	function handleClearSelection() {
		selectedAlbums = new Set();
	}

	function handlePageChange(event: CustomEvent) {
		currentPage = event.detail.page;
	}

	function handleSearch(event: CustomEvent) {
		searchQuery = event.detail.query;
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
		<StatusView
			status="loading"
			title="Processing Archive"
			message="Processing your archive..."
			spinnerSize="medium"
		/>
	{:else if archiveData?.error}
		<StatusView
			status="error"
			title="Error Processing Archive"
			message="Error: {archiveData.error}"
			buttonText="Go Back"
			on:action={goBack}
		/>
	{:else if archiveData?.albums.length > 0}
		<SelectionControls
			bind:searchQuery
			selectedCount={selectedAlbums.size}
			totalFiltered={filteredAlbums.length}
			{totalPages}
			{currentPage}
			placeholder="Search albums..."
			on:selectPage={handleSelectPage}
			on:selectAll={handleSelectAll}
			on:clearSelection={handleClearSelection}
			on:search={handleSearch}
		/>

		<ActionToolbar
			selectedCount={selectedAlbums.size}
			itemType="albums"
			title="Download Albums"
		>
			<button
				class="action-btn download-btn"
				on:click={downloadAlbums}
				aria-label="Download {selectedAlbums.size} selected albums"
			>
				<span class="btn-icon">💾</span>
				<span class="btn-text">Download Selected Albums</span>
				<span class="btn-count">({selectedAlbums.size})</span>
			</button>
		</ActionToolbar>

		<Pagination
			{currentPage}
			{totalPages}
			on:pageChange={handlePageChange}
		/>

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
		<StatusView
			status="empty"
			title="No Albums Found"
			message="No photo albums found in the archive."
			buttonText="Go Back"
			on:action={goBack}
		/>
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

	/* Action button styles using CSS custom properties */
	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: var(--action-btn-padding);
		background: var(--action-btn-bg);
		color: var(--action-btn-color);
		border: var(--action-btn-border);
		border-radius: var(--action-btn-border-radius);
		cursor: pointer;
		font-size: var(--action-btn-font-size);
		font-weight: var(--action-btn-font-weight);
		transition: all 0.2s ease;
		backdrop-filter: blur(10px);
	}

	.action-btn:hover {
		background: var(--action-btn-hover-bg);
		border-color: var(--action-btn-hover-border);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.action-btn:active {
		transform: translateY(0);
	}

	.btn-icon {
		font-size: var(--btn-icon-font-size);
	}

	.btn-text {
		font-weight: var(--btn-text-font-weight);
	}

	.btn-count {
		background: var(--btn-count-bg);
		padding: var(--btn-count-padding);
		border-radius: var(--btn-count-border-radius);
		font-size: var(--btn-count-font-size);
		font-weight: var(--btn-count-font-weight);
	}

	/* Button variant styles */
	.download-btn:hover {
		background: var(--download-btn-hover-bg);
		border-color: var(--download-btn-hover-border);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.albums-grid {
			grid-template-columns: 1fr;
		}

		.action-btn {
			flex: 1;
			justify-content: center;
			min-width: 100%;
		}

		.btn-text {
			display: none;
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