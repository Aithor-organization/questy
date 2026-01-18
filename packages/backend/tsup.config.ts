import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  // Bun 전용 모듈은 번들에서 제외 (Node.js 환경에서 조건부 로딩됨)
  // nodemailer는 CommonJS 모듈이므로 번들에서 제외
  external: ['bun:sqlite', 'drizzle-orm/bun-sqlite', 'nodemailer'],
  noExternal: ['@questybook/shared'],
  clean: true,
});
