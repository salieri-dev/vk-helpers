<script lang="ts">
	import type { ResponseTimeStats } from '$lib/utils/messageParser';

	export let stats: ResponseTimeStats;
	export let userName: string = 'User';

	function formatResponseTime(minutes: number): string {
		if (minutes < 1) {
			return `${Math.round(minutes * 60)}s`;
		} else if (minutes < 60) {
			return `${Math.round(minutes)}m`;
		} else if (minutes < 1440) {
			const hours = Math.floor(minutes / 60);
			const remainingMinutes = Math.round(minutes % 60);
			return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
		} else {
			const days = Math.floor(minutes / 1440);
			const remainingHours = Math.floor((minutes % 1440) / 60);
			return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
		}
	}

	function getResponseTimeCategory(minutes: number): string {
		if (minutes < 5) return 'instant';
		if (minutes < 30) return 'quick';
		if (minutes < 120) return 'moderate';
		if (minutes < 720) return 'slow';
		return 'very-slow';
	}

	function calculateResponseTimeDistribution(responseTimes: number[]) {
		const categories = {
			'< 5min': 0,
			'5-30min': 0,
			'30min-2h': 0,
			'2-12h': 0,
			'> 12h': 0
		};

		responseTimes.forEach(time => {
			if (time < 5) categories['< 5min']++;
			else if (time < 30) categories['5-30min']++;
			else if (time < 120) categories['30min-2h']++;
			else if (time < 720) categories['2-12h']++;
			else categories['> 12h']++;
		});

		return categories;
	}

	$: distribution = stats.totalResponses > 0 ? calculateResponseTimeDistribution(stats.responseTimes) : null;
	$: maxCount = distribution ? Math.max(...Object.values(distribution)) : 0;
</script>

<div class="response-time-stats">
	<h4>Response Time Analysis - {userName}</h4>
	
	{#if stats.totalResponses === 0}
		<div class="no-data">
			<p>No response time data available</p>
			<small>Response times are calculated based on message exchanges between different users.</small>
		</div>
	{:else}
		<div class="stats-overview">
			<div class="stat-item">
				<span class="stat-label">Average Response</span>
				<span class="stat-value average">{formatResponseTime(stats.averageResponseTime)}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">Median Response</span>
				<span class="stat-value median">{formatResponseTime(stats.medianResponseTime)}</span>
			</div>
			<div class="stat-item">
				<span class="stat-label">Total Responses</span>
				<span class="stat-value total">{stats.totalResponses.toLocaleString()}</span>
			</div>
		</div>

		{#if distribution}
			<div class="distribution">
				<h5>Response Time Distribution</h5>
				<div class="distribution-bars">
					{#each Object.entries(distribution) as [category, count]}
						<div class="distribution-item">
							<span class="category-label">{category}</span>
							<div class="distribution-bar">
								<div 
									class="distribution-fill {getResponseTimeCategory(category === '< 5min' ? 2 : category === '5-30min' ? 15 : category === '30min-2h' ? 60 : category === '2-12h' ? 360 : 1440)}"
									style="width: {maxCount > 0 ? (count / maxCount) * 100 : 0}%"
								></div>
							</div>
							<span class="count-label">{count}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.response-time-stats {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.response-time-stats h4 {
		margin: 0 0 1rem 0;
		color: #333;
		font-size: 1.1rem;
	}

	.no-data {
		text-align: center;
		padding: 2rem;
		color: #6c757d;
	}

	.no-data p {
		margin: 0 0 0.5rem 0;
		font-weight: 500;
	}

	.no-data small {
		font-style: italic;
	}

	.stats-overview {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 6px;
		border: 1px solid #e9ecef;
	}

	.stat-label {
		font-size: 0.8rem;
		color: #6c757d;
		margin-bottom: 0.5rem;
		text-align: center;
	}

	.stat-value {
		font-size: 1.2rem;
		font-weight: 600;
		text-align: center;
	}

	.stat-value.average {
		color: #4a90e2;
	}

	.stat-value.median {
		color: #28a745;
	}

	.stat-value.total {
		color: #17a2b8;
	}

	.distribution {
		margin-top: 1.5rem;
	}

	.distribution h5 {
		margin: 0 0 1rem 0;
		color: #495057;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.distribution-bars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.distribution-item {
		display: grid;
		grid-template-columns: 80px 1fr 40px;
		gap: 0.75rem;
		align-items: center;
	}

	.category-label {
		font-size: 0.8rem;
		color: #495057;
		font-weight: 500;
	}

	.distribution-bar {
		background: #e9ecef;
		height: 20px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid #dee2e6;
	}

	.distribution-fill {
		height: 100%;
		border-radius: 10px;
		transition: width 0.3s ease;
	}

	.distribution-fill.instant {
		background: linear-gradient(90deg, #28a745, #34ce57);
	}

	.distribution-fill.quick {
		background: linear-gradient(90deg, #20c997, #25e5cc);
	}

	.distribution-fill.moderate {
		background: linear-gradient(90deg, #ffc107, #ffcd39);
	}

	.distribution-fill.slow {
		background: linear-gradient(90deg, #fd7e14, #ff922b);
	}

	.distribution-fill.very-slow {
		background: linear-gradient(90deg, #dc3545, #e55a64);
	}

	.count-label {
		font-size: 0.8rem;
		color: #495057;
		font-weight: 500;
		text-align: right;
	}

	@media (max-width: 768px) {
		.response-time-stats {
			padding: 1rem;
		}
		
		.stats-overview {
			grid-template-columns: 1fr;
		}
		
		.distribution-item {
			grid-template-columns: 60px 1fr 30px;
			gap: 0.5rem;
		}
		
		.category-label {
			font-size: 0.7rem;
		}
	}
</style>