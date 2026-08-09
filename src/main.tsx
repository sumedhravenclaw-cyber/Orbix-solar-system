import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted via @fontsource — no runtime request to a font CDN, and the
// package ships `font-display: swap`, so text is never invisible while loading.
// Latin subsets only: the unqualified entrypoints also pull Greek, Cyrillic and
// Vietnamese, which this UI never renders.
// IBM Plex Sans for prose, JetBrains Mono for every instrument readout —
// the same pairing as the ORBIX console.
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';

import App from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html.');

createRoot(container).render(
  // StrictMode double-invokes effects in development. That is a feature here:
  // it proves the engine's build/dispose cycle is symmetric and leak-free.
  <StrictMode>
    <App />
  </StrictMode>,
);
