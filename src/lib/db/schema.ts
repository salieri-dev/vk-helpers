import type { DBSchema } from 'idb';

// Database record interfaces
export interface ArchiveRecord {
	id: string;              // Primary key (hash of filename + size)
	filename: string;
	size: number;
	uploadedAt: Date;
	processedAt?: Date;
	totalChats: number;
	totalMessages: number;
	totalAlbums: number;
	totalPhotos: number;
	processingStatus: 'pending' | 'processing' | 'complete' | 'error';
	error?: string;
}

export interface ChatRecord {
	archiveId: string;       // Foreign key to archives
	id: string;              // Primary key (archiveId + chatId)
	chatId: string;          // Original VK chat ID
	name: string;
	messageCount: number;
	lastMessage: Date | null;
	firstMessage: Date | null;
	totalWords: number;
	avgMessageLength: number;
	createdAt: Date;
}

export interface MessageRecord {
	archiveId: string;       // Partition key
	chatId: string;          // Partition key  
	id: string;              // Primary key (archiveId + chatId + messageId)
	messageId: string;       // Original VK message ID
	sender: string;
	isFromUser: boolean;
	timestamp: Date;
	content: string;
	hasAttachment: boolean;
	attachmentInfo: string;
	edited: boolean;
	wordCount: number;
	hasPhotos: boolean;
	photoIds: string[];      // References to photos
}

export interface AlbumRecord {
	archiveId: string;       // Foreign key
	id: string;              // Primary key (archiveId + albumId)
	albumId: string;         // Original VK album ID  
	name: string;
	photoCount: number;
	createdAt: Date | null;
	updatedAt: Date | null;
	filename: string;
	processedAt: Date;
}

export interface PhotoRecord {
	archiveId: string;       // Foreign key
	chatId?: string;         // For chat photos
	albumId?: string;        // For album photos
	id: string;              // Primary key (archiveId + photoId)
	photoId: string;         // Original VK photo ID
	url: string;
	vkUrl: string;
	timestamp: Date | null;
	altText: string;
	filename: string;
	filesize?: number;
	dimensions?: { width: number; height: number };
	downloadStatus: 'pending' | 'downloaded' | 'failed';
	localPath?: string;      // File System Access API path
}

export interface AnalyticsRecord {
	id: string;              // Primary key (archiveId + chatId + type)
	archiveId: string;
	chatId?: string;         // null for global analytics
	type: 'chat' | 'global' | 'user' | 'timeline';
	computedAt: Date;
	data: any;               // Serialized analytics data
	validUntil: Date;        // Cache expiry
}


// IndexedDB schema definition
export interface VKAnalyticsDB extends DBSchema {
	archives: {
		key: string;
		value: ArchiveRecord;
		indexes: {
			'by-filename': string;
			'by-uploaded': Date;
			'by-status': string;
		};
	};
	
	chats: {
		key: string;
		value: ChatRecord;
		indexes: {
			'by-archive': string;
			'by-chat-id': string;
			'by-last-message': Date;
			'by-message-count': number;
		};
	};
	
	messages: {
		key: string;
		value: MessageRecord;
		indexes: {
			'by-archive-chat-time': [string, string, Date];
			'by-timestamp': Date;
			'by-sender': string;
			'by-has-photos': number;
		};
	};
	
	albums: {
		key: string;
		value: AlbumRecord;
		indexes: {
			'by-archive': string;
			'by-album-id': string;
			'by-created': Date;
		};
	};
	
	photos: {
		key: string;
		value: PhotoRecord;
		indexes: {
			'by-archive': string;
			'by-chat': string;
			'by-album': string;
			'by-timestamp': Date;
			'by-download-status': string;
		};
	};
	
	analytics: {
		key: string;
		value: AnalyticsRecord;
		indexes: {
			'by-archive-chat-type': [string, string, string];
			'by-computed': Date;
			'by-valid-until': Date;
		};
	};
	
}

// Helper functions for generating keys
export function generateArchiveId(filename: string, size: number): string {
	return `${filename}_${size}_${Date.now()}`;
}

export function generateChatId(archiveId: string, chatId: string): string {
	return `${archiveId}_${chatId}`;
}

export function generateMessageId(archiveId: string, chatId: string, messageId: string): string {
	return `${archiveId}_${chatId}_${messageId}`;
}

export function generateAlbumId(archiveId: string, albumId: string): string {
	return `${archiveId}_${albumId}`;
}

export function generatePhotoId(archiveId: string, photoId: string): string {
	return `${archiveId}_${photoId}`;
}

export function generateAnalyticsId(archiveId: string, chatId: string | null, type: string): string {
	return `${archiveId}_${chatId || 'global'}_${type}`;
}
