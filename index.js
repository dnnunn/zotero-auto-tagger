"use strict";
(() => {
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
      "autoTag.error": "Error tagging items: ${error}"
    };
    return strings[key] || key;
  }

  // Register menu items
  function registerMenus() {
    const doc = Zotero.getMainWindow().document;
    
    // Tools menu
    const toolsMenu = doc.getElementById("menu_ToolsPopup");
    if (toolsMenu) {
      const menuitem = doc.createXULElement("menuitem");
      menuitem.id = `${config.addonRef}-tools-menu`;
      menuitem.setAttribute("label", getString("menu.autoTag"));
      menuitem.setAttribute("oncommand", "Zotero.AutoTagger.tagSelectedItems();");
      toolsMenu.appendChild(menuitem);
    }
    
    // Item context menu
    const itemMenu = doc.getElementById("zotero-itemmenu");
    if (itemMenu) {
      const menuitem = doc.createXULElement("menuitem");
      menuitem.id = `${config.addonRef}-item-menu`;
      menuitem.setAttribute("label", getString("menu.autoTagSelected"));
      menuitem.setAttribute("oncommand", "Zotero.AutoTagger.tagSelectedItems();");
      itemMenu.appendChild(menuitem);
    }
  }

  // Main class
  class AutoTagger {
    constructor() {
      this.initialized = false;
    }

    async init() {
      if (this.initialized) return;
      
      registerMenus();
      this.initialized = true;
      Zotero.debug("Auto-Tagger: Menu items registered");
    }

    async tagSelectedItems() {
      try {
        const items = Zotero.getActiveZoteroPane().getSelectedItems();
        if (!items || items.length === 0) {
          alert(getString("autoTag.noItems"));
          return;
        }
        
        // For now, just add test tags
        let tagged = 0;
        for (const item of items) {
          if (item.isRegularItem()) {
            item.addTag("auto-tagged");
            item.addTag("test-tag");
            await item.saveTx();
            tagged++;
          }
        }
        
        alert(getString("autoTag.complete").replace("${count}", tagged));
      } catch (e) {
        Zotero.logError(e);
        alert(getString("autoTag.error").replace("${error}", e.message));
      }
    }
  }

  // Initialize
  Zotero.AutoTagger = new AutoTagger();
  Zotero.AutoTagger.init();
})();
