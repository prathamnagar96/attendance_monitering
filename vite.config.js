import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    base: './',
    plugins: [react()],
    define: {
        global: 'globalThis',
        'process.env': {}
    },
    optimizeDeps: {
        include: ['tesseract.js']
    }
})
