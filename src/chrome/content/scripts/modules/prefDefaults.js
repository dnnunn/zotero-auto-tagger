// prefDefaults.js - loaded into AutoTagger scope
(function() {
  this.registerPreferences = function() {
    const prefs = {
      "extensions.zotero.autoTagger.apiKey": "",
      "extensions.zotero.autoTagger.maxTags": 5,
      "extensions.zotero.autoTagger.useCache": true,
      "extensions.zotero.autoTagger.cacheExpiry": 86400000, // 24 hours
      "extensions.zotero.autoTagger.autoTagOnAdd": false
    };
    
    for (let [key, value] of Object.entries(prefs)) {
      if (typeof Zotero.Prefs.get(key) === 'undefined') {
        Zotero.Prefs.set(key, value);
      }
    }
  };
}).call(this);
