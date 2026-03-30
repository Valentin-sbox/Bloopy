const chokidar = require('chokidar');
const path = require('path');
const { parseFile } = require('./metadataParser');
const { rebuildProjectIndex } = require('./projectIndex');

/**
 * File watcher for external changes
 */
class FileWatcher {
  constructor(projectPath, eventEmitter, saveTracker) {
    this.projectPath = projectPath;
    this.eventEmitter = eventEmitter;
    this.saveTracker = saveTracker; // SaveOperationTracker instance
    this.watcher = null;
    this.debounceTimer = null;
    this.pendingChanges = new Set();
    this.debounceDelay = 300; // 300ms debounce
    this.restartAttempts = 0;
    this.maxRestartAttempts = 3;
    this.restartDelay = 5000; // 5 seconds
  }

  /**
   * Initialize file watcher
   */
  initializeWatcher() {
    if (this.watcher) {
      this.watcher.close();
    }

    this.watcher = chokidar.watch(['*.txt', '*.canvas'], {
      cwd: this.projectPath,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange('add', filePath))
      .on('change', (filePath) => this.handleFileChange('change', filePath))
      .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
      .on('error', (error) => this.handleWatcherError(error));

    console.log('[SAVE-CYCLE] File watcher initialized with save tracking');
    this.restartAttempts = 0; // Reset restart attempts on successful init
  }

  /**
   * Handle watcher errors with retry logic
   * @param {Error} error - The error that occurred
   */
  handleWatcherError(error) {
    console.error('[SAVE-CYCLE] File watcher error:', error);
    console.error('[SAVE-CYCLE] Error stack:', error.stack);

    // Attempt to restart watcher
    if (this.restartAttempts < this.maxRestartAttempts) {
      this.restartAttempts++;
      console.log(`[SAVE-CYCLE] Attempting to restart watcher (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);
      
      setTimeout(() => {
        try {
          this.initializeWatcher();
          console.log('[SAVE-CYCLE] Watcher restarted successfully');
        } catch (restartError) {
          console.error('[SAVE-CYCLE] Failed to restart watcher:', restartError);
        }
      }, this.restartDelay);
    } else {
      console.error('[SAVE-CYCLE] Max restart attempts reached, watcher disabled');
      // Emit event to notify user
      if (this.eventEmitter) {
        this.eventEmitter.emit('watcher-failed', {
          error: error.message,
          message: 'File watcher has been disabled. Please restart the application.'
        });
      }
    }
  }

  /**
   * Handle file change event
   * @param {string} event - Event type (add, change, unlink)
   * @param {string} filePath - Relative file path
   */
  handleFileChange(event, filePath) {
    const fullPath = path.join(this.projectPath, filePath);
    
    // Check if this is our own save operation
    if (this.saveTracker && this.saveTracker.hasPendingSave(fullPath)) {
      console.log('[SAVE-CYCLE] Ignoring self-triggered event:', event, fullPath);
      this.saveTracker.clearOperation(fullPath);
      return; // Ignore our own saves
    }
    
    console.log('[SAVE-CYCLE] External change detected:', event, filePath);
    
    this.pendingChanges.add({
      event,
      path: fullPath,
      fileName: filePath,
      timestamp: Date.now()
    });

    this.debounceChanges();
  }

  /**
   * Debounce rapid changes
   */
  debounceChanges() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.processChanges();
    }, this.debounceDelay);
  }

  /**
   * Process pending changes
   */
  async processChanges() {
    if (this.pendingChanges.size === 0) return;

    // Group changes by file path to avoid duplicates
    const changesByPath = new Map();
    for (const change of this.pendingChanges) {
      if (!changesByPath.has(change.path)) {
        changesByPath.set(change.path, change);
      }
    }

    this.pendingChanges.clear();

    const changes = Array.from(changesByPath.values());
    console.log('[SAVE-CYCLE] Processing', changes.length, 'unique external changes');

    try {
      // Rebuild project index to reflect changes
      await rebuildProjectIndex(this.projectPath);

      // Emit events for each change
      for (const change of changes) {
        this.eventEmitter.emit('file-external-change', {
          event: change.event,
          path: change.path,
          fileName: change.fileName
        });
      }

      // Emit tree change event
      this.eventEmitter.emit('tree-change', {
        reason: 'external-changes',
        affectedFiles: changes.map(c => c.fileName)
      });
    } catch (error) {
      console.error('[SAVE-CYCLE] Failed to process external changes:', error);
    }
  }

  /**
   * Stop watching
   */
  close() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

module.exports = FileWatcher;
