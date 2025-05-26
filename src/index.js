// Define AutoTagger in the global scope so bootstrap.js can access it
var AutoTagger;

(function() {
  // Check if we're in the right context
  if (typeof Zotero === 'undefined') {
    return;
  }

  AutoTagger = class {
    constructor() {
      this.id = "zotero-auto-tagger@dnnunn.github.io";
      this.version = "0.1.0";
      this.rootURI = "";
      this.initialized = false;
      this.ui = null;
      this.prefs = null;
      this.tagGenerator = null;
    }

    async startup({ id, version, rootURI }) {
      this.rootURI = rootURI;
      await Zotero.uiReadyPromise;
      
      try {
        // Load all modules in correct order
        const modules = [
          'modules/prefDefaults.js',
          'modules/prefs.js',
          'modules/tagProcessor.js',
          'modules/tagCache.js',
          'modules/pubmedAPI.js',
          'modules/tagGenerator.js',
          'modules/ui.js'
        ];
        
        for (const module of modules) {
          Services.scriptloader.loadSubScript(
            `${rootURI}chrome/content/${module}`,
            this
          );
        }
        
        // Initialize components
        if (typeof this.registerPrefs === 'function') {
          this.registerPrefs();
        }
        
        if (typeof this.TagGenerator === 'function') {
          this.tagGenerator = new this.TagGenerator();
          // Pass loaded modules to TagGenerator
          this.tagGenerator.PubMedAPI = this.PubMedAPI;
          this.tagGenerator.TagCache = this.TagCache;
          this.tagGenerator.TagProcessor = this.TagProcessor;
        }
        
        if (typeof this.UI === 'function') {
          this.ui = new this.UI(this);
          await this.ui.init();
        }
        
        this.initialized = true;
        Zotero.log("Zotero Auto-Tagger: Startup complete", "info");
        
      } catch (e) {
        Zotero.logError(e);
        Zotero.log("Zotero Auto-Tagger: Startup failed - " + e.message, "error");
      }
    }

    shutdown() {
      if (this.ui) {
        this.ui.shutdown();
      }
      this.initialized = false;
      Zotero.log("Zotero Auto-Tagger: Shutdown complete", "info");
    }

    async tagSelectedItems() {
      try {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        if (!items || items.length === 0) {
          alert("Please select at least one item to tag.");
          return;
        }
        
        let tagged = 0;
        for (const item of items) {
          const tags = await this.tagGenerator.generateTags(item);
          if (tags && tags.length > 0) {
            for (const tag of tags) {
              item.addTag(tag);
            }
            await item.saveTx();
            tagged++;
          }
        }
        
        alert(`Tagged ${tagged} of ${items.length} items.`);
      } catch (e) {
        Zotero.logError(e);
        alert("Error tagging items: " + e.message);
      }
    }
  };
})();
