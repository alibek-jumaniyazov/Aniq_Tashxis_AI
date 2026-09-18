import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

export default defineConfig({ plugins: [react(), {
  name: 'emit-server-seo-content',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'seo-content.json', source: readFileSync(new URL('./src/seoContent.json', import.meta.url), 'utf8') })
  },
}], server: { port: 5173, strictPort: true, proxy: { '/api': process.env.VITE_BACKEND_TARGET || 'http://127.0.0.1:8000' } }, build: { chunkSizeWarningLimit: 1100, rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules')) { if (id.includes('/antd/') || id.includes('/@ant-design/') || id.includes('/rc-') || id.includes('/@rc-component/')) return 'design-system'; if (id.includes('/motion') || id.includes('/framer-motion')) return 'motion'; return 'vendor' } } } } } })
