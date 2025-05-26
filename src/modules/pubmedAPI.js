// pubmedAPI.js - loaded into AutoTagger scope
(function() {
  const PubMedAPI = class {
    constructor() {
      this.baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
      this.toolName = 'ZoteroAutoTagger';
      this.email = 'dnnunn@gmail.com'; // Update this
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
          Zotero.debug('No PMID found for item');
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
      
      const xmlResponse = await this._rateLimitedFetch(fetchUrl);
      return xmlResponse;
    }

    extractKeywords(xmlData) {
      const keywords = [];
      
      try {
        // Parse XML
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlData, 'text/xml');
        
        // Extract MeSH terms
        const meshTerms = doc.querySelectorAll('MeshHeading DescriptorName');
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
        
      } catch (error) {
        Zotero.logError(error);
      }
      
      return keywords;
    }
  };
  
  // Attach to parent scope
  this.PubMedAPI = PubMedAPI;
}).call(this);
