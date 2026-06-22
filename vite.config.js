import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is '/' for Vercel, '/taco/' for GitHub Pages
// Vercel sets VITE_VERCEL=1 automatically, GitHub Pages does not
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/taco/' : '/',
})
