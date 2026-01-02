import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // استبدل 'game-repo-name' بالاسم الذي ستسميه للمستودع في github
  base: '/WalaKelmaGame/', 
})