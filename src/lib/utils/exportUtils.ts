import type { ChatAnalytics } from './messageParser';
import { Chart } from 'chart.js';

export interface ExportOptions {
	format: 'json' | 'csv' | 'pdf' | 'png';
	includeCharts?: boolean;
	includeUserStats?: boolean;
	includeWordAnalysis?: boolean;
	includeRawData?: boolean;
}

export class AnalyticsExporter {
	static async exportAnalytics(
		analytics: ChatAnalytics[],
		options: ExportOptions,
		fileName?: string
	): Promise<void> {
		const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
		const defaultFileName = `vk-analytics-${timestamp}`;
		const finalFileName = fileName || defaultFileName;

		switch (options.format) {
			case 'json':
				await this.exportJSON(analytics, options, finalFileName);
				break;
			case 'csv':
				await this.exportCSV(analytics, options, finalFileName);
				break;
			case 'png':
				await this.exportPNG(analytics, options, finalFileName);
				break;
			default:
				throw new Error(`Unsupported export format: ${options.format}`);
		}
	}

	private static async exportJSON(
		analytics: ChatAnalytics[],
		options: ExportOptions,
		fileName: string
	): Promise<void> {
		const exportData: any = {
			metadata: {
				exportDate: new Date().toISOString(),
				totalChats: analytics.length,
				totalMessages: analytics.reduce((sum, chat) => sum + chat.totalMessages, 0),
				exportOptions: options
			},
			summary: {
				totalMessages: analytics.reduce((sum, chat) => sum + chat.totalMessages, 0),
				totalUserMessages: analytics.reduce((sum, chat) => sum + chat.userMessages, 0),
				totalWords: analytics.reduce((sum, chat) => sum + chat.wordCount, 0),
				averageMessageLength: analytics.length > 0
					? analytics.reduce((sum, chat) => sum + chat.averageMessageLength, 0) / analytics.length
					: 0,
				dateRange: {
					start: analytics.length > 0 
						? new Date(Math.min(...analytics.map(chat => chat.dateRange.start.getTime())))
						: null,
					end: analytics.length > 0 
						? new Date(Math.max(...analytics.map(chat => chat.dateRange.end.getTime())))
						: null
				}
			},
			chats: analytics.map(chat => ({
				chatId: chat.chatId,
				chatName: chat.chatName,
				totalMessages: chat.totalMessages,
				userMessages: chat.userMessages,
				otherMessages: chat.otherMessages,
				wordCount: chat.wordCount,
				averageMessageLength: chat.averageMessageLength,
				dateRange: chat.dateRange,
				messageTypes: chat.messageTypes,
				...(options.includeUserStats && { userStats: chat.userStats }),
				...(options.includeWordAnalysis && { 
					topWords: chat.topWords,
					mostActiveHours: chat.mostActiveHours,
					mostActiveDays: chat.mostActiveDays
				}),
				...(options.includeRawData && { messages: chat.messages })
			}))
		};

		this.downloadFile(
			JSON.stringify(exportData, null, 2),
			`${fileName}.json`,
			'application/json'
		);
	}

	private static async exportCSV(
		analytics: ChatAnalytics[],
		options: ExportOptions,
		fileName: string
	): Promise<void> {
		const csvData = [];

		// Chat summary CSV
		csvData.push('=== CHAT SUMMARY ===');
		csvData.push('Chat Name,Total Messages,User Messages,Other Messages,Word Count,Avg Message Length,Start Date,End Date');
		
		analytics.forEach(chat => {
			csvData.push([
				this.escapeCsv(chat.chatName),
				chat.totalMessages,
				chat.userMessages,
				chat.otherMessages,
				chat.wordCount,
				Math.round(chat.averageMessageLength),
				chat.dateRange.start.toISOString().slice(0, 10),
				chat.dateRange.end.toISOString().slice(0, 10)
			].join(','));
		});

		csvData.push('');

		// Message types CSV
		csvData.push('=== MESSAGE TYPES ===');
		csvData.push('Chat Name,Text Messages,Photos,Stickers,Forwarded,Voice,Documents');
		
		analytics.forEach(chat => {
			csvData.push([
				this.escapeCsv(chat.chatName),
				chat.messageTypes.textMessages,
				chat.messageTypes.photos,
				chat.messageTypes.stickers,
				chat.messageTypes.forwardedMessages,
				chat.messageTypes.voiceMessages,
				chat.messageTypes.documents
			].join(','));
		});

		if (options.includeUserStats) {
			csvData.push('');
			csvData.push('=== USER STATISTICS ===');
			csvData.push('Chat Name,User Name,Messages,Words,Avg Length');
			
			analytics.forEach(chat => {
				chat.userStats.forEach(user => {
					csvData.push([
						this.escapeCsv(chat.chatName),
						this.escapeCsv(user.sender),
						user.totalMessages,
						user.wordCount,
						Math.round(user.averageMessageLength)
					].join(','));
				});
			});
		}

		if (options.includeWordAnalysis) {
			csvData.push('');
			csvData.push('=== TOP WORDS ===');
			csvData.push('Chat Name,Word,Count');
			
			analytics.forEach(chat => {
				chat.topWords.forEach(({ word, count }) => {
					csvData.push([
						this.escapeCsv(chat.chatName),
						this.escapeCsv(word),
						count
					].join(','));
				});
			});
		}

		this.downloadFile(
			csvData.join('\n'),
			`${fileName}.csv`,
			'text/csv;charset=utf-8'
		);
	}

	private static async exportPNG(
		analytics: ChatAnalytics[],
		options: ExportOptions,
		fileName: string
	): Promise<void> {
		// Create a comprehensive dashboard image
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas context not available');

		// Set canvas size
		canvas.width = 1200;
		canvas.height = 800;

		// Fill background
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw title
		ctx.fillStyle = '#333';
		ctx.font = 'bold 24px Arial';
		ctx.textAlign = 'center';
		ctx.fillText('VK Analytics Dashboard', canvas.width / 2, 40);

		// Draw summary statistics
		const totalMessages = analytics.reduce((sum, chat) => sum + chat.totalMessages, 0);
		const totalUserMessages = analytics.reduce((sum, chat) => sum + chat.userMessages, 0);
		const totalWords = analytics.reduce((sum, chat) => sum + chat.wordCount, 0);

		ctx.font = '16px Arial';
		ctx.textAlign = 'left';
		ctx.fillText(`Total Messages: ${totalMessages.toLocaleString()}`, 50, 100);
		ctx.fillText(`Your Messages: ${totalUserMessages.toLocaleString()}`, 50, 130);
		ctx.fillText(`Total Words: ${totalWords.toLocaleString()}`, 50, 160);
		ctx.fillText(`Total Chats: ${analytics.length}`, 50, 190);

		// Draw chat statistics
		ctx.fillStyle = '#4a90e2';
		ctx.font = 'bold 18px Arial';
		ctx.fillText('Chat Statistics:', 50, 240);

		ctx.fillStyle = '#333';
		ctx.font = '14px Arial';
		let yPos = 270;
		
		analytics.slice(0, 10).forEach((chat, index) => {
			const percentage = ((chat.userMessages / chat.totalMessages) * 100).toFixed(1);
			ctx.fillText(
				`${index + 1}. ${chat.chatName}: ${chat.totalMessages} msgs (${percentage}% yours)`,
				60,
				yPos
			);
			yPos += 25;
		});

		// Add footer
		ctx.fillStyle = '#666';
		ctx.font = '12px Arial';
		ctx.textAlign = 'center';
		ctx.fillText(
			`Generated on ${new Date().toLocaleDateString()} by VK Analytics PWA`,
			canvas.width / 2,
			canvas.height - 20
		);

		// Download the image
		const dataUrl = canvas.toDataURL('image/png');
		this.downloadDataUrl(dataUrl, `${fileName}.png`);
	}

	private static escapeCsv(value: string): string {
		if (value.includes(',') || value.includes('"') || value.includes('\n')) {
			return `"${value.replace(/"/g, '""')}"`;
		}
		return value;
	}

	private static downloadFile(content: string, filename: string, mimeType: string): void {
		const blob = new Blob([content], { type: mimeType });
		const url = URL.createObjectURL(blob);
		this.downloadUrl(url, filename);
		URL.revokeObjectURL(url);
	}

	private static downloadDataUrl(dataUrl: string, filename: string): void {
		const link = document.createElement('a');
		link.download = filename;
		link.href = dataUrl;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	private static downloadUrl(url: string, filename: string): void {
		const link = document.createElement('a');
		link.download = filename;
		link.href = url;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	// Export individual chart as image
	static async exportChart(chartId: string, fileName?: string): Promise<void> {
		const chartElement = document.getElementById(chartId);
		if (!chartElement) throw new Error(`Chart element with id "${chartId}" not found`);

		const canvas = chartElement.querySelector('canvas');
		if (!canvas) throw new Error('Chart canvas not found');

		const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
		const finalFileName = fileName || `chart-${chartId}-${timestamp}.png`;

		const dataUrl = canvas.toDataURL('image/png');
		this.downloadDataUrl(dataUrl, finalFileName);
	}

	// Generate comprehensive analytics report
	static generateTextReport(analytics: ChatAnalytics[]): string {
		const totalMessages = analytics.reduce((sum, chat) => sum + chat.totalMessages, 0);
		const totalUserMessages = analytics.reduce((sum, chat) => sum + chat.userMessages, 0);
		const totalWords = analytics.reduce((sum, chat) => sum + chat.wordCount, 0);

		let report = `VK ANALYTICS REPORT\n`;
		report += `Generated: ${new Date().toLocaleString()}\n`;
		report += `${'='.repeat(50)}\n\n`;

		report += `OVERVIEW:\n`;
		report += `- Total Messages: ${totalMessages.toLocaleString()}\n`;
		report += `- Your Messages: ${totalUserMessages.toLocaleString()} (${((totalUserMessages/totalMessages)*100).toFixed(1)}%)\n`;
		report += `- Total Words: ${totalWords.toLocaleString()}\n`;
		report += `- Average Message Length: ${(totalWords/totalMessages).toFixed(1)} words\n`;
		report += `- Number of Chats: ${analytics.length}\n\n`;

		report += `CHAT BREAKDOWN:\n`;
		analytics.forEach((chat, index) => {
			const userPercentage = ((chat.userMessages / chat.totalMessages) * 100).toFixed(1);
			report += `${index + 1}. ${chat.chatName}\n`;
			report += `   Messages: ${chat.totalMessages.toLocaleString()} (${userPercentage}% yours)\n`;
			report += `   Words: ${chat.wordCount.toLocaleString()}\n`;
			report += `   Period: ${chat.dateRange.start.toLocaleDateString()} - ${chat.dateRange.end.toLocaleDateString()}\n`;
			report += `   Most used words: ${chat.topWords.slice(0, 3).map(w => w.word).join(', ')}\n\n`;
		});

		return report;
	}
}