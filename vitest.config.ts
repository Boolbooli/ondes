import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __BUILD_DATE__: JSON.stringify('2026-01-01'),
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
