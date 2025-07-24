<script lang="ts">
	import Chart from '$lib/components/Chart.svelte';
	import type { ChatAnalytics } from '$lib/utils/messageParser';

	export let chat: ChatAnalytics;

	$: relationshipTimelineOptions = {
		series: [{
			name: "You",
			data: chat.relationshipTimeline.map(period => period.userMessages)
		}, {
			name: "Them",
			data: chat.relationshipTimeline.map(period => period.otherMessages)
		}],
		chart: {
			type: 'bar',
			height: 350,
			stacked: true,
			toolbar: { show: false }
		},
		xaxis: {
			categories: chat.relationshipTimeline.map(period => period.month),
			title: { text: 'Month' }
		},
		yaxis: {
			title: { text: 'Message Count' }
		},
		title: {
			text: `Relationship Timeline - ${chat.chatName}`,
			align: 'center'
		},
		legend: {
			position: 'top'
		}
	};
</script>

{#if chat.relationshipTimeline.length > 1}
	<div class="chart-wrapper">
		<Chart options={relationshipTimelineOptions} />
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