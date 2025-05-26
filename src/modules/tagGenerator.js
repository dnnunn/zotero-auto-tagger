export class TagGenerator {
  constructor() {
    this.pubmedAPI = new PubMedAPI();
    this.claudeAPI = null; // Initialize when API key is provided
    this.cache = new TagCache();
  }

  async generateTags(item) {
    const doi = item.getField('DOI');
    const title = item.getField('title');
    const abstract = item.getField('abstractNote');
    
    // Check cache first
    const cachedTags = await this.cache.get(doi || title);
    if (cachedTags) {
      return cachedTags;
    }
    
    let tags = [];
    
    // Try PubMed first if DOI exists
    if (doi && Zotero.Prefs.get('autoTagger.usePubMed')) {
      tags = await this.pubmedAPI.getKeywords(doi);
    }
    
    // Use Claude if enabled and no PubMed results
    if (tags.length === 0 && Zotero.Prefs.get('autoTagger.useClaude')) {
      tags = await this.claudeAPI.generateTags(title, abstract);
    }
    
    // Cache results
    await this.cache.set(doi || title, tags);
    
    return tags;
  }
}

class PubMedAPI {
  async getKeywords(doi) {
    // PubMed API implementation
    return [];
  }
}

class TagCache {
  async get(key) {
    // Cache implementation
    return null;
  }
  
  async set(key, value) {
    // Cache implementation
  }
}
