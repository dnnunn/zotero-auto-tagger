// ui.js - loaded into AutoTagger scope
(function() {
  const UI = class {
    constructor(autoTagger) {
      this.autoTagger = autoTagger;
      this.menuItems = [];
    }

    async init() {
      // Add menu items
      this.registerMenuItems();
      
      // Add toolbar button if possible
      this.registerToolbarButton();
      
      // Register keyboard shortcuts
      this.registerShortcuts();
    }

    registerMenuItems() {
      try {
        // Add to Tools menu
        const toolsMenu = document.getElementById('menu_ToolsPopup');
        if (toolsMenu) {
          const menuitem = document.createXULElement('menuitem');
          menuitem.id = 'autotagger-tools-menuitem';
          menuitem.setAttribute('label', 'Auto-Tag Selected Items');
          menuitem.addEventListener('command', () => this.autoTagger.tagSelectedItems());
          
          const separator = document.createXULElement('menuseparator');
          separator.id = 'autotagger-tools-separator';
          
          toolsMenu.appendChild(separator);
          toolsMenu.appendChild(menuitem);
          this.menuItems.push(menuitem, separator);
        }
        
        // Add to item context menu
        const itemMenu = document.getElementById('zotero-itemmenu');
        if (itemMenu) {
          const menuitem = document.createXULElement('menuitem');
          menuitem.id = 'autotagger-context-menuitem';
          menuitem.setAttribute('label', 'Auto-Tag Items');
          menuitem.addEventListener('command', () => this.autoTagger.tagSelectedItems());
          
          const separator = document.createXULElement('menuseparator');
          separator.id = 'autotagger-context-separator';
          
          itemMenu.appendChild(separator);
          itemMenu.appendChild(menuitem);
          this.menuItems.push(menuitem, separator);
        }
      } catch (e) {
        Zotero.logError(e);
      }
    }

    registerToolbarButton() {
      // Toolbar button registration for Zotero 7
      // This is more complex and depends on your UI needs
    }

    registerShortcuts() {
      // Register keyboard shortcuts
      try {
        const keySet = document.getElementById('mainKeyset');
        if (keySet) {
          const key = document.createXULElement('key');
          key.id = 'autotagger-key';
          key.setAttribute('key', 'T');
          key.setAttribute('modifiers', 'accel shift');
          key.addEventListener('command', () => this.autoTagger.tagSelectedItems());
          keySet.appendChild(key);
        }
      } catch (e) {
        Zotero.logError(e);
      }
    }

    shutdown() {
      // Remove menu items
      for (const item of this.menuItems) {
        if (item && item.parentNode) {
          item.parentNode.removeChild(item);
        }
      }
      this.menuItems = [];
    }
  };
  
  // Attach to parent scope
  this.UI = UI;
}).call(this);
