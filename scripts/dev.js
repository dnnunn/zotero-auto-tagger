const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const chalk = require('chalk');

const config = {
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'ZoteroAutoTagger',
  outfile: 'build/addon/chrome/content/scripts/index.js',
  watch: true,
  sourcemap: 'inline',
};

async function build() {
  console.log(chalk.blue('Building plugin...'));
  
  // Copy static files
  await fs.copy('src/manifest.json', 'build/manifest.json');
  await fs.copy('addon', 'build/addon');
  await fs.copy('src/locale', 'build/addon/chrome/locale');
  
  // Build JavaScript
  const ctx = await esbuild.context(config);
  await ctx.watch();
  
  console.log(chalk.green('✓ Build complete. Watching for changes...'));
}

build().catch(console.error);
