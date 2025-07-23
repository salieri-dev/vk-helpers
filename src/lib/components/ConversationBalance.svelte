<script lang="ts">
	import type { ConversationBalance } from '$lib/utils/messageParser';

	export let balance: ConversationBalance;
	export let otherUserName: string = 'Other';

	function formatRatio(ratio: number): string {
		if (ratio === 0) return '0:1';
		if (!isFinite(ratio)) return '1:0';
		if (ratio >= 1) {
			return `${ratio.toFixed(1)}:1`;
		} else {
			return `1:${(1/ratio).toFixed(1)}`;
		}
	}

	function formatPercentage(ratio: number): number {
		if (!isFinite(ratio)) return 100;
		const total = ratio + 1;
		return Math.round((ratio / total) * 100);
	}
</script>

<div class="conversation-balance">
	<h4>Conversation Balance</h4>
	
	<div class="balance-metrics">
		<div class="balance-item">
			<div class="balance-header">
				<span class="balance-label">Message Balance</span>
				<span class="balance-ratio">{formatRatio(balance.messageRatio)}</span>
			</div>
			<div class="balance-bar">
				<div class="balance-fill you" style="width: {formatPercentage(balance.messageRatio)}%"></div>
				<div class="balance-fill other" style="width: {100 - formatPercentage(balance.messageRatio)}%"></div>
			</div>
			<div class="balance-labels">
				<span class="label-you">You ({formatPercentage(balance.messageRatio)}%)</span>
				<span class="label-other">{otherUserName} ({100 - formatPercentage(balance.messageRatio)}%)</span>
			</div>
		</div>

		<div class="balance-item">
			<div class="balance-header">
				<span class="balance-label">Word Balance</span>
				<span class="balance-ratio">{formatRatio(balance.wordRatio)}</span>
			</div>
			<div class="balance-bar">
				<div class="balance-fill you" style="width: {formatPercentage(balance.wordRatio)}%"></div>
				<div class="balance-fill other" style="width: {100 - formatPercentage(balance.wordRatio)}%"></div>
			</div>
			<div class="balance-labels">
				<span class="label-you">You ({formatPercentage(balance.wordRatio)}%)</span>
				<span class="label-other">{otherUserName} ({100 - formatPercentage(balance.wordRatio)}%)</span>
			</div>
		</div>

		<div class="balance-item">
			<div class="balance-header">
				<span class="balance-label">Conversation Initiation</span>
				<span class="balance-ratio">{formatRatio(balance.initiationRatio)}</span>
			</div>
			<div class="balance-bar">
				<div class="balance-fill you" style="width: {formatPercentage(balance.initiationRatio)}%"></div>
				<div class="balance-fill other" style="width: {100 - formatPercentage(balance.initiationRatio)}%"></div>
			</div>
			<div class="balance-labels">
				<span class="label-you">You ({formatPercentage(balance.initiationRatio)}%)</span>
				<span class="label-other">{otherUserName} ({100 - formatPercentage(balance.initiationRatio)}%)</span>
			</div>
			<div class="initiation-stats">
				<small>You started {balance.conversationStarts} out of {balance.totalConversations} conversations</small>
			</div>
		</div>
	</div>
</div>

<style>
	.conversation-balance {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.conversation-balance h4 {
		margin: 0 0 1rem 0;
		color: #333;
		font-size: 1.1rem;
	}

	.balance-metrics {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.balance-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.balance-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.balance-label {
		font-weight: 500;
		color: #495057;
		font-size: 0.9rem;
	}

	.balance-ratio {
		font-weight: 600;
		color: #4a90e2;
		font-size: 1rem;
	}

	.balance-bar {
		display: flex;
		height: 12px;
		background: #f8f9fa;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid #e9ecef;
	}

	.balance-fill {
		height: 100%;
		transition: width 0.3s ease;
	}

	.balance-fill.you {
		background: linear-gradient(90deg, #4a90e2, #5ba3f5);
	}

	.balance-fill.other {
		background: linear-gradient(90deg, #28a745, #34ce57);
	}

	.balance-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		margin-top: 0.25rem;
	}

	.label-you {
		color: #4a90e2;
		font-weight: 500;
	}

	.label-other {
		color: #28a745;
		font-weight: 500;
	}

	.initiation-stats {
		margin-top: 0.25rem;
	}

	.initiation-stats small {
		color: #6c757d;
		font-style: italic;
	}

	@media (max-width: 768px) {
		.conversation-balance {
			padding: 1rem;
		}
		
		.balance-labels {
			flex-direction: column;
			gap: 0.1rem;
		}
	}
</style>