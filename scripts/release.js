const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');
const config = require('../src/config.js').default;

async function release() {
  // First build
  require('./build.js');
  
  // Wait for build to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Create XPI
  const output = fs.createWriteStream(`zotero-auto-tagger-${config.version}.xpi`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  output.on('close', () => {
    console.log(`Created zotero-auto-tagger-${config.version}.xpi (${archive.pointer()} bytes)`);
  });
  
  archive.pipe(output);
  archive.directory('build/', false);
  archive.finalize();
}

release().catch(console.error);
