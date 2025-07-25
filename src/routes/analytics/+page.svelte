<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { archiveStore } from '$lib/stores/archive';
	import { type ChatAnalytics, type ResponseTimeStats as ResponseTimeStatsType } from '$lib/utils/messageParser';
	import { databaseService } from '$lib/db/database';
	import { generateAnalyticsId } from '$lib/db/schema';
	import { isAnalyticsCacheValid } from '$lib/utils/indexParsers';
	import StatsCard from '$lib/components/StatsCard.svelte';
	import TimelineChart from '$lib/components/TimelineChart.svelte';
	import Chart from '$lib/components/Chart.svelte'; // Import your new wrapper
	import ActivityHeatmap from '$lib/components/ActivityHeatmap.svelte';
	import DigitalGhostHeatmap from '$lib/components/DigitalGhostHeatmap.svelte';
	import stopwords from 'stopwords-ru';
	import WordCloud from '$lib/components/WordCloud.svelte';
	import ConversationBalance from '$lib/components/ConversationBalance.svelte';
	import LexicalDiversity from '$lib/components/LexicalDiversity.svelte';
	import RelationshipTimeline from '$lib/components/RelationshipTimeline.svelte';
	import ResponseTimeStats from '$lib/components/ResponseTimeStats.svelte';
	import { getEmojiStats } from '$lib/utils/emojiParser';
	import EmojiCloud from '$lib/components/EmojiCloud.svelte';
	import TopEmojis from '$lib/components/TopEmojis.svelte';
	import StatusView from '$lib/components/StatusView.svelte';
	import FunMetrics from '$lib/components/FunMetrics.svelte';

	let emojiStats: Map<string, number> = new Map();
	let analytics: ChatAnalytics[] = [];
	let cachedAnalytics: ChatAnalytics[] = []; // Store cached preprocessed data with high limits
	let isLoading = true;
	let error = '';
	let selectedChatIds: string[] = [];
	let processingStep = '';
	let processedCount = 0;
	let totalCount = 0;
	let userStatsPage = 0;
	let usersPerPage = 20;

	// --- ADDED: Configuration State Variables ---
	let wordCloudLimit = 200;
	let wordsPerUserLimit = 10; // A smaller default for the user list
	
	// --- ADDED: State for word cloud scale ---
	let wordCloudScale: 'sqrt' | 'linear' | 'log' = 'linear';
	let wordCloudColorScheme: 'category10' | 'accent' | 'paired' | 'spectral' = 'category10';

	$: totalMessages = analytics.reduce((sum, chat) => sum + chat.totalMessages, 0);
	$: totalUserMessages = analytics.reduce((sum, chat) => sum + chat.userMessages, 0);
	$: totalWords = analytics.reduce((sum, chat) => sum + chat.wordCount, 0);
	$: averageMessageLength = analytics.length > 0
		? analytics.reduce((sum, chat) => sum + chat.averageMessageLength, 0) / analytics.length
		: 0;

	// Combine message type statistics
	$: combinedMessageTypes = analytics.reduce((combined, chat) => {
		combined.photos += chat.messageTypes.photos;
		combined.stickers += chat.messageTypes.stickers;
		combined.forwardedMessages += chat.messageTypes.forwardedMessages;
		combined.wallPosts += chat.messageTypes.wallPosts;
		combined.voiceMessages += chat.messageTypes.voiceMessages;
		combined.documents += chat.messageTypes.documents;
		combined.textMessages += chat.messageTypes.textMessages;
		return combined;
	}, {
		photos: 0,
		stickers: 0,
		forwardedMessages: 0,
		wallPosts: 0,
		voiceMessages: 0,
		documents: 0,
		textMessages: 0
	});

	onMount(async () => {
		// Get selected chat IDs from URL params
		const chatsParam = $page.url.searchParams.get('chats');
		
		if (!chatsParam) {
			goto('/chats');
			return;
		}

		selectedChatIds = chatsParam.split(',');

		const archiveData = $archiveStore;
		
		if (!archiveData.zip || !archiveData.file || !archiveData.archiveId) {
			goto('/');
			return;
		}

		try {
			const analyticsId = generateAnalyticsId(
				archiveData.archiveId,
				selectedChatIds.length === 1 ? selectedChatIds[0] : null,
				'chat'
			);

			// Step 1: Check cache first
			const cachedAnalytics = await databaseService.getAnalytics(analyticsId);

			if (cachedAnalytics && isAnalyticsCacheValid(cachedAnalytics.validUntil)) {
				// Use cached data immediately
				analytics = cachedAnalytics.data;
				emojiStats = getEmojiStats(analytics.flatMap((chat) => chat.messages));
				isLoading = false;
				console.log('✅ Using cached analytics data');
			} else {
				// Step 2: No cache or expired cache, process in main thread but with progress
				console.log('🔄 Processing analytics with caching');
				
				// Import the original parsing function
				const { parseMessagesForChats } = await import('$lib/utils/messageParser');
				
				// Parse messages with progress callback
				analytics = await parseMessagesForChats(archiveData.zip, selectedChatIds, (step, processed, total) => {
					processingStep = step;
					processedCount = processed;
					totalCount = total;
				});

				// Step 3: Cache the results
				await databaseService.saveAnalytics({
					id: analyticsId,
					archiveId: archiveData.archiveId,
					chatId: selectedChatIds.length === 1 ? selectedChatIds[0] : undefined,
					type: selectedChatIds.length === 1 ? 'chat' : 'global',
					data: analytics,
					computedAt: new Date(),
					validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // Cache for 24 hours
				});

				emojiStats = getEmojiStats(analytics.flatMap((chat) => chat.messages));
				isLoading = false;
				console.log('✅ Analytics completed and cached');
			}
		} catch (err) {
			console.error('Error analyzing messages:', err);
			error = err instanceof Error ? err.message : 'Failed to analyze messages';
			isLoading = false;
		}
	});


	function goBack() {
		goto('/chats');
	}






	// Merge user statistics across multiple chats
	$: allUserStats = (() => {
		const mergedUsers: { [sender: string]: any } = {};
		
		analytics.forEach((chat, chatIndex) => {
			chat.userStats.forEach(user => {
				if (!mergedUsers[user.sender]) {
					mergedUsers[user.sender] = {
						sender: user.sender,
						totalMessages: 0,
						wordCount: 0,
						averageMessageLength: 0,
						messageTypes: { photos: 0, stickers: 0, forwardedMessages: 0, wallPosts: 0, voiceMessages: 0, documents: 0, textMessages: 0 },
						mostActiveHours: {},
						mostActiveDays: {},
						topWords: [],
						userWordCounts: {},
						chatsParticipated: []
					};
				}
				
				const merged = mergedUsers[user.sender];
				merged.chatsParticipated.push(chat.chatName);
				merged.totalMessages += user.totalMessages;
				merged.wordCount += user.wordCount;
				
				// Merge message types
				Object.entries(user.messageTypes).forEach(([type, count]) => {
					(merged.messageTypes as any)[type] += count;
				});
				
				// Merge active hours
				Object.entries(user.mostActiveHours).forEach(([hour, count]) => {
					merged.mostActiveHours[hour] = (merged.mostActiveHours[hour] || 0) + count;
				});
				
				// Merge active days
				Object.entries(user.mostActiveDays).forEach(([day, count]) => {
					merged.mostActiveDays[day] = (merged.mostActiveDays[day] || 0) + count;
				});
				
				// Merge word counts for top words calculation
				if (user.userWordCounts) {
					Object.entries(user.userWordCounts).forEach(([word, count]) => {
						merged.userWordCounts[word] = (merged.userWordCounts[word] || 0) + count;
					});
				}
			});
		});
		
		// Calculate merged top words and average message length
		return Object.values(mergedUsers).map((user: any) => {
			user.averageMessageLength = user.totalMessages > 0 ? user.wordCount / user.totalMessages : 0;
			user.topWords = Object.entries(user.userWordCounts)
				.sort(([,a], [,b]) => (b as number) - (a as number))
				.slice(0, wordsPerUserLimit)
				.map(([word, count]) => ({ word, count }));
			return user;
		}).sort((a: any, b: any) => b.totalMessages - a.totalMessages);
	})();
	
	$: paginatedUserStats = allUserStats.slice(userStatsPage * usersPerPage, (userStatsPage + 1) * usersPerPage);
	$: totalUserPages = Math.ceil(allUserStats.length / usersPerPage);

	function nextUserPage() {
		if (userStatsPage < totalUserPages - 1) {
			userStatsPage++;
		}
	}

	function prevUserPage() {
		if (userStatsPage > 0) {
			userStatsPage--;
		}
	}

	function goToUserPage(page: number) {
		userStatsPage = Math.max(0, Math.min(page, totalUserPages - 1));
	}

	function formatDate(date: Date): string {
		return new Intl.DateTimeFormat('ru-RU', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}).format(date);
	}

	function formatNumber(num: number): string {
		return new Intl.NumberFormat('ru-RU').format(Math.round(num));
	}

	// Combine all activity data for charts
	$: combinedHourActivity = analytics.reduce((combined, chat) => {
		Object.entries(chat.mostActiveHours).forEach(([hour, count]) => {
			combined[parseInt(hour)] = (combined[parseInt(hour)] || 0) + count;
		});
		return combined;
	}, {} as { [hour: number]: number });

	$: combinedDayActivity = analytics.reduce((combined, chat) => {
		Object.entries(chat.mostActiveDays).forEach(([day, count]) => {
			combined[day] = (combined[day] || 0) + count;
		});
		return combined;
	}, {} as { [day: string]: number });

	$: allWords = analytics.flatMap(chat => chat.topWords)
		.reduce((wordMap, { word, count }) => {
			wordMap[word] = (wordMap[word] || 0) + count;
			return wordMap;
		}, {} as { [word: string]: number });

	// --- UPDATED: Use the new state variable for the limit ---
	$: topWordsList = Object.entries(allWords)
		.filter(([, count]) => count >= 5)
		.sort(([,a], [,b]) => b - a)
		.slice(0, wordCloudLimit) // Use the configurable limit
		.map(([word, count]) => ({ word, count }));
	// Chart data is now processed directly for D3 components
</script>

<svelte:head>
	<title>Analytics - VK Archive Analytics</title>
</svelte:head>

<main class="container">
<header>
	<div class="header-left">
		<button class="back-button" on:click={goBack}>← Back to Chats</button>
		<div class="header-text">
			<h1>Chat Analytics</h1>
			<p>Analysis of {selectedChatIds.length} selected chat{selectedChatIds.length !== 1 ? 's' : ''}</p>
		</div>
	</div>
	<div class="header-actions"></div>
</header>

	{#if isLoading}
		<StatusView
			status="loading"
			title="Analyzing Messages"
			message={processingStep || 'Preparing to analyze messages...'}
			spinnerSize="large"
			showProgressBar={totalCount > 0}
			progress={Math.floor(processedCount)}
			progressTotal={totalCount}
			progressText={totalCount > 0 ? `Processing ${Math.floor(processedCount)} of ${totalCount} chats` : 'This may take a few moments for large archives'}
		>
			<div class="performance-warning">
				<p><strong>⚠️ Performance Notice:</strong></p>
				<p>Large archives may cause the tab to become temporarily unresponsive during processing. This is normal - please wait for completion.</p>
			</div>
		</StatusView>
	{:else if error}
		<StatusView
			status="error"
			title="Analysis Error"
			message="Error: {error}"
			buttonText="Go Back"
			on:action={goBack}
		/>
	{:else if analytics.length === 0}
		<StatusView
			status="empty"
			title="No Data Found"
			message="No data found for the selected chats."
			buttonText="Go Back"
			on:action={goBack}
		/>
	{:else}
		<!-- Overview Stats -->
		<section class="overview">
			<div class="stats-grid">
				<StatsCard
					title="Total Messages"
					value={formatNumber(totalMessages)}
					icon="💬"
				/>
				<StatsCard
					title="Your Messages"
					value={formatNumber(totalUserMessages)}
					subtitle="{Math.round((totalUserMessages / totalMessages) * 100)}% of total"
					icon="👤"
				/>
				<StatsCard
					title="Total Words"
					value={formatNumber(totalWords)}
					icon="📝"
				/>
				<StatsCard
					title="Avg Message Length"
					value="{formatNumber(averageMessageLength)} chars"
					icon="📏"
				/>
			</div>
		</section>

		<!-- Message Types Stats -->
		<section class="message-types">
			<h2>Message Types</h2>
			<div class="stats-grid">
				<StatsCard
					title="Text Messages"
					value={formatNumber(combinedMessageTypes.textMessages)}
					subtitle="{Math.round((combinedMessageTypes.textMessages / totalMessages) * 100)}% of total"
					icon="💬"
				/>
				<StatsCard
					title="Photos"
					value={formatNumber(combinedMessageTypes.photos)}
					subtitle="{Math.round((combinedMessageTypes.photos / totalMessages) * 100)}% of total"
					icon="📸"
				/>
				<StatsCard
					title="Stickers"
					value={formatNumber(combinedMessageTypes.stickers)}
					subtitle="{Math.round((combinedMessageTypes.stickers / totalMessages) * 100)}% of total"
					icon="😀"
				/>
				<StatsCard
					title="Forwarded Messages"
					value={formatNumber(combinedMessageTypes.forwardedMessages)}
					subtitle="{Math.round((combinedMessageTypes.forwardedMessages / totalMessages) * 100)}% of total"
					icon="↪️"
				/>
				<StatsCard
					title="Voice Messages"
					value={formatNumber(combinedMessageTypes.voiceMessages)}
					subtitle="{Math.round((combinedMessageTypes.voiceMessages / totalMessages) * 100)}% of total"
					icon="🎤"
				/>
				<StatsCard
					title="Documents"
					value={formatNumber(combinedMessageTypes.documents)}
					subtitle="{Math.round((combinedMessageTypes.documents / totalMessages) * 100)}% of total"
					icon="📄"
				/>
			</div>
		</section>

		<!-- Individual Chat Stats -->
		<section class="chat-details">
			<h2>Chat Details</h2>
			<div class="chat-cards">
				{#each analytics as chat}
					<div class="chat-card">
						<h3>{chat.chatName}</h3>
						<div class="chat-stats">
							<div class="stat">
								<span class="label">Messages:</span>
								<span class="value">{formatNumber(chat.totalMessages)}</span>
							</div>
							<div class="stat">
								<span class="label">Your messages:</span>
								<span class="value">{formatNumber(chat.userMessages)} ({Math.round((chat.userMessages / chat.totalMessages) * 100)}%)</span>
							</div>
							<div class="stat">
								<span class="label">Date range:</span>
								<span class="value">{formatDate(chat.dateRange.start)} - {formatDate(chat.dateRange.end)}</span>
							</div>
							<div class="stat">
								<span class="label">Words:</span>
								<span class="value">{formatNumber(chat.wordCount)}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Per-User Statistics -->
		<section class="user-stats">
			<div class="user-stats-header">
				<h2>Per-User Statistics</h2>
				<div class="user-stats-info">
					<span>Showing {Math.min(allUserStats.length, usersPerPage)} of {allUserStats.length} users</span>
				</div>
			</div>
			
			{#if paginatedUserStats.length > 0}
				<div class="users-grid">
					{#each paginatedUserStats as user}
						<div class="user-card">
							<div class="user-header">
								<h4>{user.sender}</h4>
								<span class="message-count">{formatNumber(user.totalMessages)} messages</span>
							</div>
							
							{#if user.chatsParticipated && user.chatsParticipated.length > 0 && selectedChatIds.length > 1}
								<div class="user-chats">
									<span class="chats-label">In chats:</span>
									<div class="chat-tags">
										{#each user.chatsParticipated as chatName}
											<span class="chat-tag">{chatName}</span>
										{/each}
									</div>
								</div>
							{/if}
							
							<div class="user-stats-grid">
								<div class="user-stat">
									<span class="stat-label">Words:</span>
									<span class="stat-value">{formatNumber(user.wordCount)}</span>
								</div>
								<div class="user-stat">
									<span class="stat-label">Avg Length:</span>
									<span class="stat-value">{Math.round(user.averageMessageLength)} chars</span>
								</div>
							</div>

							<!-- Message Types for User -->
							<div class="user-message-types">
								<h5>Message Types:</h5>
								<div class="message-type-bars">
									{#if user.messageTypes.textMessages > 0}
										<div class="type-bar">
											<span class="type-label">Text</span>
											<div class="type-progress">
												<div class="type-fill" style="width: {(user.messageTypes.textMessages / user.totalMessages) * 100}%"></div>
											</div>
											<span class="type-count">{user.messageTypes.textMessages}</span>
										</div>
									{/if}
									{#if user.messageTypes.photos > 0}
										<div class="type-bar">
											<span class="type-label">Photos</span>
											<div class="type-progress">
												<div class="type-fill" style="width: {(user.messageTypes.photos / user.totalMessages) * 100}%"></div>
											</div>
											<span class="type-count">{user.messageTypes.photos}</span>
										</div>
									{/if}
									{#if user.messageTypes.stickers > 0}
										<div class="type-bar">
											<span class="type-label">Stickers</span>
											<div class="type-progress">
												<div class="type-fill" style="width: {(user.messageTypes.stickers / user.totalMessages) * 100}%"></div>
											</div>
											<span class="type-count">{user.messageTypes.stickers}</span>
										</div>
									{/if}
									{#if user.messageTypes.forwardedMessages > 0}
										<div class="type-bar">
											<span class="type-label">Forwarded</span>
											<div class="type-progress">
												<div class="type-fill" style="width: {(user.messageTypes.forwardedMessages / user.totalMessages) * 100}%"></div>
											</div>
											<span class="type-count">{user.messageTypes.forwardedMessages}</span>
										</div>
									{/if}
									{#if user.messageTypes.voiceMessages > 0}
										<div class="type-bar">
											<span class="type-label">Voice</span>
											<div class="type-progress">
												<div class="type-fill" style="width: {(user.messageTypes.voiceMessages / user.totalMessages) * 100}%"></div>
											</div>
											<span class="type-count">{user.messageTypes.voiceMessages}</span>
										</div>
									{/if}
									{#if user.messageTypes.documents > 0}
										<div class="type-bar">
											<span class="type-label">Documents</span>
											<div class="type-progress">
												<div class="type-fill" style="width: {(user.messageTypes.documents / user.totalMessages) * 100}%"></div>
											</div>
											<span class="type-count">{user.messageTypes.documents}</span>
										</div>
									{/if}
								</div>
							</div>

							<!-- Top Words for User -->
							{#if user.topWords.length > 0}
								<div class="user-top-words">
									<h5>Top Words:</h5>
									<div class="word-tags">
										<!-- --- UPDATED: Use the new state variable for the limit --- -->
										{#each user.topWords.slice(0, wordsPerUserLimit) as { word, count }}
											<span class="word-tag">{word} ({count})</span>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Activity Pattern -->
							<div class="user-activity-pattern">
								<h5>Most Active:</h5>
								<div class="activity-info">
									{#if Object.keys(user.mostActiveHours).length > 0}
										{@const topHour = Object.entries(user.mostActiveHours).sort(([,a], [,b]) => (b as number) - (a as number))[0]}
										<span class="activity-item">Hour: {topHour[0]}:00 ({topHour[1]} msgs)</span>
									{/if}
									{#if Object.keys(user.mostActiveDays).length > 0}
										{@const topDay = Object.entries(user.mostActiveDays).sort(([,a], [,b]) => (b as number) - (a as number))[0]}
										<span class="activity-item">Day: {topDay[0]} ({topDay[1]} msgs)</span>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
				
				<!-- Pagination Controls -->
				{#if totalUserPages > 1}
					<div class="pagination">
						<button
							class="page-btn"
							disabled={userStatsPage === 0}
							on:click={prevUserPage}
						>
							← Previous
						</button>
						
						<div class="page-numbers">
							{#each Array(Math.min(totalUserPages, 10)) as _, i}
								{@const startPage = Math.max(0, Math.min(userStatsPage - 5, totalUserPages - 10))}
								{@const pageNum = startPage + i}
								{#if pageNum >= 0 && pageNum < totalUserPages}
									<button
										class="page-num"
										class:active={pageNum === userStatsPage}
										on:click={() => goToUserPage(pageNum)}
									>
										{pageNum + 1}
									</button>
								{/if}
							{/each}
						</div>
						
						<button
							class="page-btn"
							disabled={userStatsPage >= totalUserPages - 1}
							on:click={nextUserPage}
						>
							Next →
						</button>
					</div>
				{/if}
			{:else}
				<p class="no-users">No user statistics available with current filters.</p>
			{/if}
		</section>

		<!-- Activity Analysis -->
		<section class="activity-analysis">
			<h2>Activity Patterns</h2>
			<div class="charts-grid">
				<div class="chart-wrapper">
					<ActivityHeatmap
						data={combinedHourActivity}
						type="hourly"
						title="Hourly Activity Pattern"
					/>
				</div>
				<div class="chart-wrapper">
					<ActivityHeatmap
						data={combinedDayActivity}
						type="daily"
						title="Daily Activity Pattern"
					/>
				</div>
			</div>
		</section>

		<!-- Digital Ghost Heatmaps -->
		<section class="ghost-analysis">
			<h2>👻 Digital Ghost - Quiet Hours Analysis</h2>
			<p class="section-description">
				Discover your "ghost hours" - the times when you're least active online.
				Darker areas represent quieter periods in your digital presence.
			</p>
			<div class="charts-grid">
				<div class="chart-wrapper">
					<DigitalGhostHeatmap
						data={combinedHourActivity}
						type="hourly"
						title="👻 Digital Ghost - Hourly Quiet Hours"
					/>
				</div>
				<div class="chart-wrapper">
					<DigitalGhostHeatmap
						data={combinedDayActivity}
						type="daily"
						title="👻 Digital Ghost - Daily Quiet Days"
					/>
				</div>
			</div>
		</section>

		<!-- Timeline -->
		<section class="timeline-section">
			<h2>Message Timeline</h2>
			<TimelineChart {analytics} />
		</section>

		<!-- Advanced Analytics -->
		<section class="advanced-analytics">
			<h2>Advanced Analytics</h2>
			
			<!-- Conversation Balance -->
			<ConversationBalance {analytics} currentUserId={null} />
			
			<!-- Lexical Diversity -->
			<LexicalDiversity {analytics} currentUserId={null} />
			<!-- Global Response Time Stats -->
			{#if analytics.length > 0 && analytics[0].globalResponseTimeStats.totalResponses > 0}
				<ResponseTimeStats stats={analytics[0].globalResponseTimeStats} userName={"Global"} />
			{/if}

			<!-- Individual Response Time Stats for top users -->
			{#each allUserStats.slice(0, 3) as user}
				{#if user.responseTimeStats && user.responseTimeStats.totalResponses > 5}
					<ResponseTimeStats stats={user.responseTimeStats} userName={user.sender} />
				{/if}
			{/each}

			<!-- Relationship Timeline for each chat -->
			{#each analytics as chat}
				<RelationshipTimeline {chat} />
			{/each}
		</section>

		<!-- Word Analysis -->
		<section class="words-section">
			<h2>Word Analysis</h2>

			<!-- --- ADDED: Configuration Section --- -->
			<div class="configuration-section">
				<div class="config-grid">
					<div class="config-item">
						<label for="wordCloudLimit">
							Word Cloud Limit: <strong>{wordCloudLimit} words</strong>
						</label>
						<input
							type="range"
							id="wordCloudLimit"
							min="50"
							max="500"
							step="10"
							bind:value={wordCloudLimit}
						/>
					</div>
					<div class="config-item">
						<label for="wordsPerUserLimit">
							Top Words Per User: <strong>{wordsPerUserLimit} words</strong>
						</label>
						<input
							type="range"
							id="wordsPerUserLimit"
							min="5"
							max="50"
							step="1"
							bind:value={wordsPerUserLimit}
						/>
					</div>
					<!-- --- ADDED: Radio buttons for scaling --- -->
					<div class="config-item">
						<div class="config-label">
							Word Cloud Scaling
						</div>
						<div class="scale-options">
							<label>
								<input type="radio" bind:group={wordCloudScale} value="sqrt" />
								<span>Balanced (sqrt)</span>
							</label>
							<label>
								<input type="radio" bind:group={wordCloudScale} value="linear" />
								<span>Dramatic (linear)</span>
							</label>
							<label>
								<input type="radio" bind:group={wordCloudScale} value="log" />
								<span>Subtle (log)</span>
							</label>
						</div>
					</div>
					<div class="config-item">
						<div class="config-label">Color Scheme</div>
						<div class="scale-options">
							<label><input type="radio" bind:group={wordCloudColorScheme} value="category10" /><span>Default</span></label>
							<label><input type="radio" bind:group={wordCloudColorScheme} value="accent" /><span>Accent</span></label>
							<label><input type="radio" bind:group={wordCloudColorScheme} value="paired" /><span>Paired</span></label>
							<label><input type="radio" bind:group={wordCloudColorScheme} value="spectral" /><span>Spectral</span></label>
						</div>
					</div>
				</div>
			</div>

			<div class="words-container">
				<div class="chart-wrapper">
					<!-- --- MODIFIED: Pass the scale prop to the component --- -->
					<WordCloud words={topWordsList} scale={wordCloudScale} colorScheme={wordCloudColorScheme}/>
				</div>
			</div>
		</section>

		<!-- Emoji Analysis -->
		<section class="emoji-analysis">
			<h2>Emoji Analysis</h2>
			<div class="charts-grid">
				<div class="chart-wrapper">
					<h3>Most Used Emojis</h3>
					<TopEmojis {emojiStats} />
				</div>
				<div class="chart-wrapper">
					<h3>Emoji Cloud</h3>
					<EmojiCloud {emojiStats} />
				</div>
			</div>
		</section>

		<!-- Fun & Gamified Metrics -->
		<section class="fun-metrics-section">
			<FunMetrics
				messages={analytics.flatMap(chat => chat.messages)}
				chats={analytics}
			/>
		</section>
	{/if}
</main>

<!-- Configuration Controls -->

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 3rem;
		gap: 2rem;
	}

	.header-left {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.header-text {
		display: flex;
		flex-direction: column;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}


	.back-button {
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		border: 1px solid #dee2e6;
		color: #495057;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.75rem 1.25rem;
		margin-bottom: 1rem;
		border-radius: 8px;
		transition: all 0.2s ease;
		font-weight: 500;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.back-button:hover {
		background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
		border-color: #adb5bd;
		transform: translateY(-1px);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
		text-decoration: none;
	}

	.back-button:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	h1 {
		color: #333;
		margin-bottom: 0.5rem;
	}


	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}


	.performance-warning {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #fff8e1;
		border: 1px solid #ffecb3;
		border-radius: 6px;
		text-align: left;
		max-width: 400px;
	}

	.performance-warning p {
		margin: 0;
		font-size: 0.85rem;
		color: #e65100;
		line-height: 1.4;
	}

	.performance-warning p:first-child {
		margin-bottom: 0.5rem;
		font-weight: 600;
	}

	.overview, .message-types {
		margin-bottom: 3rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.chat-details {
		margin-bottom: 3rem;
	}

	.chat-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
	}

	.chat-card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1.5rem;
	}

	.chat-card h3 {
		color: #4a90e2;
		margin-bottom: 1rem;
	}

	.chat-stats {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.stat {
		display: flex;
		justify-content: space-between;
	}

	.stat .label {
		color: #666;
	}

	.stat .value {
		font-weight: 500;
		color: #333;
	}

	/* User Statistics Styles */
	.user-stats {
		margin-bottom: 3rem;
	}


	.users-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 1rem;
	}

	.user-card {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 6px;
		padding: 1rem;
	}

	.user-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #dee2e6;
	}

	.user-header h4 {
		margin: 0;
		color: #495057;
		font-size: 1.1rem;
	}

	.message-count {
		background: #4a90e2;
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: 500;
	}

	.user-stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.user-stat {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem;
	}

	.stat-label {
		color: #6c757d;
		font-size: 0.9rem;
	}

	.stat-value {
		font-weight: 500;
		color: #495057;
		font-size: 0.9rem;
	}

	.user-message-types, .user-top-words, .user-activity-pattern {
		margin-bottom: 1rem;
	}

	.user-message-types h5, .user-top-words h5, .user-activity-pattern h5 {
		margin: 0 0 0.5rem 0;
		color: #495057;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.message-type-bars {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.type-bar {
		display: grid;
		grid-template-columns: 60px 1fr 30px;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.8rem;
	}

	.type-label {
		color: #6c757d;
		font-size: 0.75rem;
	}

	.type-progress {
		background: #e9ecef;
		height: 8px;
		border-radius: 4px;
		overflow: hidden;
	}

	.type-fill {
		background: linear-gradient(90deg, #4a90e2, #5ba3f5);
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.type-count {
		color: #495057;
		font-weight: 500;
		font-size: 0.75rem;
		text-align: right;
	}

	.word-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.word-tag {
		background: #e3f2fd;
		color: #1976d2;
		padding: 0.2rem 0.4rem;
		border-radius: 8px;
		font-size: 0.7rem;
		font-weight: 500;
	}

	.activity-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.activity-item {
		background: #fff3e0;
		color: #f57c00;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.no-users {
		color: #6c757d;
		font-style: italic;
		text-align: center;
		padding: 2rem;
	}

	.activity-analysis, .timeline-section, .advanced-analytics, .words-section {
		margin-bottom: 3rem;
	}

	.advanced-analytics h2 {
		color: #333;
		margin-bottom: 2rem;
		text-align: center;
		font-size: 1.5rem;
		border-bottom: 2px solid #4a90e2;
		padding-bottom: 0.5rem;
	}

	.charts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: 2rem;
	}

	.words-container {
		display: block;
	}

	/* User chat tags styles */
	.user-chats {
		margin-bottom: 1rem;
		padding: 0.5rem;
		background: #f8f9fa;
		border-radius: 4px;
	}

	.chats-label {
		font-size: 0.85rem;
		color: #6c757d;
		font-weight: 500;
		margin-bottom: 0.25rem;
		display: block;
	}

	.chat-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.chat-tag {
		background: #e1f5fe;
		color: #0277bd;
		padding: 0.15rem 0.4rem;
		border-radius: 12px;
		font-size: 0.7rem;
		font-weight: 500;
		border: 1px solid #b3e5fc;
	}

	/* Ghost Analysis Section */
	.ghost-analysis {
		margin-bottom: 3rem;
	}

	.section-description {
		color: #666;
		font-size: 0.95rem;
		margin-bottom: 2rem;
		line-height: 1.5;
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		padding: 1rem;
		border-radius: 8px;
		border-left: 4px solid #666;
	}

	h2, h3 {
			color: #333;
			margin-bottom: 1rem;
		}
	
		/* --- ADDED: Styles for the new configuration section --- */
		.configuration-section {
			background: #f8f9fa;
			border-radius: 8px;
			padding: 1rem 1.5rem;
			margin-bottom: 2rem;
			border: 1px solid #e9ecef;
		}
	
		.config-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); /* Adjusted min-width */
			gap: 1.5rem;
			align-items: center;
		}
	
		.config-item {
			display: flex;
			flex-direction: column;
		}
	
		.config-item label {
			font-size: 0.9rem;
			color: #495057;
			margin-bottom: 0.5rem;
		}

		.config-label {
			font-size: 0.9rem;
			color: #495057;
			margin-bottom: 0.5rem;
		}
	
		.config-item input[type="range"] {
			width: 100%;
			cursor: pointer;
		}
	
		/* --- ADDED: Styles for the new scale options --- */
		.scale-options {
			display: flex;
			gap: 1rem;
			margin-top: 0.25rem;
		}
		.scale-options label {
			display: flex;
			align-items: center;
			gap: 0.25rem;
			font-size: 0.9rem;
			cursor: pointer;
		}
	
		@media (max-width: 768px) {
			.words-container {
				grid-template-columns: 1fr;
			}
		
		.charts-grid {
			grid-template-columns: 1fr;
		}
		
		header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}
		
		.header-actions {
			align-self: stretch;
			justify-content: space-between;
		}
		
	}
	.chart-wrapper {
		background: white;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
	}
	.chart-wrapper:empty {
		display: none;
	}

	/* Pagination Styles */
	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		margin-top: 2rem;
		padding: 1rem 0;
	}

	.page-btn {
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		color: #495057;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s ease;
	}

	.page-btn:hover:not(:disabled) {
		background: #e9ecef;
		border-color: #adb5bd;
	}

	.page-btn:disabled {
		background: #f8f9fa;
		color: #6c757d;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.page-numbers {
		display: flex;
		gap: 0.25rem;
		margin: 0 1rem;
	}

	.page-num {
		background: #fff;
		border: 1px solid #dee2e6;
		color: #495057;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		min-width: 40px;
		transition: all 0.2s ease;
	}

	.page-num:hover {
		background: #e9ecef;
		border-color: #adb5bd;
	}

	.page-num.active {
		background: #4a90e2;
		border-color: #4a90e2;
		color: white;
	}

	.page-num.active:hover {
		background: #357abd;
		border-color: #357abd;
	}

	.user-stats-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.user-stats-info {
		color: #6c757d;
		font-size: 0.9rem;
	}

	.fun-metrics-section {
		margin-top: 3rem;
		border-top: 2px solid #e9ecef;
		padding-top: 2rem;
	}
</style>