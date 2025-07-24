<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let status: 'loading' | 'error' | 'empty' = 'loading';
	export let title: string = '';
	export let message: string = '';
	export let buttonText: string = '';
	export let buttonVariant: 'primary' | 'secondary' = 'primary';
	export let spinnerSize: 'small' | 'medium' | 'large' = 'medium';
	
	// Loading-specific props
	export let showProgressBar: boolean = false;
	export let progress: number = 0;
	export let progressTotal: number = 100;
	export let progressText: string = '';
	
	// Additional content slot for custom elements
	export let showButton: boolean = true;

	const dispatch = createEventDispatcher();

	// Default values based on status
	$: defaultTitle = getDefaultTitle(status);
	$: defaultMessage = getDefaultMessage(status);
	$: defaultButtonText = getDefaultButtonText(status);
	
	$: displayTitle = title || defaultTitle;
	$: displayMessage = message || defaultMessage;
	$: displayButtonText = buttonText || defaultButtonText;
	
	$: spinnerClass = getSpinnerClass(spinnerSize);
	$: progressPercentage = progressTotal > 0 ? Math.min((progress / progressTotal) * 100, 100) : 0;

	function getDefaultTitle(status: string): string {
		switch (status) {
			case 'loading': return 'Loading...';
			case 'error': return 'Error';
			case 'empty': return 'No Data Found';
			default: return '';
		}
	}

	function getDefaultMessage(status: string): string {
		switch (status) {
			case 'loading': return 'Please wait while we process your request.';
			case 'error': return 'Something went wrong. Please try again.';
			case 'empty': return 'No data was found.';
			default: return '';
		}
	}

	function getDefaultButtonText(status: string): string {
		switch (status) {
			case 'loading': return '';
			case 'error': return 'Try Again';
			case 'empty': return 'Go Back';
			default: return 'OK';
		}
	}

	function getSpinnerClass(size: string): string {
		switch (size) {
			case 'small': return 'spinner-small';
			case 'large': return 'spinner-large';
			default: return 'spinner';
		}
	}

	function handleButtonClick() {
		dispatch('action');
	}
</script>

<div class="status-container {status}">
	{#if status === 'loading'}
		<div class={spinnerClass}></div>
	{/if}
	
	{#if displayTitle}
		<h3 class="status-title">{displayTitle}</h3>
	{/if}
	
	{#if displayMessage}
		<p class="status-message">{displayMessage}</p>
	{/if}

	{#if status === 'loading' && showProgressBar && progressTotal > 0}
		<div class="progress-bar-container">
			<div class="progress-bar">
				<div class="progress-fill" style="width: {progressPercentage}%"></div>
			</div>
			{#if progressText}
				<small class="progress-text">{progressText}</small>
			{:else}
				<small class="progress-text">
					{Math.floor(progress)} of {progressTotal}
				</small>
			{/if}
		</div>
	{/if}

	<!-- Custom content slot -->
	<slot></slot>

	{#if showButton && displayButtonText && status !== 'loading'}
		<button 
			class="status-button {buttonVariant}" 
			on:click={handleButtonClick}
		>
			{displayButtonText}
		</button>
	{/if}
</div>

<style>
	.progress-bar-container {
		margin: 1.5rem 0;
		width: 100%;
		max-width: 300px;
		margin-left: auto;
		margin-right: auto;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: #e0e0e0;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.progress-text {
		display: block;
		color: var(--text-muted);
		font-size: 0.9rem;
		text-align: center;
	}

	/* Status-specific styling */
	.status-container.error .status-title {
		color: var(--error-color);
	}

	.status-container.loading .status-title {
		color: var(--primary-color);
	}

	.status-container.empty .status-title {
		color: var(--text-muted);
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.status-container {
			padding: 2rem 1rem;
			margin: 1rem 0;
		}

		.status-title {
			font-size: 1.25rem;
		}

		.progress-bar-container {
			max-width: 250px;
		}
	}
</style>