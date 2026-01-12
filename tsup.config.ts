import { defineConfig, type Options } from 'tsup';

export default defineConfig((options: Options) => ({
  entryPoints: ['src/index.ts'],
  sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : false,
  outDir: 'dist',
  clean: true,
  dts: true,
  bundle: true,
  format: ['cjs' as const, 'esm' as const],
  minify: false,
  ignoreWatch: ['**/node_modules/**', '**/dist/**'],
  ...options,
}));
