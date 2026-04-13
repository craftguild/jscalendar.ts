import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        coverage: {
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/__tests__/**",
                "src/types.ts",
                "src/jscal/types.ts",
                "src/recurrence/types.ts",
            ],
        },
    },
});
