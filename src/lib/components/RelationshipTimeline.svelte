<script lang="ts">
	import type { RelationshipTimeline } from '$lib/utils/messageParser';

	export let timeline: RelationshipTimeline[];
	export let chatName: string = 'Chat';

	function formatMonth(monthStr: string): string {
		const [year, month] = monthStr.split('-');
		const date = new Date(parseInt(year), parseInt(month) - 1);
		return new Intl.DateTimeFormat('ru-RU', {
			year: 'numeric',
			month: 'short'
		}).format(date);
	}

	function getIntensityLevel(totalMessages: number, maxMessages: number): string {
		if (maxMessages === 0) return 'none';
		const ratio = totalMessages / maxMessages;
		if (ratio >= 0.8) return 'very-high';
		if (ratio >= 0.6) return 'high';
		if (ratio >= 0.4) return 'medium';
		if (ratio >= 0.2) return 'low';
		return 'very-low';
	}

	$: maxMessages = Math.max(...timeline.map(t => t.totalMessages));
	$: totalPeriods = timeline.length;
	$: averageMessages = timeline.reduce((sum, t) => sum + t.totalMessages, 0) / totalPeriods;
	
	// Calculate peak activity period
	$: peakPeriod = timeline.reduce((peak, current) => 
		current.totalMessages > peak.totalMessages ? current : peak, 
		timeline[0] || { month: '', totalMessages: 0, userMessages: 0, otherMessages: 0 }
	);

	// Calculate trends
	$: trendData = (() => {
		if (timeline.length < 2) return { trend: 'stable', change: 0 };
		
		const recentPeriod = timeline.slice(-3); // Last 3 months
		const earlierPeriod = timeline.slice(0, Math.min(3, timeline.length - 3)); // First 3 months
		
		const recentAvg = recentPeriod.reduce((sum, t) => sum + t.totalMessages, 0) / recentPeriod.length;
		const earlierAvg = earlierPeriod.reduce((sum, t) => sum + t.totalMessages, 0) / earlierPeriod.length;
		
		const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;
		
		let trend = 'stable';
		if (change > 20) trend = 'increasing';
		else if (change < -20) trend = 'decreasing';
		
		return { trend, change: Math.abs(change) };
	})();
</script>

<div class="relationship-timeline">
	<div class="timeline-header">
		<h4>Relationship Timeline - {chatName}</h4>
		<div class="timeline-summary">
			<div class="summary-item">
				<span class="summary-label">Total Periods:</span>
				<span class="summary-value">{totalPeriods}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Avg Messages/Month:</span>
				<span class="summary-value">{Math.round(averageMessages)}</span>
			</div>
			<div class="summary-item">
				<span class="summary-label">Peak Activity:</span>
				<span class="summary-value">{formatMonth(peakPeriod.month)}</span>
			</div>
		</div>
	</div>

	{#if timeline.length === 0}
		<div class="no-data">
			<p>No timeline data available</p>
		</div>
	{:else}
		<div class="trend-indicator">
			<div class="trend-item {trendData.trend}">
				<span class="trend-icon">
					{#if trendData.trend === 'increasing'}📈
					{:else if trendData.trend === 'decreasing'}📉
					{:else}📊{/if}
				</span>
				<span class="trend-text">
					{#if trendData.trend === 'increasing'}
						Activity increased by {Math.round(trendData.change)}%
					{:else if trendData.trend === 'decreasing'}
						Activity decreased by {Math.round(trendData.change)}%
					{:else}
						Activity remained stable
					{/if}
				</span>
			</div>
		</div>

		<div class="timeline-chart">
			<div class="timeline-grid">
				{#each timeline as period, index}
					<div class="timeline-period">
						<div class="period-header">
							<span class="period-month">{formatMonth(period.month)}</span>
						</div>
						<div class="period-bar">
							<div 
								class="period-fill {getIntensityLevel(period.totalMessages, maxMessages)}"
								style="height: {maxMessages > 0 ? (period.totalMessages / maxMessages) * 100 : 0}%"
								title="{period.totalMessages} messages"
							>
								<div class="message-breakdown">
									<div 
										class="user-portion" 
										style="height: {period.totalMessages > 0 ? (period.userMessages / period.totalMessages) * 100 : 0}%"
									></div>
								</div>
							</div>
						</div>
						<div class="period-stats">
							<div class="total-messages">{period.totalMessages}</div>
							<div class="message-split">
								<span class="user-count" title="Your messages">{period.userMessages}</span>
								<span class="divider">|</span>
								<span class="other-count" title="Other messages">{period.otherMessages}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="timeline-legend">
			<div class="legend-item">
				<div class="legend-color user-color"></div>
				<span>Your messages</span>
			</div>
			<div class="legend-item">
				<div class="legend-color other-color"></div>
				<span>Other messages</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.relationship-timeline {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.timeline-header {
		margin-bottom: 1.5rem;
	}

	.timeline-header h4 {
		margin: 0 0 0.75rem 0;
		color: #333;
		font-size: 1.1rem;
	}

	.timeline-summary {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem;
		background: #f8f9fa;
		border-radius: 4px;
		min-width: 100px;
	}

	.summary-label {
		font-size: 0.75rem;
		color: #6c757d;
		margin-bottom: 0.25rem;
	}

	.summary-value {
		font-weight: 600;
		color: #495057;
	}

	.trend-indicator {
		margin-bottom: 1.5rem;
		padding: 0.75rem;
		background: #f8f9fa;
		border-radius: 6px;
		border-left: 4px solid #4a90e2;
	}

	.trend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.trend-item.increasing {
		border-left-color: #28a745;
	}

	.trend-item.decreasing {
		border-left-color: #dc3545;
	}

	.trend-icon {
		font-size: 1.2rem;
	}

	.trend-text {
		font-weight: 500;
		color: #495057;
	}

	.no-data {
		text-align: center;
		padding: 2rem;
		color: #6c757d;
	}

	.timeline-chart {
		margin-bottom: 1rem;
	}

	.timeline-grid {
		display: flex;
		gap: 1px;
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}

	.timeline-period {
		flex: 1;
		min-width: 60px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.period-header {
		height: 20px;
		display: flex;
		align-items: center;
	}

	.period-month {
		font-size: 0.7rem;
		color: #6c757d;
		text-align: center;
		writing-mode: horizontal-tb;
		transform: rotate(-45deg);
		white-space: nowrap;
	}

	.period-bar {
		width: 100%;
		height: 120px;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.period-fill {
		width: 80%;
		max-width: 40px;
		border-radius: 4px 4px 0 0;
		transition: all 0.3s ease;
		position: relative;
		overflow: hidden;
	}

	.period-fill:hover {
		transform: scale(1.05);
	}

	.period-fill.very-high {
		background: linear-gradient(180deg, #28a745, #34ce57);
	}

	.period-fill.high {
		background: linear-gradient(180deg, #20c997, #25e5cc);
	}

	.period-fill.medium {
		background: linear-gradient(180deg, #4a90e2, #5ba3f5);
	}

	.period-fill.low {
		background: linear-gradient(180deg, #ffc107, #ffcd39);
	}

	.period-fill.very-low {
		background: linear-gradient(180deg, #dc3545, #e55a64);
	}

	.message-breakdown {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	.user-portion {
		background: rgba(74, 144, 226, 0.8);
		width: 100%;
		position: absolute;
		bottom: 0;
		border-radius: 4px 4px 0 0;
	}

	.period-stats {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.total-messages {
		font-weight: 600;
		color: #495057;
		font-size: 0.9rem;
	}

	.message-split {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.7rem;
	}

	.user-count {
		color: #4a90e2;
		font-weight: 500;
	}

	.other-count {
		color: #28a745;
		font-weight: 500;
	}

	.divider {
		color: #dee2e6;
	}

	.timeline-legend {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid #e9ecef;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: #6c757d;
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.legend-color.user-color {
		background: #4a90e2;
	}

	.legend-color.other-color {
		background: #28a745;
	}

	@media (max-width: 768px) {
		.relationship-timeline {
			padding: 1rem;
		}
		
		.timeline-summary {
			gap: 0.75rem;
		}
		
		.summary-item {
			min-width: 80px;
		}
		
		.timeline-period {
			min-width: 40px;
		}
		
		.period-month {
			font-size: 0.6rem;
		}
		
		.period-bar {
			height: 80px;
		}
	}
</style>