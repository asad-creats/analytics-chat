import { copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves 404.html for unknown paths, so a copy of the app there
 * makes deep links like /analytics-chat/board work. .nojekyll stops Pages
 * from hiding files that start with an underscore.
 */
function githubPages(outDir: string): Plugin {
  return {
    name: 'github-pages',
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
      writeFileSync(resolve(outDir, '.nojekyll'), '');
    },
  };
}

export default defineConfig(({ mode }) => {
  // `vite build --mode pages`: the self-contained demo in docs/, served at
  // https://asad-creats.github.io/analytics-chat/ (VITE_PIPELINE_MODE comes from .env.pages).
  const pages = mode === 'pages';
  return {
    base: pages ? '/analytics-chat/' : '/',
    plugins: [react(), ...(pages ? [githubPages('docs')] : [])],
    build: pages ? { outDir: 'docs', emptyOutDir: true } : {},
    // PGlite ships its own WebAssembly; let it load that rather than pre-bundling.
    optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  };
});
