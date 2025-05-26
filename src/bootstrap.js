var chromeHandle;

function install(data, reason) {}

function uninstall(data, reason) {}

async function startup(data, reason) {
  // Wait for Zotero to be ready
  await Zotero.uiReadyPromise;
  
  // Register chrome package
  chromeHandle = Services.io.getProtocolHandler("resource")
    .QueryInterface(Components.interfaces.nsIResProtocolHandler);
  
  const aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  
  const manifestURI = Services.io.newURI(
    data.rootURI + "manifest.json"
  );
  
  chromeHandle.setSubstitution(
    "zotero-auto-tagger",
    Services.io.newURI(data.rootURI + "chrome/")
  );
  
  // Import and initialize the main module
  const { AutoTagger } = ChromeUtils.import(
    data.rootURI + "chrome/content/scripts/index.js"
  );
  
  Zotero.AutoTagger = new AutoTagger();
  await Zotero.AutoTagger.startup(data);
}

function shutdown(data, reason) {
  if (Zotero.AutoTagger) {
    Zotero.AutoTagger.shutdown();
  }
  
  // Unregister chrome package
  if (chromeHandle) {
    chromeHandle.setSubstitution("zotero-auto-tagger", null);
  }
}
