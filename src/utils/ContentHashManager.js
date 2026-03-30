/**
 * ContentHashManager
 * Manages content hashes to detect actual content changes
 */
class ContentHashManager {
  constructor() {
    this.hashes = new Map(); // filePath -> hash
  }

  /**
   * Compute hash of content using FNV-1a algorithm
   * @param {string} content - Content to hash
   * @returns {string} - Hash value as hex string
   */
  computeHash(content) {
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * Check if content has changed
   * @param {string} filePath - Path to file
   * @param {string} content - Current content
   * @returns {boolean} - True if content changed
   */
  hasChanged(filePath, content) {
    const newHash = this.computeHash(content);
    const oldHash = this.hashes.get(filePath);
    
    if (oldHash === undefined) {
      console.log('[SAVE-CYCLE] No previous hash for', filePath, ', treating as changed');
      return true;
    }
    
    const changed = oldHash !== newHash;
    console.log('[SAVE-CYCLE] Content changed for', filePath, ':', changed);
    return changed;
  }

  /**
   * Update stored hash for a file
   * @param {string} filePath - Path to file
   * @param {string} content - Content to hash and store
   * @returns {string} - The computed hash
   */
  updateHash(filePath, content) {
    const hash = this.computeHash(content);
    this.hashes.set(filePath, hash);
    console.log('[SAVE-CYCLE] Updated hash for', filePath, ':', hash);
    return hash;
  }

  /**
   * Get stored hash for a file
   * @param {string} filePath - Path to file
   * @returns {string|null} - Stored hash or null
   */
  getHash(filePath) {
    return this.hashes.get(filePath) || null;
  }
}

export default ContentHashManager;
