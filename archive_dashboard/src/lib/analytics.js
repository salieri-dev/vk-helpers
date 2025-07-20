import { parseVkDate } from './date-parser.js';

const DEBUG = true; // Set to true to see detailed parsing logs in the console.

export class VKAnalytics {
    constructor() {
        this.messages = [];
        this.chats = new Map();
        this.users = new Map();
        this.processed = false;
    }

    // Parse all messages from chat HTML files
    async parseMessages(zipFile, foundChats, decoder, progressCallback = null) {
        // ... (this function remains unchanged)
        this.messages = [];
        this.chats.clear();
        this.users.clear();

        const totalChats = foundChats.size;
        let processedChats = 0;
        let totalFiles = 0;
        let processedFiles = 0;

        for (const [, chat] of foundChats) {
            totalFiles += chat.files.length;
        }

        if (progressCallback) {
            progressCallback('Initializing message analysis...', 0, 'Preparing to analyze chats and messages');
        }

        for (const [chatId, chat] of foundChats) {
            const chatMessages = [];
            
            if (progressCallback) {
                progressCallback(
                    `Processing chat: ${chat.name}`,
                    Math.round((processedChats / totalChats) * 100),
                    `Chat ${processedChats + 1} of ${totalChats} - Processing ${chat.files.length} file(s)`
                );
            }
            
            let fileIndex = 0;
            for (const file of chat.files) {
                if (progressCallback) {
                    const progress = Math.round((processedFiles / totalFiles) * 100);
                    progressCallback(
                        `Analyzing messages in ${chat.name}`,
                        progress,
                        `File ${fileIndex + 1}/${chat.files.length} - ${this.messages.length} messages found so far`
                    );
                }

                const html = decoder.decode(await file.async('uint8array'));
                const doc = new DOMParser().parseFromString(html, 'text/html');
                
                const messageElements = doc.querySelectorAll('.message');
                
                messageElements.forEach((messageEl) => {
                    const message = this.parseMessage(messageEl, chatId, chat.name);
                    if (message) {
                        chatMessages.push(message);
                        this.messages.push(message);
                    }
                });

                processedFiles++;
                fileIndex++;
            }
            
            this.chats.set(chatId, {
                ...chat,
                messageCount: chatMessages.length,
                messages: chatMessages
            });

            processedChats++;
        }

        if (progressCallback) {
            progressCallback(
                'Message analysis complete!',
                100,
                `Successfully analyzed ${this.messages.length} messages from ${totalChats} chats`
            );
        }

        this.processed = true;
        return this.messages;
    }

    // [MODIFIED] Added smarter text extraction for attachment-only messages
    parseMessage(messageEl, chatId, chatName) {
        try {
            const headerElement = messageEl.querySelector('.message__header');
            if (!headerElement) return null;

            if (DEBUG) console.groupCollapsed(`Parsing message in "${chatName}"`);

            // --- [NEW] Smarter Text Extraction Logic ---
            const contentClone = messageEl.cloneNode(true);
            const headerToRemove = contentClone.querySelector('.message__header');
            if (headerToRemove) headerToRemove.remove();

            // Step 1: Get main text by temporarily removing the attachments div.
            const kludgesClone = contentClone.querySelector('.kludges');
            if (kludgesClone) {
                kludgesClone.remove();
            }
            let text = contentClone.textContent.trim();

            // Step 2: If main text is empty, parse attachment descriptions as the text.
            if (!text) {
                const attachmentDescriptions = messageEl.querySelectorAll('.attachment__description');
                if (attachmentDescriptions.length > 0) {
                    text = Array.from(attachmentDescriptions)
                        .map(desc => desc.textContent.trim())
                        .join(', '); // Join multiple descriptions with a comma
                }
            }
            // --- End of New Logic ---
            
            let sender = 'Unknown';
            let isOwnMessage = false;
            let rawHeaderText = headerElement.textContent.trim();
            let dateStr = rawHeaderText;

            if (DEBUG) console.log(`[DEBUG] Raw Header: "${rawHeaderText}"`);

            const senderElement = headerElement.querySelector('a');
            if (senderElement) {
                sender = senderElement.textContent.trim();
                dateStr = dateStr.replace(sender, '').trim();
            } else {
                sender = 'You';
                isOwnMessage = true;
            }

            if (dateStr.startsWith(',')) {
                dateStr = dateStr.substring(1).trim();
            }
            
            if (DEBUG) console.log(`[DEBUG] Extracted Sender: "${sender}", Extracted Date String: "${dateStr}"`);

            const dateObj = parseVkDate(dateStr);
            if (DEBUG) console.log(`[DEBUG] Parsed Date Object:`, dateObj);

            if (DEBUG) console.log(`[DEBUG] Cleaned Text: "${text}"`);
            
            const attachments = messageEl.querySelectorAll('.attachment, .media');
            const hasMedia = attachments.length > 0;
            
            const message = {
                id: `${chatId}_${Date.now()}_${Math.random()}`,
                chatId,
                chatName,
                sender,
                isOwnMessage,
                text,
                timestamp: rawHeaderText,
                date: dateObj,
                hasMedia,
                attachmentCount: attachments.length,
                wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
                length: text.length
            };
            
            if (DEBUG) console.log('[DEBUG] Final Message Object:', message);
            if (DEBUG) console.groupEnd();

            if (!this.users.has(sender)) {
                this.users.set(sender, {
                    name: sender,
                    messageCount: 0,
                    wordCount: 0,
                    chats: new Set(),
                    isCurrentUser: isOwnMessage
                });
            }
            
            const user = this.users.get(sender);
            user.messageCount++;
            user.wordCount += message.wordCount;
            user.chats.add(chatId);

            return message;
        } catch (error) {
            console.warn('Failed to parse message:', error, messageEl);
            if (DEBUG) console.groupEnd();
            return null;
        }
    }

    // ... (getMessagingStatistics and getActivityHeatmapData are unchanged) ...
    getMessagingStatistics() {
        if (!this.processed) return null;
        const stats = { totalMessages: this.messages.length, totalChats: this.chats.size, totalUsers: this.users.size, averageMessageLength: 0, averageWordsPerMessage: 0, totalWords: 0, messagesWithMedia: 0 };
        const validMessages = this.messages.filter(m => m.text && m.text.length > 0);
        if (validMessages.length > 0) {
            stats.totalWords = validMessages.reduce((sum, m) => sum + m.wordCount, 0);
            stats.averageMessageLength = validMessages.reduce((sum, m) => sum + m.length, 0) / validMessages.length;
            stats.averageWordsPerMessage = stats.totalWords / validMessages.length;
        }
        stats.messagesWithMedia = this.messages.filter(m => m.hasMedia).length;
        return stats;
    }
    getActivityHeatmapData() {
        if (!this.processed) return null;
        const heatmapData = [];
        const hourCounts = Array(24).fill(0).map(() => Array(7).fill(0));
        const validMessages = this.messages.filter(m => m.date);
        if (validMessages.length === 0) return { data: [], mostActiveHour: 'N/A', mostActiveDay: 'N/A', maxCount: 0 };
        validMessages.forEach(message => {
            const hour = message.date.getHours();
            const dayOfWeek = message.date.getDay();
            hourCounts[hour][dayOfWeek]++;
        });
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let hour = 0; hour < 24; hour++) {
            for (let day = 0; day < 7; day++) {
                heatmapData.push({ hour, day, dayName: days[day], count: hourCounts[hour][day], hourLabel: `${hour.toString().padStart(2, '0')}:00` });
            }
        }
        const mostActive = heatmapData.reduce((max, curr) => curr.count > max.count ? curr : max, { count: -1 });
        return { data: heatmapData, mostActiveHour: mostActive.hourLabel || 'N/A', mostActiveDay: mostActive.dayName || 'N/A', maxCount: Math.max(1, ...heatmapData.map(d => d.count)) };
    }


    // [MODIFIED] Now includes "You" in the results.
    getTopContacts(limit = 10) {
        if (!this.processed) return null;
    
        const contactStats = [];
        
        for (const [, user] of this.users) {
            contactStats.push({
                name: user.name,
                messageCount: user.messageCount,
                wordCount: user.wordCount,
                chatCount: user.chats.size,
                averageWordsPerMessage: user.messageCount > 0 ? user.wordCount / user.messageCount : 0
            });
        }
    
        // [FIX] Removed the filter that excluded the current user ("You").
        return contactStats
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, limit);
    }

    // ... (getMessageTimeline and other functions are unchanged until getSentimentAnalysis)
    getMessageTimeline() { if (!this.processed || this.messages.length === 0) return null; const timelineCounts = new Map(); const validMessages = this.messages.filter(m => m.date); if (validMessages.length === 0) return null; validMessages.forEach(message => { const monthKey = `${message.date.getFullYear()}-${(message.date.getMonth() + 1).toString().padStart(2, '0')}`; timelineCounts.set(monthKey, (timelineCounts.get(monthKey) || 0) + 1); }); const timeline = Array.from(timelineCounts.entries()).map(([monthKey, count]) => ({ month: monthKey, date: new Date(monthKey + '-01'), count: count })).sort((a, b) => a.date - b.date); return timeline.length > 0 ? timeline : null; }
    getInteractionData() { if (!this.processed || this.users.size < 2) return null; const interactions = new Map(); for (const [, chat] of this.chats) { const chatUsers = new Set(chat.messages.map(msg => msg.sender)); const userArray = Array.from(chatUsers); for (let i = 0; i < userArray.length; i++) { for (let j = i + 1; j < userArray.length; j++) { const user1 = userArray[i]; const user2 = userArray[j]; const key = [user1, user2].sort().join('|'); if (!interactions.has(key)) { interactions.set(key, { user1, user2, sharedChats: new Set(), totalMessages: 0 }); } const interaction = interactions.get(key); interaction.sharedChats.add(chat.name); interaction.totalMessages += chat.messages.filter(m => m.sender === user1 || m.sender === user2).length; } } } const nodes = Array.from(this.users.values()).map(user => ({ id: user.name, name: user.name, messageCount: user.messageCount, isCurrentUser: user.isCurrentUser })); const edges = Array.from(interactions.values()).map(interaction => ({ source: interaction.user1, target: interaction.user2, weight: interaction.totalMessages, sharedChats: Array.from(interaction.sharedChats) })); return { nodes, edges }; }
    getResponseTimeAnalysis() { if (!this.processed) return null; const responseTimes = []; for (const [, chat] of this.chats) { const sortedMessages = chat.messages.filter(m => m.date).sort((a, b) => a.date - b.date); for (let i = 1; i < sortedMessages.length; i++) { const currentMsg = sortedMessages[i]; const previousMsg = sortedMessages[i - 1]; if (currentMsg.sender !== previousMsg.sender) { const timeDiff = currentMsg.date - previousMsg.date; const minutes = timeDiff / (1000 * 60); if (minutes <= 24 * 60) { responseTimes.push({ responder: currentMsg.sender, respondedTo: previousMsg.sender, responseTimeMinutes: minutes, chatName: chat.name }); } } } } const userResponseTimes = new Map(); responseTimes.forEach(rt => { if (!userResponseTimes.has(rt.responder)) { userResponseTimes.set(rt.responder, []); } userResponseTimes.get(rt.responder).push(rt.responseTimeMinutes); }); const averageResponseTimes = []; for (const [user, times] of userResponseTimes) { const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length; averageResponseTimes.push({ user, averageResponseMinutes: avgTime, responseCount: times.length }); } return { responseTimes, averageByUser: averageResponseTimes.sort((a, b) => a.averageResponseMinutes - b.averageResponseMinutes) }; }
    getWordFrequency(minLength = 3, excludeCommon = true) { if (!this.processed) return null; const commonWords = new Set(['and', 'the', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'что', 'как', 'это', 'так', 'все', 'уже', 'где', 'для', 'при', 'или', 'тем', 'был', 'еще', 'том', 'чем', 'мне', 'тут', 'его', 'они', 'она', 'был', 'мой', 'моя', 'мои', 'них', 'нас', 'вас', 'меня', 'тебя', 'него', 'неё', 'вам', 'нам', 'тот', 'эта', 'эти', 'эту', 'той', 'тех', 'там', 'тем']); const wordCounts = new Map(); this.messages.forEach(message => { if (!message.text) return; const words = message.text.toLowerCase().replace(/[^\w\s\u0410-\u044f]/gi, ' ').split(/\s+/).filter(word => word.length >= minLength && isNaN(word)); words.forEach(word => { if (!excludeCommon || !commonWords.has(word)) { wordCounts.set(word, (wordCounts.get(word) || 0) + 1); } }); }); return Array.from(wordCounts.entries()).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count); }
    getEmojiAnalysis() { if (!this.processed || this.messages.length === 0) return null; const emojiRegex = /\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})*(?:\u{200D}\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})*)*/gu; const emojiCounts = new Map(); this.messages.forEach(message => { if (!message.text) return; const emojis = message.text.match(emojiRegex) || []; emojis.forEach(emoji => { emojiCounts.set(emoji, (emojiCounts.get(emoji) || 0) + 1); }); }); const totalEmojis = Array.from(emojiCounts.values()).reduce((sum, count) => sum + count, 0); if (totalEmojis === 0) { return { totalEmojis: 0, uniqueEmojis: 0, topEmojis: [] }; } return { totalEmojis, uniqueEmojis: emojiCounts.size, topEmojis: Array.from(emojiCounts.entries()).map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count).slice(0, 50) }; }

    // [MODIFIED] Now using the corrected regex for Cyrillic characters.
    getSentimentAnalysis() {
        if (!this.processed || this.messages.length === 0) return null;
    
        const positiveWords = new Set([
            'good', 'great', 'awesome', 'amazing', 'love', 'like', 'happy', 'wonderful', 'fantastic', 'excellent',
            'хорошо', 'отлично', 'замечательно', 'прекрасно', 'люблю', 'нравится', 'счастлив', 'классно', 'супер', 'круто'
        ]);
    
        const negativeWords = new Set([
            'bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'horrible', 'worst', 'stupid', 'annoying',
            'плохо', 'ужасно', 'страшно', 'ненавижу', 'грустно', 'злой', 'глупо', 'раздражает', 'беспокоит', 'проблема'
        ]);
    
        const sentimentByMonth = new Map();
        const validMessages = this.messages.filter(m => m.text && m.date);
    
        if (validMessages.length === 0) return null;
    
        validMessages.forEach(message => {
            const words = message.text.toLowerCase().split(/\s+/);
            let positive = 0;
            let negative = 0;
    
            words.forEach(word => {
                const cleanWord = word.replace(/[^a-zа-яё0-9_]/g, '');
                if (positiveWords.has(cleanWord)) positive++;
                if (negativeWords.has(cleanWord)) negative++;
            });
    
            const monthKey = `${message.date.getFullYear()}-${(message.date.getMonth() + 1).toString().padStart(2, '0')}`;
            
            if (!sentimentByMonth.has(monthKey)) {
                sentimentByMonth.set(monthKey, { positive: 0, negative: 0, neutral: 0, total: 0 });
            }
    
            const monthData = sentimentByMonth.get(monthKey);
            monthData.total++;
            
            if (positive > negative) {
                monthData.positive++;
            } else if (negative > positive) {
                monthData.negative++;
            } else {
                monthData.neutral++;
            }
        });
    
        const sentimentTimeline = Array.from(sentimentByMonth.entries())
            .map(([month, data]) => ({
                month,
                date: new Date(month + '-01'),
                positive: data.positive,
                negative: data.negative,
                neutral: data.neutral,
                total: data.total,
                positiveRatio: data.total > 0 ? data.positive / data.total : 0,
                negativeRatio: data.total > 0 ? data.negative / data.total : 0,
                neutralRatio: data.total > 0 ? data.neutral / data.total : 0
            }))
            .sort((a, b) => a.date - b.date);
    
        return sentimentTimeline.length > 0 ? sentimentTimeline : null;
    }

    // ... (exportAnalyticsData is unchanged)
    exportAnalyticsData() { if (!this.processed) return null; const validDates = this.messages.filter(m => m.date).map(m => m.date.getTime()); return { summary: { generatedAt: new Date().toISOString(), totalMessages: this.messages.length, totalChats: this.chats.size, totalUsers: this.users.size, dateRange: { from: validDates.length > 0 ? new Date(Math.min(...validDates)).toISOString() : null, to: validDates.length > 0 ? new Date(Math.max(...validDates)).toISOString() : null } }, messagingStatistics: this.getMessagingStatistics(), activityHeatmap: this.getActivityHeatmapData(), topContacts: this.getTopContacts(20), messageTimeline: this.getMessageTimeline(), interactionData: this.getInteractionData(), responseTimeAnalysis: this.getResponseTimeAnalysis(), wordFrequency: this.getWordFrequency(), emojiAnalysis: this.getEmojiAnalysis(), sentimentAnalysis: this.getSentimentAnalysis() }; }
}