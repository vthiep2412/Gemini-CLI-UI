import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  
  return {
    plugins: [
      react(),
      tailwindcss()
    ],
    server: {
      port: parseInt(env.VITE_PORT) || 4009,
      watch: {
        ignored: ['**/node_modules/**', '**/dist/**']
      },
      hmr: {
        overlay: false
      },
      proxy: {
        '/api': `http://localhost:${env.PORT || 4008}`,
        '/ws': {
          target: `ws://localhost:${env.PORT || 4008}`,
          ws: true
        }
      }
    },
    optimizeDeps: {
      include: [
        'lucide-react',
        'framer-motion',
        'react-router-dom',
        'react-markdown',
        'remark-gfm',
        'react-window'
      ],
      exclude: ['react-syntax-highlighter']
    },
    build: {
      outDir: 'dist'
    }
  }
})
