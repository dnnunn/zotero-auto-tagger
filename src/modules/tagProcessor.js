// tagProcessor.js - loaded into AutoTagger scope
(function() {
  const TagProcessor = class {
    constructor() {
      this.synonymMap = new Map();
      this.blacklist = new Set();
      this.loadUserPreferences();
    }

    loadUserPreferences() {
      // Load user-defined synonyms, blacklist, etc.
      try {
        const synonyms = Zotero.Prefs.get('extensions.autoTagger.synonyms');
        if (synonyms) {
          const pairs = JSON.parse(synonyms);
          pairs.forEach(pair => {
            this.synonymMap.set(pair.from.toLowerCase(), pair.to);
          });
        }
      } catch (e) {
        Zotero.debug('Failed to load synonyms: ' + e);
      }
      
      try {
        const blacklist = Zotero.Prefs.get('extensions.autoTagger.blacklist');
        if (blacklist) {
          const terms = JSON.parse(blacklist);
          terms.forEach(term => this.blacklist.add(term.toLowerCase()));
        }
      } catch (e) {
        Zotero.debug('Failed to load blacklist: ' + e);
      }
    }

    async process(tags) {
      if (!Array.isArray(tags)) return [];
      
      return tags
        .map(tag => this.normalizeTag(tag))
        .filter(tag => tag && !this.isBlacklisted(tag))
        .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
    }

    normalizeTag(tag) {
      if (!tag || typeof tag !== 'string') return null;
      
      // Trim and normalize whitespace
      tag = tag.trim().replace(/\s+/g, ' ');
      
      // Apply synonyms
      const lower = tag.toLowerCase();
      if (this.synonymMap.has(lower)) {
        tag = this.synonymMap.get(lower);
      }
      
      // Capitalize first letter
      tag = tag.charAt(0).toUpperCase() + tag.slice(1);
      
      return tag;
    }

    isBlacklisted(tag) {
      return this.blacklist.has(tag.toLowerCase());
    }
  };
  
  // Attach to parent scope
  this.TagProcessor = TagProcessor;
}).call(this);
