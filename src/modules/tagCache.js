// tagCache.js - loaded into AutoTagger scope
(function() {
  const TagCache = class {
    constructor() {
      this.dbName = 'autoTaggerCache';
      this.tableName = 'tag_cache';
      this.initializeDB();
    }

    async initializeDB() {
      try {
        const exists = await Zotero.DB.tableExists(this.tableName);
        if (!exists) {
          await Zotero.DB.queryAsync(
            `CREATE TABLE IF NOT EXISTS ${this.tableName} (
              cache_key TEXT PRIMARY KEY,
              tags TEXT NOT NULL,
              timestamp INTEGER NOT NULL
            )`
          );
        }
      } catch (error) {
        Zotero.logError(error);
      }
    }

    async get(key) {
      try {
        const sql = `SELECT tags, timestamp FROM ${this.tableName} WHERE cache_key = ?`;
        const result = await Zotero.DB.valueQueryAsync(sql, [key]);
        
        if (!result) return null;
        
        // Check if cache is expired (default: 7 days)
        const cacheExpiry = Zotero.Prefs.get('extensions.autoTagger.cacheExpiry') || 604800000;
        const timestamp = parseInt(result.timestamp);
        
        if (Date.now() - timestamp > cacheExpiry) {
          await this.delete(key);
          return null;
        }
        
        return JSON.parse(result.tags);
      } catch (error) {
        Zotero.logError(error);
        return null;
      }
    }

    async set(key, tags) {
      try {
        const sql = `INSERT OR REPLACE INTO ${this.tableName} (cache_key, tags, timestamp) VALUES (?, ?, ?)`;
        await Zotero.DB.queryAsync(sql, [key, JSON.stringify(tags), Date.now()]);
      } catch (error) {
        Zotero.logError(error);
      }
    }

    async delete(key) {
      try {
        const sql = `DELETE FROM ${this.tableName} WHERE cache_key = ?`;
        await Zotero.DB.queryAsync(sql, [key]);
      } catch (error) {
        Zotero.logError(error);
      }
    }

    async clear() {
      try {
        const sql = `DELETE FROM ${this.tableName}`;
        await Zotero.DB.queryAsync(sql);
      } catch (error) {
        Zotero.logError(error);
      }
    }
  };
  
  // Attach to parent scope
  this.TagCache = TagCache;
}).call(this);
