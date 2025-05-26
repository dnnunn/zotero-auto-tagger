const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');
const replace = require('replace-in-file');

// Load config using require for Node.js
const config = {
  addonID: "zotero-auto-tagger@dnnunn.github.io",
  addonName: "Zotero Auto-Tagger",
  addonRef: "autoTagger",
  version: "0.1.0",
  description: "Automatically generate and add tags to references",
  author: "dnnunn",
  homepage: "https://github.com/dnnunn/zotero-auto-tagger",
  updateURL: "https://raw.githubusercontent.com/dnnunn/zotero-auto-tagger/main/update.json"
};

async function build() {
  console.log('Building plugin...');
  
  // Clean build directory
  await fs.emptyDir('build');
  
  // Copy manifest
  await fs.copy('src/manifest.json', 'build/manifest.json');
  
  // Copy bootstrap.js
  await fs.copy('src/bootstrap.js', 'build/bootstrap.js');
  
  // Copy addon files
  await fs.copy('addon', 'build');
  
  // Copy locale files
  await fs.copy('src/locale', 'build/chrome/locale');
  
  // Create modules directory
  await fs.ensureDir('build/chrome/content/modules');
  
  // Copy JS modules
  const modules = [
    'index.js',
    'modules/ui.js',
    'modules/tagGenerator.js',
    'modules/pubmedAPI.js',
    'modules/tagCache.js',
    'modules/tagProcessor.js',
    'modules/prefs.js',
    'modules/prefDefaults.js'
  ];
  
  for (const module of modules) {
    if (await fs.pathExists(`src/${module}`)) {
      const dest = module === 'index.js' 
        ? 'build/chrome/content/scripts/index.js'
        : `build/chrome/content/${module}`;
      
      await fs.ensureDir(path.dirname(dest));
      await fs.copy(`src/${module}`, dest);
    }
  }
  
  // Replace variables in manifest
  await replace({
    files: 'build/manifest.json',
    from: [/__addonID__/g, /__version__/g, /__addonName__/g, /__description__/g, /__author__/g, /__homepage__/g, /__updateURL__/g],
    to: [config.addonID, config.version, config.addonName, config.description, config.author, config.homepage, config.updateURL],
  });
  
  console.log('Build complete!');
}

build().catch(console.error);
