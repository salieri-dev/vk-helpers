import { databaseService } from '../db/database';
import { generateAnalyticsId } from '../db/schema';
import type { Message, ChatAnalytics } from '../utils/messageParser';

// Worker context
declare const self: any;

export interface AnalyticsWorkerCommand {
	type: 'PROCESS_ANALYTICS';
	messages: Message[];
	chatNames: { [chatId: string]: string };
	archiveId: string;
	chatIds: string[];
}

export interface AnalyticsWorkerResponse {
	type: 'PROGRESS' | 'COMPLETE' | 'ERROR';
	data: any;
}

interface ProgressData {
	step: string;
	processed: number;
	total: number;
	currentItem?: string;
	percentage: number;
}

interface CompletionData {
	result: ChatAnalytics[];
	analyticsId: string;
	processingTime: number;
}

interface ErrorData {
	message: string;
	stack?: string;
}

class AnalyticsProcessor {
	private startTime: number = 0;

	private postProgress(step: string, processed: number, total: number, currentItem?: string): void {
		const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

		const progressData: ProgressData = {
			step,
			percentage,
			processed,
			total,
			currentItem
		};

		self.postMessage({
			type: 'PROGRESS',
			data: progressData
		} as AnalyticsWorkerResponse);
	}

	private postComplete(data: CompletionData): void {
		self.postMessage({
			type: 'COMPLETE',
			data
		} as AnalyticsWorkerResponse);
	}

	private postError(error: ErrorData): void {
		self.postMessage({
			type: 'ERROR',
			data: error
		} as AnalyticsWorkerResponse);
	}

	async processAnalytics(
		messages: Message[],
		chatNames: { [chatId: string]: string },
		archiveId: string,
		chatIds: string[]
	): Promise<void> {
		this.startTime = Date.now();
		const analyticsId = generateAnalyticsId(
			archiveId,
			chatIds.length === 1 ? chatIds[0] : null,
			'chat'
		);

		try {
			this.postProgress('Processing analytics...', 0, 100);

			// Group messages by chat
			const messagesByChat: { [chatId: string]: Message[] } = {};
			for (const message of messages) {
				const chatId = this.extractChatIdFromMessage(message);
				if (chatIds.includes(chatId)) {
					if (!messagesByChat[chatId]) {
						messagesByChat[chatId] = [];
					}
					messagesByChat[chatId].push(message);
				}
			}

			this.postProgress('Computing analytics...', 20, 100);

			// Process analytics for each chat
			const result: ChatAnalytics[] = [];
			const totalChats = Object.keys(messagesByChat).length;
			let processedChats = 0;

			for (const [chatId, chatMessages] of Object.entries(messagesByChat)) {
				const chatName = chatNames[chatId] || `Chat ${chatId}`;
				
				this.postProgress(
					`Processing ${chatName}...`,
					20 + Math.round((processedChats / totalChats) * 60),
					100,
					`Chat ${processedChats + 1} of ${totalChats}`
				);

				const analytics = this.computeChatAnalytics(chatMessages, chatName, chatId);
				result.push(analytics);
				processedChats++;
			}

			this.postProgress('Saving results to cache...', 90, 100);

			// Cache the result in IndexedDB
			await databaseService.saveAnalytics({
				id: analyticsId,
				archiveId: archiveId,
				chatId: chatIds.length === 1 ? chatIds[0] : undefined,
				type: chatIds.length === 1 ? 'chat' : 'global',
				data: result,
				computedAt: new Date(),
				validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // Cache for 24 hours
			});

			this.postProgress('Complete!', 100, 100);

			const processingTime = Date.now() - this.startTime;

			// Send completion data
			this.postComplete({
				result,
				analyticsId,
				processingTime
			});

		} catch (error) {
			console.error('Analytics processing error:', error);

			this.postError({
				message: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined
			});
		}
	}

	private extractChatIdFromMessage(message: Message): string {
		// Extract chat ID from message ID or other identifier
		// This depends on how your message IDs are structured
		return message.id.split('_')[0] || '';
	}

	private computeChatAnalytics(messages: Message[], chatName: string, chatId: string): ChatAnalytics {
		// Implement analytics computation without DOM parsing
		// This is the heavy computation that benefits from being in a worker
		
		const totalMessages = messages.length;
		const userMessages = messages.filter(m => m.isFromUser).length;
		const wordCount = messages.reduce((sum, m) => sum + this.countWords(m.content), 0);
		const averageMessageLength = totalMessages > 0 ? wordCount / totalMessages : 0;

		// Calculate date range
		const timestamps = messages.map(m => m.timestamp).sort((a, b) => a.getTime() - b.getTime());
		const dateRange = {
			start: timestamps[0] || new Date(),
			end: timestamps[timestamps.length - 1] || new Date()
		};

		// Calculate message types
		const messageTypes = {
			photos: messages.filter(m => m.attachmentInfo.includes('photo')).length,
			stickers: messages.filter(m => m.attachmentInfo.includes('sticker')).length,
			forwardedMessages: messages.filter(m => m.attachmentInfo.includes('forward')).length,
			wallPosts: messages.filter(m => m.attachmentInfo.includes('wall')).length,
			voiceMessages: messages.filter(m => m.attachmentInfo.includes('audio_message')).length,
			documents: messages.filter(m => m.attachmentInfo.includes('doc')).length,
			videos: messages.filter(m => m.attachmentInfo.includes('video')).length,
			textMessages: messages.filter(m => !m.hasAttachment).length
		};

		// Calculate activity patterns
		const mostActiveHours: { [hour: number]: number } = {};
		const mostActiveDays: { [day: string]: number } = {};

		for (const message of messages) {
			const hour = message.timestamp.getHours();
			const day = message.timestamp.toLocaleDateString('en-US', { weekday: 'long' });
			
			mostActiveHours[hour] = (mostActiveHours[hour] || 0) + 1;
			mostActiveDays[day] = (mostActiveDays[day] || 0) + 1;
		}

		// Calculate top words (simplified without stopwords for worker)
		const wordCounts: { [word: string]: number } = {};
		for (const message of messages) {
			const words = message.content
				.toLowerCase()
				.replace(/[^\w\s]/g, ' ')
				.split(/\s+/)
				.filter(word => word.length > 2);
			
			for (const word of words) {
				wordCounts[word] = (wordCounts[word] || 0) + 1;
			}
		}

		const topWords = Object.entries(wordCounts)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 100)
			.map(([word, count]) => ({ word, count }));

		// User stats (simplified)
		const userStatsMap: { [sender: string]: any } = {};
		for (const message of messages) {
			if (!userStatsMap[message.sender]) {
				userStatsMap[message.sender] = {
					sender: message.sender,
					totalMessages: 0,
					wordCount: 0,
					averageMessageLength: 0,
					messageTypes: { ...messageTypes },
					mostActiveHours: {},
					mostActiveDays: {},
					topWords: [],
					userWordCounts: {}
				};
			}
			const userStat = userStatsMap[message.sender];
			userStat.totalMessages++;
			userStat.wordCount += this.countWords(message.content);
		}

		const userStats = Object.values(userStatsMap);

		return {
			chatId,
			chatName,
			totalMessages,
			userMessages,
			otherMessages: totalMessages - userMessages,
			wordCount,
			averageMessageLength,
			dateRange,
			messageTypes,
			mostActiveHours,
			mostActiveDays,
			topWords,
			userStats,
			messages, // Include messages for emoji parsing in main thread
			// Simplified versions of advanced analytics (can be computed in main thread if needed)
			relationshipTimeline: [],
			conversationBalance: {
				messageRatio: totalMessages > 0 ? userMessages / (totalMessages - userMessages) : 0,
				wordRatio: 0, // Will be computed in main thread if needed
				initiationRatio: 0, // Will be computed in main thread if needed
				conversationStarts: 0, // Will be computed in main thread if needed
				totalConversations: 0 // Will be computed in main thread if needed
			},
			globalResponseTimeStats: {
				averageResponseTime: 0,
				medianResponseTime: 0,
				totalResponses: 0,
				responseTimes: []
			}
		};
	}

	private countWords(text: string): number {
		return text.trim().split(/\s+/).filter(word => word.length > 0).length;
	}
}

// Worker message handler
const processor = new AnalyticsProcessor();

self.onmessage = async (event: MessageEvent<AnalyticsWorkerCommand>) => {
	const { type, messages, chatNames, archiveId, chatIds } = event.data;

	if (type === 'PROCESS_ANALYTICS') {
		await processor.processAnalytics(messages, chatNames, archiveId, chatIds);
	}
};

// Export for testing
export { AnalyticsProcessor };