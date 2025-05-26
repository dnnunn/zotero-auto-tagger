/* global Components, Services */
"use strict";

if (typeof Zotero == "undefined") {
  var Zotero = Components.classes["@zotero.org/Zotero;1"]
    .getService(Components.interfaces.nsISupports).wrappedJSObject;
}

var chromeHandle;

async function startup({ id, version, resourceURI, rootURI = resourceURI.spec }) {
  await Zotero.uiReadyPromise;
  
  Zotero.debug("Auto-Tagger: Starting up");

  // Register chrome package
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "autotagger", rootURI + "chrome/content/"],
  ]);

  // Load plugin code
  Services.scriptloader.loadSubScript(
    rootURI + "chrome/content/scripts/index.js",
    {}
  );
  
  Zotero.debug("Auto-Tagger: Initialized");
}

function shutdown() {
  Zotero.debug("Auto-Tagger: Shutting down");
  
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
  
  // Remove from Zotero namespace
  delete Zotero.AutoTagger;
}

function install(data, reason) {
  Zotero.debug("Auto-Tagger: Installed");
}

function uninstall(data, reason) {
  Zotero.debug("Auto-Tagger: Uninstalled");
}
