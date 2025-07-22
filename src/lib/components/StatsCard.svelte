<script lang="ts">
	export let title: string;
	export let value: string;
	export let subtitle: string = '';
	export let icon: string = '';
</script>

<div class="stats-card">
	{#if icon}
		<div class="icon">{icon}</div>
	{/if}
	<div class="content">
		<h3 class="title">{title}</h3>
		<div class="value">{value}</div>
		{#if subtitle}
			<div class="subtitle">{subtitle}</div>
		{/if}
	</div>
</div>

<style>
	.stats-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		display: flex;
		align-items: center;
		gap: 1rem;
		transition: box-shadow 0.2s ease;
	}

	.stats-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.icon {
		font-size: 2rem;
		flex-shrink: 0;
	}

	.content {
		flex: 1;
		min-width: 0;
	}

	.title {
		color: #666;
		font-size: 0.9rem;
		font-weight: 500;
		margin: 0 0 0.5rem 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.value {
		color: #333;
		font-size: 1.8rem;
		font-weight: 600;
		margin-bottom: 0.25rem;
		line-height: 1;
	}

	.subtitle {
		color: #4a90e2;
		font-size: 0.8rem;
		font-weight: 500;
	}
</style>