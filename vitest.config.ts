import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  // Vitest 4 transforms JSX (automatic runtime) via oxc out of the box —
  // no @vitejs/plugin-react needed, which keeps the dev-dependency surface small.
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Domain/validation/repository tests live next to their code.
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> project root alias.
      "@": resolve(import.meta.dirname, "src"),
      // `server-only` throws when imported without React's "react-server" condition
      // (which Vitest doesn't set). Stub it so server modules are importable in tests.
      "server-only": resolve(import.meta.dirname, "test/server-only-stub.ts"),
    },
  },
})
