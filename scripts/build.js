const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');
const replace = require('replace-in-file');
const config = require('../src/config.js').default;

async function build() {
  console.log('Building plugin...');
  
  // Clean build directory
  await fs.emptyDir('build');
  
  // Copy files
  await fs.copy('src/manifest.json', 'build/manifest.json');
  await fs.copy('addon', 'build/addon');
  await fs.copy('src/locale', 'build/addon/chrome/locale');
  
  // Replace variables in manifest
  await replace({
    files: 'build/manifest.json',
    from: [/__addonID__/g, /__version__/g, /__addonName__/g, /__description__/g, /__author__/g, /__homepage__/g, /__updateURL__/g],
    to: [config.addonID, config.version, config.addonName, config.description, config.author, config.homepage, config.updateURL],
  });
  
  // Build JavaScript
  await esbuild.build({
    entryPoints: ['src/index.js'],
    bundle: true,
    format: 'iife',
    globalName: 'ZoteroAutoTagger',
    outfile: 'build/addon/chrome/content/scripts/index.js',
    minify: true,
  });
  
  console.log('Build complete!');
}

build().catch(console.error);
