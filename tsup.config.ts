import { defineConfig, type Options } from 'tsup';

export default defineConfig((options: Options) => ({
  entryPoints: ['src/index.ts'],
  clean: false,
  dts: true,
  format: ['cjs', 'esm'],
  minify: true,
  ignoreWatch: ['**/node_modules/**', '**/dist/**'],
  ...options,
}));
