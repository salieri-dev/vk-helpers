<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import * as d3 from 'd3';

	// Chart configuration props
	export let width: number | 'auto' = 'auto';
	export let height: number = 400;
	export let margin: { top: number; right: number; bottom: number; left: number } = {
		top: 40,
		right: 40,
		bottom: 60,
		left: 80
	};
	export let maxWidth: number = 800;
	export let minWidth: number = 400;
	export let responsive: boolean = true;

	// Chart data - passed through to slot
	export let data: any = null;

	// Elements
	let svgElement: SVGElement;
	let containerElement: HTMLDivElement;
	let mainGroup: SVGGElement;

	// Computed dimensions
	let actualWidth: number;
	let actualHeight: number;
	let innerWidth: number;
	let innerHeight: number;

	// Event dispatcher for chart events
	const dispatch = createEventDispatcher();

	// Calculate responsive width
	function calculateDimensions() {
		if (!containerElement) return;

		if (width === 'auto' && responsive) {
			const containerWidth = containerElement.getBoundingClientRect().width;
			actualWidth = Math.min(Math.max(containerWidth - 32, minWidth), maxWidth);
		} else {
			actualWidth = typeof width === 'number' ? width : minWidth;
		}

		actualHeight = height;
		innerWidth = actualWidth - margin.left - margin.right;
		innerHeight = actualHeight - margin.top - margin.bottom;
	}

	// Setup SVG and main group
	function setupSvg() {
		if (!svgElement) return;

		// Clear previous content
		d3.select(svgElement).selectAll('*').remove();

		// Set SVG dimensions
		const svg = d3.select(svgElement)
			.attr('width', actualWidth)
			.attr('height', actualHeight);

		// Create main group with margins
		mainGroup = svg.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`)
			.node() as SVGGElement;

		// Dispatch ready event with chart context
		dispatch('ready', {
			svg,
			g: d3.select(mainGroup),
			width: actualWidth,
			height: actualHeight,
			innerWidth,
			innerHeight,
			margin
		});
	}

	// Create and show tooltip
	export function showTooltip(event: MouseEvent, content: string, className: string = 'd3-tooltip') {
		// Remove any existing tooltips
		hideTooltip(className);

		const tooltip = d3.select('body').append('div')
			.attr('class', className)
			.style('position', 'absolute')
			.style('background', 'rgba(0, 0, 0, 0.8)')
			.style('color', 'white')
			.style('padding', '10px')
			.style('border-radius', '5px')
			.style('pointer-events', 'none')
			.style('font-size', '12px')
			.style('z-index', '1000')
			.style('opacity', 0);

		tooltip.html(content)
			.style('left', (event.pageX + 10) + 'px')
			.style('top', (event.pageY - 10) + 'px')
			.transition()
			.duration(200)
			.style('opacity', 1);

		return tooltip;
	}

	// Hide tooltip
	export function hideTooltip(className: string = 'd3-tooltip') {
		d3.selectAll(`.${className}`)
			.transition()
			.duration(200)
			.style('opacity', 0)
			.remove();
	}

	// Update chart when data or dimensions change
	function updateChart() {
		if (!svgElement || !containerElement) return;

		calculateDimensions();
		setupSvg();
	}

	// Handle window resize
	function handleResize() {
		if (responsive) {
			updateChart();
		}
	}

	// Reactive updates
	$: if (svgElement && containerElement && data !== null) {
		updateChart();
	}

	onMount(() => {
		if (data !== null) {
			updateChart();
		}

		// Add resize listener if responsive
		if (responsive) {
			window.addEventListener('resize', handleResize);
		}

		return () => {
			if (responsive) {
				window.removeEventListener('resize', handleResize);
			}
		};
	});

	onDestroy(() => {
		// Clean up tooltips
		hideTooltip();
		
		// Clean up SVG
		if (svgElement) {
			d3.select(svgElement).selectAll('*').remove();
		}
		
		// Remove resize listener
		if (responsive) {
			window.removeEventListener('resize', handleResize);
		}
	});

	// Export chart context for programmatic access
	export function getChartContext() {
		return {
			svg: d3.select(svgElement),
			g: mainGroup ? d3.select(mainGroup) : null,
			width: actualWidth,
			height: actualHeight,
			innerWidth,
			innerHeight,
			margin,
			showTooltip,
			hideTooltip
		};
	}
</script>

<div class="d3-chart-container" bind:this={containerElement}>
	<svg bind:this={svgElement}></svg>
	
	<!-- Slot for chart-specific content -->
	{#if mainGroup && innerWidth > 0 && innerHeight > 0}
		<slot 
			chartContext={{
				svg: d3.select(svgElement),
				g: d3.select(mainGroup),
				width: actualWidth,
				height: actualHeight,
				innerWidth,
				innerHeight,
				margin,
				showTooltip,
				hideTooltip
			}}
		></slot>
	{/if}
</div>

<style>
	.d3-chart-container {
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		background: white;
		border-radius: 8px;
		overflow: visible;
	}

	svg {
		max-width: 100%;
		height: auto;
		display: block;
	}

	/* Global tooltip styles */
	:global(.d3-tooltip) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
		line-height: 1.4;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(8px);
	}

	:global(.d3-tooltip strong) {
		display: block;
		margin-bottom: 4px;
		font-weight: 600;
	}
</style>