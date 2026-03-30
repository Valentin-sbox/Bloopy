/**
 * SaveOperationTracker
 * Tracks pending save operations to distinguish between internal saves and external file changes
 */
class SaveOperationTracker {
  constructor() {
    this.pendingOperations = new Map(); // filePath -> { id, timestamp, hash }
    this.operationTimeout = 2000; // 2 seconds
  }

  /**
   * Register a save operation
   * @param {string} filePath - Path to file being saved
   * @param {string} contentHash - Hash of content being saved
   * @returns {string} operationId - Unique operation identifier
   */
  registerSave(filePath, contentHash) {
    const operationId = `${Date.now()}-${Math.random()}`;
    const operation = {
      id: operationId,
      timestamp: Date.now(),
      hash: contentHash
    };
    
    this.pendingOperations.set(filePath, operation);
    
    console.log('[SAVE-CYCLE] Registered save operation:', operationId, 'for', filePath);
    
    // Auto-expire after timeout
    setTimeout(() => {
      this.clearOperation(filePath, operationId);
    }, this.operationTimeout);
    
    return operationId;
  }

  /**
   * Check if a file path has a pending save operation
   * @param {string} filePath - Path to check
   * @returns {boolean} - True if operation is pending
   */
  hasPendingSave(filePath) {
    const hasPending = this.pendingOperations.has(filePath);
    console.log('[SAVE-CYCLE] Check pending save for', filePath, ':', hasPending);
    return hasPending;
  }

  /**
   * Clear a save operation
   * @param {string} filePath - Path to file
   * @param {string} operationId - Operation ID to clear (optional)
   */
  clearOperation(filePath, operationId) {
    const operation = this.pendingOperations.get(filePath);
    if (operation && (!operationId || operation.id === operationId)) {
      this.pendingOperations.delete(filePath);
      console.log('[SAVE-CYCLE] Cleared save operation:', operation.id, 'for', filePath);
    }
  }

  /**
   * Get operation details
   * @param {string} filePath - Path to file
   * @returns {object|null} - Operation details or null
   */
  getOperation(filePath) {
    return this.pendingOperations.get(filePath) || null;
  }
}

export default SaveOperationTracker;
