import { registerPreferences } from './prefDefaults.js';

export function registerPrefs() {
  // Register default preferences
  registerPreferences();
  
  // Register preference pane
  const prefOptions = {
    pluginID: "autoTagger",
    src: rootURI + "chrome/content/preferences/index.xhtml",
    label: "Auto-Tagger Preferences",
    image: rootURI + "chrome/content/icons/icon@32px.png",
    defaultXUL: true
  };
  
  Zotero.PreferencePanes.register(prefOptions);
}
