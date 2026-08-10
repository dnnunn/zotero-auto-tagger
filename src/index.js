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
        "autoTag.usingLLM": "Using local model for item without PubMed data...",
        "autoTag.ollamaUnreachable": "Cannot reach Ollama. Is it running? (ollama serve)",
        "autoTag.llmError": "Local model error: ${error}"
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

    // Local LLM tagging via Ollama. No API key, no per-token cost, no data
    // leaving the machine. Requires Ollama running with the configured model
    // pulled (`ollama pull qwen3:8b`).
    class OllamaAPI {
      constructor() {
        this.baseURL = (getPref('extensions.autoTagger.ollamaUrl')
                        || 'http://localhost:11434').replace(/\/$/, '');
        this.model = getPref('extensions.autoTagger.ollamaModel') || 'qwen3:8b';
      }

      async generateTags(item) {
        const metadata = {
          title: item.getField('title') || '',
          abstract: item.getField('abstractNote') || '',
          authors: this.getAuthors(item),
          publicationTitle: item.getField('publicationTitle') || '',
          date: item.getField('date') || '',
          itemType: item.itemType
        };

        const response = await this.callOllama(this.createPrompt(metadata));
        return this.parseTagsFromResponse(response);
      }

      getAuthors(item) {
        return item.getCreators()
          .filter(c => c.creatorType === 'author')
          .map(c => `${c.firstName} ${c.lastName}`.trim())
          .join(', ');
      }

      createPrompt(metadata) {
        return `Generate 5-10 keyword tags for this reference, for retrieval in a reference manager.

Title: ${metadata.title}
Authors: ${metadata.authors}
Abstract: ${metadata.abstract}
Publication: ${metadata.publicationTitle}
Date: ${metadata.date}
Type: ${metadata.itemType}

Cover main topics, methodologies, key concepts, and subject areas.
Respond with ONLY the keywords, one per line. No numbering, no explanation.`;
      }

      async callOllama(prompt) {
        const body = JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          // Qwen3 and other reasoning models emit <think> blocks by default.
          // Ask for them off; parseTagsFromResponse strips them regardless,
          // since older Ollama builds ignore this field.
          think: false,
          options: { temperature: 0.2, num_predict: 512 }
        });

        Zotero.debug(`Auto-Tagger: Calling Ollama (${this.model}) at ${this.baseURL}`);

        let response;
        try {
          response = await Zotero.HTTP.request('POST', `${this.baseURL}/api/generate`, {
            headers: { 'Content-Type': 'application/json' },
            body: body
          });
        } catch (e) {
          throw new Error(getString("autoTag.ollamaUnreachable"));
        }

        if (response.status !== 200) {
          Zotero.debug(`Auto-Tagger: Ollama error: ${response.responseText}`);
          throw new Error(`Ollama error: ${response.status} - ${response.responseText}`);
        }

        return JSON.parse(response.responseText);
      }

      parseTagsFromResponse(response) {
        let content = response.response || '';
        // Strip reasoning blocks before parsing, or the model's chain of
        // thought ends up as tags.
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        const tags = content
          .split('\n')
          .map(line => line.trim())
          // Drop list markers and numbering the model may add despite the prompt
          .map(line => line.replace(/^[-*\u2022]\s*/, '').replace(/^\d+[.)]\s*/, '').trim())
          .filter(line => line.length > 0 && line.length < 100)
          .filter(line => !line.endsWith(':'))   // drop headings like "Keywords:"
          .slice(0, 10);

        Zotero.debug(`Auto-Tagger: Parsed ${tags.length} tags from Ollama`);
        return tags;
      }
    }

    class AutoTagger {
      constructor() {
        this.initialized = false;
        this.pubmedAPI = null;
        this.ollamaAPI = null;
        Zotero.debug("Auto-Tagger: AutoTagger instance created");
      }

      async init() {
        if (this.initialized) return;

        Zotero.debug("Auto-Tagger: Initializing");

        // v0.3.0 migration: earlier versions stored an Anthropic API key in
        // plaintext in prefs.js. Tagging is local now, so the key is not just
        // unused but a liability sitting in a file that gets copied into
        // profile backups. Clear it on first run.
        for (const stale of ['claudeApiKey', 'claudeModel', 'claudeMinGapMs']) {
          try {
            if (getPref(`extensions.autoTagger.${stale}`) !== undefined) {
              Zotero.Prefs.clear(`extensions.autoTagger.${stale}`, true);
              Zotero.debug(`Auto-Tagger: cleared stale pref ${stale}`);
            }
          } catch (e) { /* pref absent or already cleared */ }
        }

        this.pubmedAPI = new PubMedAPI();
        this.ollamaAPI = new OllamaAPI();
        
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
          let taggedByLLM = 0;
          let skipped = 0;
          let errors = 0;
          let errorMessages = [];
          
          for (let i = 0; i < regularItems.length; i++) {
            const item = regularItems[i];
            const progress = getString("autoTag.processing")
              .replace("${current}", i + 1)
              .replace("${total}", regularItems.length);
            
            Zotero.debug(`Auto-Tagger: ${progress}`);
            
            try {
              const aiPrefixCheck = getPref('extensions.autoTagger.aiTagPrefix') ?? 'ai: ';

              // Resumability. A library-wide pass is measured in tens of hours;
              // without this, any interruption means starting over and
              // re-paying the inference cost for work already done. Skip items
              // that already carry an LLM tag unless explicitly re-tagging.
              if (!getPref('extensions.autoTagger.retagExisting')) {
                const already = item.getTags()
                  .some(t => t.tag && t.tag.startsWith(aiPrefixCheck));
                if (already) {
                  Zotero.debug(`Auto-Tagger: item ${item.id} already LLM-tagged, skipping`);
                  skipped++;
                  continue;
                }
              }

              const doi = item.getField('DOI');
              const pmid = item.getField('extra')?.match(/PMID:\s*(\d+)/)?.[1];

              let keywords = [];
              let aiKeywords = [];

              // Try PubMed first if DOI or PMID exists
              if (doi || pmid) {
                keywords = await this.pubmedAPI.getKeywords(doi, pmid);
              }

              // Source policy. Default 'both': MeSH gives controlled vocabulary,
              // the LLM adds the specific concepts MeSH lacks, and the two are
              // namespaced so they never merge. 'fallback' is the pre-0.4.0
              // behaviour — LLM only when PubMed returns nothing.
              const llmMode = getPref('extensions.autoTagger.llmMode') || 'both';
              const runLLM = llmMode === 'both'
                          || (llmMode === 'fallback' && keywords.length === 0);

              if (runLLM) {
                Zotero.debug(`Auto-Tagger: running Ollama for item ${item.id} (mode=${llmMode}, pubmed=${keywords.length})`);
                try {
                  aiKeywords = await this.ollamaAPI.generateTags(item);
                  if (aiKeywords.length > 0) {
                    taggedByLLM++;
                  }
                } catch (llmError) {
                  // Do not abort the whole run because one item failed. A
                  // library-wide pass is long; losing it to a single transient
                  // Ollama hiccup is worse than skipping the item.
                  errorMessages.push(`Item "${item.getField('title')}": ${llmError.message}`);
                  Zotero.debug(`Auto-Tagger: LLM failed for item ${item.id}, continuing`);
                }
              }

              if (keywords.length === 0 && aiKeywords.length === 0) {
                Zotero.debug(`Auto-Tagger: No keywords found for item ${item.id}`);
                errors++;
                continue;
              }

              // Namespace AI-generated tags so they stay distinguishable from
              // PubMed MeSH / author keywords. Without this the two sources
              // merge into one flat vocabulary and provenance is unrecoverable.
              const aiPrefix = getPref('extensions.autoTagger.aiTagPrefix') ?? 'ai: ';

              await Zotero.DB.executeTransaction(async function () {
                for (const keyword of keywords) {
                  item.addTag(keyword, 0);
                }
                for (const keyword of aiKeywords) {
                  item.addTag(`${aiPrefix}${keyword}`, 1);
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
          if (taggedByLLM > 0) {
            message += `\n${taggedByLLM} items tagged using the local model.`;
            if (skipped) message += `\n${skipped} already tagged, skipped.`;
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
