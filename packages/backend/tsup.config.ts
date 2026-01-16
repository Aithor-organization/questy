import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  external: ['bun:sqlite'],
  noExternal: ['@questybook/shared'],
  clean: true,
});
