const esbuild = require('esbuild');
const fs = require('fs-extra');
const path = require('path');
const { replaceInFile } = require('replace-in-file');

// Define project root
const projectRoot = path.join(__dirname, '..');
const buildBaseDir = path.join(projectRoot, 'build');
const buildDir = path.join(buildBaseDir, 'addon');

// Load config using require for Node.js
const config = {
  addonID: "zotero-auto-tagger@dnnunn.github.io",
  addonName: "Zotero Auto-Tagger",
  addonRef: "autoTagger",
  version: "0.2.0",
  description: "Automatically generate and add tags to references",
  author: "dnnunn",
  homepage: "https://github.com/dnnunn/zotero-auto-tagger",
  updateURL: "https://raw.githubusercontent.com/dnnunn/zotero-auto-tagger/main/update.json"
};

async function build() {
  console.log('Building plugin...');
  
  // Clean build directory
  await fs.emptyDir(buildDir);
  
  // Copy manifest
  await fs.copy(
    path.join(projectRoot, 'src/manifest.json'), 
    path.join(buildDir, 'manifest.json')
  );
  
  // Copy bootstrap.js
  await fs.copy(
    path.join(projectRoot, 'src/bootstrap.js'), 
    path.join(buildDir, 'bootstrap.js')
  );
  
  // Copy addon files
  await fs.copy(
    path.join(projectRoot, 'addon'), 
    buildDir
  );
  
  // Copy locale files
  await fs.copy(
    path.join(projectRoot, 'src/locale'), 
    path.join(buildDir, 'chrome/locale')
  );
  
  // Create modules directory
  await fs.ensureDir(path.join(buildDir, 'chrome/content/modules'));
  
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
    if (await fs.pathExists(path.join(projectRoot, `src/${module}`))) {
      const dest = module === 'index.js' 
        ? path.join(buildDir, 'chrome/content/scripts/index.js')
        : path.join(buildDir, `chrome/content/${module}`);
      
      await fs.ensureDir(path.dirname(dest));
      await fs.copy(path.join(projectRoot, `src/${module}`), dest);
    }
  }
  
  // Replace variables in manifest
  await replaceInFile({
    files: path.join(buildDir, 'manifest.json'),
    from: [/__addonID__/g, /__version__/g, /__addonName__/g, /__description__/g, /__author__/g, /__homepage__/g, /__updateURL__/g],
    to: [config.addonID, config.version, config.addonName, config.description, config.author, config.homepage, config.updateURL],
  });
  
  console.log('Build complete!');
}

build().catch(console.error);
