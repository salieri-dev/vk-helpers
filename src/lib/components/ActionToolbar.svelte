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

		/* CSS custom properties for action buttons */
		--action-btn-bg: rgba(255, 255, 255, 0.15);
		--action-btn-hover-bg: rgba(255, 255, 255, 0.25);
		--action-btn-border: 1px solid rgba(255, 255, 255, 0.3);
		--action-btn-hover-border: rgba(255, 255, 255, 0.5);
		--action-btn-color: white;
		--action-btn-padding: 0.75rem 1.5rem;
		--action-btn-border-radius: 8px;
		--action-btn-font-size: 0.9rem;
		--action-btn-font-weight: 500;

		/* Button variants */
		--analyze-btn-hover-bg: rgba(76, 175, 80, 0.2);
		--analyze-btn-hover-border: rgba(76, 175, 80, 0.5);
		--download-btn-hover-bg: rgba(255, 152, 0, 0.2);
		--download-btn-hover-border: rgba(255, 152, 0, 0.5);
		--delete-btn-hover-bg: rgba(244, 67, 54, 0.2);
		--delete-btn-hover-border: rgba(244, 67, 54, 0.5);

		/* Button elements */
		--btn-icon-font-size: 1.1rem;
		--btn-text-font-weight: 500;
		--btn-count-bg: rgba(255, 255, 255, 0.2);
		--btn-count-padding: 0.25rem 0.5rem;
		--btn-count-border-radius: 12px;
		--btn-count-font-size: 0.8rem;
		--btn-count-font-weight: 600;
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

	/* Styling hint: Use CSS custom properties in slotted content */
	/* Example:
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

		.analyze-btn:hover {
			background: var(--analyze-btn-hover-bg);
			border-color: var(--analyze-btn-hover-border);
		}
	*/

	@media (max-width: 768px) {
		.action-toolbar {
			position: static;
			margin: 1rem 0;
			padding: 1rem;

			/* Mobile overrides for CSS custom properties */
			--action-btn-padding: 1rem;
			--action-btn-font-size: 0.8rem;
			--btn-icon-font-size: 1.2rem;
		}

		.action-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.action-buttons {
			width: 100%;
		}
	}
</style>