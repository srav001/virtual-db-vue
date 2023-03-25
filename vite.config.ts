import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	build: {
		minify: 'esbuild',
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'virtual-db-vue',
			fileName: 'virtual-db-vue'
		},
		rollupOptions: {
			external: ['vue', 'pinia'],
			output: {
				globals: {
					vue: 'Vue',
					pinia: 'Pinia'
				}
			}
		}
	},
	plugins: [vue(), dts()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		}
	}
});
