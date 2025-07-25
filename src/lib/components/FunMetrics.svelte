<script lang="ts">
	import { onMount } from 'svelte';
	import StatsCard from './StatsCard.svelte';
	import type { Message, ChatAnalytics } from '../utils/messageParser';

	export let messages: Message[] = [];
	export let chats: ChatAnalytics[] = [];

	interface Achievement {
		id: string;
		title: string;
		description: string;
		icon: string;
		value: string;
		subtitle: string;
		type: 'gold' | 'silver' | 'bronze' | 'special';
		unlocked: boolean;
	}

	let achievements: Achievement[] = [];
	let loading = true;

	// Calculate achievements based on message data
	function calculateAchievements(): Achievement[] {
		if (!messages.length) return [];

		const achievementsList: Achievement[] = [];

		// 🏆 The Monologuer Award - Longest streak of messages by one person
		const monologueStreak = calculateMonologueStreak();
		achievementsList.push({
			id: 'monologuer',
			title: 'The Monologuer Award',
			description: 'Longest streak of consecutive messages by one person',
			icon: '🏆',
			value: monologueStreak.count.toString(),
			subtitle: `${monologueStreak.sender} sent ${monologueStreak.count} messages in a row`,
			type: monologueStreak.count >= 20 ? 'gold' : monologueStreak.count >= 10 ? 'silver' : 'bronze',
			unlocked: monologueStreak.count > 0
		});

		// 🦉 The Night Owl Badge - Messages sent between 1 AM and 6 AM
		const nightOwlStats = calculateNightOwlStats();
		achievementsList.push({
			id: 'night-owl',
			title: 'The Night Owl Badge',
			description: 'Percentage of messages sent between 1 AM and 6 AM',
			icon: '🦉',
			value: `${nightOwlStats.percentage.toFixed(1)}%`,
			subtitle: `${nightOwlStats.count} night messages out of ${messages.length}`,
			type: nightOwlStats.percentage >= 15 ? 'gold' : nightOwlStats.percentage >= 10 ? 'silver' : 'bronze',
			unlocked: nightOwlStats.percentage >= 5
		});

		// ⚡ Fastest Fingers - Highest messages in 5-minute window
		const fastestFingers = calculateFastestFingers();
		achievementsList.push({
			id: 'fastest-fingers',
			title: 'Fastest Fingers',
			description: 'Highest number of messages sent in a 5-minute window',
			icon: '⚡',
			value: fastestFingers.count.toString(),
			subtitle: `Peak activity by ${fastestFingers.sender}`,
			type: fastestFingers.count >= 50 ? 'gold' : fastestFingers.count >= 30 ? 'silver' : 'bronze',
			unlocked: fastestFingers.count > 0
		});

		// ❓ The Inquisitor - Most questions asked
		const inquisitor = calculateInquisitor();
		achievementsList.push({
			id: 'inquisitor',
			title: 'The Inquisitor',
			description: 'The user who asks the most questions',
			icon: '❓',
			value: inquisitor.count.toString(),
			subtitle: `${inquisitor.sender} asked ${inquisitor.count} questions`,
			type: inquisitor.count >= 100 ? 'gold' : inquisitor.count >= 50 ? 'silver' : 'bronze',
			unlocked: inquisitor.count > 0
		});

		// 📚 The Novelist - Longest single message
		const novelist = calculateNovelist();
		achievementsList.push({
			id: 'novelist',
			title: 'The Novelist',
			description: 'Longest single message by word count',
			icon: '📚',
			value: `${novelist.wordCount} words`,
			subtitle: `Epic message by ${novelist.sender}`,
			type: novelist.wordCount >= 500 ? 'gold' : novelist.wordCount >= 200 ? 'silver' : 'bronze',
			unlocked: novelist.wordCount > 0
		});

		// 🤐 The Minimalist - Shortest average message length
		const minimalist = calculateMinimalist();
		achievementsList.push({
			id: 'minimalist',
			title: 'The Minimalist',
			description: 'Shortest average message length',
			icon: '🤐',
			value: `${minimalist.avgLength.toFixed(1)} words`,
			subtitle: `${minimalist.sender} keeps it brief`,
			type: minimalist.avgLength <= 3 ? 'gold' : minimalist.avgLength <= 5 ? 'silver' : 'bronze',
			unlocked: minimalist.avgLength > 0
		});

		// 🔥 The Streak Master - Most consecutive active days
		const streakMaster = calculateStreakMaster();
		achievementsList.push({
			id: 'streak-master',
			title: 'The Streak Master',
			description: 'Longest streak of consecutive days with messages',
			icon: '🔥',
			value: `${streakMaster.days} days`,
			subtitle: `Consistent messaging champion`,
			type: streakMaster.days >= 30 ? 'gold' : streakMaster.days >= 14 ? 'silver' : 'bronze',
			unlocked: streakMaster.days > 0
		});

		// 🎭 The Emoji King/Queen - Most emojis used
		const emojiKing = calculateEmojiKing();
		achievementsList.push({
			id: 'emoji-king',
			title: 'The Emoji Royalty',
			description: 'Most emojis used in messages',
			icon: '🎭',
			value: emojiKing.count.toString(),
			subtitle: `${emojiKing.sender} loves expressions`,
			type: emojiKing.count >= 1000 ? 'gold' : emojiKing.count >= 500 ? 'silver' : 'bronze',
			unlocked: emojiKing.count > 0
		});

		// 🌅 The Early Bird - Most messages before 8 AM
		const earlyBird = calculateEarlyBird();
		achievementsList.push({
			id: 'early-bird',
			title: 'The Early Bird',
			description: 'Most messages sent before 8 AM',
			icon: '🌅',
			value: earlyBird.count.toString(),
			subtitle: `${earlyBird.sender} beats the sunrise`,
			type: earlyBird.count >= 100 ? 'gold' : earlyBird.count >= 50 ? 'silver' : 'bronze',
			unlocked: earlyBird.count > 0
		});

		// 💯 The Centurion - First to reach 100 messages
		const centurion = calculateCenturion();
		achievementsList.push({
			id: 'centurion',
			title: 'The Centurion',
			description: 'First person to send 100+ messages',
			icon: '💯',
			value: `${centurion.count} msgs`,
			subtitle: `${centurion.sender} reached the milestone first`,
			type: centurion.count >= 1000 ? 'gold' : centurion.count >= 500 ? 'silver' : 'bronze',
			unlocked: centurion.count >= 100
		});

		// 🔇 The Silent Type - Longest gap between messages
		const silentType = calculateSilentType();
		achievementsList.push({
			id: 'silent-type',
			title: 'The Silent Type',
			description: 'Longest gap between messages',
			icon: '🔇',
			value: `${silentType.days} days`,
			subtitle: `${silentType.sender} took a digital detox`,
			type: silentType.days >= 365 ? 'gold' : silentType.days >= 90 ? 'silver' : 'bronze',
			unlocked: silentType.days > 0
		});

		return achievementsList.filter(a => a.unlocked);
	}

	function calculateMonologueStreak(): { count: number; sender: string } {
		let maxStreak = 0;
		let currentStreak = 0;
		let currentSender = '';
		let maxStreakSender = '';
		let lastSender = '';

		// Sort messages by timestamp
		const sortedMessages = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		for (const message of sortedMessages) {
			if (message.sender === lastSender) {
				currentStreak++;
			} else {
				if (currentStreak > maxStreak) {
					maxStreak = currentStreak;
					maxStreakSender = currentSender;
				}
				currentStreak = 1;
				currentSender = message.sender;
			}
			lastSender = message.sender;
		}

		// Check final streak
		if (currentStreak > maxStreak) {
			maxStreak = currentStreak;
			maxStreakSender = currentSender;
		}

		return { count: maxStreak, sender: maxStreakSender };
	}

	function calculateNightOwlStats(): { count: number; percentage: number } {
		const nightMessages = messages.filter(m => {
			const hour = m.timestamp.getHours();
			return hour >= 1 && hour < 6;
		});

		return {
			count: nightMessages.length,
			percentage: messages.length > 0 ? (nightMessages.length / messages.length) * 100 : 0
		};
	}

	function calculateFastestFingers(): { count: number; sender: string } {
		const timeWindows = new Map<string, { count: number; sender: string }>();
		const sortedMessages = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		for (let i = 0; i < sortedMessages.length; i++) {
			const currentTime = sortedMessages[i].timestamp.getTime();
			const windowEnd = currentTime + (5 * 60 * 1000); // 5 minutes
			
			let count = 0;
			let senderCounts = new Map<string, number>();
			
			for (let j = i; j < sortedMessages.length && sortedMessages[j].timestamp.getTime() <= windowEnd; j++) {
				count++;
				const sender = sortedMessages[j].sender;
				senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
			}
			
			// Find the sender with most messages in this window
			let topSender = '';
			let topCount = 0;
			for (const [sender, senderCount] of senderCounts) {
				if (senderCount > topCount) {
					topCount = senderCount;
					topSender = sender;
				}
			}
			
			const windowKey = `${currentTime}`;
			if (!timeWindows.has(windowKey) || count > timeWindows.get(windowKey)!.count) {
				timeWindows.set(windowKey, { count, sender: topSender });
			}
		}

		let maxCount = 0;
		let maxSender = '';
		for (const window of timeWindows.values()) {
			if (window.count > maxCount) {
				maxCount = window.count;
				maxSender = window.sender;
			}
		}

		return { count: maxCount, sender: maxSender };
	}

	function calculateInquisitor(): { count: number; sender: string } {
		const questionCounts = new Map<string, number>();

		for (const message of messages) {
			if (message.content.includes('?')) {
				const questionCount = (message.content.match(/\?/g) || []).length;
				questionCounts.set(message.sender, (questionCounts.get(message.sender) || 0) + questionCount);
			}
		}

		let maxCount = 0;
		let topSender = '';
		for (const [sender, count] of questionCounts) {
			if (count > maxCount) {
				maxCount = count;
				topSender = sender;
			}
		}

		return { count: maxCount, sender: topSender };
	}

	function calculateNovelist(): { wordCount: number; sender: string } {
		let maxWords = 0;
		let topSender = '';

		for (const message of messages) {
			const wordCount = message.content.trim().split(/\s+/).filter(word => word.length > 0).length;
			if (wordCount > maxWords) {
				maxWords = wordCount;
				topSender = message.sender;
			}
		}

		return { wordCount: maxWords, sender: topSender };
	}

	function calculateMinimalist(): { avgLength: number; sender: string } {
		const senderStats = new Map<string, { totalWords: number; messageCount: number }>();

		for (const message of messages) {
			const wordCount = message.content.trim().split(/\s+/).filter(word => word.length > 0).length;
			const stats = senderStats.get(message.sender) || { totalWords: 0, messageCount: 0 };
			stats.totalWords += wordCount;
			stats.messageCount++;
			senderStats.set(message.sender, stats);
		}

		let minAvgLength = Infinity;
		let topSender = '';
		for (const [sender, stats] of senderStats) {
			if (stats.messageCount >= 10) { // Minimum 10 messages to qualify
				const avgLength = stats.totalWords / stats.messageCount;
				if (avgLength < minAvgLength) {
					minAvgLength = avgLength;
					topSender = sender;
				}
			}
		}

		return { avgLength: minAvgLength === Infinity ? 0 : minAvgLength, sender: topSender };
	}

	function calculateStreakMaster(): { days: number } {
		const messageDates = new Set<string>();
		
		for (const message of messages) {
			const dateStr = message.timestamp.toISOString().split('T')[0];
			messageDates.add(dateStr);
		}

		const sortedDates = Array.from(messageDates).sort();
		let maxStreak = 0;
		let currentStreak = 1;

		for (let i = 1; i < sortedDates.length; i++) {
			const prevDate = new Date(sortedDates[i - 1]);
			const currentDate = new Date(sortedDates[i]);
			const diffDays = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

			if (diffDays === 1) {
				currentStreak++;
			} else {
				maxStreak = Math.max(maxStreak, currentStreak);
				currentStreak = 1;
			}
		}

		maxStreak = Math.max(maxStreak, currentStreak);
		return { days: maxStreak };
	}

	function calculateEmojiKing(): { count: number; sender: string } {
		const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
		const senderEmojiCounts = new Map<string, number>();

		for (const message of messages) {
			const emojiMatches = message.content.match(emojiRegex) || [];
			if (emojiMatches.length > 0) {
				senderEmojiCounts.set(message.sender, (senderEmojiCounts.get(message.sender) || 0) + emojiMatches.length);
			}
		}

		let maxCount = 0;
		let topSender = '';
		for (const [sender, count] of senderEmojiCounts) {
			if (count > maxCount) {
				maxCount = count;
				topSender = sender;
			}
		}

		return { count: maxCount, sender: topSender };
	}

	function calculateEarlyBird(): { count: number; sender: string } {
		const earlySenderCounts = new Map<string, number>();

		for (const message of messages) {
			const hour = message.timestamp.getHours();
			if (hour >= 5 && hour < 8) { // 5 AM to 8 AM
				earlySenderCounts.set(message.sender, (earlySenderCounts.get(message.sender) || 0) + 1);
			}
		}

		let maxCount = 0;
		let topSender = '';
		for (const [sender, count] of earlySenderCounts) {
			if (count > maxCount) {
				maxCount = count;
				topSender = sender;
			}
		}

		return { count: maxCount, sender: topSender };
	}

	function calculateCenturion(): { count: number; sender: string } {
		const senderCounts = new Map<string, number>();
		const sortedMessages = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		let firstCenturion = '';
		let centurionCount = 0;

		for (const message of sortedMessages) {
			const currentCount = (senderCounts.get(message.sender) || 0) + 1;
			senderCounts.set(message.sender, currentCount);

			if (currentCount >= 100 && !firstCenturion) {
				firstCenturion = message.sender;
				centurionCount = currentCount;
				break;
			}
		}

		// If no one reached 100, find the person with most messages
		if (!firstCenturion) {
			for (const [sender, count] of senderCounts) {
				if (count > centurionCount) {
					centurionCount = count;
					firstCenturion = sender;
				}
			}
		}

		return { count: centurionCount, sender: firstCenturion };
	}

	function calculateSilentType(): { days: number; sender: string } {
		const senderMessages = new Map<string, Date[]>();

		// Group messages by sender
		for (const message of messages) {
			if (!senderMessages.has(message.sender)) {
				senderMessages.set(message.sender, []);
			}
			senderMessages.get(message.sender)!.push(message.timestamp);
		}

		let maxGap = 0;
		let silentSender = '';

		for (const [sender, timestamps] of senderMessages) {
			if (timestamps.length < 2) continue;

			const sortedTimestamps = timestamps.sort((a, b) => a.getTime() - b.getTime());
			
			for (let i = 1; i < sortedTimestamps.length; i++) {
				const gapMs = sortedTimestamps[i].getTime() - sortedTimestamps[i - 1].getTime();
				const gapDays = Math.floor(gapMs / (1000 * 60 * 60 * 24));
				
				if (gapDays > maxGap) {
					maxGap = gapDays;
					silentSender = sender;
				}
			}
		}

		return { days: maxGap, sender: silentSender };
	}

	onMount(() => {
		loading = true;
		try {
			achievements = calculateAchievements();
		} catch (error) {
			console.error('Error calculating achievements:', error);
			achievements = [];
		} finally {
			loading = false;
		}
	});

	$: if (messages.length || chats.length) {
		achievements = calculateAchievements();
		loading = false;
	}
</script>

<div class="fun-metrics">
	<div class="header">
		<h2>🎮 Fun & Gamified Metrics</h2>
		<p>Discover amusing patterns and achievements from your chat history!</p>
	</div>

	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Calculating achievements...</p>
		</div>
	{:else if achievements.length === 0}
		<div class="no-data">
			<p>No achievements available. Upload and process a VK archive to see your fun metrics!</p>
		</div>
	{:else}
		<div class="achievements-grid">
			{#each achievements as achievement (achievement.id)}
				<div class="achievement-card {achievement.type}" class:unlocked={achievement.unlocked}>
					<StatsCard 
						title={achievement.title}
						value={achievement.value}
						subtitle={achievement.subtitle}
						icon={achievement.icon}
					/>
					<div class="achievement-description">
						<p>{achievement.description}</p>
					</div>
					<div class="achievement-badge {achievement.type}">
						{#if achievement.type === 'gold'}
							🥇
						{:else if achievement.type === 'silver'}
							🥈
						{:else if achievement.type === 'bronze'}
							🥉
						{:else}
							⭐
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<div class="summary">
			<h3>🏆 Achievement Summary</h3>
			<div class="summary-stats">
				<div class="stat">
					<span class="label">Total Achievements:</span>
					<span class="value">{achievements.length}</span>
				</div>
				<div class="stat">
					<span class="label">Gold Medals:</span>
					<span class="value gold">{achievements.filter(a => a.type === 'gold').length}</span>
				</div>
				<div class="stat">
					<span class="label">Silver Medals:</span>
					<span class="value silver">{achievements.filter(a => a.type === 'silver').length}</span>
				</div>
				<div class="stat">
					<span class="label">Bronze Medals:</span>
					<span class="value bronze">{achievements.filter(a => a.type === 'bronze').length}</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.fun-metrics {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.header h2 {
		color: #333;
		margin-bottom: 0.5rem;
		font-size: 2rem;
	}

	.header p {
		color: #666;
		font-size: 1.1rem;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #f3f3f3;
		border-top: 4px solid #4a90e2;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.no-data {
		text-align: center;
		padding: 3rem;
		color: #666;
		font-size: 1.1rem;
	}

	.achievements-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.achievement-card {
		position: relative;
		border-radius: 12px;
		padding: 1rem;
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		border: 2px solid #dee2e6;
		transition: all 0.3s ease;
		overflow: hidden;
	}

	.achievement-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: linear-gradient(90deg, #dee2e6 0%, #adb5bd 100%);
	}

	.achievement-card.gold {
		background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
		border-color: #ffc107;
	}

	.achievement-card.gold::before {
		background: linear-gradient(90deg, #ffc107 0%, #ff8f00 100%);
	}

	.achievement-card.silver {
		background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
		border-color: #9e9e9e;
	}

	.achievement-card.silver::before {
		background: linear-gradient(90deg, #9e9e9e 0%, #616161 100%);
	}

	.achievement-card.bronze {
		background: linear-gradient(135deg, #efebe9 0%, #d7ccc8 100%);
		border-color: #8d6e63;
	}

	.achievement-card.bronze::before {
		background: linear-gradient(90deg, #8d6e63 0%, #5d4037 100%);
	}

	.achievement-card.special {
		background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
		border-color: #4caf50;
	}

	.achievement-card.special::before {
		background: linear-gradient(90deg, #4caf50 0%, #388e3c 100%);
	}

	.achievement-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
	}

	.achievement-description {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}

	.achievement-description p {
		color: #555;
		font-size: 0.9rem;
		margin: 0;
		font-style: italic;
	}

	.achievement-badge {
		position: absolute;
		top: 1rem;
		right: 1rem;
		font-size: 1.5rem;
		filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.2));
	}

	.summary {
		background: white;
		border: 1px solid #ddd;
		border-radius: 12px;
		padding: 2rem;
		margin-top: 2rem;
	}

	.summary h3 {
		color: #333;
		margin-bottom: 1.5rem;
		text-align: center;
		font-size: 1.5rem;
	}

	.summary-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.stat {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 8px;
		border-left: 4px solid #4a90e2;
	}

	.stat .label {
		font-weight: 500;
		color: #555;
	}

	.stat .value {
		font-weight: 600;
		font-size: 1.2rem;
		color: #333;
	}

	.stat .value.gold {
		color: #ff8f00;
	}

	.stat .value.silver {
		color: #616161;
	}

	.stat .value.bronze {
		color: #5d4037;
	}

	@media (max-width: 768px) {
		.fun-metrics {
			padding: 1rem;
		}

		.achievements-grid {
			grid-template-columns: 1fr;
		}

		.header h2 {
			font-size: 1.5rem;
		}

		.summary-stats {
			grid-template-columns: 1fr;
		}
	}
</style>