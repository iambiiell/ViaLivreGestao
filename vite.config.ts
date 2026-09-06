
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, path.resolve('.'), '');

    // Gemini API Key from environment
    const API_KEY = env.GEMINI_API_KEY || '';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss()
      ],

      define: {
        'process.env.API_KEY': JSON.stringify(API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        },
        dedupe: ['react', 'react-dom']
      }
    };
});
