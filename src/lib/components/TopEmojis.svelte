<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';

	export let emojiStats: Map<string, number> = new Map();
	export let topN = 10;

	let chartCanvas: HTMLCanvasElement;
	let chart: Chart;

	$: if (chartCanvas && emojiStats.size > 0) {
		drawChart();
	}

	function drawChart() {
		const topEmojis = Array.from(emojiStats.entries())
			.sort(([, a], [, b]) => b - a)
			.slice(0, topN);

		const labels = topEmojis.map(([emoji]) => emoji);
		const data = topEmojis.map(([, count]) => count);

		if (chart) {
			chart.data.labels = labels;
			chart.data.datasets[0].data = data;
			chart.update();
		} else {
			chart = new Chart(chartCanvas, {
				type: 'bar',
				data: {
					labels,
					datasets: [
						{
							label: 'Most Used Emojis',
							data,
							backgroundColor: 'rgba(75, 192, 192, 0.2)',
							borderColor: 'rgba(75, 192, 192, 1)',
							borderWidth: 1
						}
					]
				},
				options: {
					indexAxis: 'y',
					scales: {
						x: {
							beginAtZero: true
						}
					}
				}
			});
		}
	}
</script>

<div class="top-emojis-container">
	<canvas bind:this={chartCanvas}></canvas>
</div>

<style>
	.top-emojis-container {
		width: 100%;
		max-width: 600px;
		margin: auto;
	}
</style>