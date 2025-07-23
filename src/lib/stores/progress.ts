import { writable, derived } from 'svelte/store';
import type { ProgressData } from '../workers/worker-types';

export interface GlobalProgress {
	activeOperations: Map<string, OperationProgress>;
	notifications: NotificationItem[];
}

export interface OperationProgress {
	id: string;
	type: 'archive-processing' | 'image-download' | 'analytics' | 'export';
	title: string;
	status: 'pending' | 'running' | 'complete' | 'error' | 'cancelled';
	progress: ProgressData | null;
	startTime: Date;
	endTime?: Date;
	error?: string;
	metadata?: any;
}

export interface NotificationItem {
	id: string;
	type: 'info' | 'success' | 'warning' | 'error';
	title: string;
	message: string;
	timestamp: Date;
	duration?: number; // Auto-dismiss after N seconds
	persistent?: boolean; // Don't auto-dismiss
	action?: {
		label: string;
		callback: () => void;
	};
}

function createProgressStore() {
	const { subscribe, update } = writable<GlobalProgress>({
		activeOperations: new Map(),
		notifications: []
	});

	function startOperation(
		id: string, 
		type: OperationProgress['type'], 
		title: string,
		metadata?: any
	): void {
		update(state => {
			const newOperations = new Map(state.activeOperations);
			newOperations.set(id, {
				id,
				type,
				title,
				status: 'pending',
				progress: null,
				startTime: new Date(),
				metadata
			});
			
			return {
				...state,
				activeOperations: newOperations
			};
		});
	}

	function updateOperation(id: string, updates: Partial<OperationProgress>): void {
		update(state => {
			const newOperations = new Map(state.activeOperations);
			const existing = newOperations.get(id);
			
			if (existing) {
				newOperations.set(id, { ...existing, ...updates });
			}
			
			return {
				...state,
				activeOperations: newOperations
			};
		});
	}

	function updateOperationProgress(id: string, progress: ProgressData): void {
		updateOperation(id, { 
			progress, 
			status: 'running' 
		});
	}

	function completeOperation(id: string, result?: any): void {
		updateOperation(id, { 
			status: 'complete', 
			endTime: new Date(),
			metadata: { ...(getOperation(id)?.metadata || {}), result }
		});

		// Auto-remove completed operations after 30 seconds
		setTimeout(() => {
			removeOperation(id);
		}, 30000);
	}

	function errorOperation(id: string, error: string): void {
		updateOperation(id, { 
			status: 'error', 
			error,
			endTime: new Date()
		});

		// Add error notification
		addNotification({
			type: 'error',
			title: 'Operation Failed',
			message: error,
			persistent: true
		});
	}

	function cancelOperation(id: string): void {
		updateOperation(id, { 
			status: 'cancelled', 
			endTime: new Date()
		});

		// Auto-remove cancelled operations after 5 seconds
		setTimeout(() => {
			removeOperation(id);
		}, 5000);
	}

	function removeOperation(id: string): void {
		update(state => {
			const newOperations = new Map(state.activeOperations);
			newOperations.delete(id);
			
			return {
				...state,
				activeOperations: newOperations
			};
		});
	}

	function getOperation(id: string): OperationProgress | undefined {
		let operation: OperationProgress | undefined;
		
		// Use subscribe to get current state synchronously
		const unsubscribe = subscribe(state => {
			operation = state.activeOperations.get(id);
		});
		unsubscribe();
		
		return operation;
	}

	function addNotification(notification: Omit<NotificationItem, 'id' | 'timestamp'>): string {
		const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const item: NotificationItem = {
			...notification,
			id,
			timestamp: new Date()
		};

		update(state => ({
			...state,
			notifications: [...state.notifications, item]
		}));

		// Auto-dismiss non-persistent notifications
		if (!notification.persistent) {
			const duration = notification.duration || 5000;
			setTimeout(() => {
				removeNotification(id);
			}, duration);
		}

		return id;
	}

	function removeNotification(id: string): void {
		update(state => ({
			...state,
			notifications: state.notifications.filter(n => n.id !== id)
		}));
	}

	function clearNotifications(): void {
		update(state => ({
			...state,
			notifications: []
		}));
	}

	// Derived stores for specific operation types
	const archiveOperations = derived(
		{ subscribe },
		$state => Array.from($state.activeOperations.values())
			.filter(op => op.type === 'archive-processing')
	);

	const downloadOperations = derived(
		{ subscribe },
		$state => Array.from($state.activeOperations.values())
			.filter(op => op.type === 'image-download')
	);

	const hasActiveOperations = derived(
		{ subscribe },
		$state => $state.activeOperations.size > 0
	);

	const activeOperationsList = derived(
		{ subscribe },
		$state => Array.from($state.activeOperations.values())
			.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
	);

	const recentNotifications = derived(
		{ subscribe },
		$state => $state.notifications
			.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
			.slice(0, 10) // Keep only latest 10 notifications
	);

	return {
		subscribe,
		startOperation,
		updateOperation,
		updateOperationProgress,
		completeOperation,
		errorOperation,
		cancelOperation,
		removeOperation,
		getOperation,
		addNotification,
		removeNotification,
		clearNotifications,
		// Derived stores
		archiveOperations,
		downloadOperations,
		hasActiveOperations,
		activeOperationsList,
		recentNotifications
	};
}

export const progressStore = createProgressStore();

// Helper functions for common notification types
export function showSuccessNotification(title: string, message: string): string {
	return progressStore.addNotification({
		type: 'success',
		title,
		message
	});
}

export function showErrorNotification(title: string, message: string, persistent = false): string {
	return progressStore.addNotification({
		type: 'error',
		title,
		message,
		persistent
	});
}

export function showInfoNotification(title: string, message: string): string {
	return progressStore.addNotification({
		type: 'info',
		title,
		message
	});
}

export function showWarningNotification(title: string, message: string): string {
	return progressStore.addNotification({
		type: 'warning',
		title,
		message
	});
}

// Helper functions for operation tracking
export function trackArchiveProcessing(filename: string): string {
	const operationId = `archive_${Date.now()}`;
	progressStore.startOperation(
		operationId,
		'archive-processing',
		`Processing ${filename}`,
		{ filename }
	);
	return operationId;
}

export function trackImageDownload(totalImages: number, useFileSystem: boolean): string {
	const operationId = `download_${Date.now()}`;
	progressStore.startOperation(
		operationId,
		'image-download',
		`Downloading ${totalImages} images`,
		{ totalImages, useFileSystem }
	);
	return operationId;
}

// Progress calculation helpers
export function calculateOverallProgress(operations: OperationProgress[]): {
	percentage: number;
	completed: number;
	total: number;
	estimated?: string;
} {
	if (operations.length === 0) {
		return { percentage: 0, completed: 0, total: 0 };
	}

	let totalPercentage = 0;
	let completed = 0;
	let estimatedTimes: number[] = [];

	for (const op of operations) {
		if (op.status === 'complete') {
			totalPercentage += 100;
			completed++;
		} else if (op.progress) {
			totalPercentage += op.progress.percentage;
			if (op.progress.estimatedTimeRemaining) {
				// Parse time string to milliseconds (simplified)
				const timeStr = op.progress.estimatedTimeRemaining;
				if (timeStr.includes('h')) {
					const hours = parseInt(timeStr);
					estimatedTimes.push(hours * 60 * 60 * 1000);
				} else if (timeStr.includes('m')) {
					const minutes = parseInt(timeStr);
					estimatedTimes.push(minutes * 60 * 1000);
				} else if (timeStr.includes('s')) {
					const seconds = parseInt(timeStr);
					estimatedTimes.push(seconds * 1000);
				}
			}
		}
	}

	const percentage = Math.round(totalPercentage / operations.length);
	const averageEstimate = estimatedTimes.length > 0 
		? estimatedTimes.reduce((a, b) => a + b, 0) / estimatedTimes.length
		: 0;

	return {
		percentage,
		completed,
		total: operations.length,
		estimated: averageEstimate > 0 ? formatTime(averageEstimate) : undefined
	};
}

function formatTime(ms: number): string {
	if (ms <= 0) return '0s';
	
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	
	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	} else {
		return `${seconds}s`;
	}
}