export class PubMedAPI {
  constructor() {
    this.baseURL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
    this.toolName = 'ZoteroAutoTagger';
    this.email = 'your-email@example.com'; // Update this
    this.apiKey = null; // Optional: get from https://www.ncbi.nlm.nih.gov/account/
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
    
    const params = new URLSearchParams({
      tool: this.toolName,
      email: this.email
    });
    
    if (this.apiKey) {
      params.append('api_key', this.apiKey);
    }
    
    const separator = url.includes('?') ? '&' : '?';
    const fullURL = `${url}${separator}${params.toString()}`;
    
    const response = await fetch(fullURL);
    if (!response.ok) {
      throw new Error(`PubMed API error: ${response.status} ${response.statusText}`);
    }
    
    return response;
  }

  async searchByDOI(doi) {
    try {
      const searchURL = `${this.baseURL}esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}[doi]&retmode=json`;
      const response = await this._rateLimitedFetch(searchURL);
      const data = await response.json();
      
      if (data.esearchresult && data.esearchresult.idlist && data.esearchresult.idlist.length > 0) {
        return data.esearchresult.idlist[0];
      }
      return null;
    } catch (error) {
      Zotero.debug(`PubMed search by DOI failed: ${error.message}`);
      return null;
    }
  }

  async searchByTitle(title, author = '', year = '') {
    try {
      let searchTerm = `"${title}"[Title]`;
      
      if (author) {
        const lastName = this._extractLastName(author);
        if (lastName) {
          searchTerm += ` AND ${lastName}[Author]`;
        }
      }
      
      if (year) {
        searchTerm += ` AND ${year}[Publication Date]`;
      }
      
      const searchURL = `${this.baseURL}esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmode=json`;
      const response = await this._rateLimitedFetch(searchURL);
      const data = await response.json();
      
      if (data.esearchresult && data.esearchresult.idlist && data.esearchresult.idlist.length > 0) {
        // Return the first match
        return data.esearchresult.idlist[0];
      }
      return null;
    } catch (error) {
      Zotero.debug(`PubMed search by title failed: ${error.message}`);
      return null;
    }
  }

  async getKeywords(item) {
    try {
      let pmid = null;
      
      // Try to get PMID from the item's extra field
      const extra = item.getField('extra');
      const pmidMatch = extra.match(/PMID:\s*(\d+)/i);
      if (pmidMatch) {
        pmid = pmidMatch[1];
      }
      
      // If no PMID, try DOI
      if (!pmid) {
        const doi = item.getField('DOI');
        if (doi) {
          pmid = await this.searchByDOI(doi);
        }
      }
      
      // If still no PMID, try title search
      if (!pmid) {
        const title = item.getField('title');
        const firstCreator = item.getCreators()[0];
        const author = firstCreator ? firstCreator.lastName : '';
        const year = item.getField('date').substring(0, 4);
        
        if (title) {
          pmid = await this.searchByTitle(title, author, year);
        }
      }
      
      // If we have a PMID, fetch the full record
      if (pmid) {
        return await this.fetchRecordKeywords(pmid);
      }
      
      return [];
    } catch (error) {
      Zotero.debug(`Failed to get keywords from PubMed: ${error.message}`);
      return [];
    }
  }

  async fetchRecordKeywords(pmid) {
    try {
      const fetchURL = `${this.baseURL}efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;
      const response = await this._rateLimitedFetch(fetchURL);
      const xmlText = await response.text();
      
      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      
      const keywords = new Set();
      
      // Get author keywords
      const keywordNodes = xmlDoc.getElementsByTagName("Keyword");
      for (let i = 0; i < keywordNodes.length; i++) {
        const keyword = keywordNodes[i].textContent.trim();
        if (keyword) {
          keywords.add(keyword);
        }
      }
      
      // Get MeSH terms (major topics only by default)
      const meshNodes = xmlDoc.getElementsByTagName("MeshHeading");
      for (let i = 0; i < meshNodes.length; i++) {
        const descriptorNode = meshNodes[i].getElementsByTagName("DescriptorName")[0];
        if (descriptorNode) {
          const majorTopic = descriptorNode.getAttribute("MajorTopicYN");
          if (majorTopic === "Y" || keywords.size < 5) { // Include non-major topics if we have few keywords
            const meshTerm = descriptorNode.textContent.trim();
            if (meshTerm) {
              keywords.add(meshTerm);
            }
          }
        }
        
        // Also check for qualifier names (subheadings)
        const qualifierNodes = meshNodes[i].getElementsByTagName("QualifierName");
        for (let j = 0; j < qualifierNodes.length; j++) {
          const majorTopic = qualifierNodes[j].getAttribute("MajorTopicYN");
          if (majorTopic === "Y") {
            const qualifier = qualifierNodes[j].textContent.trim();
            const descriptorName = descriptorNode ? descriptorNode.textContent.trim() : '';
            if (qualifier && descriptorName) {
              keywords.add(`${descriptorName}/${qualifier}`);
            }
          }
        }
      }
      
      // Convert Set to Array and limit number of keywords
      const keywordArray = Array.from(keywords);
      const maxKeywords = Zotero.Prefs.get('extensions.autoTagger.maxTags') || 10;
      
      return keywordArray.slice(0, maxKeywords);
    } catch (error) {
      Zotero.debug(`Failed to fetch PubMed record: ${error.message}`);
      return [];
    }
  }

  _extractLastName(author) {
    if (typeof author === 'string') {
      // Simple extraction - takes last word as last name
      const parts = author.trim().split(/\s+/);
      return parts[parts.length - 1];
    } else if (author && author.lastName) {
      return author.lastName;
    }
    return '';
  }

  async testConnection() {
    try {
      const testURL = `${this.baseURL}einfo.fcgi?db=pubmed&retmode=json`;
      const response = await this._rateLimitedFetch(testURL);
      const data = await response.json();
      return data.einforesult ? true : false;
    } catch (error) {
      return false;
    }
  }
}
