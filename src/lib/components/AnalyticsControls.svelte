<script lang="ts">
	import { analyticsConfig, getDateRangeDescription, validateDateRange, type MessageTypeFilters } from '$lib/stores/analyticsConfig';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		configSaved: void;
	}>();

	export let isOpen = false;

	$: store = $analyticsConfig;
	$: config = store.draft; // Always work with draft
	$: hasChanges = store.hasChanges;

	let dateStart = '';
	let dateEnd = '';

	// Initialize date inputs from draft config
	$: {
		if (config.dateRange.start) {
			dateStart = config.dateRange.start.toISOString().split('T')[0];
		} else {
			dateStart = '';
		}
		if (config.dateRange.end) {
			dateEnd = config.dateRange.end.toISOString().split('T')[0];
		} else {
			dateEnd = '';
		}
	}

	function handleTopWordsChange(event: Event) {
		const target = event.target as HTMLInputElement;
		analyticsConfig.setTopWordsCount(parseInt(target.value));
	}

	function handleUserTopWordsChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = parseInt(target.value);
		analyticsConfig.updateDraft(config => ({ ...config, userTopWordsCount: Math.max(3, Math.min(30, value)) }));
	}

	function handleMinFrequencyChange(event: Event) {
		const target = event.target as HTMLInputElement;
		analyticsConfig.setMinWordFrequency(parseInt(target.value));
	}

	function handleDateRangeEnabled(event: Event) {
		const target = event.target as HTMLInputElement;
		analyticsConfig.updateDraft(config => ({
			...config,
			dateRange: { ...config.dateRange, enabled: target.checked }
		}));
	}

	function handleDateStart() {
		const startDate = dateStart ? new Date(dateStart) : null;
		const endDate = config.dateRange.end;
		
		if (validateDateRange(startDate, endDate)) {
			analyticsConfig.setDateRange(startDate, endDate, config.dateRange.enabled);
		}
	}

	function handleDateEnd() {
		const startDate = config.dateRange.start;
		const endDate = dateEnd ? new Date(dateEnd) : null;
		
		if (validateDateRange(startDate, endDate)) {
			analyticsConfig.setDateRange(startDate, endDate, config.dateRange.enabled);
		}
	}

	function toggleMessageType(messageType: keyof MessageTypeFilters) {
		analyticsConfig.toggleMessageType(messageType);
	}

	function resetConfig() {
		analyticsConfig.reset();
		dateStart = '';
		dateEnd = '';
	}

	function toggleAnimations() {
		analyticsConfig.updateDraft(config => ({ ...config, animationsEnabled: !config.animationsEnabled }));
	}

	function toggleCompactMode() {
		analyticsConfig.updateDraft(config => ({ ...config, compactMode: !config.compactMode }));
	}

	function saveChanges() {
		analyticsConfig.applyChanges();
		dispatch('configSaved');
		isOpen = false;
	}

	function discardChanges() {
		analyticsConfig.discardChanges();
		isOpen = false;
	}

	// Check if any message types are disabled
	$: hasMessageTypeFilters = !Object.values(config.messageTypes).every(enabled => enabled);
</script>

<div class="controls-overlay" class:open={isOpen}>
	<div class="controls-panel">
		<header class="controls-header">
			<h2>Analytics Settings</h2>
			<button class="close-button" on:click={() => isOpen = false} aria-label="Close settings">
				×
			</button>
		</header>

		<div class="controls-content">
			<!-- Word Analysis Section -->
			<section class="control-section">
				<h3>📝 Word Analysis</h3>
				
				<div class="control-group">
					<label for="top-words-count">
						Top Words Count: <strong>{config.topWordsCount}</strong>
					</label>
					<input
						id="top-words-count"
						type="range"
						min="5"
						max="500"
						step="5"
						value={config.topWordsCount}
						on:input={handleTopWordsChange}
						class="range-input"
					/>
					<div class="range-labels">
						<span>5</span>
						<span>500</span>
					</div>
				</div>

				<div class="control-group">
					<label for="user-top-words">
						Per-User Top Words: <strong>{config.userTopWordsCount}</strong>
					</label>
					<input
						id="user-top-words"
						type="range"
						min="3"
						max="30"
						step="1"
						value={config.userTopWordsCount}
						on:input={handleUserTopWordsChange}
						class="range-input"
					/>
					<div class="range-labels">
						<span>3</span>
						<span>30</span>
					</div>
				</div>

				<div class="control-group">
					<label for="min-frequency">
						Min Word Frequency: <strong>{config.minWordFrequency}</strong>
					</label>
					<input
						id="min-frequency"
						type="range"
						min="1"
						max="50"
						step="1"
						value={config.minWordFrequency}
						on:input={handleMinFrequencyChange}
						class="range-input"
					/>
					<div class="range-labels">
						<span>1</span>
						<span>50</span>
					</div>
				</div>
			</section>

			<!-- Date Range Section -->
			<section class="control-section">
				<h3>📅 Date Range</h3>
				
				<div class="control-group">
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={config.dateRange.enabled}
							on:change={handleDateRangeEnabled}
						/>
						Enable Date Filtering
					</label>
					<small class="filter-status">
						Currently showing: <strong>{getDateRangeDescription(config.dateRange)}</strong>
					</small>
				</div>

				<div class="date-inputs" class:disabled={!config.dateRange.enabled}>
					<div class="control-group">
						<label for="date-start">Start Date</label>
						<input
							id="date-start"
							type="date"
							bind:value={dateStart}
							on:change={handleDateStart}
							disabled={!config.dateRange.enabled}
						/>
					</div>
					<div class="control-group">
						<label for="date-end">End Date</label>
						<input
							id="date-end"
							type="date"
							bind:value={dateEnd}
							on:change={handleDateEnd}
							disabled={!config.dateRange.enabled}
						/>
					</div>
				</div>
			</section>

			<!-- Message Types Section -->
			<section class="control-section">
				<h3>💬 Message Types</h3>
				{#if hasMessageTypeFilters}
					<small class="filter-warning">⚠️ Some message types are filtered out</small>
				{/if}
				
				<div class="message-type-grid">
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={config.messageTypes.textMessages}
							on:change={() => toggleMessageType('textMessages')}
						/>
						💬 Text Messages
					</label>
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={config.messageTypes.photos}
							on:change={() => toggleMessageType('photos')}
						/>
						📸 Photos
					</label>
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={config.messageTypes.stickers}
							on:change={() => toggleMessageType('stickers')}
						/>
						😀 Stickers
					</label>
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={config.messageTypes.forwardedMessages}
							on:change={() => toggleMessageType('forwardedMessages')}
						/>
						↪️ Forwarded
					</label>
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={config.messageTypes.voiceMessages}
							on:change={() => toggleMessageType('voiceMessages')}
						/>
						🎤 Voice
					</label>
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={config.messageTypes.documents}
							on:change={() => toggleMessageType('documents')}
						/>
						📄 Documents
					</label>
				</div>
			</section>

			<!-- Display Settings Section -->
			<section class="control-section">
				<h3>🎨 Display</h3>
				
				<label class="checkbox-label">
					<input
						type="checkbox"
						checked={config.animationsEnabled}
						on:change={toggleAnimations}
					/>
					Enable Animations
				</label>

				<label class="checkbox-label">
					<input
						type="checkbox"
						checked={config.compactMode}
						on:change={toggleCompactMode}
					/>
					Compact Mode
				</label>
			</section>
		</div>

		<footer class="controls-footer">
			<div class="footer-buttons">
				<button
					class="save-button"
					class:has-changes={hasChanges}
					on:click={saveChanges}
					disabled={!hasChanges}
				>
					💾 Apply Changes
				</button>
				<button
					class="discard-button"
					on:click={discardChanges}
					disabled={!hasChanges}
				>
					❌ Discard
				</button>
				<button class="reset-button" on:click={resetConfig}>
					🔄 Reset All
				</button>
			</div>
			{#if hasChanges}
				<small class="changes-notice">⚠️ You have unsaved changes</small>
			{/if}
		</footer>
	</div>
</div>

<style>
	.controls-overlay {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 400px;
		background: rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(4px);
		z-index: 1000;
		transform: translateX(100%);
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.controls-overlay.open {
		transform: translateX(0);
	}

	.controls-panel {
		width: 100%;
		height: 100%;
		background: white;
		box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
	}

	.controls-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 2px solid #f0f0f0;
		background: #f8f9fa;
	}

	.controls-header h2 {
		margin: 0;
		color: #333;
		font-size: 1.3rem;
		font-weight: 600;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #666;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.close-button:hover {
		background: #e9ecef;
		color: #333;
	}

	.controls-content {
		flex: 1;
		padding: 0;
		overflow-y: auto;
	}

	.control-section {
		padding: 1.5rem;
		border-bottom: 1px solid #f0f0f0;
	}

	.control-section:last-child {
		border-bottom: none;
	}

	.control-section h3 {
		margin: 0 0 1rem 0;
		color: #4a90e2;
		font-size: 1rem;
		font-weight: 600;
	}

	.control-group {
		margin-bottom: 1.5rem;
	}

	.control-group:last-child {
		margin-bottom: 0;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		color: #333;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.range-input {
		width: 100%;
		height: 6px;
		background: #e9ecef;
		border-radius: 3px;
		outline: none;
		-webkit-appearance: none;
		appearance: none;
	}

	.range-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		background: #4a90e2;
		border-radius: 50%;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.range-input::-webkit-slider-thumb:hover {
		background: #357abd;
	}

	.range-input::-moz-range-thumb {
		width: 18px;
		height: 18px;
		background: #4a90e2;
		border-radius: 50%;
		cursor: pointer;
		border: none;
		transition: background 0.2s ease;
	}

	.range-input::-moz-range-thumb:hover {
		background: #357abd;
	}

	.range-labels {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: #666;
		margin-top: 0.25rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	input[type="checkbox"] {
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	input[type="date"] {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.date-inputs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		opacity: 1;
		transition: opacity 0.3s ease;
	}

	.date-inputs.disabled {
		opacity: 0.5;
	}

	.message-type-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.filter-status {
		color: #666;
		font-size: 0.85rem;
		display: block;
		margin-top: 0.25rem;
	}

	.filter-warning {
		color: #e65100;
		font-size: 0.85rem;
		display: block;
		margin-bottom: 1rem;
		font-weight: 500;
	}

	.controls-footer {
		padding: 1.5rem;
		border-top: 2px solid #f0f0f0;
		background: #f8f9fa;
	}

	.footer-buttons {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.save-button {
		flex: 1;
		padding: 0.75rem;
		background: #28a745;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.save-button:hover:not(:disabled) {
		background: #218838;
		transform: translateY(-1px);
	}

	.save-button:disabled {
		background: #6c757d;
		cursor: not-allowed;
		transform: none;
	}

	.save-button.has-changes {
		background: #007bff;
		box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
	}

	.save-button.has-changes:hover {
		background: #0056b3;
	}

	.discard-button {
		padding: 0.75rem;
		background: #dc3545;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.discard-button:hover:not(:disabled) {
		background: #c82333;
	}

	.discard-button:disabled {
		background: #6c757d;
		cursor: not-allowed;
	}

	.reset-button {
		padding: 0.75rem;
		background: #6c757d;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.reset-button:hover {
		background: #5a6268;
	}

	.changes-notice {
		display: block;
		text-align: center;
		color: #ffc107;
		font-weight: 500;
		font-size: 0.85rem;
	}

	/* Mobile Responsiveness */
	@media (max-width: 768px) {
		.controls-overlay {
			width: 100%;
		}

		.controls-header {
			padding: 1rem;
		}

		.control-section {
			padding: 1rem;
		}

		.message-type-grid {
			grid-template-columns: 1fr;
		}

		.date-inputs {
			grid-template-columns: 1fr;
		}

		.footer-buttons {
			flex-direction: column;
		}
	}
</style>