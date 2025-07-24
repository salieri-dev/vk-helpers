<script lang="ts">
	import { slide } from 'svelte/transition';

	export let selectedCount = 0;
	export let itemType = 'items'; // e.g., 'chats', 'albums', 'items'
	export let title = 'Selected Actions';
	export let visible = false;
	
	$: visible = selectedCount > 0;
	$: itemLabel = selectedCount === 1 ? itemType.slice(0, -1) : itemType; // Remove 's' for singular
</script>

{#if visible}
	<section class="action-toolbar" transition:slide={{ duration: 300 }}>
		<div class="action-header">
			<h3>{title}</h3>
			<span class="selection-summary">
				{selectedCount} {itemLabel} selected
			</span>
		</div>
		<div class="action-buttons">
			<slot {selectedCount} />
		</div>
	</section>
{/if}

<style>
	.action-toolbar {
		position: sticky;
		top: 20px;
		z-index: 100;
		background: #4a90e2;
		color: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 4px 16px rgba(74, 144, 226, 0.3);
		margin: 2rem 0;
		border: 2px solid rgba(255, 255, 255, 0.2);
	}

	.action-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	}

	.action-header h3 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 600;
	}

	.selection-summary {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	/* Global styles for action buttons that can be used by slotted content */
	:global(.action-toolbar .action-btn) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		background: rgba(255, 255, 255, 0.15);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
		backdrop-filter: blur(10px);
	}

	:global(.action-toolbar .action-btn:hover) {
		background: rgba(255, 255, 255, 0.25);
		border-color: rgba(255, 255, 255, 0.5);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	:global(.action-toolbar .action-btn:active) {
		transform: translateY(0);
	}

	:global(.action-toolbar .btn-icon) {
		font-size: 1.1rem;
	}

	:global(.action-toolbar .btn-text) {
		font-weight: 500;
	}

	:global(.action-toolbar .btn-count) {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	/* Color variants for different button types */
	:global(.action-toolbar .analyze-btn:hover) {
		background: rgba(76, 175, 80, 0.2);
		border-color: rgba(76, 175, 80, 0.5);
	}

	:global(.action-toolbar .download-btn:hover) {
		background: rgba(255, 152, 0, 0.2);
		border-color: rgba(255, 152, 0, 0.5);
	}

	:global(.action-toolbar .delete-btn:hover) {
		background: rgba(244, 67, 54, 0.2);
		border-color: rgba(244, 67, 54, 0.5);
	}

	@media (max-width: 768px) {
		.action-toolbar {
			position: static;
			margin: 1rem 0;
			padding: 1rem;
		}

		.action-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.action-buttons {
			width: 100%;
		}

		:global(.action-toolbar .action-btn) {
			flex: 1;
			justify-content: center;
			padding: 1rem;
			font-size: 0.8rem;
		}

		:global(.action-toolbar .btn-text) {
			display: none;
		}

		:global(.action-toolbar .btn-icon) {
			font-size: 1.2rem;
		}
	}
</style>