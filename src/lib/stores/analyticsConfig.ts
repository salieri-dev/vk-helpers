import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface DateRange {
	start: Date | null;
	end: Date | null;
	enabled: boolean;
}

export interface MessageTypeFilters {
	textMessages: boolean;
	photos: boolean;
	stickers: boolean;
	forwardedMessages: boolean;
	voiceMessages: boolean;
	documents: boolean;
}

export interface AnalyticsConfig {
	// Word Analysis Controls - increased limits for cached data
	topWordsCount: number;
	userTopWordsCount: number;
	minWordFrequency: number;
	
	// Date Filtering
	dateRange: DateRange;
	
	// Message Type Filtering
	messageTypes: MessageTypeFilters;
	
	// Display Settings
	animationsEnabled: boolean;
	compactMode: boolean;
}

export interface ConfigStore {
	applied: AnalyticsConfig;
	draft: AnalyticsConfig;
	hasChanges: boolean;
}

// Default configuration with higher limits for cached data
const defaultConfig: AnalyticsConfig = {
	// Word Analysis - increased limits to work with cached data
	topWordsCount: 20,
	userTopWordsCount: 8,
	minWordFrequency: 1,
	
	// Date Filtering
	dateRange: {
		start: null,
		end: null,
		enabled: false
	},
	
	// Message Types (all enabled by default)
	messageTypes: {
		textMessages: true,
		photos: true,
		stickers: true,
		forwardedMessages: true,
		voiceMessages: true,
		documents: true
	},
	
	// Display Settings
	animationsEnabled: true,
	compactMode: false
};

// Maximum limits for cached data (much higher than UI limits)
export const CACHE_LIMITS = {
	MAX_TOP_WORDS: 500, // Cache up to 500 top words
	MAX_USER_TOP_WORDS: 30, // Cache up to 30 words per user
	MIN_WORD_FREQUENCY_CACHE: 1 // Cache all words with frequency >= 1
} as const;

const STORAGE_KEY = 'vk-analytics-config';

// Load saved config from localStorage
function loadConfig(): AnalyticsConfig {
	if (!browser) return defaultConfig;
	
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return defaultConfig;
		
		const parsed = JSON.parse(saved);
		
		// Convert date strings back to Date objects
		if (parsed.dateRange?.start) {
			parsed.dateRange.start = new Date(parsed.dateRange.start);
		}
		if (parsed.dateRange?.end) {
			parsed.dateRange.end = new Date(parsed.dateRange.end);
		}
		
		// Merge with defaults to ensure all properties exist
		return { ...defaultConfig, ...parsed };
	} catch (error) {
		console.warn('Failed to load analytics config from localStorage:', error);
		return defaultConfig;
	}
}

// Save config to localStorage
function saveConfig(config: AnalyticsConfig) {
	if (!browser) return;
	
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch (error) {
		console.warn('Failed to save analytics config to localStorage:', error);
	}
}

// Create the writable store with draft/applied pattern
function createAnalyticsConfigStore() {
	const appliedConfig = loadConfig();
	const initialStore: ConfigStore = {
		applied: appliedConfig,
		draft: { ...appliedConfig },
		hasChanges: false
	};
	
	const { subscribe, set, update } = writable<ConfigStore>(initialStore);
	
	return {
		subscribe,
		// Update only the draft configuration
		updateDraft: (updater: (draft: AnalyticsConfig) => AnalyticsConfig) => {
			update((store) => {
				const newDraft = updater(store.draft);
				return {
					...store,
					draft: newDraft,
					hasChanges: !configsEqual(newDraft, store.applied)
				};
			});
		},
		// Apply the draft changes to the applied config
		applyChanges: () => {
			update((store) => {
				const newApplied = { ...store.draft };
				saveConfig(newApplied);
				return {
					applied: newApplied,
					draft: { ...newApplied },
					hasChanges: false
				};
			});
		},
		// Discard draft changes and revert to applied config
		discardChanges: () => {
			update((store) => ({
				...store,
				draft: { ...store.applied },
				hasChanges: false
			}));
		},
		// Reset both applied and draft to defaults
		reset: () => {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
			const resetStore: ConfigStore = {
				applied: { ...defaultConfig },
				draft: { ...defaultConfig },
				hasChanges: false
			};
			set(resetStore);
		},
		// Utility methods for common draft operations
		setTopWordsCount: (count: number) => {
			update((store) => {
				const newDraft = { ...store.draft, topWordsCount: Math.max(5, Math.min(CACHE_LIMITS.MAX_TOP_WORDS, count)) };
				return {
					...store,
					draft: newDraft,
					hasChanges: !configsEqual(newDraft, store.applied)
				};
			});
		},
		setDateRange: (start: Date | null, end: Date | null, enabled: boolean = true) => {
			update((store) => {
				const newDraft = {
					...store.draft,
					dateRange: { start, end, enabled }
				};
				return {
					...store,
					draft: newDraft,
					hasChanges: !configsEqual(newDraft, store.applied)
				};
			});
		},
		toggleMessageType: (messageType: keyof MessageTypeFilters) => {
			update((store) => {
				const newDraft = {
					...store.draft,
					messageTypes: {
						...store.draft.messageTypes,
						[messageType]: !store.draft.messageTypes[messageType]
					}
				};
				return {
					...store,
					draft: newDraft,
					hasChanges: !configsEqual(newDraft, store.applied)
				};
			});
		},
		setMinWordFrequency: (frequency: number) => {
			update((store) => {
				const newDraft = { ...store.draft, minWordFrequency: Math.max(1, frequency) };
				return {
					...store,
					draft: newDraft,
					hasChanges: !configsEqual(newDraft, store.applied)
				};
			});
		}
	};
}

// Helper function to compare two configs for equality
function configsEqual(a: AnalyticsConfig, b: AnalyticsConfig): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export const analyticsConfig = createAnalyticsConfigStore();

// Export validation helpers
export function validateDateRange(start: Date | null, end: Date | null): boolean {
	if (!start || !end) return true; // Allow partial ranges
	return start <= end;
}

export function getDateRangeDescription(dateRange: DateRange): string {
	if (!dateRange.enabled || (!dateRange.start && !dateRange.end)) {
		return 'All time';
	}
	
	const formatDate = (date: Date) => 
		new Intl.DateTimeFormat('ru-RU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(date);
	
	if (dateRange.start && dateRange.end) {
		return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
	} else if (dateRange.start) {
		return `From ${formatDate(dateRange.start)}`;
	} else if (dateRange.end) {
		return `Until ${formatDate(dateRange.end)}`;
	}
	
	return 'All time';
}