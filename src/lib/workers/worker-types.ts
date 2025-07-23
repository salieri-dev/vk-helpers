// Common progress interface
export interface ProgressData {
	step: string;
	percentage: number;
	processed: number;
	total: number;
	estimatedTimeRemaining?: string;
	currentItem?: string;
}

// Archive Worker Messages
export interface ArchiveWorkerCommand {
	type: 'PROCESS_ARCHIVE';
	file: File;
	options: ProcessingOptions;
}

export interface ArchiveWorkerResponse {
	type: 'PROGRESS' | 'COMPLETE' | 'ERROR';
	data: ProgressData | CompletionData | ErrorData;
}

export interface ProcessingOptions {
	skipAnalytics?: boolean;
	batchSize?: number;
}

export interface CompletionData {
	archiveId: string;
	totalChats: number;
	totalMessages: number;
	totalAlbums: number;
	totalPhotos: number;
	processingTime: number;
}

export interface ErrorData {
	message: string;
	stack?: string;
	step?: string;
}

// Download Worker Messages
export interface DownloadWorkerCommand {
	type: 'DOWNLOAD_IMAGES';
	archiveId: string;
	photoIds: string[];
	options: DownloadOptions;
	directoryHandle?: FileSystemDirectoryHandle;
}

export interface DownloadWorkerResponse {
	type: 'PROGRESS' | 'COMPLETE' | 'ERROR' | 'FILE_WRITTEN';
	data: ProgressData | DownloadCompletionData | ErrorData | FileWriteData;
}

export interface DownloadOptions {
	useFileSystem: boolean;
	directoryHandle?: FileSystemDirectoryHandle;
	concurrentDownloads?: number;
	batchSize?: number;
	retryAttempts?: number;
	addExifMetadata?: boolean;
}

export interface DownloadCompletionData {
	queueId: string;
	totalImages: number;
	downloadedImages: number;
	failedImages: number;
	downloadPath?: string;
	zipBlob?: Blob;
	processingTime: number;
}

export interface FileWriteData {
	filename: string;
	path: string;
	size: number;
}

// Worker Message Wrapper
export interface WorkerMessage<T = any> {
	id: string;
	type: string;
	data: T;
	timestamp: number;
}

// Worker Response Wrapper
export interface WorkerResponse<T = any> {
	id: string;
	type: string;
	data: T;
	timestamp: number;
	success: boolean;
	error?: string;
}

// Helper type for worker communication
export type WorkerCommandHandler<TCommand, TResponse> = (
	command: TCommand,
	postMessage: (response: TResponse) => void
) => Promise<void>;

// File System Access API types (for better typing)
declare global {
	interface Window {
		showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
	}

	interface FileSystemDirectoryHandle {
		getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
		getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
		entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
		keys(): AsyncIterableIterator<string>;
		values(): AsyncIterableIterator<FileSystemHandle>;
	}

	interface FileSystemFileHandle {
		createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
		getFile(): Promise<File>;
	}

	interface FileSystemWritableFileStream extends WritableStream {
		write(data: BufferSource | Blob | string): Promise<void>;
		seek(position: number): Promise<void>;
		truncate(size: number): Promise<void>;
	}

	interface FileSystemCreateWritableOptions {
		keepExistingData?: boolean;
	}

}

export {};