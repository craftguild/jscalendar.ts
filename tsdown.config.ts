import { defineConfig } from "tsdown";

export default defineConfig({
    dts: true,
    format: {
        esm: {
            target: ["es2020"],
        },
        cjs: {
            target: ["node12"],
        },
    },
});
