import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Clean up old caches
cleanupOutdatedCaches();

// Precache all static assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache strategy for runtime requests
self.addEventListener('fetch', (event) => {
	// Handle API calls or specific routes if needed
	if (event.request.url.includes('/api/')) {
		// For API calls, always go to network first
		return;
	}
});