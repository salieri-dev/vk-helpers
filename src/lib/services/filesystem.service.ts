/**
 * File System Access API Service
 * Provides a clean interface for modern browsers to work with the file system directly
 */
export class FileSystemService {
	private static instance: FileSystemService;
	
	static getInstance(): FileSystemService {
		if (!FileSystemService.instance) {
			FileSystemService.instance = new FileSystemService();
		}
		return FileSystemService.instance;
	}

	/**
	 * Check if File System Access API is supported
	 */
	isSupported(): boolean {
		return 'showDirectoryPicker' in window;
	}

	/**
	 * Show directory picker dialog
	 */
	async pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
		if (!this.isSupported()) {
			throw new Error('File System Access API is not supported in this browser');
		}

		try {
			return await window.showDirectoryPicker!();
		} catch (error) {
			// User cancelled or permission denied
			if (error instanceof DOMException && error.name === 'AbortError') {
				return null;
			}
			throw error;
		}
	}

	/**
	 * Create a file in the given directory
	 */
	async createFile(
		dirHandle: FileSystemDirectoryHandle,
		filename: string,
		data: Blob | string | BufferSource
	): Promise<void> {
		const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
		const writable = await fileHandle.createWritable();
		
		try {
			await writable.write(data);
		} finally {
			await writable.close();
		}
	}

	/**
	 * Create a directory (if it doesn't exist)
	 */
	async createDirectory(
		parentHandle: FileSystemDirectoryHandle,
		dirName: string
	): Promise<FileSystemDirectoryHandle> {
		return await parentHandle.getDirectoryHandle(dirName, { create: true });
	}

	/**
	 * Create nested directory structure
	 */
	async createNestedDirectory(
		rootHandle: FileSystemDirectoryHandle,
		path: string
	): Promise<FileSystemDirectoryHandle> {
		const pathParts = path.split('/').filter(part => part.length > 0);
		let currentHandle = rootHandle;

		for (const part of pathParts) {
			currentHandle = await this.createDirectory(currentHandle, part);
		}

		return currentHandle;
	}

	/**
	 * Check if a file exists in a directory
	 */
	async fileExists(
		dirHandle: FileSystemDirectoryHandle,
		filename: string
	): Promise<boolean> {
		try {
			await dirHandle.getFileHandle(filename);
			return true;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				return false;
			}
			throw error;
		}
	}

	/**
	 * Check if a directory exists
	 */
	async directoryExists(
		parentHandle: FileSystemDirectoryHandle,
		dirName: string
	): Promise<boolean> {
		try {
			await parentHandle.getDirectoryHandle(dirName);
			return true;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'NotFoundError') {
				return false;
			}
			throw error;
		}
	}

	/**
	 * List all files in a directory
	 */
	async listFiles(dirHandle: FileSystemDirectoryHandle): Promise<string[]> {
		const files: string[] = [];
		
		for await (const [name, handle] of dirHandle.entries()) {
			if (handle.kind === 'file') {
				files.push(name);
			}
		}
		
		return files.sort();
	}

	/**
	 * List all directories in a directory
	 */
	async listDirectories(dirHandle: FileSystemDirectoryHandle): Promise<string[]> {
		const directories: string[] = [];
		
		for await (const [name, handle] of dirHandle.entries()) {
			if (handle.kind === 'directory') {
				directories.push(name);
			}
		}
		
		return directories.sort();
	}

	/**
	 * Get the size of a file
	 */
	async getFileSize(fileHandle: FileSystemFileHandle): Promise<number> {
		const file = await fileHandle.getFile();
		return file.size;
	}

	/**
	 * Read a file as text
	 */
	async readTextFile(fileHandle: FileSystemFileHandle): Promise<string> {
		const file = await fileHandle.getFile();
		return await file.text();
	}

	/**
	 * Read a file as a blob
	 */
	async readBlobFile(fileHandle: FileSystemFileHandle): Promise<Blob> {
		return await fileHandle.getFile();
	}

	/**
	 * Write text to a file (overwrites existing content)
	 */
	async writeTextFile(
		dirHandle: FileSystemDirectoryHandle,
		filename: string,
		content: string
	): Promise<void> {
		await this.createFile(dirHandle, filename, content);
	}

	/**
	 * Append text to a file
	 */
	async appendTextFile(
		dirHandle: FileSystemDirectoryHandle,
		filename: string,
		content: string
	): Promise<void> {
		const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
		const writable = await fileHandle.createWritable({ keepExistingData: true });
		
		try {
			await writable.seek(await this.getFileSize(fileHandle));
			await writable.write(content);
		} finally {
			await writable.close();
		}
	}

	/**
	 * Delete a file
	 */
	async deleteFile(
		dirHandle: FileSystemDirectoryHandle,
		filename: string
	): Promise<void> {
		await dirHandle.removeEntry(filename);
	}

	/**
	 * Delete a directory (must be empty)
	 */
	async deleteDirectory(
		parentHandle: FileSystemDirectoryHandle,
		dirName: string
	): Promise<void> {
		await parentHandle.removeEntry(dirName, { recursive: true });
	}

	/**
	 * Create a progress log file for tracking downloads
	 */
	async createProgressLog(
		rootHandle: FileSystemDirectoryHandle,
		archiveName: string
	): Promise<FileSystemFileHandle> {
		const logFilename = `download_log_${archiveName}_${new Date().toISOString().slice(0, 10)}.txt`;
		const fileHandle = await rootHandle.getFileHandle(logFilename, { create: true });
		
		// Write initial header
		const header = `VK Analytics - Download Log
Archive: ${archiveName}
Started: ${new Date().toISOString()}
----------------------------------------
`;
		
		const writable = await fileHandle.createWritable();
		try {
			await writable.write(header);
		} finally {
			await writable.close();
		}

		return fileHandle;
	}

	/**
	 * Log download progress to file
	 */
	async logProgress(
		logHandle: FileSystemFileHandle,
		message: string
	): Promise<void> {
		const writable = await logHandle.createWritable({ keepExistingData: true });
		
		try {
			const currentSize = await this.getFileSize(logHandle);
			await writable.seek(currentSize);
			
			const timestamp = new Date().toISOString();
			await writable.write(`[${timestamp}] ${message}\n`);
		} finally {
			await writable.close();
		}
	}

	/**
	 * Request persistent storage permission (for IndexedDB)
	 */
	async requestPersistentStorage(): Promise<boolean> {
		if ('storage' in navigator && 'persist' in navigator.storage) {
			return await navigator.storage.persist();
		}
		return false;
	}

	/**
	 * Get storage quota information
	 */
	async getStorageQuota(): Promise<{
		available: number;
		used: number;
		quota: number;
	} | null> {
		if ('storage' in navigator && 'estimate' in navigator.storage) {
			const estimate = await navigator.storage.estimate();
			return {
				available: (estimate.quota || 0) - (estimate.usage || 0),
				used: estimate.usage || 0,
				quota: estimate.quota || 0
			};
		}
		return null;
	}

	/**
	 * Sanitize filename for file system compatibility
	 */
	sanitizeFilename(filename: string): string {
		return filename
			.replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
			.replace(/\s+/g, ' ')          // Normalize whitespace
			.replace(/\.+$/, '')           // Remove trailing dots
			.trim()                        // Remove leading/trailing spaces
			.substring(0, 255);            // Limit length (Windows/NTFS limit)
	}

	/**
	 * Sanitize directory name for file system compatibility
	 */
	sanitizeDirectoryName(dirName: string): string {
		return dirName
			.replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
			.replace(/\s+/g, '_')          // Replace spaces with underscores
			.replace(/\.+$/, '')           // Remove trailing dots
			.trim()                        // Remove leading/trailing spaces
			.substring(0, 255);            // Limit length
	}

	/**
	 * Generate unique filename if file already exists
	 */
	async generateUniqueFilename(
		dirHandle: FileSystemDirectoryHandle,
		baseFilename: string
	): Promise<string> {
		const sanitized = this.sanitizeFilename(baseFilename);
		
		if (!await this.fileExists(dirHandle, sanitized)) {
			return sanitized;
		}

		// Extract name and extension
		const lastDot = sanitized.lastIndexOf('.');
		const name = lastDot === -1 ? sanitized : sanitized.substring(0, lastDot);
		const ext = lastDot === -1 ? '' : sanitized.substring(lastDot);

		// Try numbered variations
		for (let i = 1; i <= 999; i++) {
			const candidate = `${name} (${i})${ext}`;
			if (!await this.fileExists(dirHandle, candidate)) {
				return candidate;
			}
		}

		// Fallback with timestamp
		const timestamp = Date.now();
		return `${name}_${timestamp}${ext}`;
	}
}

// Export singleton instance
export const fileSystemService = FileSystemService.getInstance();