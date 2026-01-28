import { build } from 'bun';
import dts from 'bun-plugin-dts';

await build({
    entrypoints: ['./src/index.ts'],
    plugins: [
        dts({ output:{ noBanner: true }})
    ],
    minify: {
        identifiers: true,
        whitespace: true,
        syntax: true
    },
    naming: 'index.mjs',
    sourcemap: 'none',
    outdir: 'dist',
    format: 'esm',
    target: 'node'
});

await build({
    entrypoints: ['./src/index.ts'],
    minify: {
        identifiers: true,
        whitespace: true,
        syntax: true
    },
    naming: 'index.cjs',
    sourcemap: 'none',
    outdir: 'dist',
    format: 'cjs',
    target: 'node'
});
