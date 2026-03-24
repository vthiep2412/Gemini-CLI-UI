import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  
  return {
    plugins: [react()],
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
        '@uiw/react-codemirror',
        'react-markdown',
        'remark-gfm',
        'react-syntax-highlighter',
        'react-syntax-highlighter/dist/esm/styles/prism'
      ]
    },
    build: {
      outDir: 'dist'
    }
  }
})