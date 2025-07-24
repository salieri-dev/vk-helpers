import { writable } from 'svelte/store';
import JSZip from 'jszip';
import { extractChatListFromIndex, extractAlbumListFromIndex } from '$lib/utils/indexParsers';

export interface ChatInfo {
	id: string;
	name: string;
	messageCount: number;
	lastMessage: Date | null;
}

export interface PhotoInfo {
	id: string;
	url: string;
	vkUrl: string;
	timestamp: Date | null;
	altText: string;
}

export interface AlbumInfo {
	id: string;
	name: string;
	photoCount: number;
	createdAt: Date | null;
	updatedAt: Date | null;
	filename: string;
	photos?: PhotoInfo[];
}

export interface ArchiveData {
	file: File | null;
	zip: JSZip | null;
	chats: ChatInfo[];
	albums: AlbumInfo[];
	isLoading: boolean;
	error: string | null;
	processingStep?: string;
	archiveId?: string; // Added for tracking
}

function createArchiveStore() {
	const { subscribe, set, update } = writable<ArchiveData>({
		file: null,
		zip: null,
		chats: [],
		albums: [],
		isLoading: false,
		error: null
	});

	return {
		subscribe,
		setFile: async (file: File) => {
			const archiveId = generateArchiveId(file.name, file.size);
			
			update(state => ({
				...state,
				file,
				isLoading: true,
				error: null,
				processingStep: '📁 Loading ZIP file...',
				archiveId
			}));
			
			try {
				// Load ZIP file - this is fast
				const zip = await JSZip.loadAsync(file);
				
				update(state => ({
					...state,
					processingStep: '🔍 Reading archive index...'
				}));
				
				// FAST part: Only parse index files
				const chats = await extractChatListFromIndex(zip);
				const albums = await extractAlbumListFromIndex(zip);
				
				update(state => ({
					...state,
					file,
					zip,
					chats,
					albums,
					isLoading: false,
					processingStep: undefined
				}));
				
			} catch (error) {
				console.error('❌ Error in archiveStore.setFile:', error);
				update(state => ({
					...state,
					error: error instanceof Error ? error.message : 'Unknown error',
					isLoading: false,
					processingStep: undefined
				}));
			}
		},
		reset: () => {
			set({
				file: null,
				zip: null,
				chats: [],
				albums: [],
				isLoading: false,
				error: null,
				processingStep: undefined
			});
		}
	};
}

/**
 * Generate a unique archive ID based on file name and size
 */
function generateArchiveId(filename: string, size: number): string {
	return `archive_${btoa(filename + size).replace(/[/+=]/g, '')}_${Date.now()}`;
}


export const archiveStore = createArchiveStore();