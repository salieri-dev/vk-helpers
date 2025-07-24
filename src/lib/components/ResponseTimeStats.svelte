<script lang="ts">
	import type { ResponseTimeStats as ResponseTimeStatsType } from '$lib/utils/messageParser';

	export let stats: ResponseTimeStatsType;
	export let userName: string = 'User';

	function formatResponseTime(minutes: number): string {
		if (minutes < 1) return `${Math.round(minutes * 60)}s`;
		if (minutes < 60) return `${Math.round(minutes)}m`;
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = Math.round(minutes % 60);
		return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
	}
    
    // Updated distribution categories as requested
	const distributionCategories = {
        '< 1 min': (t: number) => t < 1,
        '1-5 min': (t: number) => t >= 1 && t < 5,
        '5-10 min': (t: number) => t >= 5 && t < 10,
        '10-30 min': (t: number) => t >= 10 && t < 30,
        '30-60 min': (t: number) => t >= 30 && t < 60,
        '> 1 hour': (t: number) => t >= 60,
    };

	function getResponseTimeCategory(minutes: number): string {
		if (minutes < 1) return 'instant';
		if (minutes < 5) return 'fast';
		if (minutes < 10) return 'quick';
		if (minutes < 30) return 'moderate';
		if (minutes < 60) return 'slow';
		return 'very-slow';
	}
    
	function calculateResponseTimeDistribution(responseTimes: number[]) {
        const categories = Object.fromEntries(Object.keys(distributionCategories).map(key => [key, 0]));
		
        responseTimes.forEach(time => {
            for (const [category, check] of Object.entries(distributionCategories)) {
                if (check(time)) {
                    categories[category]++;
                    break;
                }
            }
        });
		return categories;
	}

	$: distribution = stats && stats.totalResponses > 0 ? calculateResponseTimeDistribution(stats.responseTimes) : null;
	$: maxCount = distribution ? Math.max(...Object.values(distribution)) : 0;
</script>

<div class="response-time-stats">
	<h4>Response Time Analysis - {userName}</h4>
	
	{#if !stats || stats.totalResponses === 0}
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
									class="distribution-fill {getResponseTimeCategory(category === '< 1 min' ? 0.5 : category === '1-5 min' ? 3 : category === '5-10 min' ? 7 : category === '10-30 min' ? 20 : category === '30-60 min' ? 45 : 90)}"
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
	h4 {
		margin: 0 0 1rem 0;
		color: #333;
		font-size: 1.1rem;
	}
	.no-data {
		text-align: center;
		padding: 2rem;
		color: #6c757d;
	}
	.stats-overview {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.stat-item {
		text-align: center;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 6px;
	}
	.stat-label {
		font-size: 0.8rem;
		color: #6c757d;
	}
	.stat-value {
		font-size: 1.2rem;
		font-weight: 600;
	}
    /* ... rest of your styles ... */
	.distribution-fill.instant { background: #28a745; }
	.distribution-fill.fast { background: #20c997; }
	.distribution-fill.quick { background: #ffc107; }
	.distribution-fill.moderate { background: #fd7e14; }
	.distribution-fill.slow { background: #dc3545; }
	.distribution-fill.very-slow { background: #842029; }
    .distribution {
		margin-top: 1.5rem;
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
	}
	.distribution-bar {
		background: #e9ecef;
		height: 20px;
		border-radius: 10px;
	}
	.distribution-fill {
		height: 100%;
		border-radius: 10px;
	}
	.count-label {
		font-size: 0.8rem;
		text-align: right;
	}
</style>