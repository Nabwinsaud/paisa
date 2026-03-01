import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "esewa/index": "src/esewa/index.ts",
    "khalti/index": "src/khalti/index.ts",
  },
  format: ["cjs", "esm"],
  dts: {
    compilerOptions: {
      composite: false,
    },
  },
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outDir: "dist",
});
