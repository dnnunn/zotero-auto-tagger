// prefDefaults.js - loaded into AutoTagger scope
(function() {
  this.registerPreferences = function() {
    const prefs = {
      "extensions.autoTagger.apiKey": "",
      "extensions.autoTagger.maxTags": 5,
      "extensions.autoTagger.useCache": true,
      "extensions.autoTagger.cacheExpiry": 86400000, // 24 hours
      "extensions.autoTagger.autoTagOnAdd": false
    };
    
    for (let [key, value] of Object.entries(prefs)) {
      if (typeof Zotero.Prefs.get(key) === 'undefined') {
        Zotero.Prefs.set(key, value);
      }
    }
  };
}).call(this);
