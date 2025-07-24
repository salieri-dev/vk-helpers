import { openDB, type IDBPDatabase } from 'idb';
import type { 
	VKAnalyticsDB, 
	ArchiveRecord, 
	ChatRecord, 
	MessageRecord,
	AlbumRecord,
	PhotoRecord,
	AnalyticsRecord,
	DownloadQueueRecord
} from './schema';

const DB_NAME = 'vk-analytics-db';
const DB_VERSION = 1;

class DatabaseService {
	private db: IDBPDatabase<VKAnalyticsDB> | null = null;
	private initPromise: Promise<void> | null = null;

	/**
	 * Initialize the database connection
	 */
	private async init(): Promise<void> {
		if (this.db) return;

		this.db = await openDB<VKAnalyticsDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				// Archives store
				if (!db.objectStoreNames.contains('archives')) {
					const archiveStore = db.createObjectStore('archives', { keyPath: 'id' });
					archiveStore.createIndex('by-filename', 'filename');
					archiveStore.createIndex('by-uploaded', 'uploadedAt');
					archiveStore.createIndex('by-status', 'processingStatus');
				}

				// Chats store
				if (!db.objectStoreNames.contains('chats')) {
					const chatStore = db.createObjectStore('chats', { keyPath: 'id' });
					chatStore.createIndex('by-archive', 'archiveId');
					chatStore.createIndex('by-chat-id', 'chatId');
					chatStore.createIndex('by-last-message', 'lastMessage');
					chatStore.createIndex('by-message-count', 'messageCount');
				}

				// Messages store
				if (!db.objectStoreNames.contains('messages')) {
					const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
					messageStore.createIndex('by-archive-chat-time', ['archiveId', 'chatId', 'timestamp']);
					messageStore.createIndex('by-timestamp', 'timestamp');
					messageStore.createIndex('by-sender', 'sender');
					messageStore.createIndex('by-has-photos', 'hasPhotos');
				}

				// Albums store
				if (!db.objectStoreNames.contains('albums')) {
					const albumStore = db.createObjectStore('albums', { keyPath: 'id' });
					albumStore.createIndex('by-archive', 'archiveId');
					albumStore.createIndex('by-album-id', 'albumId');
					albumStore.createIndex('by-created', 'createdAt');
				}

				// Photos store
				if (!db.objectStoreNames.contains('photos')) {
					const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
					photoStore.createIndex('by-archive', 'archiveId');
					photoStore.createIndex('by-chat', 'chatId');
					photoStore.createIndex('by-album', 'albumId');
					photoStore.createIndex('by-timestamp', 'timestamp');
					photoStore.createIndex('by-download-status', 'downloadStatus');
				}

				// Analytics store
				if (!db.objectStoreNames.contains('analytics')) {
					const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id' });
					analyticsStore.createIndex('by-archive-chat-type', ['archiveId', 'chatId', 'type']);
					analyticsStore.createIndex('by-computed', 'computedAt');
					analyticsStore.createIndex('by-valid-until', 'validUntil');
				}

				// Download queue store
				if (!db.objectStoreNames.contains('downloadQueue')) {
					const queueStore = db.createObjectStore('downloadQueue', { keyPath: 'id' });
					queueStore.createIndex('by-archive', 'archiveId');
					queueStore.createIndex('by-status', 'status');
					queueStore.createIndex('by-created', 'createdAt');
				}
			},
		});
	}

	/**
	 * Ensure database is initialized
	 */
	private async ensureReady(): Promise<IDBPDatabase<VKAnalyticsDB>> {
		if (!this.initPromise) {
			this.initPromise = this.init();
		}
		await this.initPromise;
		
		if (!this.db) {
			throw new Error('Database failed to initialize');
		}
		
		return this.db;
	}

	// ARCHIVE OPERATIONS
	async createArchive(archive: ArchiveRecord): Promise<void> {
		const db = await this.ensureReady();
		await db.add('archives', archive);
	}

	async getArchive(id: string): Promise<ArchiveRecord | undefined> {
		const db = await this.ensureReady();
		return await db.get('archives', id);
	}

	async updateArchive(archive: Partial<ArchiveRecord> & { id: string }): Promise<void> {
		const db = await this.ensureReady();
		const existing = await db.get('archives', archive.id);
		if (existing) {
			await db.put('archives', { ...existing, ...archive });
		}
	}

	async getAllArchives(): Promise<ArchiveRecord[]> {
		const db = await this.ensureReady();
		return await db.getAll('archives');
	}

	async deleteArchive(id: string): Promise<void> {
		const db = await this.ensureReady();
		const tx = db.transaction(['archives', 'chats', 'messages', 'albums', 'photos', 'analytics', 'downloadQueue'], 'readwrite');
		
		// Delete archive and all related data
		await Promise.all([
			tx.objectStore('archives').delete(id),
			// Delete all related records
			this.deleteRecordsByIndex(tx.objectStore('chats'), 'by-archive', id),
			this.deleteRecordsByIndex(tx.objectStore('messages'), 'archiveId', id),
			this.deleteRecordsByIndex(tx.objectStore('albums'), 'by-archive', id),
			this.deleteRecordsByIndex(tx.objectStore('photos'), 'by-archive', id),
			this.deleteRecordsByIndex(tx.objectStore('analytics'), 'archiveId', id),
			this.deleteRecordsByIndex(tx.objectStore('downloadQueue'), 'by-archive', id),
		]);
		
		await tx.done;
	}

	// CHAT OPERATIONS
	async createChat(chat: ChatRecord): Promise<void> {
		const db = await this.ensureReady();
		await db.add('chats', chat);
	}

	async updateChat(chat: Partial<ChatRecord> & { id: string }): Promise<void> {
		const db = await this.ensureReady();
		const existing = await db.get('chats', chat.id);
		if (existing) {
			await db.put('chats', { ...existing, ...chat });
		}
	}

	async getChatsByArchive(archiveId: string): Promise<ChatRecord[]> {
		const db = await this.ensureReady();
		return await db.getAllFromIndex('chats', 'by-archive', archiveId);
	}

	async getChat(id: string): Promise<ChatRecord | undefined> {
		const db = await this.ensureReady();
		return await db.get('chats', id);
	}

	// MESSAGE OPERATIONS
	async createMessage(message: MessageRecord): Promise<void> {
		const db = await this.ensureReady();
		await db.add('messages', message);
	}

	async createMessages(messages: MessageRecord[]): Promise<void> {
		const db = await this.ensureReady();
		const tx = db.transaction('messages', 'readwrite');
		const store = tx.objectStore('messages');
		
		await Promise.all(messages.map(message => store.add(message)));
		await tx.done;
	}

	async getMessagesByChatPaginated(
		archiveId: string, 
		chatId: string, 
		options: {
			startDate?: Date;
			endDate?: Date;
			limit?: number;
			offset?: number;
		} = {}
	): Promise<MessageRecord[]> {
		const db = await this.ensureReady();
		const { startDate, endDate, limit = 50, offset = 0 } = options;
		
		let query: IDBKeyRange | undefined;
		if (startDate || endDate) {
			const start = startDate || new Date(0);
			const end = endDate || new Date();
			query = IDBKeyRange.bound([archiveId, chatId, start], [archiveId, chatId, end]);
		}
		
		const index = db.transaction('messages').store.index('by-archive-chat-time');
		let cursor = await index.openCursor(query);
		
		const messages: MessageRecord[] = [];
		let skipped = 0;
		let count = 0;
		
		while (cursor && count < limit) {
			if (skipped < offset) {
				skipped++;
				cursor = await cursor.continue();
				continue;
			}
			
			messages.push(cursor.value);
			count++;
			cursor = await cursor.continue();
		}
		
		return messages;
	}

	async getMessagesByChat(archiveId: string, chatId: string): Promise<MessageRecord[]> {
		const db = await this.ensureReady();
		const range = IDBKeyRange.bound([archiveId, chatId, new Date(0)], [archiveId, chatId, new Date()]);
		return await db.getAllFromIndex('messages', 'by-archive-chat-time', range);
	}

	// ALBUM OPERATIONS
	async createAlbum(album: AlbumRecord): Promise<void> {
		const db = await this.ensureReady();
		await db.add('albums', album);
	}

	async getAlbumsByArchive(archiveId: string): Promise<AlbumRecord[]> {
		const db = await this.ensureReady();
		return await db.getAllFromIndex('albums', 'by-archive', archiveId);
	}

	// PHOTO OPERATIONS
	async createPhoto(photo: PhotoRecord): Promise<void> {
		const db = await this.ensureReady();
		await db.add('photos', photo);
	}

	async createPhotos(photos: PhotoRecord[]): Promise<void> {
		const db = await this.ensureReady();
		const tx = db.transaction('photos', 'readwrite');
		const store = tx.objectStore('photos');
		
		await Promise.all(photos.map(photo => store.add(photo)));
		await tx.done;
	}

	async getPhotosByArchive(archiveId: string): Promise<PhotoRecord[]> {
		const db = await this.ensureReady();
		return await db.getAllFromIndex('photos', 'by-archive', archiveId);
	}

	async getPhotosByDownloadStatus(status: string): Promise<PhotoRecord[]> {
		const db = await this.ensureReady();
		return await db.getAllFromIndex('photos', 'by-download-status', status);
	}

	async updatePhoto(photo: Partial<PhotoRecord> & { id: string }): Promise<void> {
		const db = await this.ensureReady();
		const existing = await db.get('photos', photo.id);
		if (existing) {
			await db.put('photos', { ...existing, ...photo });
		}
	}

	// ANALYTICS OPERATIONS
	async saveAnalytics(analytics: AnalyticsRecord): Promise<void> {
		const db = await this.ensureReady();
		await db.put('analytics', analytics);
	}

	async getAnalytics(id: string): Promise<AnalyticsRecord | undefined> {
		const db = await this.ensureReady();
		return await db.get('analytics', id);
	}

	async getValidAnalytics(archiveId: string, chatId: string | null, type: string): Promise<AnalyticsRecord | undefined> {
		const db = await this.ensureReady();
		const key: [string, string, string] = [archiveId, chatId || '', type];
		const result = await db.getFromIndex('analytics', 'by-archive-chat-type', key);
		
		if (result && result.validUntil > new Date()) {
			return result;
		}
		
		return undefined;
	}

	/**
		* Clear expired analytics cache entries
		*/
	async clearExpiredAnalytics(): Promise<number> {
		const db = await this.ensureReady();
		const now = new Date();
		const tx = db.transaction('analytics', 'readwrite');
		const store = tx.objectStore('analytics');
		const index = store.index('by-valid-until');
		
		let cursor = await index.openCursor(IDBKeyRange.upperBound(now));
		let deletedCount = 0;
		
		while (cursor) {
			await cursor.delete();
			deletedCount++;
			cursor = await cursor.continue();
		}
		
		await tx.done;
		return deletedCount;
	}

	/**
		* Get analytics cache statistics
		*/
	async getAnalyticsCacheStats(): Promise<{
		totalEntries: number;
		validEntries: number;
		expiredEntries: number;
		totalCacheSize: number;
	}> {
		const db = await this.ensureReady();
		const allAnalytics = await db.getAll('analytics');
		const now = new Date();
		
		let validEntries = 0;
		let expiredEntries = 0;
		let totalCacheSize = 0;
		
		for (const entry of allAnalytics) {
			if (entry.validUntil > now) {
				validEntries++;
			} else {
				expiredEntries++;
			}
			totalCacheSize += JSON.stringify(entry.data).length;
		}
		
		return {
			totalEntries: allAnalytics.length,
			validEntries,
			expiredEntries,
			totalCacheSize
		};
	}

	/**
		* Clear all analytics cache
		*/
	async clearAnalyticsCache(): Promise<void> {
		const db = await this.ensureReady();
		await db.clear('analytics');
	}

	// DOWNLOAD QUEUE OPERATIONS
	async createDownloadQueue(queue: DownloadQueueRecord): Promise<void> {
		const db = await this.ensureReady();
		await db.add('downloadQueue', queue);
	}

	async updateDownloadQueue(queue: Partial<DownloadQueueRecord> & { id: string }): Promise<void> {
		const db = await this.ensureReady();
		const existing = await db.get('downloadQueue', queue.id);
		if (existing) {
			await db.put('downloadQueue', { ...existing, ...queue });
		}
	}

	async getDownloadQueuesByArchive(archiveId: string): Promise<DownloadQueueRecord[]> {
		const db = await this.ensureReady();
		return await db.getAllFromIndex('downloadQueue', 'by-archive', archiveId);
	}

	// UTILITY METHODS
	private async deleteRecordsByIndex(store: any, indexName: string, key: any): Promise<void> {
		const index = store.index(indexName);
		let cursor = await index.openCursor(key);
		
		while (cursor) {
			await cursor.delete();
			cursor = await cursor.continue();
		}
	}

	/**
	 * Get database statistics
	 */
	async getStats(): Promise<{
		archives: number;
		chats: number;
		messages: number;
		albums: number;
		photos: number;
		analytics: number;
		downloadQueues: number;
	}> {
		const db = await this.ensureReady();
		
		const [archives, chats, messages, albums, photos, analytics, downloadQueues] = await Promise.all([
			db.count('archives'),
			db.count('chats'),
			db.count('messages'),
			db.count('albums'),
			db.count('photos'),
			db.count('analytics'),
			db.count('downloadQueue'),
		]);

		return { archives, chats, messages, albums, photos, analytics, downloadQueues };
	}

	/**
	 * Clear all data (for development/testing)
	 */
	async clearAll(): Promise<void> {
		const db = await this.ensureReady();
		const tx = db.transaction(['archives', 'chats', 'messages', 'albums', 'photos', 'analytics', 'downloadQueue'], 'readwrite');
		
		await Promise.all([
			tx.objectStore('archives').clear(),
			tx.objectStore('chats').clear(),
			tx.objectStore('messages').clear(),
			tx.objectStore('albums').clear(),
			tx.objectStore('photos').clear(),
			tx.objectStore('analytics').clear(),
			tx.objectStore('downloadQueue').clear(),
		]);
		
		await tx.done;
	}

	/**
	 * Close database connection
	 */
	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
			this.initPromise = null;
		}
	}
}

// Singleton instance
export const databaseService = new DatabaseService();

// Export the class for testing
export { DatabaseService };