import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Firebase ayrı dosyada (ESM, uygulamaya bağımlı değil). React vb. CommonJS kütüphaneleri ayrı
        // dosyaya bölünmez: paketleyicinin yardımcı kodu uygulama dosyasında kalıp döngü yaratıyor ve açılışta çöküyordu.
        codeSplitting: {
          groups: [{ name: 'firebase', test: /node_modules[\/](firebase|@firebase)/ }],
        },
      },
    },
  },
})
