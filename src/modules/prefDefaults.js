export const prefDefaults = {
  'extensions.autoTagger.usePubMed': true,
  'extensions.autoTagger.useClaude': false,
  'extensions.autoTagger.claudeAPIKey': '',
  'extensions.autoTagger.supplementWithAI': false,
  'extensions.autoTagger.maxTags': 10,
  'extensions.autoTagger.skipTaggedItems': true,
  'extensions.autoTagger.titleCaseTags': false,
  'extensions.autoTagger.cacheMaxAge': 30, // days
  'extensions.autoTagger.rateLimit': 300, // ms
  'extensions.autoTagger.pubmedEmail': '',
  'extensions.autoTagger.pubmedAPIKey': '',
  'extensions.autoTagger.synonyms': '[]',
  'extensions.autoTagger.blacklist': '[]'
};

export function registerPreferences() {
  for (const [key, value] of Object.entries(prefDefaults)) {
    if (!Zotero.Prefs.has(key)) {
      if (typeof value === 'boolean') {
        Zotero.Prefs.set(key, value);
      } else if (typeof value === 'number') {
        Zotero.Prefs.set(key, value);
      } else {
        Zotero.Prefs.set(key, value);
      }
    }
  }
}
