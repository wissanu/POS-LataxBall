import { defineConfig } from 'vitest/config'

// Standalone config: the pricing core has no Vue/DOM dependency.   Run:  npm run test:price
export default defineConfig({ test: { include: ['src/lib/rubber-price/tests/**/*.test.ts'], environment: 'node' } })
