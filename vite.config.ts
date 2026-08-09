import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Three.js is by far the heaviest dependency. Splitting it into its own
    // chunk lets the browser cache it independently of application code, which
    // changes far more often. (UX rule: bundle-splitting.)
    rollupOptions: {
      output: {
        // A function, not a map: `three` alone would leave the addons
        // (OrbitControls, EffectComposer, UnrealBloomPass) in the app chunk,
        // which then invalidates on every application change.
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
