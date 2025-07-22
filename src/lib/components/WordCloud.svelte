<script lang="ts">
	import { onMount, afterUpdate } from 'svelte';
	import { analyticsConfig } from '$lib/stores/analyticsConfig';

	export let words: { word: string; count: number }[];

	let cloudContainer: HTMLDivElement;
	let selectedWords: Set<string> = new Set();
	let hoveredWord: string | null = null;
	let layoutStrategy: 'spiral' | 'grid' | 'random' = 'grid';

	$: maxCount = Math.max(...words.map(w => w.count), 1);
	$: minCount = Math.min(...words.map(w => w.count), 1);

	// Enhanced size calculation with responsive control
	function getWordSize(count: number): number {
		const config = $analyticsConfig;
		
		// Responsive size limits based on container size
		let minSize = 0.7;
		let maxSize = 2.5;
		
		// Adjust sizes based on screen size
		if (typeof window !== 'undefined') {
			if (window.innerWidth < 480) {
				minSize = 0.6;
				maxSize = 1.8;
			} else if (window.innerWidth < 768) {
				minSize = 0.65;
				maxSize = 2.2;
			}
		}
		
		// Logarithmic scaling for better distribution
		const logMax = Math.log(maxCount + 1);
		const logCurrent = Math.log(count + 1);
		const ratio = logCurrent / logMax;
		
		// Apply power curve for more dramatic size differences
		const scaledRatio = Math.pow(ratio, 0.65);
		return minSize + (maxSize - minSize) * scaledRatio;
	}

	// Enhanced color system with theme support
	function getWordColor(count: number): string {
		const ratio = count / maxCount;
		
		// Multiple color schemes
		const colorSchemes = {
			blue: ['#0d47a1', '#1565c0', '#1976d2', '#1e88e5', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9'],
			gradient: ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688'],
			warm: ['#bf360c', '#d84315', '#e64a19', '#f57c00', '#ff9800', '#ffb74d', '#ffcc02', '#ffeb3b'],
			cool: ['#1a237e', '#283593', '#303f9f', '#3949ab', '#3f51b5', '#5c6bc0', '#7986cb', '#9fa8da']
		};

		const scheme = colorSchemes.blue; // Can be made configurable
		const index = Math.min(Math.floor(ratio * scheme.length), scheme.length - 1);
		return scheme[scheme.length - 1 - index];
	}

	function getWordOpacity(count: number): number {
		const ratio = count / maxCount;
		return Math.max(0.6, 0.6 + ratio * 0.4);
	}

	// Advanced positioning algorithm with collision detection
	function positionWords() {
		if (!cloudContainer) return;

		const container = cloudContainer;
		const containerRect = container.getBoundingClientRect();
		const words = container.querySelectorAll('.word-item') as NodeListOf<HTMLElement>;
		
		// Clear existing positioning
		words.forEach(word => {
			word.style.position = '';
			word.style.left = '';
			word.style.top = '';
			word.style.transform = '';
		});

		if (layoutStrategy === 'spiral') {
			positionWordsSpiral(words, containerRect);
		} else if (layoutStrategy === 'grid') {
			positionWordsGrid(words);
		} else {
			positionWordsRandom(words, containerRect);
		}
	}

	function positionWordsSpiral(words: NodeListOf<HTMLElement>, containerRect: DOMRect) {
		const padding = 10; // Add padding from edges
		const centerX = containerRect.width / 2;
		const centerY = containerRect.height / 2;
		const positions: Array<{x: number, y: number, width: number, height: number}> = [];

		words.forEach((word, index) => {
			const wordRect = word.getBoundingClientRect();
			const wordWidth = wordRect.width;
			const wordHeight = wordRect.height;

			let placed = false;
			let radius = 0;
			let angle = 0;
			const maxRadius = Math.min(centerX - padding, centerY - padding) * 0.75;

			// First word goes in center
			if (index === 0) {
				const x = Math.max(padding, Math.min(centerX - wordWidth / 2, containerRect.width - wordWidth - padding));
				const y = Math.max(padding, Math.min(centerY - wordHeight / 2, containerRect.height - wordHeight - padding));
				word.style.position = 'absolute';
				word.style.left = `${x}px`;
				word.style.top = `${y}px`;
				positions.push({x, y, width: wordWidth, height: wordHeight});
				return;
			}

			// Spiral positioning for other words
			while (!placed && radius <= maxRadius) {
				const x = centerX + radius * Math.cos(angle) - wordWidth / 2;
				const y = centerY + radius * Math.sin(angle) - wordHeight / 2;

				// Enhanced boundary check with padding
				const boundaryCheck = x >= padding &&
					y >= padding &&
					x + wordWidth <= containerRect.width - padding &&
					y + wordHeight <= containerRect.height - padding;

				// Check for collisions
				const hasCollision = positions.some(pos =>
					x < pos.x + pos.width + 8 &&
					x + wordWidth + 8 > pos.x &&
					y < pos.y + pos.height + 8 &&
					y + wordHeight + 8 > pos.y
				);

				if (!hasCollision && boundaryCheck) {
					word.style.position = 'absolute';
					word.style.left = `${x}px`;
					word.style.top = `${y}px`;
					positions.push({x, y, width: wordWidth, height: wordHeight});
					placed = true;
				} else {
					angle += 0.25;
					if (angle > 2 * Math.PI) {
						angle = 0;
						radius += 15;
					}
				}
			}
		});
	}

	function positionWordsGrid(words: NodeListOf<HTMLElement>) {
		// Reset to flex layout for grid
		words.forEach(word => {
			word.style.position = '';
			word.style.left = '';
			word.style.top = '';
		});
	}

	function positionWordsRandom(words: NodeListOf<HTMLElement>, containerRect: DOMRect) {
		const padding = 10; // Add padding from edges
		const positions: Array<{x: number, y: number, width: number, height: number}> = [];

		words.forEach(word => {
			const wordRect = word.getBoundingClientRect();
			const wordWidth = wordRect.width;
			const wordHeight = wordRect.height;

			let attempts = 0;
			let placed = false;

			// Ensure there's enough space for positioning
			const availableWidth = containerRect.width - wordWidth - (padding * 2);
			const availableHeight = containerRect.height - wordHeight - (padding * 2);

			if (availableWidth <= 0 || availableHeight <= 0) {
				// Skip this word if container is too small
				return;
			}

			while (!placed && attempts < 75) {
				const x = padding + Math.random() * availableWidth;
				const y = padding + Math.random() * availableHeight;

				const hasCollision = positions.some(pos =>
					x < pos.x + pos.width + 8 &&
					x + wordWidth + 8 > pos.x &&
					y < pos.y + pos.height + 8 &&
					y + wordHeight + 8 > pos.y
				);

				if (!hasCollision) {
					word.style.position = 'absolute';
					word.style.left = `${x}px`;
					word.style.top = `${y}px`;
					positions.push({x, y, width: wordWidth, height: wordHeight});
					placed = true;
				}
				attempts++;
			}
		});
	}

	// Enhanced word shuffling with frequency-aware distribution
	function shuffleWords(words: { word: string; count: number }[]): { word: string; count: number }[] {
		if (words.length === 0) return [];
		
		const result = [...words].sort((a, b) => b.count - a.count);
		
		// Group words by frequency tiers for better distribution
		const highFreq = result.filter(w => w.count / maxCount > 0.7);
		const medFreq = result.filter(w => w.count / maxCount > 0.3 && w.count / maxCount <= 0.7);
		const lowFreq = result.filter(w => w.count / maxCount <= 0.3);
		
		// Fisher-Yates shuffle for each tier
		const shuffle = (arr: typeof result) => {
			for (let i = arr.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[arr[i], arr[j]] = [arr[j], arr[i]];
			}
			return arr;
		};

		// Interleave words from different frequency tiers
		const shuffled: { word: string; count: number }[] = [];
		const tiers = [shuffle(highFreq), shuffle(medFreq), shuffle(lowFreq)];
		const maxLength = Math.max(...tiers.map(t => t.length));

		for (let i = 0; i < maxLength; i++) {
			tiers.forEach(tier => {
				if (tier[i]) shuffled.push(tier[i]);
			});
		}

		return shuffled;
	}

	// Word interaction handlers
	function toggleWordSelection(word: string) {
		if (selectedWords.has(word)) {
			selectedWords.delete(word);
		} else {
			selectedWords.add(word);
		}
		selectedWords = new Set(selectedWords); // Trigger reactivity
	}

	function handleWordHover(word: string | null) {
		hoveredWord = word;
	}

	// Export word cloud as image
	function exportWordCloud() {
		if (!cloudContainer) return;

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const containerRect = cloudContainer.getBoundingClientRect();
		canvas.width = containerRect.width;
		canvas.height = containerRect.height;

		// Set white background
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw words
		const words = cloudContainer.querySelectorAll('.word-item') as NodeListOf<HTMLElement>;
		words.forEach(wordElement => {
			const style = window.getComputedStyle(wordElement);
			const rect = wordElement.getBoundingClientRect();
			const containerRect = cloudContainer.getBoundingClientRect();
			
			ctx.fillStyle = style.color;
			ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			ctx.fillText(
				wordElement.textContent || '',
				rect.left - containerRect.left,
				rect.top - containerRect.top + rect.height * 0.8
			);
		});

		// Download
		const link = document.createElement('a');
		link.download = 'word-cloud.png';
		link.href = canvas.toDataURL();
		link.click();
	}

	function cycleLayoutStrategy() {
		const strategies = ['spiral', 'grid', 'random'] as const;
		const currentIndex = strategies.indexOf(layoutStrategy);
		layoutStrategy = strategies[(currentIndex + 1) % strategies.length];
	}

	$: shuffledWords = shuffleWords(words);

	onMount(() => {
		if (layoutStrategy === 'spiral' || layoutStrategy === 'random') {
			setTimeout(positionWords, 100);
		}
	});

	afterUpdate(() => {
		if ((layoutStrategy === 'spiral' || layoutStrategy === 'random') && cloudContainer) {
			setTimeout(positionWords, 100);
		}
	});
</script>

<div class="word-cloud">
	{#if words.length > 0}
		<div class="word-cloud-header">
			<div class="word-cloud-controls">
				<button 
					class="layout-btn"
					on:click={cycleLayoutStrategy}
					title="Change layout: {layoutStrategy}"
				>
					{#if layoutStrategy === 'spiral'}🌀{:else if layoutStrategy === 'grid'}⊞{:else}🎲{/if}
					{layoutStrategy}
				</button>
				<button 
					class="export-btn"
					on:click={exportWordCloud}
					title="Export word cloud as image"
				>
					💾 Export
				</button>
			</div>
			<div class="word-cloud-stats">
				<span class="stat-item">
					<span class="stat-value">{words.length}</span>
					<span class="stat-label">words</span>
				</span>
				{#if selectedWords.size > 0}
					<span class="stat-item selected">
						<span class="stat-value">{selectedWords.size}</span>
						<span class="stat-label">selected</span>
					</span>
				{/if}
			</div>
		</div>

		<div 
			class="cloud-container" 
			class:spiral={layoutStrategy === 'spiral'}
			class:grid={layoutStrategy === 'grid'}
			class:random={layoutStrategy === 'random'}
			bind:this={cloudContainer}
		>
			{#each shuffledWords as { word, count }, i (word)}
				<span
					class="word-item"
					class:selected={selectedWords.has(word)}
					class:hovered={hoveredWord === word}
					style="
						font-size: {getWordSize(count)}rem;
						color: {getWordColor(count)};
						opacity: {getWordOpacity(count)};
						--i: {i};
						--final-opacity: {getWordOpacity(count)};
					"
					title="{word}: {count} times ({((count / maxCount) * 100).toFixed(1)}%)"
					on:click={() => toggleWordSelection(word)}
					on:mouseenter={() => handleWordHover(word)}
					on:mouseleave={() => handleWordHover(null)}
					role="button"
					tabindex="0"
					on:keydown={(e) => e.key === 'Enter' && toggleWordSelection(word)}
				>
					{word}
				</span>
			{/each}
		</div>

		{#if selectedWords.size > 0}
			<div class="selected-words-panel">
				<h5>Selected Words ({selectedWords.size})</h5>
				<div class="selected-words-list">
					{#each Array.from(selectedWords) as word}
						{@const wordData = words.find(w => w.word === word)}
						<span class="selected-word-tag">
							{word}
							{#if wordData}
								<small>({wordData.count})</small>
							{/if}
							<button 
								class="remove-word"
								on:click={() => toggleWordSelection(word)}
								title="Remove from selection"
							>×</button>
						</span>
					{/each}
				</div>
				<button 
					class="clear-selection"
					on:click={() => selectedWords.clear()}
				>
					Clear Selection
				</button>
			</div>
		{/if}
	{:else}
		<div class="no-words">
			<div class="no-data-icon">☁️</div>
			<h4>No Words to Display</h4>
			<p>Adjust your filters or word frequency threshold to see words.</p>
		</div>
	{/if}
</div>

<style>
	.word-cloud {
		background: linear-gradient(135deg, #f8f9fc 0%, #e8f4fd 100%);
		border-radius: 12px;
		padding: 1rem;
		box-shadow: 0 2px 8px rgba(0,0,0,0.05);
		position: relative;
		min-height: 300px;
		width: 100%;
		max-width: 100%;
		overflow: hidden;
		box-sizing: border-box;
	}

	.word-cloud-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(74, 144, 226, 0.2);
	}

	.word-cloud-controls {
		display: flex;
		gap: 0.5rem;
	}

	.layout-btn, .export-btn {
		background: rgba(74, 144, 226, 0.1);
		border: 1px solid rgba(74, 144, 226, 0.3);
		color: #4a90e2;
		border-radius: 6px;
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.layout-btn:hover, .export-btn:hover {
		background: rgba(74, 144, 226, 0.2);
		transform: translateY(-1px);
	}

	.word-cloud-stats {
		display: flex;
		gap: 1rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 0.8rem;
	}

	.stat-value {
		font-weight: 700;
		color: #4a90e2;
		font-size: 1rem;
	}

	.stat-label {
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-size: 0.7rem;
	}

	.stat-item.selected .stat-value {
		color: #e91e63;
	}

	.cloud-container {
		position: relative;
		min-height: 250px;
		max-height: 400px;
		border-radius: 8px;
		overflow: hidden;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		contain: layout style;
	}

	.cloud-container.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.6rem;
		align-items: flex-start;
		justify-content: center;
		padding: 1rem;
		width: 100%;
		max-width: 100%;
		box-sizing: border-box;
		overflow: hidden;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.cloud-container.spiral,
	.cloud-container.random {
		position: relative;
		height: 300px;
	}

	.word-item {
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		white-space: nowrap;
		user-select: none;
		text-shadow: 0 1px 2px rgba(0,0,0,0.1);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		letter-spacing: 0.02em;
		border-radius: 4px;
		padding: 0.1rem 0.3rem;
		position: relative;
		z-index: 1;
		max-width: calc(100% - 2rem);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		box-sizing: border-box;
		flex-shrink: 1;
		word-break: break-word;
	}

	.word-item:hover,
	.word-item.hovered {
		transform: scale(1.15) rotate(-1deg);
		filter: brightness(1.2) saturate(1.3);
		z-index: 10;
		text-shadow: 0 2px 6px rgba(0,0,0,0.3);
		background: rgba(255,255,255,0.9);
		backdrop-filter: blur(4px);
		box-shadow: 0 4px 12px rgba(0,0,0,0.2);
	}

	.word-item.selected {
		background: rgba(233, 30, 99, 0.15);
		border: 2px solid #e91e63;
		color: #e91e63 !important;
		font-weight: 700;
	}

	.word-item:focus {
		outline: 2px solid #4a90e2;
		outline-offset: 2px;
	}

	.selected-words-panel {
		margin-top: 1rem;
		padding: 1rem;
		background: rgba(233, 30, 99, 0.05);
		border: 1px solid rgba(233, 30, 99, 0.2);
		border-radius: 8px;
	}

	.selected-words-panel h5 {
		margin: 0 0 0.75rem 0;
		color: #e91e63;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.selected-words-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.selected-word-tag {
		background: rgba(233, 30, 99, 0.1);
		border: 1px solid rgba(233, 30, 99, 0.3);
		color: #e91e63;
		border-radius: 12px;
		padding: 0.3rem 0.6rem;
		font-size: 0.8rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.selected-word-tag small {
		opacity: 0.7;
	}

	.remove-word {
		background: none;
		border: none;
		color: #e91e63;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		padding: 0;
		margin-left: 0.2rem;
	}

	.clear-selection {
		background: #e91e63;
		color: white;
		border: none;
		border-radius: 6px;
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
		cursor: pointer;
		font-weight: 500;
		transition: background 0.2s ease;
	}

	.clear-selection:hover {
		background: #c2185b;
	}

	.no-words {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 250px;
		text-align: center;
		color: #666;
	}

	.no-data-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.6;
	}

	.no-words h4 {
		margin: 0 0 0.5rem 0;
		color: #495057;
		font-size: 1.2rem;
	}

	.no-words p {
		margin: 0;
		font-size: 0.9rem;
		opacity: 0.8;
	}

	/* Animation for word appearance */
	.word-item {
		animation: wordAppear 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
		animation-delay: calc(var(--i, 0) * 0.05s);
		opacity: 0;
		transform: scale(0.6) translateY(20px);
	}

	@keyframes wordAppear {
		0% {
			opacity: 0;
			transform: scale(0.6) translateY(20px);
		}
		60% {
			opacity: var(--final-opacity, 1);
			transform: scale(1.1) translateY(-2px);
		}
		100% {
			opacity: var(--final-opacity, 1);
			transform: scale(1) translateY(0);
		}
	}

	/* Background decorative elements */
	.word-cloud::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image:
			radial-gradient(circle at 25% 25%, rgba(74, 144, 226, 0.03) 0%, transparent 70%),
			radial-gradient(circle at 75% 75%, rgba(33, 150, 243, 0.03) 0%, transparent 70%);
		border-radius: 12px;
		pointer-events: none;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.word-cloud {
			padding: 0.75rem;
			margin: 0.5rem 0;
		}

		.word-cloud-header {
			flex-direction: column;
			gap: 0.75rem;
			align-items: stretch;
		}

		.word-cloud-controls,
		.word-cloud-stats {
			justify-content: center;
		}

		.cloud-container {
			min-height: 200px;
			max-height: 300px;
		}

		.cloud-container.spiral,
		.cloud-container.random {
			height: 250px;
		}

		.cloud-container.grid {
			padding: 0.75rem;
		}

		.word-item {
			max-width: calc(100vw - 4rem);
			font-size: clamp(0.65rem, 2.5vw, 1.5rem) !important;
		}

		.selected-words-panel {
			padding: 0.75rem;
		}
	}

	@media (max-width: 480px) {
		.word-cloud {
			padding: 0.5rem;
		}

		.word-cloud-controls {
			flex-direction: column;
		}

		.layout-btn, .export-btn {
			justify-content: center;
			font-size: 0.7rem;
			padding: 0.3rem 0.6rem;
		}

		.cloud-container {
			min-height: 180px;
			max-height: 250px;
		}

		.cloud-container.spiral,
		.cloud-container.random {
			height: 200px;
		}

		.cloud-container.grid {
			padding: 0.5rem;
		}

		.word-item {
			max-width: calc(100vw - 3rem);
			font-size: clamp(0.6rem, 2vw, 1.2rem) !important;
			padding: 0.05rem 0.2rem;
		}
	}

	/* Extra small screens */
	@media (max-width: 360px) {
		.cloud-container {
			min-height: 150px;
			max-height: 200px;
		}

		.word-item {
			max-width: calc(100vw - 2rem);
			font-size: clamp(0.5rem, 1.8vw, 1rem) !important;
		}
	}
</style>