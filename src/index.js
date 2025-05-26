import { BasicTool } from "zotero-plugin-toolkit";
import config from "./config.js";
import { registerPrefs } from "./modules/prefs.js";
import { AutoTaggerUI } from "./modules/ui.js";
import { TagGenerator } from "./modules/tagGenerator.js";

class AutoTagger {
  constructor() {
    this.id = config.addonID;
    this.version = config.version;
    this.rootURI = "";
    this.initialized = false;
  }

  async onStartup() {
    await Zotero.uiReady;
    
    this.toolkit = new BasicTool();
    
    // Register preferences
    registerPrefs();
    
    // Initialize UI
    this.ui = new AutoTaggerUI(this.toolkit);
    await this.ui.init();
    
    // Initialize tag generator
    this.tagGenerator = new TagGenerator();
    
    this.initialized = true;
    Zotero.debug(`${config.addonName} initialized`);
  }

  onShutdown() {
    if (this.ui) {
      this.ui.uninit();
    }
    Zotero.debug(`${config.addonName} shutdown`);
  }

  onInstall(version) {
    Zotero.debug(`${config.addonName} installed version ${version}`);
  }

  onUninstall(version) {
    Zotero.debug(`${config.addonName} uninstalled version ${version}`);
  }
}

Zotero.AutoTagger = new AutoTagger();

export default AutoTagger;
