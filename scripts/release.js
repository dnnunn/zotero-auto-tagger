const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');

async function release() {
  // First build
  await require('./build.js');
  
  // Wait for build to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create XPI with version number
  const output = fs.createWriteStream(`zotero-auto-tagger-0.1.0.xpi`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  output.on('close', () => {
    console.log(`Created zotero-auto-tagger-0.1.0.xpi (${archive.pointer()} bytes)`);
  });
  
  archive.on('error', (err) => {
    throw err;
  });
  
  archive.pipe(output);
  archive.directory('build/', false);
  archive.finalize();
}

release().catch(console.error);
