export class TagProcessor {
  constructor() {
    this.loadUserPreferences();
  }

  loadUserPreferences() {
    // Load user-defined synonyms, blacklist, etc.
    this.synonymMap = new Map();
    this.blacklist = new Set();
    
    // Load from preferences
    try {
      const synonyms = Zotero.Prefs.get('extensions.autoTagger.synonyms');
      if (synonyms) {
        const pairs = JSON.parse(synonyms);
        pairs.forEach(pair => {
          this.synonymMap.set(pair.from.toLowerCase(), pair.to);
        });
      }
    } catch (e) {}
    
    try {
      const blacklist = Zotero.Prefs.get('extensions.autoTagger.blacklist');
      if (blacklist) {
        const terms = JSON.parse(blacklist);
        terms.forEach(term => {
          this.blacklist.add(term.toLowerCase());
        });
      }
    } catch (e) {}
  }

  processTags(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }
    
    // Process each tag
    let processedTags = tags
      .filter(tag => tag && typeof tag === 'string')
      .map(tag => this.normalizeTag(tag))
      .filter(tag => tag && !this.blacklist.has(tag.toLowerCase()))
      .map(tag => this.applySynonyms(tag));
    
    // Remove duplicates (case-insensitive)
    const seen = new Map();
    processedTags = processedTags.filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.set(key, tag);
      return true;
    });
    
    // Apply max tags limit
    const maxTags = Zotero.Prefs.get('extensions.autoTagger.maxTags') || 10;
    return processedTags.slice(0, maxTags);
  }

  normalizeTag(tag) {
    // Trim whitespace
    tag = tag.trim();
    
    // Remove special characters at the beginning/end
    tag = tag.replace(/^[^\w]+|[^\w]+$/g, '');
    
    // Normalize whitespace
    tag = tag.replace(/\s+/g, ' ');
    
    // Title case option
    if (Zotero.Prefs.get('extensions.autoTagger.titleCaseTags')) {
      tag = this.toTitleCase(tag);
    }
    
    return tag;
  }

  applySynonyms(tag) {
    const lowerTag = tag.toLowerCase();
    if (this.synonymMap.has(lowerTag)) {
      return this.synonymMap.get(lowerTag);
    }
    return tag;
  }

  toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  suggestSimilarTags(tag, existingTags) {
    // Find similar existing tags using Levenshtein distance
    const suggestions = [];
    const maxDistance = 2;
    
    existingTags.forEach(existingTag => {
      const distance = this.levenshteinDistance(
        tag.toLowerCase(), 
        existingTag.toLowerCase()
      );
      
      if (distance <= maxDistance && distance > 0) {
        suggestions.push({
          tag: existingTag,
          distance: distance
        });
      }
    });
    
    // Sort by distance
    suggestions.sort((a, b) => a.distance - b.distance);
    
    return suggestions.map(s => s.tag);
  }

  levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }
}
