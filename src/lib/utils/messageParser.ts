import JSZip from 'jszip';
import { decodeWindows1251 } from '$lib/utils/encoding';
import stopwords from 'stopwords-ru';

export interface Message {
	id: string;
	sender: string;
	isFromUser: boolean;
	timestamp: Date;
	content: string;
	hasAttachment: boolean;
	attachmentInfo: string;
	attachmentLinks: string[];
	edited: boolean;
}

export interface MessageTypeStats {
	photos: number;
	stickers: number;
	forwardedMessages: number;
	wallPosts: number;
	voiceMessages: number;
	documents: number;
	videos: number;
	textMessages: number;
}

export interface ResponseTimeStats {
	averageResponseTime: number; // in minutes
	medianResponseTime: number; // in minutes
	totalResponses: number;
	responseTimes: number[]; // array of response times in minutes
}

export interface ConversationBalance {
	messageRatio: number; // user messages / other user messages
	wordRatio: number; // user words / other user words
	initiationRatio: number; // user initiations / other user initiations
	conversationStarts: number; // number of conversations user started
	totalConversations: number; // total conversation segments identified
}

export interface UserStats {
	sender: string;
	totalMessages: number;
	wordCount: number;
	averageMessageLength: number;
	messageTypes: MessageTypeStats;
	mostActiveHours: { [hour: number]: number };
	mostActiveDays: { [day: string]: number };
	topWords: { word: string; count: number }[];
	userWordCounts?: { [word: string]: number };
	// New advanced analytics
	responseTimeStats?: ResponseTimeStats;
	conversationBalance?: ConversationBalance;
}

export interface RelationshipTimeline {
	month: string; // YYYY-MM format
	userMessages: number;
	otherMessages: number;
	totalMessages: number;
}

export interface ChatAnalytics {
	chatId: string;
	chatName: string;
	totalMessages: number;
	userMessages: number;
	otherMessages: number;
	messages: Message[];
	dateRange: {
		start: Date;
		end: Date;
	};
	wordCount: number;
	averageMessageLength: number;
	mostActiveHours: { [hour: number]: number };
	mostActiveDays: { [day: string]: number };
	topWords: { word: string; count: number }[];
	messageTypes: MessageTypeStats;
	userStats: UserStats[];
	// New advanced analytics
	relationshipTimeline: RelationshipTimeline[];
	conversationBalance: ConversationBalance;
	globalResponseTimeStats: ResponseTimeStats;
}

export async function parseMessagesForChats(
	zip: JSZip,
	chatIds: string[],
	onProgress?: (step: string, processed: number, total: number) => void
): Promise<ChatAnalytics[]> {
	// console.log('🔍 parseMessagesForChats called with chatIds:', chatIds);
	// console.log('🔍 ZIP file contains these paths:', Object.keys(zip.files));
	
	const analytics: ChatAnalytics[] = [];

	onProgress?.('🔍 Counting message files...', 0, 1);

	// First pass: count total message files across all chats for accurate progress tracking
	let totalFiles = 0;
	const chatFileMapping: { [chatId: string]: string[] } = {};
	
	for (const chatId of chatIds) {
		const messageFiles = Object.keys(zip.files)
			.filter(fileName =>
				fileName.startsWith(`messages/${chatId}/messages`) &&
				fileName.endsWith('.html')
			)
			.sort();
		chatFileMapping[chatId] = messageFiles;
		totalFiles += messageFiles.length;
	}

	onProgress?.('🔍 Starting message analysis...', 0, totalFiles);

	let processedFiles = 0;
	
	for (let i = 0; i < chatIds.length; i++) {
		const chatId = chatIds[i];
		const chatFiles = chatFileMapping[chatId];
		// console.log(`🔍 Processing chat ID: ${chatId} (${i + 1}/${chatIds.length}) with ${chatFiles.length} files`);
		
		onProgress?.(`📊 Analyzing chat ${i + 1} of ${chatIds.length}...`, processedFiles, totalFiles);
		
		const chatAnalytics = await parseChatMessages(zip, chatId, (fileProgress, totalChatFiles) => {
			const currentFileProgress = processedFiles + fileProgress;
			onProgress?.(`📊 Analyzing chat ${i + 1}/${chatIds.length} - Processing file ${currentFileProgress}/${totalFiles}`, currentFileProgress, totalFiles);
		});
		
		if (chatAnalytics) {
			// console.log(`✅ Successfully parsed chat ${chatId}:`, {
			//	chatName: chatAnalytics.chatName,
			//	totalMessages: chatAnalytics.totalMessages
			// });
			analytics.push(chatAnalytics);
		} else {
			console.warn(`❌ No data found for chat ${chatId}`);
		}
		
		processedFiles += chatFiles.length;
		onProgress?.(`✅ Completed chat ${i + 1} of ${chatIds.length}`, processedFiles, totalFiles);
	}

	onProgress?.('✅ Analysis complete!', totalFiles, totalFiles);
	// console.log(`🔍 Final analytics array length: ${analytics.length}`);
	return analytics;
}

async function parseChatMessages(
	zip: JSZip,
	chatId: string,
	onFileProgress?: (processed: number, total: number) => void
): Promise<ChatAnalytics | null> {
	// console.log(`🔍 parseChatMessages called for chatId: ${chatId}`);
	
	// Find all message files for this chat
	const messageFiles = Object.keys(zip.files)
		.filter(fileName =>
			fileName.startsWith(`messages/${chatId}/messages`) &&
			fileName.endsWith('.html')
		)
		.sort(); // Sort to process in order

	// console.log(`🔍 Found ${messageFiles.length} message files for chat ${chatId}:`, messageFiles);

	if (messageFiles.length === 0) {
		console.warn(`❌ No message files found for chat ${chatId}`);
		// console.log(`🔍 Looking for pattern: messages/${chatId}/messages*.html`);
		// console.log(`🔍 Available files matching messages/${chatId}/: `,
		//	Object.keys(zip.files).filter(f => f.includes(`messages/${chatId}/`))
		// );
		return null;
	}

	let allMessages: Message[] = [];
	let chatName = `Chat ${chatId}`;

	// Process each message file
	for (let i = 0; i < messageFiles.length; i++) {
		const fileName = messageFiles[i];
		// console.log(`🔍 Processing file: ${fileName} (${i + 1}/${messageFiles.length})`);
		
		onFileProgress?.(i + 1, messageFiles.length);
		
		const file = zip.file(fileName);
		if (!file) {
			console.warn(`❌ Could not access file: ${fileName}`);
			continue;
		}

		try {
			const buffer = await file.async('arraybuffer');
			// console.log(`🔍 File ${fileName} size: ${buffer.byteLength} bytes`);
			
			const content = decodeWindows1251(buffer);
			// console.log(`🔍 Decoded content length: ${content.length} chars`);
			// console.log(`🔍 Content preview (first 200 chars): ${content.substring(0, 200)}`);
			
			const messages = parseMessagesFromHtml(content, fileName);
			// console.log(`🔍 Extracted ${messages.length} messages from ${fileName}`);
			
			// Extract chat name from the first file
			if (allMessages.length === 0 && messages.length > 0) {
				const extractedName = extractChatName(content);
				// console.log(`🔍 Extracted chat name: ${extractedName}`);
				chatName = extractedName || chatName;
			}

			allMessages.push(...messages);
		} catch (error) {
			console.warn(`❌ Failed to parse ${fileName}:`, error);
		}
	}

	// console.log(`🔍 Total messages collected for chat ${chatId}: ${allMessages.length}`);

	// Sort messages by timestamp (oldest first)
	allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

	if (allMessages.length === 0) {
		console.warn(`❌ No messages parsed for chat ${chatId}`);
		return null;
	}

	const analytics = calculateAnalytics(chatId, chatName, allMessages);
	// console.log(`✅ Analytics calculated for chat ${chatId}:`, {
	//	totalMessages: analytics.totalMessages,
	//	dateRange: analytics.dateRange
	// });
	
	return analytics;
}

function parseMessagesFromHtml(htmlContent: string, fileName: string = 'Unknown'): Message[] {
	// console.log('🔍 parseMessagesFromHtml called');
	
	const parser = new DOMParser();
	const doc = parser.parseFromString(htmlContent, 'text/html');
	const messages: Message[] = [];

	const messageElements = doc.querySelectorAll('.message[data-id]');
	// console.log(`🔍 Found ${messageElements.length} message elements with .message[data-id] selector`);

	// If no elements found, let's try alternative selectors
	if (messageElements.length === 0) {
		// console.log('🔍 Trying alternative selectors...');
		// const altElements1 = doc.querySelectorAll('.message');
		// console.log(`🔍 Found ${altElements1.length} elements with .message selector`);
		
		// const altElements2 = doc.querySelectorAll('[data-id]');
		// console.log(`🔍 Found ${altElements2.length} elements with [data-id] attribute`);
		
		// const bodyText = doc.body?.textContent?.substring(0, 500) || 'No body found';
		// console.log('🔍 Document body preview:', bodyText);
	}

	for (const element of messageElements) {
		try {
			const id = element.getAttribute('data-id') || '';
			const headerElement = element.querySelector('.message__header');
			
			if (!headerElement) {
				// console.log(`🔍 No .message__header found for message ${id}`);
				continue;
			}

			const headerText = headerElement.textContent || '';
			// console.log(`🔍 Processing message ${id}, header: ${headerText.substring(0, 100)}`);
			
			const isFromUser = headerText.includes('Вы,');
			
			// Extract sender name
			let sender = 'Unknown';
			if (isFromUser) {
				sender = 'You';
			} else {
				const linkElement = headerElement.querySelector('a');
				if (linkElement) {
					sender = linkElement.textContent?.trim() || 'Unknown';
				}
			}

			// Extract timestamp
			const timestamp = parseVkTimestamp(headerText);
			// console.log(`🔍 Parsed timestamp for message ${id}:`, timestamp);
			
			// Extract message content and attachment information separately
			const contentElements = element.children;
			let content = '';
			let hasAttachment = false;
			let edited = false;
			let attachmentInfo = '';
			let attachmentLinks: string[] = [];

			for (const child of contentElements) {
				if (child.classList.contains('message__header')) continue;
				
				// This should be the main content div
				const contentDiv = child as HTMLElement;
				
				// Check for attachments in kludges and extract attachment descriptions
				const kludgesDiv = contentDiv.querySelector('.kludges');
				if (kludgesDiv) {
					hasAttachment = true;
					// Extract all attachment descriptions
					const attachmentDescs = kludgesDiv.querySelectorAll('.attachment__description');
					const attachments = Array.from(attachmentDescs).map(desc => desc.textContent?.trim() || '');
					attachmentInfo = attachments.join(' ').trim();
					
					const attachmentLinkElements = kludgesDiv.querySelectorAll('a');
					attachmentLinks = Array.from(attachmentLinkElements).map((link) => link.href || '');

					// Debug logging
					if (attachmentInfo) {
						console.log(`Message ${id}: Found ${attachmentDescs.length} attachments: "${attachmentInfo}"`);
					}
				}
				
				// Extract ONLY the main text content, excluding kludges
				const clonedDiv = contentDiv.cloneNode(true) as HTMLElement;
				const kludgesToRemove = clonedDiv.querySelectorAll('.kludges');
				kludgesToRemove.forEach(k => k.remove());
				
				const text = clonedDiv.textContent?.trim() || '';
				content = text;
				break;
			}


			// console.log(`🔍 Extracted content for message ${id}: ${content.substring(0, 100)}`);

			// Check if edited
			const editedElement = element.querySelector('.message-edited');
			edited = !!editedElement;

			if (timestamp && (content || attachmentInfo)) {
				messages.push({
					id,
					sender,
					isFromUser,
					timestamp,
					content,
					hasAttachment,
					attachmentInfo,
					attachmentLinks,
					edited
				});
				// console.log(`✅ Successfully parsed message ${id}`);
			} else {
				// console.warn(`❌ Skipping message ${id}: timestamp=${timestamp}, content='${content}'`);
			}
		} catch (error) {
			console.warn('❌ Failed to parse message element:', error);
		}
	}

	// console.log(`🔍 parseMessagesFromHtml returning ${messages.length} messages`);
	return messages;
}

function extractChatName(htmlContent: string): string | null {
	const parser = new DOMParser();
	const doc = parser.parseFromString(htmlContent, 'text/html');
	
	// Look for chat name in breadcrumbs
	const crumbs = doc.querySelectorAll('.ui_crumb');
	if (crumbs.length >= 3) {
		return crumbs[2].textContent?.trim() || null;
	}
	
	return null;
}

function parseVkTimestamp(headerText: string): Date | null {
	// console.log(`🔍 parseVkTimestamp attempting to parse: "${headerText}"`);
	
	// Extract date from various formats:
	// "Наталья Абельдяева, 13 июн 2019 в 13:30:27"
	// "Вы, 13 июн 2019 в 13:29:17"
	// "OZON, 24 мая 2025 в 21:20:28"
	
	const dateMatch = headerText.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})\s+в\s+(\d{1,2}):(\d{2}):(\d{2})/i);
	if (!dateMatch) {
		// console.log(`❌ No date match found for: "${headerText}"`);
		return null;
	}

	const [, day, monthName, year, hour, minute, second] = dateMatch;
	// console.log(`🔍 Parsed date parts: day=${day}, month=${monthName}, year=${year}, time=${hour}:${minute}:${second}`);
	
	// Russian month names to numbers (including full forms)
	const months: { [key: string]: number } = {
		'янв': 0, 'января': 0,
		'фев': 1, 'февраля': 1,
		'мар': 2, 'марта': 2,
		'апр': 3, 'апреля': 3,
		'май': 4, 'мая': 4,
		'июн': 5, 'июня': 5,
		'июл': 6, 'июля': 6,
		'авг': 7, 'августа': 7,
		'сен': 8, 'сентября': 8,
		'окт': 9, 'октября': 9,
		'ноя': 10, 'ноября': 10,
		'дек': 11, 'декабря': 11
	};

	const monthNumber = months[monthName.toLowerCase()];
	if (monthNumber === undefined) {
		// console.log(`❌ Unknown month name: "${monthName}"`);
		return null;
	}

	try {
		const date = new Date(
			parseInt(year),
			monthNumber,
			parseInt(day),
			parseInt(hour),
			parseInt(minute),
			parseInt(second)
		);
		// console.log(`✅ Successfully parsed date: ${date.toISOString()}`);
		return date;
	} catch (error) {
		// console.log(`❌ Error creating date:`, error);
		return null;
	}
}

function calculateResponseTimes(messages: Message[], currentUserId: string): ResponseTimeStats {
	const responseTimes: number[] = [];
	
	for (let i = 1; i < messages.length; i++) {
		const currentMessage = messages[i];
		const previousMessage = messages[i - 1];
		
		// Only count as a response if users are different
		if (currentMessage.sender !== previousMessage.sender) {
			const timeDiff = currentMessage.timestamp.getTime() - previousMessage.timestamp.getTime();
			const minutesDiff = timeDiff / (1000 * 60); // Convert to minutes
			
			// Only count reasonable response times (within 24 hours)
			if (minutesDiff > 0 && minutesDiff <= 1440) {
				responseTimes.push(minutesDiff);
			}
		}
	}
	
	if (responseTimes.length === 0) {
		return {
			averageResponseTime: 0,
			medianResponseTime: 0,
			totalResponses: 0,
			responseTimes: []
		};
	}
	
	const sortedTimes = [...responseTimes].sort((a, b) => a - b);
	const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
	const median = sortedTimes.length % 2 === 0
		? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
		: sortedTimes[Math.floor(sortedTimes.length / 2)];
	
	return {
		averageResponseTime: average,
		medianResponseTime: median,
		totalResponses: responseTimes.length,
		responseTimes: responseTimes
	};
}

function calculateConversationBalance(messages: Message[]): ConversationBalance {
	const userMessages = messages.filter(m => m.isFromUser);
	const otherMessages = messages.filter(m => !m.isFromUser);
	
	// Calculate word counts
	const userWords = userMessages.reduce((sum, msg) => sum + msg.content.split(/\s+/).filter(w => w.length > 0).length, 0);
	const otherWords = otherMessages.reduce((sum, msg) => sum + msg.content.split(/\s+/).filter(w => w.length > 0).length, 0);
	
	// Calculate conversation initiations (after 12+ hour gaps)
	const CONVERSATION_GAP = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
	let userInitiations = 0;
	let otherInitiations = 0;
	let totalConversations = 0;
	
	if (messages.length > 0) {
		// First message is always an initiation
		if (messages[0].isFromUser) {
			userInitiations++;
		} else {
			otherInitiations++;
		}
		totalConversations = 1;
		
		for (let i = 1; i < messages.length; i++) {
			const currentMessage = messages[i];
			const previousMessage = messages[i - 1];
			const timeDiff = currentMessage.timestamp.getTime() - previousMessage.timestamp.getTime();
			
			// If there's a gap of 12+ hours, consider this a new conversation
			if (timeDiff >= CONVERSATION_GAP) {
				totalConversations++;
				if (currentMessage.isFromUser) {
					userInitiations++;
				} else {
					otherInitiations++;
				}
			}
		}
	}
	
	return {
		messageRatio: otherMessages.length > 0 ? userMessages.length / otherMessages.length : userMessages.length,
		wordRatio: otherWords > 0 ? userWords / otherWords : userWords,
		initiationRatio: otherInitiations > 0 ? userInitiations / otherInitiations : userInitiations,
		conversationStarts: userInitiations,
		totalConversations: totalConversations
	};
}

function calculateRelationshipTimeline(messages: Message[]): RelationshipTimeline[] {
	const monthlyData: { [month: string]: { userMessages: number; otherMessages: number; } } = {};
	
	for (const message of messages) {
		const monthKey = `${message.timestamp.getFullYear()}-${String(message.timestamp.getMonth() + 1).padStart(2, '0')}`;
		
		if (!monthlyData[monthKey]) {
			monthlyData[monthKey] = { userMessages: 0, otherMessages: 0 };
		}
		
		if (message.isFromUser) {
			monthlyData[monthKey].userMessages++;
		} else {
			monthlyData[monthKey].otherMessages++;
		}
	}
	
	return Object.entries(monthlyData)
		.map(([month, data]) => ({
			month,
			userMessages: data.userMessages,
			otherMessages: data.otherMessages,
			totalMessages: data.userMessages + data.otherMessages
		}))
		.sort((a, b) => a.month.localeCompare(b.month));
}

function calculateAnalytics(chatId: string, chatName: string, messages: Message[]): ChatAnalytics {
	const userMessages = messages.filter(m => m.isFromUser).length;
	const otherMessages = messages.length - userMessages;
	
	// Calculate date range efficiently without spread operator for large arrays
	let minTimestamp = messages[0].timestamp.getTime();
	let maxTimestamp = messages[0].timestamp.getTime();
	
	for (const message of messages) {
		const time = message.timestamp.getTime();
		if (time < minTimestamp) minTimestamp = time;
		if (time > maxTimestamp) maxTimestamp = time;
	}
	
	const start = new Date(minTimestamp);
	const end = new Date(maxTimestamp);

	// Initialize message type counters
	const messageTypes: MessageTypeStats = {
		photos: 0,
		stickers: 0,
		forwardedMessages: 0,
		wallPosts: 0,
		voiceMessages: 0,
		documents: 0,
		videos: 0,
		textMessages: 0
	};


	// Function to check if a word is likely a URL, ID, or technical term
	function isNonMeaningfulText(word: string): boolean {
		// URLs and domains
		if (/^https?/.test(word) || /\.(com|ru|org|net|io|co|uk)/.test(word)) {
			return true;
		}
		
		// VK user/group IDs (like "id157793137not_salieri")
		if (/^id\d+/.test(word)) {
			return true;
		}
		
		// Long technical strings (likely URLs or hashes)
		if (word.length > 30 && !/[а-яё]/i.test(word)) {
			return true;
		}
		
		// Mixed alphanumeric strings that look like IDs or tokens
		if (word.length > 10 && /\d/.test(word) && /[a-z]/i.test(word) && !/[а-яё]/i.test(word)) {
			return true;
		}
		
		// File extensions and formats
		if (/\.(jpg|jpeg|png|gif|mp4|avi|mp3|pdf|doc|docx|txt|zip|rar)$/i.test(word)) {
			return true;
		}
		
		// Pin codes and technical terms
		if (word === 'pin' || /^pin\d+$/.test(word)) {
			return true;
		}
		
		return false;
	}

	// Use the stopwords-ru package for comprehensive Russian stopwords filtering
	const russianStopwords = new Set(stopwords);

	// Calculate word count, message types, and activity patterns
	let totalWords = 0;
	let totalLength = 0;
	const hourActivity: { [hour: number]: number } = {};
	const dayActivity: { [day: string]: number } = {};
	const wordCounts: { [word: string]: number } = {};

	messages.forEach(message => {
		const attachmentInfo = message.attachmentInfo.toLowerCase();

		if (attachmentInfo) {
			if (attachmentInfo.includes('фотография')) {
				messageTypes.photos++;
			} else if (attachmentInfo.includes('стикер')) {
				messageTypes.stickers++;
			} else if (attachmentInfo.includes('прикреплённое сообщение')) {
				messageTypes.forwardedMessages++;
			} else if (attachmentInfo.includes('запись на стене')) {
				messageTypes.wallPosts++;
			} else if (
				attachmentInfo.includes('голосовое сообщение') ||
				(attachmentInfo.includes('файл') && message.attachmentLinks.some((link) => link.endsWith('.ogg')))
			) {
				messageTypes.voiceMessages++;
			} else if (attachmentInfo.includes('документ') || attachmentInfo.includes('файл')) {
				messageTypes.documents++;
			} else if (attachmentInfo.includes('видеозапись')) {
				messageTypes.videos++;
			}
		} else {
			// If no attachment description, it's a text message if it has text content.
			if (message.content.trim()) {
				messageTypes.textMessages++;
			}
		}

		// Calculate basic metrics
		const words = message.content.toLowerCase().split(/\s+/).filter(word => word.length > 0);
		totalWords += words.length;
		totalLength += message.content.length;

		// Activity patterns
		const hour = message.timestamp.getHours();
		const day = message.timestamp.toLocaleDateString('ru-RU', { weekday: 'long' });
		
		hourActivity[hour] = (hourActivity[hour] || 0) + 1;
		dayActivity[day] = (dayActivity[day] || 0) + 1;

		// Word frequency analysis for all messages with actual text content
		if (message.content.trim()) {
			const cleanWords = message.content.toLowerCase()
				.replace(/[^\u0400-\u04FF\w\s]/g, '') // Keep only Cyrillic and Latin letters
				.split(/\s+/)
				.filter(word =>
					word.length > 2 &&
					!russianStopwords.has(word) &&
					!/^\d+$/.test(word) && // Filter out pure numbers
					!isNonMeaningfulText(word) // Filter out URLs, IDs, etc.
				);

			cleanWords.forEach(word => {
				wordCounts[word] = (wordCounts[word] || 0) + 1;
			});
		}
	});

	const topWords = Object.entries(wordCounts)
		.sort(([,a], [,b]) => b - a)
		.slice(0, 20)
		.map(([word, count]) => ({ word, count }));

	// Calculate per-user statistics
	const userStatsMap: { [sender: string]: UserStats } = {};
	
	messages.forEach(message => {
		const sender = message.sender;
		if (!userStatsMap[sender]) {
			userStatsMap[sender] = {
				sender,
				totalMessages: 0,
				wordCount: 0,
				averageMessageLength: 0,
				messageTypes: {
					photos: 0,
					stickers: 0,
					forwardedMessages: 0,
					wallPosts: 0,
					voiceMessages: 0,
					documents: 0,
					videos: 0,
					textMessages: 0
				},
				mostActiveHours: {},
				mostActiveDays: {},
				topWords: []
			};
		}

		const userStats = userStatsMap[sender];
		const content = message.content.toLowerCase();
		const attachmentInfo = message.attachmentInfo.toLowerCase();
		
		// Basic stats - use case-insensitive counting
		userStats.totalMessages++;
		const words = message.content.toLowerCase().split(/\s+/).filter(word => word.length > 0);
		userStats.wordCount += words.length;

		if (attachmentInfo) {
			if (attachmentInfo.includes('фотография')) {
				userStats.messageTypes.photos++;
			} else if (attachmentInfo.includes('стикер')) {
				userStats.messageTypes.stickers++;
			} else if (attachmentInfo.includes('прикреплённое сообщение')) {
				userStats.messageTypes.forwardedMessages++;
			} else if (attachmentInfo.includes('запись на стене')) {
				userStats.messageTypes.wallPosts++;
			} else if (
				attachmentInfo.includes('голосовое сообщение') ||
				(attachmentInfo.includes('файл') && message.attachmentLinks.some((link) => link.endsWith('.ogg')))
			) {
				userStats.messageTypes.voiceMessages++;
			} else if (attachmentInfo.includes('документ') || attachmentInfo.includes('файл')) {
				userStats.messageTypes.documents++;
			} else if (attachmentInfo.includes('видеозапись')) {
				userStats.messageTypes.videos++;
			}
		} else {
			// If no attachment description, it's a text message if it has text content.
			if (message.content.trim()) {
				userStats.messageTypes.textMessages++;
			}
		}

		// Activity patterns
		const hour = message.timestamp.getHours();
		const day = message.timestamp.toLocaleDateString('ru-RU', { weekday: 'long' });
		
		userStats.mostActiveHours[hour] = (userStats.mostActiveHours[hour] || 0) + 1;
		userStats.mostActiveDays[day] = (userStats.mostActiveDays[day] || 0) + 1;
	});

	// Calculate averages and top words for each user
	const userStats: UserStats[] = Object.values(userStatsMap).map(user => {
		user.averageMessageLength = user.wordCount > 0 ?
			messages.filter(m => m.sender === user.sender)
				.reduce((sum, m) => sum + m.content.length, 0) / user.totalMessages : 0;

		// Calculate user's top words (simplified for performance)
		const userMessages = messages.filter(m => m.sender === user.sender);
		const userWordCounts: { [word: string]: number } = {};
		
		// Analyze all messages for accurate word counts
		const sampleMessages = userMessages;

		sampleMessages.forEach(message => {
			const cleanWords = message.content.toLowerCase()
				.replace(/[^\u0400-\u04FF\w\s]/g, '')
				.split(/\s+/)
				.filter(word =>
					word.length > 2 &&
					!russianStopwords.has(word) &&
					!/^\d+$/.test(word) &&
					!isNonMeaningfulText(word) // Filter out URLs, IDs, etc.
				);

			cleanWords.forEach(word => {
				userWordCounts[word] = (userWordCounts[word] || 0) + 1;
			});
		});

		user.topWords = Object.entries(userWordCounts)
			.sort(([,a], [,b]) => b - a)
			.slice(0, 10)
			.map(([word, count]) => ({ word, count, userWordCounts: userWordCounts }));

		return { ...user, userWordCounts };
	});

	// Sort users by message count
	userStats.sort((a, b) => b.totalMessages - a.totalMessages);

	// Calculate new advanced analytics
	const conversationBalance = calculateConversationBalance(messages);
	const globalResponseTimeStats = calculateResponseTimes(messages, 'You');
	const relationshipTimeline = calculateRelationshipTimeline(messages);

	// Calculate response times for each user
	userStats.forEach(user => {
		const userMessages = messages.filter(m => m.sender === user.sender);
		if (userMessages.length > 1) {
			user.responseTimeStats = calculateResponseTimes(messages, user.sender);
			user.conversationBalance = calculateConversationBalance(userMessages);
		}
	});

	return {
		chatId,
		chatName,
		totalMessages: messages.length,
		userMessages,
		otherMessages,
		messages,
		dateRange: { start, end },
		wordCount: totalWords,
		averageMessageLength: totalLength / messages.length,
		mostActiveHours: hourActivity,
		mostActiveDays: dayActivity,
		topWords,
		messageTypes,
		userStats,
		// New advanced analytics
		relationshipTimeline,
		conversationBalance,
		globalResponseTimeStats
	};
}