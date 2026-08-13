import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Rewrites the root-relative `og:image` to an absolute URL, and adds `og:url`.
 *
 * Link-preview crawlers (Slack, Facebook, iMessage) do not reliably resolve a
 * relative `og:image` against the page URL, so a relative one yields a card
 * with no image. The origin is only knowable at deploy time, hence a build
 * step rather than a literal in index.html.
 *
 * Resolution order, first hit wins:
 *   SITE_ORIGIN                      — explicit override, any host
 *   VERCEL_PROJECT_PRODUCTION_URL    — set by Vercel, bare host, no protocol
 *
 * With neither set (a local `npm run build`) the tag is left relative: a wrong
 * absolute URL produces a broken image, which is worse than none.
 */
const absoluteOgUrls = (): Plugin => ({
  name: 'orbix-absolute-og-urls',
  transformIndexHtml(html) {
    const configured = process.env.SITE_ORIGIN ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (!configured) return html;

    const origin = (/^https?:\/\//.test(configured) ? configured : `https://${configured}`)
      // A trailing slash would produce `https://host//og.png`.
      .replace(/\/+$/, '');

    return html
      .replace('content="/og.png"', `content="${origin}/og.png"`)
      .replace(
        '<meta property="og:type" content="website" />',
        `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${origin}/" />\n    <link rel="canonical" href="${origin}/" />`,
      );
  },
});

export default defineConfig({
  plugins: [react(), absoluteOgUrls()],
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
