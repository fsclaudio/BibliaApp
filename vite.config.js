import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Durante desenvolvimento, rotas que começam com /api serão encaminhadas
      // para https://www.abibliadigital.com.br/api, evitando problemas de CORS.
      // Isso garante que /api/livros -> https://www.abibliadigital.com.br/api/livros
      '/api': {
        target: 'https://www.abibliadigital.com.br/api',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
