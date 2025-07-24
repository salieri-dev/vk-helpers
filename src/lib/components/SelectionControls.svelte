<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let searchQuery = '';
	export let selectedCount = 0;
	export let totalFiltered = 0;
	export let totalPages = 1;
	export let currentPage = 1;
	export let placeholder = 'Search...';

	function handleSelectPage() {
		dispatch('selectPage');
	}

	function handleSelectAll() {
		dispatch('selectAll');
	}

	function handleClearSelection() {
		dispatch('clearSelection');
	}

	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchQuery = target.value;
		dispatch('search', { query: searchQuery });
	}
</script>

<section class="controls">
	<div class="search">
		<input
			type="text"
			{placeholder}
			value={searchQuery}
			on:input={handleSearchInput}
		/>
	</div>
	<div class="selection-controls">
		<button on:click={handleSelectPage}>Select Page</button>
		<button on:click={handleSelectAll}>Select All ({totalFiltered})</button>
		<button on:click={handleClearSelection}>Clear Selection</button>
		<span class="selected-count">
			{selectedCount} selected
		</span>
	</div>
	{#if totalPages > 1}
		<div class="pagination-info">
			<span>Page {currentPage} of {totalPages} ({totalFiltered} total items)</span>
		</div>
	{/if}
</section>

<style>
	.controls {
		margin-bottom: 2rem;
		background: white;
		padding: 1.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.search {
		margin-bottom: 1rem;
	}

	.search input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 1rem;
	}

	.search input:focus {
		outline: none;
		border-color: #4a90e2;
		box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
	}

	.selection-controls {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.selection-controls button {
		padding: 0.5rem 1rem;
		background: #f8f9fa;
		border: 1px solid #ddd;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
	}

	.selection-controls button:hover {
		background: #e9ecef;
		border-color: #4a90e2;
	}

	.selected-count {
		color: #4a90e2;
		font-weight: 500;
		padding: 0.5rem;
		background: #f0f8ff;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.pagination-info {
		color: #666;
		font-size: 0.9rem;
	}

	@media (max-width: 768px) {
		.selection-controls {
			justify-content: space-between;
		}

		.selection-controls button {
			font-size: 0.8rem;
			padding: 0.4rem 0.8rem;
		}
	}
</style>