<script lang="ts">
	export let data: { [key: string]: number } | { [key: number]: number };
	export let type: 'hourly' | 'daily' = 'hourly';

	$: processedData = processData(data, type);

	function processData(rawData: { [key: string]: number } | { [key: number]: number }, dataType: string) {
		if (dataType === 'hourly') {
			// Create array for 24 hours
			const hourData = rawData as { [key: number]: number };
			const hours = Array.from({ length: 24 }, (_, i) => ({
				label: `${i}:00`,
				value: hourData[i] || 0,
				key: i
			}));
			return hours;
		} else {
			// Days of week in Russian
			const dayOrder = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
			const dayData = rawData as { [key: string]: number };
			const days = dayOrder.map(day => ({
				label: day.charAt(0).toUpperCase() + day.slice(1),
				value: dayData[day] || 0,
				key: day
			}));
			return days;
		}
	}

	$: maxValue = Math.max(...processedData.map(d => d.value), 1);

	function getIntensity(value: number): number {
		return value / maxValue;
	}

	function getColor(intensity: number): string {
		if (intensity === 0) return '#f8f9fa';
		
		const alpha = Math.max(0.1, intensity);
		return `rgba(74, 144, 226, ${alpha})`;
	}
</script>

<div class="heatmap">
	<div class="heatmap-grid" class:hourly={type === 'hourly'} class:daily={type === 'daily'}>
		{#each processedData as item (item.key)}
			<div 
				class="heatmap-cell"
				style="background-color: {getColor(getIntensity(item.value))}"
				title="{item.label}: {item.value} messages"
			>
				<div class="cell-label">{type === 'hourly' ? item.key : item.label.slice(0, 3)}</div>
				<div class="cell-value">{item.value}</div>
			</div>
		{/each}
	</div>
	
	<div class="legend">
		<span class="legend-label">Less</span>
		<div class="legend-scale">
			{#each Array(5) as _, i}
				<div 
					class="legend-item"
					style="background-color: {getColor(i / 4)}"
				></div>
			{/each}
		</div>
		<span class="legend-label">More</span>
	</div>
</div>

<style>
	.heatmap {
		width: 100%;
	}

	.heatmap-grid {
		display: grid;
		gap: 2px;
		margin-bottom: 1rem;
	}

	.heatmap-grid.hourly {
		grid-template-columns: repeat(8, 1fr);
	}

	.heatmap-grid.daily {
		grid-template-columns: repeat(7, 1fr);
	}

	.heatmap-cell {
		aspect-ratio: 1;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 0.25rem;
		transition: all 0.2s ease;
		cursor: help;
	}

	.heatmap-cell:hover {
		transform: scale(1.05);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 1;
		position: relative;
	}

	.cell-label {
		font-size: 0.7rem;
		font-weight: 500;
		color: #333;
		margin-bottom: 0.125rem;
	}

	.cell-value {
		font-size: 0.6rem;
		color: #666;
		font-weight: 600;
	}

	.legend {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: #666;
	}

	.legend-scale {
		display: flex;
		gap: 1px;
	}

	.legend-item {
		width: 12px;
		height: 12px;
		border: 1px solid #e0e0e0;
	}

	.legend-label {
		font-size: 0.7rem;
	}

	@media (max-width: 768px) {
		.heatmap-grid.hourly {
			grid-template-columns: repeat(6, 1fr);
		}
		
		.cell-label {
			font-size: 0.6rem;
		}
		
		.cell-value {
			font-size: 0.5rem;
		}
	}
</style>