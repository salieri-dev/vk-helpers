import { writable, derived, type Readable } from 'svelte/store';
import { databaseService } from '../db/database';
import type { 
	ArchiveRecord, 
	ChatRecord, 
	AlbumRecord, 
	PhotoRecord 
} from '../db/schema';
import type { 
	ArchiveWorkerCommand, 
	ArchiveWorkerResponse, 
	ProgressData,
	CompletionData 
} from '../workers/worker-types';

// Lightweight state interfaces (only UI state, not data)
export interface ArchiveState {
	currentArchive: ArchiveRecord | null;
	isProcessing: boolean;
	progress: ProgressData | null;
	error: string | null;
}

export interface ChatListState {
	chats: ChatRecord[];
	loading: boolean;
	error: string | null;
	searchQuery: string;
	sortBy: 'name' | 'messages' | 'lastMessage';
	sortOrder: 'asc' | 'desc';
}

export interface AlbumListState {
	albums: AlbumRecord[];
	loading: boolean;
	error: string | null;
}

// Worker management
let archiveWorker: Worker | null = null;

function createArchiveStore() {
	const { subscribe, set, update } = writable<ArchiveState>({
		currentArchive: null,
		isProcessing: false,
		progress: null,
		error: null
	});

	function initWorker(): Worker {
		if (!archiveWorker) {
			archiveWorker = new Worker(
				new URL('../workers/archive.worker.ts', import.meta.url),
				{ type: 'module' }
			);
			
			archiveWorker.onmessage = (event: MessageEvent<ArchiveWorkerResponse>) => {
				const { type, data } = event.data;
				
				switch (type) {
					case 'PROGRESS':
						update(state => ({ 
							...state, 
							progress: data as ProgressData 
						}));
						break;
						
					case 'COMPLETE':
						const completionData = data as CompletionData;
						update(state => ({ 
							...state, 
							isProcessing: false, 
							progress: null 
						}));
						// Reload current archive to get updated data
						loadArchive(completionData.archiveId);
						break;
						
					case 'ERROR':
						update(state => ({ 
							...state, 
							isProcessing: false, 
							progress: null, 
							error: (data as any).message 
						}));
						break;
				}
			};
			
			archiveWorker.onerror = (error) => {
				console.error('Archive worker error:', error);
				update(state => ({ 
					...state, 
					isProcessing: false, 
					progress: null, 
					error: 'Worker error occurred' 
				}));
			};
		}
		
		return archiveWorker;
	}

	async function processFile(file: File): Promise<void> {
		update(state => ({
			...state,
			isProcessing: true,
			progress: null,
			error: null
		}));

		const worker = initWorker();
		const command: ArchiveWorkerCommand = {
			type: 'PROCESS_ARCHIVE',
			file,
			options: {}
		};

		worker.postMessage(command);
	}

	async function loadArchive(archiveId: string): Promise<void> {
		try {
			const archive = await databaseService.getArchive(archiveId);
			if (archive) {
				update(state => ({ 
					...state, 
					currentArchive: archive, 
					error: null 
				}));
			}
		} catch (error) {
			console.error('Failed to load archive:', error);
			update(state => ({ 
				...state, 
				error: error instanceof Error ? error.message : 'Failed to load archive'
			}));
		}
	}

	async function getAllArchives(): Promise<ArchiveRecord[]> {
		try {
			return await databaseService.getAllArchives();
		} catch (error) {
			console.error('Failed to get archives:', error);
			update(state => ({ 
				...state, 
				error: error instanceof Error ? error.message : 'Failed to get archives'
			}));
			return [];
		}
	}

	async function deleteArchive(archiveId: string): Promise<void> {
		try {
			await databaseService.deleteArchive(archiveId);
			update(state => ({ 
				...state, 
				currentArchive: state.currentArchive?.id === archiveId ? null : state.currentArchive
			}));
		} catch (error) {
			console.error('Failed to delete archive:', error);
			update(state => ({ 
				...state, 
				error: error instanceof Error ? error.message : 'Failed to delete archive'
			}));
		}
	}

	function clearError(): void {
		update(state => ({ ...state, error: null }));
	}

	function reset(): void {
		set({
			currentArchive: null,
			isProcessing: false,
			progress: null,
			error: null
		});
		
		if (archiveWorker) {
			archiveWorker.terminate();
			archiveWorker = null;
		}
	}

	return {
		subscribe,
		processFile,
		loadArchive,
		getAllArchives,
		deleteArchive,
		clearError,
		reset
	};
}

function createChatListStore() {
	const { subscribe, set, update } = writable<ChatListState>({
		chats: [],
		loading: false,
		error: null,
		searchQuery: '',
		sortBy: 'name',
		sortOrder: 'asc'
	});

	async function loadChats(archiveId: string): Promise<void> {
		update(state => ({ ...state, loading: true, error: null }));
		
		try {
			const chats = await databaseService.getChatsByArchive(archiveId);
			update(state => ({ 
				...state, 
				chats, 
				loading: false 
			}));
		} catch (error) {
			console.error('Failed to load chats:', error);
			update(state => ({ 
				...state, 
				loading: false, 
				error: error instanceof Error ? error.message : 'Failed to load chats'
			}));
		}
	}

	function setSearchQuery(query: string): void {
		update(state => ({ ...state, searchQuery: query }));
	}

	function setSorting(sortBy: ChatListState['sortBy'], sortOrder: ChatListState['sortOrder']): void {
		update(state => ({ ...state, sortBy, sortOrder }));
	}

	// Derived store for filtered and sorted chats
	const filteredChats = derived(
		{ subscribe },
		($state) => {
			let result = [...$state.chats];

			// Apply search filter
			if ($state.searchQuery.trim()) {
				const query = $state.searchQuery.toLowerCase().trim();
				result = result.filter(chat => 
					chat.name.toLowerCase().includes(query)
				);
			}

			// Apply sorting
			result.sort((a, b) => {
				let comparison = 0;
				
				switch ($state.sortBy) {
					case 'name':
						comparison = a.name.localeCompare(b.name);
						break;
					case 'messages':
						comparison = a.messageCount - b.messageCount;
						break;
					case 'lastMessage':
						const aDate = a.lastMessage ? a.lastMessage.getTime() : 0;
						const bDate = b.lastMessage ? b.lastMessage.getTime() : 0;
						comparison = aDate - bDate;
						break;
				}
				
				return $state.sortOrder === 'desc' ? -comparison : comparison;
			});

			return result;
		}
	);

	return {
		subscribe,
		loadChats,
		setSearchQuery,
		setSorting,
		filteredChats
	};
}

function createAlbumListStore() {
	const { subscribe, set, update } = writable<AlbumListState>({
		albums: [],
		loading: false,
		error: null
	});

	async function loadAlbums(archiveId: string): Promise<void> {
		update(state => ({ ...state, loading: true, error: null }));
		
		try {
			const albums = await databaseService.getAlbumsByArchive(archiveId);
			update(state => ({ 
				...state, 
				albums, 
				loading: false 
			}));
		} catch (error) {
			console.error('Failed to load albums:', error);
			update(state => ({ 
				...state, 
				loading: false, 
				error: error instanceof Error ? error.message : 'Failed to load albums'
			}));
		}
	}

	return {
		subscribe,
		loadAlbums
	};
}

// Message store for paginated loading
function createMessageStore() {
	const messages = writable<{
		data: Map<string, any[]>; // chatId -> messages
		loading: Set<string>; // chatIds currently loading
		errors: Map<string, string>; // chatId -> error
	}>({
		data: new Map(),
		loading: new Set(),
		errors: new Map()
	});

	async function loadMessages(
		archiveId: string, 
		chatId: string, 
		options: {
			startDate?: Date;
			endDate?: Date;
			limit?: number;
			offset?: number;
		} = {}
	): Promise<void> {
		messages.update(state => ({
			...state,
			loading: new Set([...state.loading, chatId]),
			errors: new Map([...state.errors].filter(([key]) => key !== chatId))
		}));

		try {
			const messageList = await databaseService.getMessagesByChatPaginated(
				archiveId, 
				chatId, 
				options
			);

			messages.update(state => {
				const newData = new Map(state.data);
				const existingMessages = newData.get(chatId) || [];
				
				// If offset is 0, replace data; otherwise append
				if (options.offset === 0 || !options.offset) {
					newData.set(chatId, messageList);
				} else {
					newData.set(chatId, [...existingMessages, ...messageList]);
				}

				const newLoading = new Set(state.loading);
				newLoading.delete(chatId);

				return {
					data: newData,
					loading: newLoading,
					errors: state.errors
				};
			});
		} catch (error) {
			console.error(`Failed to load messages for chat ${chatId}:`, error);
			
			messages.update(state => {
				const newLoading = new Set(state.loading);
				newLoading.delete(chatId);
				
				const newErrors = new Map(state.errors);
				newErrors.set(chatId, error instanceof Error ? error.message : 'Failed to load messages');

				return {
					...state,
					loading: newLoading,
					errors: newErrors
				};
			});
		}
	}

	function getMessagesForChat(chatId: string): Readable<any[]> {
		return derived(messages, $messages => $messages.data.get(chatId) || []);
	}

	function getChatLoadingState(chatId: string): Readable<boolean> {
		return derived(messages, $messages => $messages.loading.has(chatId));
	}

	function getChatError(chatId: string): Readable<string | null> {
		return derived(messages, $messages => $messages.errors.get(chatId) || null);
	}

	return {
		loadMessages,
		getMessagesForChat,
		getChatLoadingState,
		getChatError
	};
}

// Export store instances
export const archiveStore = createArchiveStore();
export const chatListStore = createChatListStore();
export const albumListStore = createAlbumListStore();
export const messageStore = createMessageStore();

// Helper functions for common operations
export async function getPhotosForDownload(archiveId: string, filters?: {
	chatIds?: string[];
	albumIds?: string[];
	dateRange?: { start: Date; end: Date };
}): Promise<PhotoRecord[]> {
	try {
		let photos = await databaseService.getPhotosByArchive(archiveId);
		
		// Apply filters
		if (filters) {
			if (filters.chatIds) {
				photos = photos.filter(photo => 
					photo.chatId && filters.chatIds!.includes(photo.chatId)
				);
			}
			
			if (filters.albumIds) {
				photos = photos.filter(photo => 
					photo.albumId && filters.albumIds!.includes(photo.albumId)
				);
			}
			
			if (filters.dateRange) {
				photos = photos.filter(photo => {
					if (!photo.timestamp) return false;
					const photoDate = new Date(photo.timestamp);
					return photoDate >= filters.dateRange!.start && photoDate <= filters.dateRange!.end;
				});
			}
		}
		
		return photos.filter(photo => photo.downloadStatus === 'pending');
	} catch (error) {
		console.error('Failed to get photos for download:', error);
		throw error;
	}
}

export async function getDatabaseStats() {
	try {
		return await databaseService.getStats();
	} catch (error) {
		console.error('Failed to get database stats:', error);
		return null;
	}
}