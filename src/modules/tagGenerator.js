import { PubMedAPI } from './pubmedAPI.js';
import { ClaudeAPI } from './claudeAPI.js';
import { TagCache } from './tagCache.js';
import { TagProcessor } from './tagProcessor.js';

export class TagGenerator {
  constructor() {
    this.pubmedAPI = new PubMedAPI();
    this.claudeAPI = null; // Initialize when API key is provided
    this.cache = new TagCache();
    this.processor = new TagProcessor();
  }

  async generateTags(item) {
    if (!item || !item.isRegularItem()) {
      return [];
    }
    
    // Create a cache key
    const doi = item.getField('DOI');
    const title = item.getField('title');
    const cacheKey = doi || title;
    
    if (!cacheKey) {
      Zotero.debug('No DOI or title for caching');
      return [];
    }
    
    // Check cache first
    const cachedTags = await this.cache.get(cacheKey);
    if (cachedTags && cachedTags.length > 0) {
      Zotero.debug(`Using cached tags for: ${cacheKey}`);
      return cachedTags;
    }
    
    let tags = [];
    
    // Try PubMed first if enabled
    if (Zotero.Prefs.get('extensions.autoTagger.usePubMed') !== false) {
      try {
        Zotero.debug('Attempting to get tags from PubMed...');
        tags = await this.pubmedAPI.getKeywords(item);
        
        if (tags.length > 0) {
          Zotero.debug(`Found ${tags.length} tags from PubMed`);
        }
      } catch (error) {
        Zotero.debug(`PubMed error: ${error.message}`);
      }
    }
    
    // Use Claude if enabled and no PubMed results (or to supplement)
    if (Zotero.Prefs.get('extensions.autoTagger.useClaude') && 
        (tags.length === 0 || Zotero.Prefs.get('extensions.autoTagger.supplementWithAI'))) {
      
      const apiKey = Zotero.Prefs.get('extensions.autoTagger.claudeAPIKey');
      if (apiKey) {
        if (!this.claudeAPI) {
          this.claudeAPI = new ClaudeAPI(apiKey);
        }
        
        try {
          const aiTags = await this.claudeAPI.generateTags(item);
          tags = [...new Set([...tags, ...aiTags])]; // Merge and deduplicate
        } catch (error) {
          Zotero.debug(`Claude API error: ${error.message}`);
        }
      }
    }
    
    // Process tags (clean, normalize, etc.)
    tags = this.processor.processTags(tags);
    
    // Cache results
    if (tags.length > 0) {
      await this.cache.set(cacheKey, tags);
    }
    
    return tags;
  }

  async applyTagsToItem(item, tags) {
    if (!item || !tags || tags.length === 0) {
      return false;
    }
    
    try {
      // Begin transaction
      await Zotero.DB.executeTransaction(async function () {
        for (const tag of tags) {
          item.addTag(tag, 0); // 0 = automatic tag
        }
        await item.save();
      });
      
      return true;
    } catch (error) {
      Zotero.debug(`Failed to apply tags: ${error.message}`);
      return false;
    }
  }

  async tagItems(items, progressCallback) {
    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (progressCallback) {
        progressCallback(i + 1, items.length, item);
      }
      
      // Skip items that already have tags if preference is set
      if (Zotero.Prefs.get('extensions.autoTagger.skipTaggedItems') && 
          item.getTags().length > 0) {
        results.skipped++;
        continue;
      }
      
      try {
        const tags = await this.generateTags(item);
        
        if (tags.length > 0) {
          const success = await this.applyTagsToItem(item, tags);
          if (success) {
            results.success++;
          } else {
            results.failed++;
          }
        } else {
          results.skipped++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        Zotero.debug(`Error tagging item ${item.key}: ${error.message}`);
        results.failed++;
      }
    }
    
    return results;
  }
}
