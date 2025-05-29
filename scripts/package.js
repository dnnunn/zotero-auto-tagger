const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

// Define project root
const projectRoot = path.join(__dirname, '..');
const buildBaseDir = path.join(projectRoot, 'build');
const addonDir = path.join(buildBaseDir, 'addon');
const xpiDir = path.join(buildBaseDir, 'xpi'); // New XPI output directory
const packageJson = require(path.join(projectRoot, 'package.json'));
const version = packageJson.version;

async function package() {
  console.log('Packaging extension...');
  
  // Ensure the xpi directory exists
  await fs.ensureDir(xpiDir);
  
  // Create output stream for the XPI file
  const xpiName = `zotero-auto-tagger-v${version}.xpi`;
  const xpiPath = path.join(xpiDir, xpiName); // Changed path to xpiDir
  const output = fs.createWriteStream(xpiPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });
  
  // Listen for all archive data to be written
  output.on('close', function() {
    console.log(`Created ${xpiName} (${archive.pointer()} bytes)`);
    
    // Also create a copy without version for update purposes
    fs.copySync(xpiPath, path.join(xpiDir, 'zotero-auto-tagger.xpi')); // Changed path to xpiDir
    console.log('Created zotero-auto-tagger.xpi (copy without version for updates)');
  });
  
  // Good practice to catch warnings
  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      console.warn(err);
    } else {
      throw err;
    }
  });
  
  // Handle errors
  archive.on('error', function(err) {
    throw err;
  });
  
  // Pipe archive data to the file
  archive.pipe(output);
  
  // Add files from addon directory to the archive
  archive.directory(addonDir, false);
  
  // Finalize the archive
  await archive.finalize();
}

package().catch(console.error); 