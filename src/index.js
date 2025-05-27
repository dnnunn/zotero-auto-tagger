"use strict";

if (typeof Zotero !== 'undefined') {
  Zotero.debug("Auto-Tagger: index.js loaded");
}

(() => {
  try {
    const config = {
      addonName: "Zotero Auto-Tagger",
      addonID: "zotero-auto-tagger@dnnunn.github.io",
      addonRef: "autotagger",
      addonInstance: "AutoTagger"
    };

    function getString(key) {
      const strings = {
        "menu.autoTag": "Auto-Tag Items",
        "menu.autoTagSelected": "Auto-Tag Selected Items",
        "autoTag.title": "Auto-Tagger",
        "autoTag.noItems": "No items selected",
        "autoTag.complete": "Tagged ${count} items",
        "autoTag.error": "Error tagging items: ${error}",
        "autoTag.processing": "Processing ${current} of ${total} items...",
        "autoTag.usingClaude": "Using Claude AI for item without PubMed data...",
        "autoTag.noApiKey": "No Claude API key configured. Please set it in Zotero preferences.",
        "autoTag.claudeError": "Claude API error: ${error}"
      };
      return strings[key] || key;
    }

    // Helper function to get preferences
    function getPref(key) {
      try {
        return Services.prefs.getCharPref(key);
      } catch (e) {
        return null;
      }
    }

    // Helper function to show dialogs
    function showMessage(message, title = "Auto-Tagger") {
      const win = Zotero.getMainWindow();
      if (win && win.alert) {
        win.alert(message);
      } else {
        // Fallback to Zotero Services prompt
        const ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
          .getService(Components.interfaces.nsIPromptService);
        ps.alert(null, title, message);
      }
    }

    function registerMenus() {
      Zotero.debug("Auto-Tagger: Registering menus");
      const doc = Zotero.getMainWindow().document;
      
      const toolsMenu = doc.getElementById("menu_ToolsPopup");
      if (toolsMenu) {
        const menuitem = doc.createXULElement("menuitem");
        menuitem.id = `${config.addonRef}-tools-menu`;
        menuitem.setAttribute("label", getString("menu.autoTag"));
        menuitem.setAttribute("oncommand", "Zotero.AutoTagger.tagSelectedItems();");
        toolsMenu.appendChild(menuitem);
        Zotero.debug("Auto-Tagger: Added to Tools menu");
      }
      
      const itemMenu = doc.getElementById("zotero-itemmenu");
      if (itemMenu) {
        const menuitem = doc.createXULElement("menuitem");
        menuitem.id = `${config.addonRef}-item-menu`;
        menuitem.setAttribute("label", getString("menu.autoTagSelected"));
        menuitem.setAttribute("oncommand", "Zotero.AutoTagger.tagSelectedItems();");
        itemMenu.appendChild(menuitem);
        Zotero.debug("Auto-Tagger: Added to item context menu");
      }
    }

    class PubMedAPI {
      constructor() {
        this.baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
        this.toolName = 'ZoteroAutoTagger';
        this.email = 'dnnunn@gmail.com';
        this.apiKey = getPref('extensions.autoTagger.pubmedApiKey');
        this.rateLimit = 350;
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
          if (!pmid && doi) {
            pmid = await this.getPMIDFromDOI(doi);
          }
          
          if (!pmid) {
            Zotero.debug('Auto-Tagger: No PMID found for item');
            return [];
          }
          
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
        
        const meshTerms = doc.querySelectorAll('MeshHeading > DescriptorName');
        meshTerms.forEach(term => {
          const keyword = term.textContent.trim();
          if (keyword) keywords.push(keyword);
        });
        
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

    class ClaudeAPI {
      constructor() {
        this.baseURL = 'https://api.anthropic.com/v1/messages';
        this.apiKey = getPref('extensions.autoTagger.claudeApiKey');
        this.model = 'claude-3-haiku-20240307';
        this.lastClaudeCall = 0; // Using Haiku for cost efficiency
      }

      async generateTags(item) {
        if (!this.apiKey) {
          Zotero.debug('Auto-Tagger: No Claude API key configured');
          throw new Error(getString("autoTag.noApiKey"));
        }

        try {
          // Gather item metadata
          const metadata = {
            title: item.getField('title') || '',
            abstract: item.getField('abstractNote') || '',
            authors: this.getAuthors(item),
            publicationTitle: item.getField('publicationTitle') || '',
            date: item.getField('date') || '',
            itemType: item.itemType
          };

          Zotero.debug(`Auto-Tagger: Claude metadata: ${JSON.stringify(metadata)}`);

          // Create prompt
          const prompt = this.createPrompt(metadata);

          // Make API request
          const now = Date.now();
          if (this.lastClaudeCall && (now - this.lastClaudeCall) < 12000) {
            const wait = 12000 - (now - this.lastClaudeCall);
            Zotero.debug(`Auto-Tagger: Rate limit - waiting ${wait}ms`);
            await new Promise(r => setTimeout(r, wait));
          }
          this.lastClaudeCall = Date.now();
          const response = await this.callClaudeAPI(prompt);
          
          // Parse response to extract tags
          return this.parseTagsFromResponse(response);
        } catch (error) {
          Zotero.logError(error);
          Zotero.debug(`Auto-Tagger: Claude API error - ${error.message}`);
          throw error;
        }
      }

      getAuthors(item) {
        const creators = item.getCreators();
        return creators
          .filter(creator => creator.creatorType === 'author')
          .map(creator => `${creator.firstName} ${creator.lastName}`.trim())
          .join(', ');
      }

      createPrompt(metadata) {
        return `Please analyze the following academic item and generate relevant keyword tags for categorization in a reference manager. Generate 5-10 specific, relevant keywords that would help someone find this item when searching their library.

Title: ${metadata.title}
Authors: ${metadata.authors}
Abstract: ${metadata.abstract}
Publication: ${metadata.publicationTitle}
Date: ${metadata.date}
Type: ${metadata.itemType}

Please respond with ONLY the keywords, one per line, without any explanation or additional text. Focus on:
- Main topics and themes
- Methodologies mentioned
- Key concepts
- Subject areas
- Important terms from the title and abstract`;
      }

      async callClaudeAPI(prompt) {
        const headers = {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'anthropic-version': '2023-06-01'
        };

        const body = JSON.stringify({
          model: this.model,
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        Zotero.debug(`Auto-Tagger: Calling Claude API with model ${this.model}`);

        const response = await Zotero.HTTP.request('POST', this.baseURL, {
          headers: headers,
          body: body
        });

        if (response.status !== 200) {
          Zotero.debug(`Auto-Tagger: Claude API error response: ${response.responseText}`);
          throw new Error(`Claude API error: ${response.status} - ${response.responseText}`);
        }

        return JSON.parse(response.responseText);
      }

      parseTagsFromResponse(response) {
        try {
          const content = response.content[0].text;
          Zotero.debug(`Auto-Tagger: Claude response: ${content}`);
          
          const tags = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.length < 100) // Basic validation
            .slice(0, 10); // Limit to 10 tags
          
          Zotero.debug(`Auto-Tagger: Parsed ${tags.length} tags from Claude`);
          return tags;
        } catch (error) {
          Zotero.debug('Auto-Tagger: Error parsing Claude response');
          throw error;
        }
      }
    }

    class AutoTagger {
      constructor() {
        this.initialized = false;
        this.pubmedAPI = null;
        this.claudeAPI = null;
        Zotero.debug("Auto-Tagger: AutoTagger instance created");
      }

      async init() {
        if (this.initialized) return;
        
        Zotero.debug("Auto-Tagger: Initializing");
        
        this.pubmedAPI = new PubMedAPI();
        this.claudeAPI = new ClaudeAPI();
        
        registerMenus();
        
        this.initialized = true;
        Zotero.debug("Auto-Tagger: Initialization complete");
      }

      async tagSelectedItems() {
        try {
          const items = Zotero.getActiveZoteroPane().getSelectedItems();
          if (!items || items.length === 0) {
            showMessage(getString("autoTag.noItems"));
            return;
          }
          
          const regularItems = items.filter(item => item.isRegularItem());
          if (regularItems.length === 0) {
            showMessage("No regular items selected");
            return;
          }
          
          Zotero.debug(`Auto-Tagger: Processing ${regularItems.length} items`);
          
          let tagged = 0;
          let taggedByClaude = 0;
          let errors = 0;
          let errorMessages = [];
          
          for (let i = 0; i < regularItems.length; i++) {
            const item = regularItems[i];
            const progress = getString("autoTag.processing")
              .replace("${current}", i + 1)
              .replace("${total}", regularItems.length);
            
            Zotero.debug(`Auto-Tagger: ${progress}`);
            
            try {
              const doi = item.getField('DOI');
              const pmid = item.getField('extra')?.match(/PMID:\s*(\d+)/)?.[1];
              
              let keywords = [];
              
              // Try PubMed first if DOI or PMID exists
              if (doi || pmid) {
                keywords = await this.pubmedAPI.getKeywords(doi, pmid);
              }
              
              // If no keywords from PubMed, try Claude
              if (keywords.length === 0) {
                Zotero.debug(`Auto-Tagger: No PubMed keywords for item ${item.id}, trying Claude...`);
                try {
                  keywords = await this.claudeAPI.generateTags(item);
                  if (keywords.length > 0) {
                    taggedByClaude++;
                  }
                } catch (claudeError) {
                  errorMessages.push(`Item "${item.getField('title')}": ${claudeError.message}`);
                  throw claudeError;
                }
              }
              
              if (keywords.length === 0) {
                Zotero.debug(`Auto-Tagger: No keywords found for item ${item.id}`);
                errors++;
                continue;
              }
              
              await Zotero.DB.executeTransaction(async function () {
                for (const keyword of keywords) {
                  item.addTag(keyword, 0);
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
          
          let message = getString("autoTag.complete").replace("${count}", tagged);
          if (taggedByClaude > 0) {
            message += `\n${taggedByClaude} items tagged using Claude AI.`;
          }
          if (errors > 0) {
            message += `\n${errors} items failed to process.`;
            if (errorMessages.length > 0) {
              message += `\n\nErrors:\n${errorMessages.join('\n')}`;
            }
          }
          showMessage(message);
          
        } catch (e) {
          Zotero.logError(e);
          showMessage(getString("autoTag.error").replace("${error}", e.message));
        }
      }
    }

    Zotero.AutoTagger = new AutoTagger();
    Zotero.AutoTagger.init();
    
    Zotero.debug("Auto-Tagger: Script completed");
  } catch (e) {
    Zotero.logError(e);
    Zotero.debug("Auto-Tagger: Error in index.js - " + e.message);
  }
})();
