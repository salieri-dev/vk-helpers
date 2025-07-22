<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { archiveStore } from '$lib/stores/archive';
	import type { ChatInfo } from '$lib/stores/archive';

	let archiveData: typeof $archiveStore;
	let selectedChats: Set<string> = new Set();
	let searchQuery = '';
	let currentPage = 1;
	let itemsPerPage = 50;

	$: filteredChats = archiveData?.chats
		.filter(chat =>
			chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			chat.id.includes(searchQuery)
		)
		.sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0)) || [];

	$: totalPages = Math.ceil(filteredChats.length / itemsPerPage);
	$: paginatedChats = filteredChats.slice(
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

	function toggleChat(chatId: string) {
		if (selectedChats.has(chatId)) {
			selectedChats.delete(chatId);
		} else {
			selectedChats.add(chatId);
		}
		selectedChats = new Set(selectedChats); // Trigger reactivity
	}

	function selectAll() {
		selectedChats = new Set(paginatedChats.map(chat => chat.id));
	}

	function selectAllFiltered() {
		selectedChats = new Set(filteredChats.map(chat => chat.id));
	}

	function selectNone() {
		selectedChats = new Set();
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

	function analyzeSelected() {
		if (selectedChats.size === 0) {
			alert('Please select at least one chat to analyze.');
			return;
		}

		// Store selected chats and navigate to analytics
		const selectedChatIds = Array.from(selectedChats);
		goto(`/analytics?chats=${selectedChatIds.join(',')}`);
	}

	function downloadImages() {
		if (selectedChats.size === 0) {
			alert('Please select at least one chat to download images from.');
			return;
		}

		// Store selected chats and navigate to download page
		const selectedChatIds = Array.from(selectedChats);
		goto(`/download?chats=${selectedChatIds.join(',')}`);
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
	<title>Select Chats - VK Archive Analytics</title>
</svelte:head>

<main class="container">
	<header>
		<button class="back-button" on:click={goBack}>← Back</button>
		<h1>Select Chats to Analyze</h1>
		<p>Choose which conversations you want to analyze. You can select multiple chats.</p>
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
	{:else if archiveData?.chats.length > 0}
		<section class="controls">
			<div class="search">
				<input
					type="text"
					placeholder="Search chats..."
					bind:value={searchQuery}
				/>
			</div>
			<div class="selection-controls">
				<button on:click={selectAll}>Select Page</button>
				<button on:click={selectAllFiltered}>Select All ({filteredChats.length})</button>
				<button on:click={selectNone}>Clear Selection</button>
				<span class="selected-count">
					{selectedChats.size} selected
				</span>
			</div>
			{#if totalPages > 1}
				<div class="pagination-info">
					<span>Page {currentPage} of {totalPages} ({filteredChats.length} total chats)</span>
				</div>
			{/if}
		</section>

		{#if selectedChats.size > 0}
			<section class="action-controls" transition:slide={{ duration: 300 }}>
				<div class="action-header">
					<h3>Selected Actions</h3>
					<span class="selection-summary">{selectedChats.size} chat{selectedChats.size !== 1 ? 's' : ''} selected</span>
				</div>
				<div class="action-buttons">
					<button
						class="action-btn analyze-btn"
						on:click={analyzeSelected}
						aria-label="Analyze {selectedChats.size} selected chats"
					>
						<span class="btn-icon">📊</span>
						<span class="btn-text">Analyze Selected</span>
						<span class="btn-count">({selectedChats.size})</span>
					</button>
					<button
						class="action-btn download-btn"
						on:click={downloadImages}
						aria-label="Download images from {selectedChats.size} selected chats"
					>
						<span class="btn-icon">📸</span>
						<span class="btn-text">Download Images</span>
						<span class="btn-count">({selectedChats.size})</span>
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

		<section class="chat-grid">
			{#each paginatedChats as chat (chat.id)}
				<div
					class="chat-card"
					class:selected={selectedChats.has(chat.id)}
					role="button"
					tabindex="0"
					on:click={() => toggleChat(chat.id)}
					on:keydown={(e) => e.key === 'Enter' && toggleChat(chat.id)}
				>
					<div class="chat-checkbox">
						<input
							type="checkbox"
							checked={selectedChats.has(chat.id)}
							on:change={() => toggleChat(chat.id)}
						/>
					</div>
					<div class="chat-info">
						<h3 class="chat-name">{chat.name}</h3>
						<div class="message-count">~{chat.messageCount || 0} messages</div>
					</div>
				</div>
			{/each}
		</section>
	{:else}
		<div class="no-chats">
			<p>No chats found in the archive.</p>
			<button on:click={goBack}>Go Back</button>
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

	.loading, .error, .no-chats {
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

	.pagination-btn {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		background: white;
		color: #333;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.pagination-btn:hover:not(:disabled) {
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

	.page-number {
		padding: 0.5rem 0.75rem;
		border: 1px solid #ddd;
		background: white;
		color: #333;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 40px;
	}

	.page-number:hover {
		background: #4a90e2;
		color: white;
		border-color: #4a90e2;
	}

	.page-number.active {
		background: #4a90e2;
		color: white;
		border-color: #4a90e2;
	}

	.chat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.chat-card {
		display: flex;
		align-items: flex-start;
		padding: 1rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		background: white;
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 80px;
	}

	.chat-card:hover {
		border-color: #4a90e2;
		box-shadow: 0 2px 8px rgba(74, 144, 226, 0.1);
	}

	.chat-card.selected {
		border-color: #4a90e2;
		background: #e3f2fd;
	}

	.chat-checkbox {
		margin-right: 0.75rem;
		margin-top: 0.125rem;
	}

	.chat-info {
		flex: 1;
		min-width: 0;
	}

	.chat-name {
		margin: 0 0 0.5rem 0;
		color: #333;
		font-size: 1rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.message-count {
		color: #4a90e2;
		font-size: 0.9rem;
		font-weight: 500;
	}

	/* Action Controls Section */
	.action-controls {
		background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
		border: 2px solid #4a90e2;
		border-radius: 12px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 4px 12px rgba(74, 144, 226, 0.15);
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
		background: linear-gradient(90deg, #4a90e2, #7b1fa2, #4a90e2);
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
		border-bottom: 1px solid rgba(74, 144, 226, 0.2);
	}

	.action-header h3 {
		margin: 0;
		color: #2c5aa0;
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
		min-width: 200px;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.action-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}

	.action-btn:active {
		transform: translateY(0);
	}

	.analyze-btn {
		background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
		color: white;
	}

	.analyze-btn:hover {
		background: linear-gradient(135deg, #357abd 0%, #2c5aa0 100%);
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

	.btn-text {
		font-weight: 600;
	}

	.btn-count {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.85rem;
		font-weight: 700;
	}

	/* Responsive Design */
	@media (max-width: 600px) {
		.action-buttons {
			flex-direction: column;
		}
		
		.action-btn {
			min-width: 100%;
		}
		
		.action-header {
			flex-direction: column;
			gap: 0.5rem;
			text-align: center;
		}
	}

	@media (max-width: 480px) {
		.action-controls {
			padding: 1rem;
			margin-bottom: 1rem;
		}
		
		.btn-text {
			display: none;
		}
		
		.action-btn {
			min-width: auto;
			padding: 0.75rem 1rem;
		}
		
		.action-buttons {
			flex-direction: row;
			justify-content: space-around;
		}
	}
</style>