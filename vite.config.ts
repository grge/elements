import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const isPages = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  plugins: [vue()],
  base: isPages ? '/elements/' : '/',
})
