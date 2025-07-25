<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { archiveStore } from '$lib/stores/archive';
	import type { ChatInfo } from '$lib/stores/archive';
	import SelectionControls from '$lib/components/SelectionControls.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import ActionToolbar from '$lib/components/ActionToolbar.svelte';
	import StatusView from '$lib/components/StatusView.svelte';

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

	function handleSelectPage() {
		selectedChats = new Set(paginatedChats.map(chat => chat.id));
	}

	function handleSelectAll() {
		selectedChats = new Set(filteredChats.map(chat => chat.id));
	}

	function handleClearSelection() {
		selectedChats = new Set();
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
	{:else if archiveData?.chats.length > 0}
		<SelectionControls
			bind:searchQuery
			selectedCount={selectedChats.size}
			totalFiltered={filteredChats.length}
			{totalPages}
			{currentPage}
			placeholder="Search chats..."
			on:selectPage={handleSelectPage}
			on:selectAll={handleSelectAll}
			on:clearSelection={handleClearSelection}
			on:search={handleSearch}
		/>

		<ActionToolbar
			selectedCount={selectedChats.size}
			itemType="chats"
		>
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
		</ActionToolbar>

		<Pagination
			{currentPage}
			{totalPages}
			on:pageChange={handlePageChange}
		/>

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
		<StatusView
			status="empty"
			title="No Chats Found"
			message="No chats found in the archive."
			buttonText="Go Back"
			on:action={goBack}
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
		margin-bottom: 2rem;
	}

	.back-button {
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		border: 1px solid #dee2e6;
		color: #495057;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.75rem 1.25rem;
		margin-bottom: 1rem;
		border-radius: 8px;
		transition: all 0.2s ease;
		font-weight: 500;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.back-button:hover {
		background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
		border-color: #adb5bd;
		transform: translateY(-1px);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
		text-decoration: none;
	}

	.back-button:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	h1 {
		color: #333;
		margin-bottom: 0.5rem;
	}


	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
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
	.analyze-btn:hover {
		background: var(--analyze-btn-hover-bg);
		border-color: var(--analyze-btn-hover-border);
	}

	.download-btn:hover {
		background: var(--download-btn-hover-bg);
		border-color: var(--download-btn-hover-border);
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.action-btn {
			flex: 1;
			justify-content: center;
		}

		.btn-text {
			display: none;
		}
	}

</style>