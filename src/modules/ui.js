import { TagGenerator } from './tagGenerator.js';

export class AutoTaggerUI {
  constructor(toolkit) {
    this.toolkit = toolkit;
    this.tagGenerator = new TagGenerator();
  }

  async init() {
    // Add menu items
    this.registerMenuItems();
    
    // Add toolbar button
    this.registerToolbarButton();
    
    // Register keyboard shortcuts
    this.registerShortcuts();
  }

  registerMenuItems() {
    // Item menu
    const itemMenu = document.getElementById('zotero-itemmenu');
    if (itemMenu) {
      const menuitem = document.createXULElement('menuitem');
      menuitem.id = 'autotagger-menuitem';
      menuitem.setAttribute('label', 'Auto-Tag Items');
      menuitem.addEventListener('command', () => this.tagSelectedItems());
      
      // Add separator
      const separator = document.createXULElement('menuseparator');
      itemMenu.appendChild(separator);
      itemMenu.appendChild(menuitem);
    }

    // Collection menu
    const collectionMenu = document.getElementById('zotero-collectionmenu');
    if (collectionMenu) {
      const menuitem = document.createXULElement('menuitem');
      menuitem.id = 'autotagger-collection-menuitem';
      menuitem.setAttribute('label', 'Auto-Tag Collection');
      menuitem.addEventListener('command', () => this.tagCollection());
      
      collectionMenu.appendChild(menuitem);
    }
  }

  registerToolbarButton() {
    // For Zotero 7, we'll add this later
  }

  registerShortcuts() {
    // Register keyboard shortcut Ctrl/Cmd + Alt + T
    const keySet = document.getElementById('zotero-keys');
    if (keySet) {
      const key = document.createXULElement('key');
      key.id = 'autotagger-key';
      key.setAttribute('key', 'T');
      key.setAttribute('modifiers', 'accel alt');
      key.addEventListener('command', () => this.tagSelectedItems());
      keySet.appendChild(key);
    }
  }

  async tagSelectedItems() {
    const items = Zotero.getActiveZoteroPane().getSelectedItems();
    if (items.length === 0) {
      alert("Please select items to tag");
      return;
    }
    
    const progressWin = new Zotero.ProgressWindow({
      closeOnClick: false
    });
    progressWin.changeHeadline("Auto-Tagging Items");
    progressWin.show();
    
    const progressIndicator = new progressWin.ItemProgress(
      null, 
      `Processing ${items.length} items...`
    );
    progressIndicator.setProgress(0);
    
    try {
      const results = await this.tagGenerator.tagItems(
        items,
        (current, total, item) => {
          progressIndicator.setProgress((current / total) * 100);
          progressIndicator.setText(
            `Processing ${current} of ${total}: ${item.getField('title').substring(0, 50)}...`
          );
        }
      );
      
      progressIndicator.setText(
        `Complete! Tagged: ${results.success}, Failed: ${results.failed}, Skipped: ${results.skipped}`
      );
      progressIndicator.setProgress(100);
      
    } catch (error) {
      progressIndicator.setText("Error: " + error.message);
      progressIndicator.setError();
    }
    
    setTimeout(() => {
      progressWin.close();
    }, 3000);
  }

  async tagCollection() {
    const collection = Zotero.getActiveZoteroPane().getSelectedCollection();
    if (!collection) {
      alert("Please select a collection");
      return;
    }
    
    const items = await collection.getChildItems();
    const regularItems = items.filter(item => item.isRegularItem());
    
    if (regularItems.length === 0) {
      alert("No items in collection to tag");
      return;
    }
    
    // Use the same tagging process
    await this.tagSelectedItems();
  }

  uninit() {
    // Cleanup menu items
    const menuitem = document.getElementById('autotagger-menuitem');
    if (menuitem) menuitem.remove();
    
    const collectionMenuItem = document.getElementById('autotagger-collection-menuitem');
    if (collectionMenuItem) collectionMenuItem.remove();
    
    const key = document.getElementById('autotagger-key');
    if (key) key.remove();
  }
}
