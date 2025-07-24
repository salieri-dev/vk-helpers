<script lang="ts">
	import Chart from '$lib/components/Chart.svelte';
	import type { ChatAnalytics } from '$lib/utils/messageParser';

	export let chat: ChatAnalytics;

	$: conversationBalanceOptions = {
		series: [chat.conversationBalance.messageRatio, 1],
		chart: {
			type: 'donut',
			height: 350
		},
		labels: ['You', 'Them'],
		title: {
			text: `Conversation Balance - ${chat.chatName}`,
			align: 'center'
		},
		legend: {
			position: 'bottom'
		}
	};
</script>

{#if chat.userMessages > 0 && chat.otherMessages > 0}
	<div class="chart-wrapper">
		<Chart options={conversationBalanceOptions} />
	</div>
{/if}

<style>
	.chart-wrapper {
		background: white;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
	}
	.chart-wrapper:empty {
		display: none;
	}
</style>