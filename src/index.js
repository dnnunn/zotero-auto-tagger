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

    // Controlled facet vocabulary, emitted alongside the free-text topical tags
    // as `key:value` pairs.
    //
    // These four exist because free-text topical tags cannot express the things
    // that decide whether a paper actually supports a claim. A worked example:
    // McClanahan 2025 (milk osteopontin / gut IELs) reads as supporting evidence
    // from its abstract, but is a knockout-deprivation design — it shows that
    // REMOVING osteopontin changes the gut, not that adding it helps. Topical
    // tags cannot distinguish that from a supplementation trial; `exposure:` can.
    // Likewise `lifestage:`, which separates neonatal-model evidence from the
    // adult claims it is being used to support.
    //
    // Values are enforced in code, not merely requested in the prompt: a local
    // 8B model will occasionally invent one, and a hallucinated facet is worse
    // than a missing one because it looks like signal downstream.
    const FACET_VOCAB = {
      design:      ['in-vitro', 'organoid', 'ex-vivo', 'animal-invivo',
                    'human-trial', 'observational', 'review', 'meta-analysis'],
      exposure:    ['supplementation', 'deprivation', 'knockout',
                    'association', 'none'],
      lifestage:   ['neonatal', 'infant', 'juvenile', 'adult', 'aged', 'mixed'],
      testarticle: ['bovine', 'human', 'recombinant', 'milk-derived',
                    'peptide', 'synthetic', 'not-stated']
    };

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
        const facetSpec = Object.entries(FACET_VOCAB)
          .map(([key, values]) => `${key}:  one of  ${values.join(', ')}`)
          .join('\n');

        return `Generate tags for this reference, for retrieval in a reference manager.

Title: ${metadata.title}
Authors: ${metadata.authors}
Abstract: ${metadata.abstract}
Publication: ${metadata.publicationTitle}
Date: ${metadata.date}
Type: ${metadata.itemType}

Respond with two kinds of line, and nothing else. No headings, no numbering,
no explanation.

FIRST: 5-10 topical keywords, one per line, covering main topics,
methodologies, key concepts and subject areas.

THEN: study-characteristic facets, one per line, in the exact form key:value,
using ONLY these keys and values:

${facetSpec}

Rules for the facets:
- Emit a facet only if the abstract states or clearly implies it.
- If it is unclear, omit that line entirely. Do NOT guess.
- Use several lines for the same key if more than one value applies.
- exposure: describes what was done to the subject — whether the study ADDED
  the substance (supplementation), REMOVED it (deprivation, knockout), or only
  observed a correlation (association).
- testarticle: describes the substance actually tested, not the topic of the
  paper. Use not-stated if the source or form is never specified.`;
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

        const raw = content
          .split('\n')
          .map(line => line.trim())
          // Drop list markers and numbering the model may add despite the prompt
          .map(line => line.replace(/^[-*\u2022]\s*/, '').replace(/^\d+[.)]\s*/, '').trim())
          .filter(line => line.length > 0 && line.length < 100)
          .filter(line => !line.endsWith(':'))   // drop headings like "Keywords:"
          // Drop section headers the model may emit despite the prompt. Without
          // this, "FIRST: ..." / "THEN: ..." become tags.
          .filter(line => !/^(first|then|topical|facets?)\b/i.test(line));

        // Case-normalise, then de-duplicate within the item.
        //
        // Without this the vocabulary fragments badly: a 3,159-item run produced
        // 15,196 distinct tags that collapsed to 12,801 on lowercasing alone,
        // with 1,936 concepts split across case variants \u2014 OSTEOPONTIN /
        // Osteopontin / osteopontin appearing as three separate tags across
        // 2,615 items. That makes tag filtering silently lossy, and makes the
        // tags unusable as graph nodes downstream.
        const seen = new Set();
        const tags = [];
        const facets = [];

        for (const line of raw) {
          // Controlled facets are handled separately and deliberately bypass
          // normaliseTag: sentence-casing `exposure:knockout` into
          // `Exposure:knockout` would re-introduce the case fragmentation this
          // whole pass exists to remove.
          const m = line.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
          if (m && Object.prototype.hasOwnProperty.call(FACET_VOCAB, m[1].toLowerCase())) {
            const key = m[1].toLowerCase();
            const value = m[2].trim().toLowerCase();
            if (!FACET_VOCAB[key].includes(value)) {
              Zotero.debug(`Auto-Tagger: dropped out-of-vocabulary facet "${line}"`);
              continue;
            }
            const facet = `${key}:${value}`;
            if (!seen.has(facet)) { seen.add(facet); facets.push(facet); }
            continue;
          }

          if (tags.length >= 10) continue;  // topical cap; facets still collected
          const n = this.normaliseTag(line);
          const k = n.toLowerCase();
          if (n && !seen.has(k)) { seen.add(k); tags.push(n); }
        }

        const all = tags.concat(facets);
        Zotero.debug(`Auto-Tagger: Parsed ${tags.length} topical tags + ` +
                     `${facets.length} facets from Ollama`);
        return all;
      }

      // Canonical form: sentence case, with acronyms preserved.
      //   OSTEOPONTIN     -> Osteopontin
      //   gene expression -> Gene expression
      //   Gene Expression -> Gene expression
      //   ELISA / CD44    -> unchanged (short all-caps, or contains digits)
      // Deliberately does NOT stem plurals: the plugin sees one item at a time
      // and has no library-wide view, so singular/plural merging cannot be done
      // safely here. That needs a separate library-wide pass.
      normaliseTag(tag) {
        const t = tag.replace(/\s+/g, ' ').trim();
        if (!t) return '';
        // Distinguish a scientific token that must keep its casing (mRNA, CD44,
        // TGF-beta, RNA-seq, ELISA, IL-6) from a word that is merely SHOUTED
        // (OSTEOPONTIN, INFLAMMATION). Both are "uppercase", so length and the
        // presence of digits/mixed case are what separate them.
        const keepCase = (w) => {
          const letters = w.replace(/[^A-Za-z]/g, '');
          const allCaps = letters.length > 0 && letters === letters.toUpperCase();
          // A long all-caps run with no digits is shouting, not an acronym.
          if (allCaps && !/\d/.test(w) && letters.length > 6) return false;
          // 2+ caps run (ELISA, mRNA, TGF-beta), caps+digit (CD44, IL-6),
          // or internal capital i.e. CamelCase (AlphaFold, pH).
          return /[A-Z]{2,}/.test(w) || (/[A-Z]/.test(w) && /\d/.test(w)) || /[a-z][A-Z]/.test(w);
        };
        // keepCase alone cannot tell a SHORT shouted word from an acronym —
        // "GENE" and "ELISA" look identical to it — so "GENE EXPRESSION" would
        // normalise to "GENE expression" and still fragment against
        // "Gene expression" across items.
        //
        // A multi-word tag in which EVERY word is all-caps is shouting, not a
        // run of acronyms. Tokens under 4 letters or containing digits stay
        // protected, so "TGF BETA" -> "TGF beta" and "NF KB" -> "NF KB".
        // Single-word tags are left to keepCase, so ELISA / PCR / NEC survive.
        const parts = t.split(' ');
        const allShouted = parts.length > 1 && parts.every(w => {
          const letters = w.replace(/[^A-Za-z]/g, '');
          return letters.length > 0 && letters === letters.toUpperCase();
        });

        const words = parts.map(w => {
          if (allShouted && !/\d/.test(w) &&
              w.replace(/[^A-Za-z]/g, '').length >= 4) {
            return w.toLowerCase();
          }
          return keepCase(w) ? w : w.toLowerCase();
        });
        // Only capitalise a Latin initial. Upper-casing a Greek or other
        // non-Latin initial (αv -> Αv) invents a new variant instead of
        // collapsing one.
        if (words.length && !keepCase(words[0]) && /^[a-z]/.test(words[0])) {
          words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
        }
        return words.join(' ');
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

          // A library-wide pass runs for tens of hours. Without a visible
          // counter there is no way to know how far it got before you close
          // Zotero, and no way to stop it short of quitting the app.
          if (this._running) {
            this._cancelRequested = true;
            showMessage("Auto-Tagger: stop requested. Finishing the current item...");
            return;
          }
          this._running = true;
          this._cancelRequested = false;

          const started = Date.now();
          const progressWin = new Zotero.ProgressWindow({ closeOnClick: false });
          progressWin.changeHeadline(`Auto-Tagging ${regularItems.length} items`);
          const bar = new progressWin.ItemProgress('', 'Starting...');
          progressWin.show();

          let tagged = 0;
          let taggedByLLM = 0;
          let skipped = 0;
          let errors = 0;
          let errorMessages = [];

          // Persisted so "how far did it get?" is answerable after the window
          // is gone. Read it back from the Config Editor.
          const saveProgress = (i) => {
            try {
              Services.prefs.setCharPref('extensions.autoTagger.lastRun',
                `${new Date().toISOString().slice(0,16).replace('T',' ')} | ` +
                `${i}/${regularItems.length} processed | ${tagged} tagged, ` +
                `${skipped} skipped, ${errors} errors`);
            } catch (e) { /* non-fatal */ }
          };

          for (let i = 0; i < regularItems.length; i++) {
            if (this._cancelRequested) {
              Zotero.debug('Auto-Tagger: cancelled by user');
              break;
            }
            const item = regularItems[i];

            // Update before the slow work so the count reflects what is
            // actually in flight, not what finished.
            const pct = Math.round((i / regularItems.length) * 100);
            const elapsed = (Date.now() - started) / 1000;
            const rate = i > 0 ? elapsed / i : 0;
            const etaMin = rate > 0 ? Math.round((rate * (regularItems.length - i)) / 60) : 0;
            bar.setProgress(Math.max(pct, 1));
            bar.setText(
              `${i + 1}/${regularItems.length} — ${tagged} tagged, ${skipped} skipped` +
              (errors ? `, ${errors} errors` : '') +
              (etaMin ? ` — ~${etaMin} min left` : '')
            );
            if (i % 10 === 0) saveProgress(i);
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

              // When re-tagging, replace rather than accumulate: strip the
              // previous run's LLM tags first, so switching models or editing
              // the prompt doesn't leave both generations layered on the item.
              // Only prefixed tags are touched — PubMed MeSH is never removed.
              const replacing = !!getPref('extensions.autoTagger.retagExisting');
              const stale = replacing
                ? item.getTags().map(t => t.tag).filter(t => t && t.startsWith(aiPrefix))
                : [];

              await Zotero.DB.executeTransaction(async function () {
                for (const old of stale) {
                  item.removeTag(old);
                }
                for (const keyword of keywords) {
                  item.addTag(keyword, 0);
                }
                for (const keyword of aiKeywords) {
                  item.addTag(`${aiPrefix}${keyword}`, 1);
                }
                await item.save();
              });
              if (stale.length) {
                Zotero.debug(`Auto-Tagger: replaced ${stale.length} prior LLM tags on item ${item.id}`);
              }
              
              tagged++;
              Zotero.debug(`Auto-Tagger: Tagged item ${item.id} with ${keywords.length} keywords`);
              
            } catch (e) {
              errors++;
              Zotero.logError(e);
              Zotero.debug(`Auto-Tagger: Error processing item ${item.id}: ${e.message}`);
            }
          }
          
          this._running = false;
          const wasCancelled = this._cancelRequested;
          this._cancelRequested = false;
          saveProgress(tagged + skipped + errors);

          const mins = Math.round((Date.now() - started) / 60000);
          bar.setProgress(100);
          bar.setText(
            (wasCancelled ? 'Stopped — ' : 'Done — ') +
            `${tagged} tagged, ${skipped} skipped` + (errors ? `, ${errors} errors` : '') +
            (mins ? ` in ${mins} min` : '')
          );
          progressWin.startCloseTimer(8000);

          let message = getString("autoTag.complete").replace("${count}", tagged);
          if (wasCancelled) {
            message = `Stopped early.\n${tagged} items tagged before stopping.`;
          }
          message += `\n\nRe-running is safe — already-tagged items are skipped.`;
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
          // Release the run lock here too. Without this an exception leaves
          // _running true forever and every later click is interpreted as a
          // stop request, wedging the plugin until Zotero restarts.
          this._running = false;
          this._cancelRequested = false;
          try { if (typeof progressWin !== 'undefined' && progressWin) progressWin.close(); } catch (_) {}
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
