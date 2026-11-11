import { copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves 404.html for unknown paths, so a copy of the app there
 * makes deep links like /analytics-chat/board work. .nojekyll stops Pages
 * from hiding files that start with an underscore.
 */
function githubPages(): Plugin {
  let outDir = 'docs';
  return {
    name: 'github-pages',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
      writeFileSync(resolve(outDir, '.nojekyll'), '');
    },
  };
}

export default defineConfig(({ mode }) => {
  // The self-contained browser demo (VITE_PIPELINE_MODE=browser from .env.<mode>), built two ways:
  // `--mode pages` into docs/ for https://asad-creats.github.io/analytics-chat/, and
  // `--mode portfolio` into dist-portfolio/ for the portfolio site's /pipeline/.
  const pages = mode === 'pages';
  const portfolio = mode === 'portfolio';
  return {
    base: pages ? '/analytics-chat/' : portfolio ? '/pipeline/' : '/',
    plugins: [react(), ...(pages ? [githubPages()] : [])],
    build: pages
      ? { outDir: 'docs', emptyOutDir: true }
      : portfolio
        ? { outDir: 'dist-portfolio', emptyOutDir: true }
        : {},
    // PGlite ships its own WebAssembly; let it load that rather than pre-bundling.
    optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  };
});
