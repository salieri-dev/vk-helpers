<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import cloud from 'd3-cloud';

	export let emojiStats: Map<string, number> = new Map();
	export let scale: 'sqrt' | 'linear' | 'log' = 'sqrt';

	let svgElement: SVGElement;
	let width = 0;
	const height = 300;

	$: if (svgElement && width > 0 && emojiStats.size > 0) {
		drawEmojiCloud();
	}

	function drawEmojiCloud() {
		d3.select(svgElement).selectAll('*').remove();

		const svg = d3
			.select(svgElement)
			.attr('width', width)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${width / 2},${height / 2})`);

		const emojis = Array.from(emojiStats.entries()).map(([emoji, count]) => ({
			text: emoji,
			count
		}));

		const maxCount = d3.max(emojis, (d) => d.count);

		let fontSize;
		switch (scale) {
			case 'linear':
				fontSize = d3
					.scaleLinear()
					.domain([0, maxCount || 1])
					.range([20, 80]);
				break;
			case 'log':
				fontSize = d3
					.scaleLog()
					.domain([1, maxCount || 1])
					.range([20, 80]);
				break;
			case 'sqrt':
			default:
				fontSize = d3
					.scaleSqrt()
					.domain([0, maxCount || 1])
					.range([20, 80]);
				break;
		}

		const layout = cloud()
			.size([width, height])
			.words(emojis.map((d) => ({ text: d.text, size: fontSize(d.count), count: d.count })))
			.padding(5)
			.rotate(0)
			.fontSize((d: any) => d.size)
			.on('end', draw);

		layout.start();

		function draw(drawnWords: any[]) {
			const updateSelection = svg.selectAll<SVGTextElement, any>('text').data(drawnWords, (d: any) => d.text);

			updateSelection.exit().transition().duration(200).style('fill-opacity', 1e-6).remove();

			const enterSelection = updateSelection
				.enter()
				.append('text')
				.style('font-size', (d: any) => `${d.size}px`)
				.style('fill-opacity', 1e-6)
				.attr('text-anchor', 'middle')
				.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
				.text((d: any) => d.text);
			
			enterSelection.merge(updateSelection)
				.transition().duration(600)
				.style('fill-opacity', 1);
		}
	}
</script>

<div class="emoji-cloud-container" bind:clientWidth={width}>
	<svg bind:this={svgElement}></svg>
</div>

<style>
	.emoji-cloud-container {
		width: 100%;
		min-height: 300px;
	}
	svg {
		width: 100%;
		height: 100%;
	}
</style>