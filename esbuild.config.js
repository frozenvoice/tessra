const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');
const isProd = !isWatch;

/** @type {import('esbuild').BuildOptions} */
const extensionOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProd,
  minify: isProd,
};

/** @type {import('esbuild').BuildOptions} */
const webviewHljsOptions = {
  entryPoints: ['src/webview/hljs.ts'],
  bundle: true,
  outfile: 'dist/hljs.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: false,
  minify: true,
};

/** @type {import('esbuild').BuildOptions} */
const webviewBodyConversionOptions = {
  entryPoints: ['src/webview/bodyConversion.ts'],
  bundle: true,
  outfile: 'dist/bodyConversion.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: false,
  minify: true,
};

async function main() {
  if (isWatch) {
    const [extCtx, hljsCtx, bodyConvCtx] = await Promise.all([
      esbuild.context(extensionOptions),
      esbuild.context(webviewHljsOptions),
      esbuild.context(webviewBodyConversionOptions),
    ]);
    console.log('[esbuild] build started');
    await Promise.all([extCtx.watch(), hljsCtx.watch(), bodyConvCtx.watch()]);
    console.log('[esbuild] watching...');
  } else {
    await Promise.all([
      esbuild.build(extensionOptions),
      esbuild.build(webviewHljsOptions),
      esbuild.build(webviewBodyConversionOptions),
    ]);
    console.log('[esbuild] build complete');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
