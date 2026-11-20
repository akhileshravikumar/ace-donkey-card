import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  clean: true,
  // The shared workspace package ships TypeScript source, so bundle it into the server build.
  noExternal: ['@ace/shared'],
});
