import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			strategies: 'injectManifest',
			srcDir: './src',
			filename: 'sw.ts',
			registerType: 'autoUpdate',
			manifest: {
				name: 'VK Archive Analytics',
				short_name: 'VK Analytics',
				description: 'Analyze your VK GDPR archive data locally in your browser',
				theme_color: '#4a90e2',
				background_color: '#ffffff',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'favicon.svg',
						sizes: 'any',
						type: 'image/svg+xml'
					}
				]
			}
		})
	],
	define: {
		global: 'globalThis'
	},
	optimizeDeps: {
		exclude: ['iconv-lite']
	}
});
