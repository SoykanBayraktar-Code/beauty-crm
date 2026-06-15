import { defineConfig } from "vitest/config";

// Testler LOKAL Supabase stack'ine (127.0.0.1:54321) bağlanır.
// DB durum yarışlarını önlemek için tek süreç + sıralı dosya çalıştırma.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 40000,
    fileParallelism: false,
  },
});
