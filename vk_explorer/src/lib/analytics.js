import { parseVkDate } from './date-parser.js';

const DEBUG = true; // Set to true to see detailed parsing logs in the console.

export class VKAnalytics {
    constructor() {
        this.messages = [];
        this.chats = new Map();
        this.users = new Map();
        this.processed = false;
    }

    // ... other methods are unchanged ...

    async parseMessages(zipFile, foundChats, decoder, progressCallback = null) {
        // ... this function remains unchanged ...
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
    
    // ... other methods are unchanged ...
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

            // Step 2: If main text is empty, leave it empty (attachment descriptions are not message content)
            // Note: attachment descriptions like "Фотография", "Стикер", "прикреплённое сообщение"
            // are message type indicators, not actual message text content
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
                // Check if header starts with "Вы" (Russian for "You")
                if (rawHeaderText.startsWith('Вы,') || rawHeaderText.startsWith('Вы ')) {
                    sender = 'Вы';
                    dateStr = dateStr.replace('Вы', '').trim();
                } else {
                    sender = 'You';
                }
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
    
    // ... other methods are unchanged ...

    // Sentiment analysis has been removed due to resource constraints
    async getSentimentAnalysis(progressCallback = null) {
        if (progressCallback) {
            progressCallback('Sentiment Analysis', 100, 'Sentiment analysis disabled due to resource constraints');
        }
        return null;
    }

    getMessagingStatistics() {
        if (!this.processed || this.messages.length === 0) return null;

        const totalMessages = this.messages.length;
        const totalChats = this.chats.size;
        const totalWords = this.messages.reduce((sum, msg) => sum + msg.wordCount, 0);
        const totalChars = this.messages.reduce((sum, msg) => sum + msg.length, 0);
        const messagesWithMedia = this.messages.filter(msg => msg.hasMedia).length;

        return {
            totalMessages,
            totalChats,
            totalWords,
            totalChars,
            messagesWithMedia,
            averageMessageLength: totalMessages > 0 ? totalChars / totalMessages : 0,
            averageWordsPerMessage: totalMessages > 0 ? totalWords / totalMessages : 0,
            mediaPercentage: totalMessages > 0 ? (messagesWithMedia / totalMessages) * 100 : 0
        };
    }

    getActivityHeatmapData() {
        if (!this.processed || this.messages.length === 0) return null;

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const heatmapGrid = [];
        let maxCount = 0;

        // Create 24x7 grid (hour x day)
        for (let hour = 0; hour < 24; hour++) {
            for (let day = 0; day < 7; day++) {
                heatmapGrid.push({
                    hour,
                    day,
                    dayName: dayNames[day],
                    hourLabel: `${hour.toString().padStart(2, '0')}:00`,
                    count: 0
                });
            }
        }

        // Fill the grid with actual data
        this.messages.forEach(msg => {
            if (msg.date) {
                const hour = msg.date.getHours();
                const day = msg.date.getDay();
                const cell = heatmapGrid.find(c => c.hour === hour && c.day === day);
                if (cell) {
                    cell.count++;
                    maxCount = Math.max(maxCount, cell.count);
                }
            }
        });

        const mostActiveCell = heatmapGrid.reduce((max, cell) => cell.count > max.count ? cell : max);

        return {
            data: heatmapGrid,
            maxCount,
            mostActiveHour: mostActiveCell.hourLabel,
            mostActiveDay: mostActiveCell.dayName
        };
    }

    getTopContacts(limit = 10) {
        if (!this.processed || this.users.size === 0) return null;

        // Debug output
        const allUsers = Array.from(this.users.values());
        console.log('All users found:', allUsers.map(u => ({ name: u.name, messageCount: u.messageCount, isCurrentUser: u.isCurrentUser })));

        // Include ALL users (including "Вы"/"You") in the rankings
        return Array.from(this.users.values())
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, limit)
            .map(user => ({
                name: user.name,
                messageCount: user.messageCount,
                wordCount: user.wordCount,
                chatCount: user.chats.size
            }));
    }

    getMessageTimeline() {
        if (!this.processed || this.messages.length === 0) return null;

        const messagesByMonth = new Map();

        this.messages.forEach(msg => {
            if (msg.date) {
                const monthKey = `${msg.date.getFullYear()}-${(msg.date.getMonth() + 1).toString().padStart(2, '0')}`;
                if (!messagesByMonth.has(monthKey)) {
                    messagesByMonth.set(monthKey, 0);
                }
                messagesByMonth.set(monthKey, messagesByMonth.get(monthKey) + 1);
            }
        });

        return Array.from(messagesByMonth.entries())
            .map(([month, count]) => ({
                month,
                date: new Date(month + '-01'),
                count
            }))
            .sort((a, b) => a.date - b.date);
    }

    getInteractionHeatmapData() {
        if (!this.processed || this.messages.length === 0) return null;

        // Get top users by message count
        const allUsers = Array.from(this.users.values())
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, 10)
            .map(user => user.name);
            
        if (allUsers.length < 2) return null;

        const heatmapSeries = [];

        // Create interaction matrix
        allUsers.forEach(userA => {
            const userData = {
                name: userA,
                data: []
            };

            allUsers.forEach(userB => {
                let interactionCount = 0;
                
                if (userA === userB) {
                    // Diagonal: show user's total message count
                    interactionCount = this.users.get(userA).messageCount;
                } else {
                    // Off-diagonal: count messages in shared chats
                    this.chats.forEach((chat, chatId) => {
                        const chatMessages = this.messages.filter(msg => msg.chatId === chatId);
                        
                        const userAInChat = chatMessages.some(msg => msg.sender === userA);
                        const userBInChat = chatMessages.some(msg => msg.sender === userB);
                        
                        // If both users are in this chat, add their combined message count
                        if (userAInChat && userBInChat) {
                            const userAMessages = chatMessages.filter(msg => msg.sender === userA).length;
                            const userBMessages = chatMessages.filter(msg => msg.sender === userB).length;
                            interactionCount += userAMessages + userBMessages;
                        }
                    });
                }

                userData.data.push({
                    x: userB,
                    y: interactionCount
                });
            });

            heatmapSeries.push(userData);
        });

        return heatmapSeries;
    }

    getResponseTimeAnalysis() {
        if (!this.processed || this.messages.length === 0) return null;

        const userResponseTimes = new Map();
        let totalQualifyingResponses = 0;
        
        // Group messages by chat and analyze response times
        this.chats.forEach((chat, chatId) => {
            const chatMessages = this.messages
                .filter(msg => msg.chatId === chatId && msg.date && msg.sender)
                .sort((a, b) => a.date.getTime() - b.date.getTime());

            if (chatMessages.length < 2) return; // Need at least 2 messages for response time

            for (let i = 1; i < chatMessages.length; i++) {
                const current = chatMessages[i];
                const previous = chatMessages[i - 1];

                // Only calculate response time if different senders
                if (current.sender !== previous.sender) {
                    const responseTime = current.date.getTime() - previous.date.getTime();
                    const responseTimeMinutes = responseTime / (1000 * 60);
                    
                    // Filter out unrealistic response times (less than 1 minute or more than 24 hours)
                    if (responseTimeMinutes >= 1 && responseTimeMinutes < 60 * 24) {
                        if (!userResponseTimes.has(current.sender)) {
                            userResponseTimes.set(current.sender, []);
                        }
                        userResponseTimes.get(current.sender).push(responseTimeMinutes);
                        totalQualifyingResponses++;
                    }
                }
            }
        });

        if (userResponseTimes.size === 0 || totalQualifyingResponses < 5) return null;

        // Calculate averages per user
        const averageByUser = Array.from(userResponseTimes.entries())
            .map(([user, times]) => {
                const avgMinutes = times.reduce((sum, time) => sum + time, 0) / times.length;
                return {
                    user,
                    averageResponseMinutes: avgMinutes,
                    averageResponseHours: avgMinutes / 60,
                    totalResponses: times.length,
                    fastestResponseMinutes: Math.min(...times),
                    slowestResponseMinutes: Math.max(...times)
                };
            })
            .filter(userData => userData.totalResponses >= 2) // Only include users with at least 2 responses
            .sort((a, b) => a.averageResponseMinutes - b.averageResponseMinutes); // Fastest first

        if (averageByUser.length === 0) return null;

        const allResponseTimes = Array.from(userResponseTimes.values()).flat();
        const overallAverage = allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;

        return {
            averageByUser,
            averageResponseTimeMinutes: overallAverage,
            averageResponseTimeHours: overallAverage / 60,
            totalAnalyzedResponses: allResponseTimes.length,
            totalUsersAnalyzed: averageByUser.length,
            fastestOverallMinutes: Math.min(...allResponseTimes),
            slowestOverallMinutes: Math.max(...allResponseTimes)
        };
    }

    getWordFrequency(limit = 50) {
        if (!this.processed || this.messages.length === 0) return null;

        const wordCount = new Map();
        const commonWords = new Set(['и', 'в', 'не', 'на', 'я', 'быть', 'он', 'с', 'что', 'а', 'по', 'это', 'она', 'к', 'но', 'они', 'мы', 'как', 'из', 'у', 'то', 'от', 'за', 'свой', 'все', 'се', 'уж', 'так', 'же', 'вы', 'ее', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'these', 'those', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);

        this.messages.forEach(msg => {
            if (msg.text) {
                const words = msg.text.toLowerCase()
                    .replace(/[^\w\sа-яё]/gi, ' ')
                    .split(/\s+/)
                    .filter(word => word.length > 2 && !commonWords.has(word));

                words.forEach(word => {
                    wordCount.set(word, (wordCount.get(word) || 0) + 1);
                });
            }
        });

        return Array.from(wordCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([word, count]) => ({ word, count }));
    }

    getEmojiAnalysis(limit = 20) {
        if (!this.processed || this.messages.length === 0) return null;

        const emojiCount = new Map();
        const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

        this.messages.forEach(msg => {
            if (msg.text) {
                const emojis = msg.text.match(emojiRegex);
                if (emojis) {
                    emojis.forEach(emoji => {
                        emojiCount.set(emoji, (emojiCount.get(emoji) || 0) + 1);
                    });
                }
            }
        });

        if (emojiCount.size === 0) return null;

        const totalEmojis = Array.from(emojiCount.values()).reduce((sum, count) => sum + count, 0);

        return {
            topEmojis: Array.from(emojiCount.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([emoji, count]) => ({
                    emoji,
                    count,
                    percentage: (count / totalEmojis) * 100
                })),
            totalEmojis,
            uniqueEmojis: emojiCount.size
        };
    }

    exportAnalyticsData() {
        if (!this.processed) return null;

        return {
            messagingStatistics: this.getMessagingStatistics(),
            activityHeatmap: this.getActivityHeatmapData(),
            topContacts: this.getTopContacts(20),
            messageTimeline: this.getMessageTimeline(),
            interactionNetwork: this.getInteractionHeatmapData(),
            responseTimeAnalysis: this.getResponseTimeAnalysis(),
            wordFrequency: this.getWordFrequency(100),
            emojiAnalysis: this.getEmojiAnalysis(50),
            // sentimentAnalysis removed due to resource constraints
        };
    }
}