// prefs.js - loaded into AutoTagger scope
(function() {
  // First load the prefDefaults
  if (this.rootURI) {
    Services.scriptloader.loadSubScript(
      this.rootURI + 'chrome/content/scripts/modules/prefDefaults.js',
      this
    );
  }
  
  this.registerPrefs = function() {
    // Register default preferences if function exists
    if (typeof this.registerPreferences === 'function') {
      this.registerPreferences();
    }
    
    // Register preference pane
    const prefOptions = {
      pluginID: "autoTagger",
      src: this.rootURI + "chrome/content/preferences/index.xhtml",
      label: "Auto-Tagger Preferences",
      image: this.rootURI + "chrome/content/icons/icon@32px.png",
      defaultXUL: true
    };
    
    Zotero.PreferencePanes.register(prefOptions);
  };
}).call(this);
