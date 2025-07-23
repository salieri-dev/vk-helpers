/**
 * Archive Service
 * High-level service for managing VK archive processing
 * Orchestrates workers, database operations, and progress tracking
 */
import { progressStore, trackArchiveProcessing } from '../stores/progress';
import { databaseService } from '../db/database';
import { generateArchiveId } from '../db/schema';
import type { 
	ArchiveWorkerCommand, 
	ArchiveWorkerResponse,
	ProcessingOptions 
} from '../workers/worker-types';

export class ArchiveService {
	private static instance: ArchiveService;
	private worker: Worker | null = null;
	private currentOperationId: string | null = null;

	static getInstance(): ArchiveService {
		if (!ArchiveService.instance) {
			ArchiveService.instance = new ArchiveService();
		}
		return ArchiveService.instance;
	}

	/**
	 * Initialize the archive processing worker
	 */
	private initWorker(): Worker {
		if (this.worker) {
			return this.worker;
		}

		this.worker = new Worker(
			new URL('../workers/archive.worker.ts', import.meta.url),
			{ type: 'module' }
		);

		this.worker.onmessage = (event: MessageEvent<ArchiveWorkerResponse>) => {
			if (!this.currentOperationId) return;

			const { type, data } = event.data;

			switch (type) {
				case 'PROGRESS':
					progressStore.updateOperationProgress(this.currentOperationId, data as any);
					break;

				case 'COMPLETE':
					const completionData = data as any;
					progressStore.completeOperation(this.currentOperationId, completionData);
					this.currentOperationId = null;
					break;

				case 'ERROR':
					const errorData = data as any;
					progressStore.errorOperation(this.currentOperationId, errorData.message);
					this.currentOperationId = null;
					break;
			}
		};

		this.worker.onerror = (error) => {
			console.error('Archive worker error:', error);
			if (this.currentOperationId) {
				progressStore.errorOperation(this.currentOperationId, 'Worker error occurred');
				this.currentOperationId = null;
			}
		};

		return this.worker;
	}

	/**
	 * Process a VK archive file
	 */
	async processArchive(file: File, options: ProcessingOptions = {}): Promise<string> {
		// Check if file already exists
		const existingArchives = await databaseService.getAllArchives();
		const duplicate = existingArchives.find(
			archive => archive.filename === file.name && archive.size === file.size
		);

		if (duplicate) {
			throw new Error(`Archive ${file.name} has already been processed`);
		}

		// Start progress tracking
		this.currentOperationId = trackArchiveProcessing(file.name);

		// Initialize worker
		const worker = this.initWorker();

		// Send command to worker
		const command: ArchiveWorkerCommand = {
			type: 'PROCESS_ARCHIVE',
			file,
			options
		};

		worker.postMessage(command);

		// Return the expected archive ID
		return generateArchiveId(file.name, file.size);
	}

	/**
	 * Cancel current processing operation
	 */
	cancelProcessing(): void {
		if (this.currentOperationId) {
			progressStore.cancelOperation(this.currentOperationId);
			this.currentOperationId = null;
		}

		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
	}

	/**
	 * Get all processed archives
	 */
	async getAllArchives() {
		return await databaseService.getAllArchives();
	}

	/**
	 * Get archive by ID
	 */
	async getArchive(archiveId: string) {
		return await databaseService.getArchive(archiveId);
	}

	/**
	 * Delete an archive and all associated data
	 */
	async deleteArchive(archiveId: string): Promise<void> {
		await databaseService.deleteArchive(archiveId);
	}

	/**
	 * Get processing statistics
	 */
	async getProcessingStats() {
		return await databaseService.getStats();
	}

	/**
	 * Check storage usage
	 */
	async getStorageInfo(): Promise<{
		used: number;
		available: number;
		quota: number;
		percentage: number;
	} | null> {
		if ('storage' in navigator && 'estimate' in navigator.storage) {
			const estimate = await navigator.storage.estimate();
			const used = estimate.usage || 0;
			const quota = estimate.quota || 0;
			const available = quota - used;
			const percentage = quota > 0 ? Math.round((used / quota) * 100) : 0;

			return { used, available, quota, percentage };
		}
		return null;
	}

	/**
	 * Request persistent storage
	 */
	async requestPersistentStorage(): Promise<boolean> {
		if ('storage' in navigator && 'persist' in navigator.storage) {
			return await navigator.storage.persist();
		}
		return false;
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
		this.currentOperationId = null;
	}
}

// Export singleton instance
export const archiveService = ArchiveService.getInstance();

// Helper functions
export async function isArchiveAlreadyProcessed(filename: string, size: number): Promise<boolean> {
	const archives = await databaseService.getAllArchives();
	return archives.some(archive => archive.filename === filename && archive.size === size);
}

export async function getArchiveProcessingHistory(): Promise<{
	total: number;
	successful: number;
	failed: number;
	pending: number;
	totalSize: number;
}> {
	const archives = await databaseService.getAllArchives();
	
	return {
		total: archives.length,
		successful: archives.filter(a => a.processingStatus === 'complete').length,
		failed: archives.filter(a => a.processingStatus === 'error').length,
		pending: archives.filter(a => a.processingStatus === 'processing').length,
		totalSize: archives.reduce((sum, archive) => sum + archive.size, 0)
	};
}