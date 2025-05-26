"use strict";

if (typeof Zotero !== 'undefined') {
  Zotero.debug("Auto-Tagger: index.js loaded");
}

(() => {
  try {
    // Configuration
    const config = {
      addonName: "Zotero Auto-Tagger",
      addonID: "zotero-auto-tagger@dnnunn.github.io",
      addonRef: "autotagger",
      addonInstance: "AutoTagger"
    };

    // Simple string helper
    function getString(key) {
      const strings = {
        "menu.autoTag": "Auto-Tag Items",
        "menu.autoTagSelected": "Auto-Tag Selected Items",
        "autoTag.title": "Auto-Tagger",
        "autoTag.noItems": "No items selected",
        "autoTag.complete": "Tagged ${count} items",
        "autoTag.error": "Error tagging items: ${error}",
        "autoTag.processing": "Processing ${current} of ${total} items..."
      };
      return strings[key] || key;
    }

    // Register menu items
    function registerMenus() {
      Zotero.debug("Auto-Tagger: Registering menus");
      const doc = Zotero.getMainWindow().document;
      
      // Tools menu
      const toolsMenu = doc.getElementById("menu_ToolsPopup");
      if (toolsMenu) {
        const menuitem = doc.createXULElement("menuitem");
        menuitem.id = `${config.addonRef}-tools-menu`;
        menuitem.setAttribute("label", getString("menu.autoTag"));
        menuitem.setAttribute("oncommand", "Zotero.AutoTagger.tagSelectedItems();");
        toolsMenu.appendChild(menuitem);
        Zotero.debug("Auto-Tagger: Added to Tools menu");
      } else {
        Zotero.debug("Auto-Tagger: Tools menu not found");
      }
      
      // Item context menu
      const itemMenu = doc.getElementById("zotero-itemmenu");
      if (itemMenu) {
        const menuitem = doc.createXULElement("menuitem");
        menuitem.id = `${config.addonRef}-item-menu`;
        menuitem.setAttribute("label", getString("menu.autoTagSelected"));
        menuitem.setAttribute("oncommand", "Zotero.AutoTagger.tagSelectedItems();");
        itemMenu.appendChild(menuitem);
        Zotero.debug("Auto-Tagger: Added to item context menu");
      } else {
        Zotero.debug("Auto-Tagger: Item menu not found");
      }
    }

    // PubMed API class
    class PubMedAPI {
      constructor() {
        this.baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
        this.toolName = 'ZoteroAutoTagger';
        this.email = 'dnnunn@gmail.com';
        this.apiKey = Zotero.Prefs.get('extensions.autoTagger.pubmedApiKey') || null;
        this.rateLimit = 350; // milliseconds between requests
        this.lastRequest = 0;
      }

      async _rateLimitedFetch(url) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;
        
        if (timeSinceLastRequest < this.rateLimit) {
          await new Promise(resolve => 
            setTimeout(resolve, this.rateLimit - timeSinceLastRequest)
          );
        }
        
        this.lastRequest = Date.now();
        
        try {
          const response = await Zotero.HTTP.request('GET', url);
          if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.responseText;
        } catch (error) {
          Zotero.logError(error);
          throw error;
        }
      }

      async getKeywords(doi, pmid) {
        try {
          // First, get PMID if we only have DOI
          if (!pmid && doi) {
            pmid = await this.getPMIDFromDOI(doi);
          }
          
          if (!pmid) {
            Zotero.debug('Auto-Tagger: No PMID found for item');
            return [];
          }
          
          // Fetch article details
          const details = await this.fetchArticleDetails(pmid);
          return this.extractKeywords(details);
        } catch (error) {
          Zotero.logError(error);
          return [];
        }
      }

      async getPMIDFromDOI(doi) {
        const searchUrl = `${this.baseURL}esearch.fcgi?` +
          `db=pubmed&term=${encodeURIComponent(doi)}[DOI]&retmode=json` +
          `&tool=${this.toolName}&email=${this.email}` +
          (this.apiKey ? `&api_key=${this.apiKey}` : '');
        
        const response = await this._rateLimitedFetch(searchUrl);
        const data = JSON.parse(response);
        
        if (data.esearchresult && data.esearchresult.idlist && data.esearchresult.idlist.length > 0) {
          return data.esearchresult.idlist[0];
        }
        
        return null;
      }

      async fetchArticleDetails(pmid) {
        const fetchUrl = `${this.baseURL}efetch.fcgi?` +
          `db=pubmed&id=${pmid}&retmode=xml` +
          `&tool=${this.toolName}&email=${this.email}` +
          (this.apiKey ? `&api_key=${this.apiKey}` : '');
        
        return await this._rateLimitedFetch(fetchUrl);
      }

      extractKeywords(xmlResponse) {
        const keywords = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlResponse, 'text/xml');
        
        // Extract MeSH terms
        const meshTerms = doc.querySelectorAll('MeshHeading > DescriptorName');
        meshTerms.forEach(term => {
          const keyword = term.textContent.trim();
          if (keyword) keywords.push(keyword);
        });
        
        // Extract keywords
        const keywordNodes = doc.querySelectorAll('Keyword');
        keywordNodes.forEach(node => {
          const keyword = node.textContent.trim();
          if (keyword && !keywords.includes(keyword)) {
            keywords.push(keyword);
          }
        });
        
        return keywords;
      }
    }

    // Main class
    class AutoTagger {
      constructor() {
        this.initialized = false;
        this.pubmedAPI = null;
        Zotero.debug("Auto-Tagger: AutoTagger instance created");
      }

      async init() {
        if (this.initialized) return;
        
        Zotero.debug("Auto-Tagger: Initializing");
        
        // Initialize PubMed API
        this.pubmedAPI = new PubMedAPI();
        
        // Register UI
        registerMenus();
        
        this.initialized = true;
        Zotero.debug("Auto-Tagger: Initialization complete");
      }

      async tagSelectedItems() {
        try {
          const items = Zotero.getActiveZoteroPane().getSelectedItems();
          if (!items || items.length === 0) {
            alert(getString("autoTag.noItems"));
            return;
          }
          
          // Filter to regular items only
          const regularItems = items.filter(item => item.isRegularItem());
          if (regularItems.length === 0) {
            alert("No regular items selected");
            return;
          }
          
          Zotero.debug(`Auto-Tagger: Processing ${regularItems.length} items`);
          
          let tagged = 0;
          let errors = 0;
          
          // Process each item
          for (let i = 0; i < regularItems.length; i++) {
            const item = regularItems[i];
            const progress = getString("autoTag.processing")
              .replace("${current}", i + 1)
              .replace("${total}", regularItems.length);
            
            Zotero.debug(`Auto-Tagger: ${progress}`);
            
            try {
              // Get DOI
              const doi = item.getField('DOI');
              const pmid = item.getField('extra')?.match(/PMID:\s*(\d+)/)?.[1];
              
              if (!doi && !pmid) {
                Zotero.debug(`Auto-Tagger: Item ${item.id} has no DOI or PMID`);
                errors++;
                continue;
              }
              
              // Get keywords from PubMed
              const keywords = await this.pubmedAPI.getKeywords(doi, pmid);
              
              if (keywords.length === 0) {
                Zotero.debug(`Auto-Tagger: No keywords found for item ${item.id}`);
                errors++;
                continue;
              }
              
              // Add tags to item
              await Zotero.DB.executeTransaction(async function () {
                for (const keyword of keywords) {
                  item.addTag(keyword, 0); // 0 = automatic tag
                }
                await item.save();
              });
              
              tagged++;
              Zotero.debug(`Auto-Tagger: Tagged item ${item.id} with ${keywords.length} keywords`);
              
            } catch (e) {
              errors++;
              Zotero.logError(e);
              Zotero.debug(`Auto-Tagger: Error processing item ${item.id}: ${e.message}`);
            }
          }
          
          // Report results
          let message = getString("autoTag.complete").replace("${count}", tagged);
          if (errors > 0) {
            message += `\n${errors} items failed to process.`;
          }
          alert(message);
          
        } catch (e) {
          Zotero.logError(e);
          alert(getString("autoTag.error").replace("${error}", e.message));
        }
      }
    }

    // Initialize
    Zotero.AutoTagger = new AutoTagger();
    Zotero.AutoTagger.init();
    
    Zotero.debug("Auto-Tagger: Script completed");
  } catch (e) {
    Zotero.logError(e);
    Zotero.debug("Auto-Tagger: Error in index.js - " + e.message);
  }
})();
