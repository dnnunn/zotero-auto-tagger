if (!Zotero.AutoTagger) {
  const { BasicTool } = ChromeUtils.import("chrome://zotero/content/modules/PluginToolkit.jsm");
  
  class AutoTagger {
    constructor() {
      this.id = "zotero-auto-tagger@dnnunn.github.io";
      this.version = "0.1.0";
      this.rootURI = "";
      this.initialized = false;
      this.toolkit = null;
      this.ui = null;
    }

    async startup({ id, version, rootURI }) {
      this.rootURI = rootURI;
      await Zotero.uiReadyPromise;
      
      // Import modules
      const { registerPrefs } = ChromeUtils.import(
        `${rootURI}modules/prefs.js`
      );
      const { AutoTaggerUI } = ChromeUtils.import(
        `${rootURI}modules/ui.js`
      );
      
      this.toolkit = new BasicTool();
      
      // Register preferences
      registerPrefs();
      
      // Initialize UI
      this.ui = new AutoTaggerUI(this.toolkit);
      await this.ui.init();
      
      this.initialized = true;
      Zotero.debug("Auto-Tagger initialized");
    }

    shutdown() {
      if (this.ui) {
        this.ui.uninit();
      }
      Zotero.debug("Auto-Tagger shutdown");
    }

    install(data, reason) {
      Zotero.debug("Auto-Tagger installed");
    }

    uninstall(data, reason) {
      Zotero.debug("Auto-Tagger uninstalled");
    }
  }

  Zotero.AutoTagger = new AutoTagger();
}
