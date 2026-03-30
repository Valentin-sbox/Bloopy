const fs = require('fs').promises;
const path = require('path');

/**
 * Transaction log for atomic operations
 */
class TransactionManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.transactionLog = [];
    this.backups = new Map();
  }

  /**
   * Start a new transaction
   */
  begin() {
    this.transactionLog = [];
    this.backups.clear();
  }

  /**
   * Log a file operation
   * @param {string} operation - Operation type (create, update, delete)
   * @param {string} fileId - File ID
   * @param {object} data - Operation data
   */
  async logOperation(operation, fileId, data = {}) {
    this.transactionLog.push({
      operation,
      fileId,
      data,
      timestamp: Date.now()
    });

    // Create backup for update/delete operations
    if (operation === 'update' || operation === 'delete') {
      await this.createBackup(fileId);
    }
  }

  /**
   * Create backup of a file
   * @param {string} fileId - File ID
   */
  async createBackup(fileId) {
    if (this.backups.has(fileId)) return;

    const filePath = path.join(this.projectPath, `${fileId}.txt`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.backups.set(fileId, content);
    } catch (error) {
      // File might not exist yet
      this.backups.set(fileId, null);
    }
  }

  /**
   * Commit transaction
   */
  commit() {
    this.transactionLog = [];
    this.backups.clear();
  }

  /**
   * Rollback transaction
   */
  async rollback() {
    console.log(`Rolling back ${this.transactionLog.length} operations...`);

    // Restore backups in reverse order
    for (const [fileId, content] of this.backups.entries()) {
      const filePath = path.join(this.projectPath, `${fileId}.txt`);
      
      try {
        if (content === null) {
          // File didn't exist before, delete it
          await fs.unlink(filePath);
        } else {
          // Restore original content
          await fs.writeFile(filePath, content, 'utf-8');
        }
      } catch (error) {
        console.error(`Failed to rollback ${fileId}: ${error.message}`);
      }
    }

    this.transactionLog = [];
    this.backups.clear();
  }

  /**
   * Execute operation with transaction support
   * @param {Function} operation - Async operation to execute
   * @returns {Promise<any>} - Operation result
   */
  async execute(operation) {
    this.begin();
    
    try {
      const result = await operation(this);
      this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

/**
 * Validate metadata structure
 * @param {object} metadata - Metadata to validate
 * @returns {boolean} - True if valid
 * @throws {Error} - If invalid
 */
function validateMetadataStructure(metadata) {
  const required = ['id', 'name', 'parentId', 'order', 'children', 'createdAt', 'updatedAt'];
  
  for (const field of required) {
    if (!(field in metadata)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (typeof metadata.id !== 'string' || !metadata.id) {
    throw new Error('Invalid id field');
  }

  if (typeof metadata.name !== 'string') {
    throw new Error('Invalid name field');
  }

  if (!Array.isArray(metadata.children)) {
    throw new Error('children must be an array');
  }

  return true;
}

module.exports = {
  TransactionManager,
  validateMetadataStructure
};
