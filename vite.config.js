import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// dev (npm run dev) ใช้ base "/" จึงเปิด http://localhost:5173/?demo ได้ตาม CLAUDE.md
// build ใช้ base ของ GitHub Pages (/baanbrew-dashboard/) · Firebase Hosting ใช้ npm run build:hosting (--base=/)
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/baanbrew-dashboard/',
  plugins: [react(), tailwindcss()],
}))
