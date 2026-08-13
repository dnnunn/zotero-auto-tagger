// Full release build: clean -> build -> package.
//
// This used to reimplement packaging itself and got it wrong in three ways: it
// hardcoded version 0.1.0 in the XPI name, it archived `build/` rather than
// `build/addon/` (so manifest.json landed one directory below the archive root,
// and any previously-built XPI in `build/xpi/` was bundled into the new one),
// and it "waited" for the build with a 2-second sleep because `require`-ing
// build.js returns nothing to await. The result was a wrongly-named, unloadable
// plugin — which is how the published release drifted out of step with the code.
//
// It now delegates to build.js and package.js, which already read the version
// from package.json and write the correct layout. Keep it that way: packaging
// logic belongs in one place.

const path = require('path');
const fs = require('fs-extra');
const { execFileSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const version = require(path.join(projectRoot, 'package.json')).version;

function run(script) {
  execFileSync(process.execPath, [path.join(__dirname, script)], {
    cwd: projectRoot,
    stdio: 'inherit'
  });
}

async function release() {
  console.log(`Releasing v${version}...`);

  // Clean first. A stale build directory is exactly how you ship the previous
  // version's code under the current version's filename.
  await fs.remove(path.join(projectRoot, 'build'));

  run('build.js');
  run('package.js');

  const xpi = path.join(projectRoot, 'build', 'xpi',
                        `zotero-auto-tagger-v${version}.xpi`);
  if (!fs.existsSync(xpi)) {
    throw new Error(`Expected XPI not found: ${xpi}`);
  }

  console.log(`\nRelease artefact: ${path.relative(projectRoot, xpi)}`);
  console.log(`Next: bump update.json to ${version}, then`);
  console.log(`  gh release create v${version} ${path.relative(projectRoot, xpi)}`);
}

release().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
