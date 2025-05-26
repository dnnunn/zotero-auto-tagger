// pubmed.js - loaded into AutoTagger scope
(function() {
  this.PubMed = {
    fetchKeywords: async function(item) {
      try {
        // Get DOI or PubMed ID
        const doi = item.getField('DOI');
        const pmid = item.getField('extra') && item.getField('extra').match(/PMID:\s*(\d+)/)?.[1];
        
        if (!doi && !pmid) {
          Zotero.log("No DOI or PMID found for item", "warn");
          return [];
        }
        
        // Fetch from PubMed
        const keywords = await this.fetchFromPubMed(pmid || doi);
        return keywords;
      } catch (e) {
        Zotero.logError(e);
        return [];
      }
    },
    
    fetchFromPubMed: async function(identifier) {
      // This is a placeholder - implement actual PubMed API call
      // You'll need to use the code from pubmedAPI.js
      Zotero.log(`Fetching keywords for ${identifier}`, "info");
      return ["keyword1", "keyword2"]; // Placeholder
    }
  };
}).call(this);
