<script lang="ts">
	import { onMount, onDestroy, afterUpdate } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import type { ChatAnalytics } from '$lib/utils/messageParser';

	export let analytics: ChatAnalytics[];

	let chartContainer: HTMLCanvasElement;
	let chartInstance: Chart | null = null;

	// Register Chart.js components
	Chart.register(...registerables);

	$: timelineData = generateTimelineData(analytics);

	function generateTimelineData(data: ChatAnalytics[]) {
		if (data.length === 0) return [];

		// Get all messages from all chats
		const allMessages = data.flatMap(chat => 
			chat.messages.map(msg => ({
				...msg,
				chatName: chat.chatName
			}))
		);

		// Sort by timestamp
		allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		// Group messages by month for timeline
		const monthlyData = new Map<string, number>();
		
		allMessages.forEach(message => {
			const monthKey = `${message.timestamp.getFullYear()}-${String(message.timestamp.getMonth() + 1).padStart(2, '0')}`;
			monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + 1);
		});

		// Convert to array and sort
		return Array.from(monthlyData.entries())
			.map(([monthKey, count]) => ({
				month: monthKey,
				count,
				date: new Date(monthKey + '-01')
			}))
			.sort((a, b) => a.date.getTime() - b.date.getTime());
	}

	function formatMonth(date: Date): string {
		return new Intl.DateTimeFormat('ru-RU', {
			year: 'numeric',
			month: 'short'
		}).format(date);
	}

	function createChart() {
		if (!chartContainer || timelineData.length === 0) return;

		const ctx = chartContainer.getContext('2d');
		if (!ctx) return;

		// Destroy existing chart
		if (chartInstance) {
			chartInstance.destroy();
		}

		// Prepare data for Chart.js
		const labels = timelineData.map(item => formatMonth(item.date));
		const data = timelineData.map(item => item.count);
		
		// Create gradient
		const gradient = ctx.createLinearGradient(0, 0, 0, 400);
		gradient.addColorStop(0, 'rgba(74, 144, 226, 0.8)');
		gradient.addColorStop(1, 'rgba(74, 144, 226, 0.2)');

		chartInstance = new Chart(ctx, {
			type: 'line',
			data: {
				labels,
				datasets: [{
					label: 'Messages per Month',
					data,
					borderColor: '#4a90e2',
					backgroundColor: gradient,
					borderWidth: 3,
					fill: true,
					tension: 0.4,
					pointBackgroundColor: '#4a90e2',
					pointBorderColor: '#ffffff',
					pointBorderWidth: 2,
					pointRadius: 5,
					pointHoverRadius: 8,
					pointHoverBackgroundColor: '#357abd',
					pointHoverBorderColor: '#ffffff',
					pointHoverBorderWidth: 3
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					intersect: false,
					mode: 'index'
				},
				plugins: {
					title: {
						display: true,
						text: 'Message Activity Over Time',
						font: {
							size: 16,
							weight: 'bold'
						},
						color: '#333',
						padding: {
							bottom: 20
						}
					},
					legend: {
						display: false
					},
					tooltip: {
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						titleColor: '#ffffff',
						bodyColor: '#ffffff',
						borderColor: '#4a90e2',
						borderWidth: 1,
						cornerRadius: 6,
						displayColors: false,
						callbacks: {
							title: function(context) {
								return context[0].label;
							},
							label: function(context) {
								const count = context.parsed.y;
								return `${count.toLocaleString()} messages`;
							},
							afterLabel: function(context) {
								const total = data.reduce((sum, val) => sum + val, 0);
								const percentage = ((context.parsed.y / total) * 100).toFixed(1);
								return `${percentage}% of total activity`;
							}
						}
					}
				},
				scales: {
					x: {
						display: true,
						title: {
							display: true,
							text: 'Time Period',
							font: {
								size: 12,
								weight: 'bold'
							},
							color: '#666'
						},
						ticks: {
							color: '#666',
							font: {
								size: 11
							},
							maxRotation: 45,
							minRotation: 0
						},
						grid: {
							display: false
						}
					},
					y: {
						display: true,
						title: {
							display: true,
							text: 'Message Count',
							font: {
								size: 12,
								weight: 'bold'
							},
							color: '#666'
						},
						ticks: {
							color: '#666',
							font: {
								size: 11
							},
							callback: function(value) {
								return typeof value === 'number' ? value.toLocaleString() : value;
							}
						},
						grid: {
							color: 'rgba(0, 0, 0, 0.1)'
						},
						beginAtZero: true
					}
				},
				elements: {
					point: {
						hoverBorderWidth: 3
					}
				},
				animation: {
					duration: 1000,
					easing: 'easeInOutQuart'
				}
			}
		});
	}

	// Reactive chart updates
	$: if (chartContainer && timelineData.length > 0) {
		createChart();
	}

	onMount(() => {
		if (timelineData.length > 0) {
			createChart();
		}
	});

	afterUpdate(() => {
		if (chartContainer && timelineData.length > 0 && !chartInstance) {
			createChart();
		}
	});

	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
		}
	});

	// Calculate summary statistics
	$: totalMessages = timelineData.reduce((sum, item) => sum + item.count, 0);
	$: averagePerMonth = timelineData.length > 0 ? Math.round(totalMessages / timelineData.length) : 0;
	$: peakMonth = timelineData.length > 0 
		? timelineData.reduce((peak, item) => item.count > peak.count ? item : peak, timelineData[0])
		: null;
</script>

<div class="timeline-chart">
	{#if timelineData.length > 0}
		<div class="chart-container">
			<canvas bind:this={chartContainer}></canvas>
		</div>
		
		<div class="chart-summary">
			<div class="summary-item">
				<span class="summary-label">Total Messages</span>
				<span class="summary-value">{totalMessages.toLocaleString()}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Average per Month</span>
				<span class="summary-value">{averagePerMonth.toLocaleString()}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Peak Activity</span>
				<span class="summary-value">
					{#if peakMonth}
						{formatMonth(peakMonth.date)}
						<small>({peakMonth.count.toLocaleString()} msgs)</small>
					{/if}
				</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Time Period</span>
				<span class="summary-value">
					{timelineData.length > 1 
						? `${formatMonth(timelineData[0].date)} - ${formatMonth(timelineData[timelineData.length - 1].date)}`
						: formatMonth(timelineData[0].date)
					}
				</span>
			</div>
		</div>
	{:else}
		<div class="no-data">
			<div class="no-data-icon">📈</div>
			<h4>No Timeline Data Available</h4>
			<p>No messages found in the selected date range and filters.</p>
		</div>
	{/if}
</div>

<style>
	.timeline-chart {
		background: white;
		border: 1px solid #ddd;
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
		transition: box-shadow 0.2s ease;
	}

	.timeline-chart:hover {
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
	}

	.chart-container {
		position: relative;
		height: 350px;
		margin-bottom: 2rem;
	}

	.chart-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem;
		padding-top: 1.5rem;
		border-top: 2px solid #f0f0f0;
	}

	.summary-item {
		text-align: center;
		background: linear-gradient(135deg, #f8f9fa, #e9ecef);
		padding: 1rem;
		border-radius: 8px;
		border: 1px solid #e9ecef;
		transition: all 0.2s ease;
	}

	.summary-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(74, 144, 226, 0.15);
	}

	.summary-label {
		display: block;
		font-size: 0.85rem;
		color: #666;
		margin-bottom: 0.5rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.summary-value {
		display: block;
		font-size: 1.1rem;
		font-weight: 700;
		color: #4a90e2;
		line-height: 1.2;
	}

	.summary-value small {
		display: block;
		font-size: 0.8rem;
		font-weight: 400;
		color: #666;
		margin-top: 0.25rem;
	}

	.no-data {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 300px;
		text-align: center;
		color: #666;
		background: linear-gradient(135deg, #f8f9fa, #e9ecef);
		border-radius: 8px;
		border: 2px dashed #dee2e6;
	}

	.no-data-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.6;
	}

	.no-data h4 {
		margin: 0 0 0.5rem 0;
		color: #495057;
		font-size: 1.2rem;
	}

	.no-data p {
		margin: 0;
		font-size: 0.9rem;
		opacity: 0.8;
	}

	@media (max-width: 768px) {
		.timeline-chart {
			padding: 1rem;
		}
		
		.chart-container {
			height: 250px;
		}
		
		.chart-summary {
			grid-template-columns: 1fr 1fr;
			gap: 1rem;
		}
		
		.summary-item {
			padding: 0.75rem;
		}
		
		.summary-label {
			font-size: 0.75rem;
		}
		
		.summary-value {
			font-size: 1rem;
		}
	}

	@media (max-width: 480px) {
		.chart-summary {
			grid-template-columns: 1fr;
		}
		
		.chart-container {
			height: 200px;
		}
	}
</style>