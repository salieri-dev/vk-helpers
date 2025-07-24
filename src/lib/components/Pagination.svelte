<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let currentPage = 1;
	export let totalPages = 1;
	export let maxVisiblePages = 5;

	$: visiblePages = getVisiblePages(currentPage, totalPages, maxVisiblePages);

	function getVisiblePages(current: number, total: number, maxVisible: number): number[] {
		if (total <= maxVisible) {
			return Array.from({ length: total }, (_, i) => i + 1);
		}

		const start = Math.max(1, current - Math.floor(maxVisible / 2));
		const end = Math.min(total, start + maxVisible - 1);
		const adjustedStart = Math.max(1, end - maxVisible + 1);

		return Array.from({ length: end - adjustedStart + 1 }, (_, i) => adjustedStart + i);
	}

	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages && page !== currentPage) {
			dispatch('pageChange', { page });
		}
	}

	function nextPage() {
		if (currentPage < totalPages) {
			goToPage(currentPage + 1);
		}
	}

	function prevPage() {
		if (currentPage > 1) {
			goToPage(currentPage - 1);
		}
	}
</script>

{#if totalPages > 1}
	<section class="pagination">
		<button
			class="pagination-btn"
			on:click={prevPage}
			disabled={currentPage <= 1}
			aria-label="Go to previous page"
		>
			← Previous
		</button>
		
		<div class="page-numbers">
			{#if visiblePages[0] > 1}
				<button
					class="page-number"
					on:click={() => goToPage(1)}
					aria-label="Go to page 1"
				>
					1
				</button>
				{#if visiblePages[0] > 2}
					<span class="ellipsis">...</span>
				{/if}
			{/if}

			{#each visiblePages as page}
				<button
					class="page-number"
					class:active={page === currentPage}
					on:click={() => goToPage(page)}
					aria-label="Go to page {page}"
					aria-current={page === currentPage ? 'page' : undefined}
				>
					{page}
				</button>
			{/each}

			{#if visiblePages[visiblePages.length - 1] < totalPages}
				{#if visiblePages[visiblePages.length - 1] < totalPages - 1}
					<span class="ellipsis">...</span>
				{/if}
				<button
					class="page-number"
					on:click={() => goToPage(totalPages)}
					aria-label="Go to page {totalPages}"
				>
					{totalPages}
				</button>
			{/if}
		</div>
		
		<button
			class="pagination-btn"
			on:click={nextPage}
			disabled={currentPage >= totalPages}
			aria-label="Go to next page"
		>
			Next →
		</button>
	</section>
{/if}

<style>
	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		margin: 2rem 0;
		padding: 1rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.pagination-btn {
		padding: 0.75rem 1rem;
		background: #f8f9fa;
		border: 1px solid #ddd;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
		color: #333;
	}

	.pagination-btn:hover:not(:disabled) {
		background: #e9ecef;
		border-color: #4a90e2;
		color: #4a90e2;
	}

	.pagination-btn:disabled {
		background: #f8f9fa;
		color: #999;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.page-numbers {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.page-number {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f8f9fa;
		border: 1px solid #ddd;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
		color: #333;
	}

	.page-number:hover {
		background: #e9ecef;
		border-color: #4a90e2;
		color: #4a90e2;
	}

	.page-number.active {
		background: #4a90e2;
		border-color: #4a90e2;
		color: white;
	}

	.page-number.active:hover {
		background: #357abd;
		border-color: #357abd;
	}

	.ellipsis {
		padding: 0 0.5rem;
		color: #999;
		font-size: 0.9rem;
	}

	@media (max-width: 768px) {
		.pagination {
			gap: 0.25rem;
			padding: 0.5rem;
		}

		.pagination-btn {
			padding: 0.5rem 0.75rem;
			font-size: 0.8rem;
		}

		.page-number {
			width: 35px;
			height: 35px;
			font-size: 0.8rem;
		}

		.ellipsis {
			padding: 0 0.25rem;
		}
	}
</style>