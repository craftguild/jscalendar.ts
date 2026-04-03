import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        dir: "src",
        include: ["__tests__/**/*.test.ts"],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/appendix/**",
            "**/.{idea,git,cache,output,temp}/**",
            "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
            "**/src/test.ts",
        ],
        coverage: {
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/__tests__/**",
                "src/types.ts",
                "src/jscal/types.ts",
                "src/recurrence/types.ts",
                "src/test.ts",
            ],
        },
    },
});
