export class TagCache {
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
      Zotero.debug(`Failed to initialize tag cache DB: ${error.message}`);
    }
  }

  async get(key) {
    if (!key) return null;
    
    try {
      const sql = `SELECT tags, timestamp FROM ${this.tableName} WHERE cache_key = ?`;
      const row = await Zotero.DB.rowQueryAsync(sql, [key]);
      
      if (row) {
        // Check if cache is still valid (30 days by default)
        const maxAge = Zotero.Prefs.get('extensions.autoTagger.cacheMaxAge') || 30;
        const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
        
        if (Date.now() - row.timestamp < maxAgeMs) {
          return JSON.parse(row.tags);
        } else {
          // Cache expired, delete it
          await this.delete(key);
        }
      }
    } catch (error) {
      Zotero.debug(`Cache get error: ${error.message}`);
    }
    
    return null;
  }

  async set(key, tags) {
    if (!key || !Array.isArray(tags)) return;
    
    try {
      const sql = `INSERT OR REPLACE INTO ${this.tableName} 
                   (cache_key, tags, timestamp) VALUES (?, ?, ?)`;
      await Zotero.DB.queryAsync(sql, [
        key,
        JSON.stringify(tags),
        Date.now()
      ]);
    } catch (error) {
      Zotero.debug(`Cache set error: ${error.message}`);
    }
  }

  async delete(key) {
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE cache_key = ?`;
      await Zotero.DB.queryAsync(sql, [key]);
    } catch (error) {
      Zotero.debug(`Cache delete error: ${error.message}`);
    }
  }

  async clear() {
    try {
      const sql = `DELETE FROM ${this.tableName}`;
      await Zotero.DB.queryAsync(sql);
    } catch (error) {
      Zotero.debug(`Cache clear error: ${error.message}`);
    }
  }

  async getStats() {
    try {
      const countSql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const sizeSql = `SELECT SUM(LENGTH(tags)) as size FROM ${this.tableName}`;
      
      const count = await Zotero.DB.valueQueryAsync(countSql);
      const size = await Zotero.DB.valueQueryAsync(sizeSql);
      
      return {
        count: count || 0,
        size: size || 0,
        sizeFormatted: this.formatBytes(size || 0)
      };
    } catch (error) {
      Zotero.debug(`Cache stats error: ${error.message}`);
      return { count: 0, size: 0, sizeFormatted: '0 B' };
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
