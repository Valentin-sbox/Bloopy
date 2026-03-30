const { ipcMain } = require('electron');
const EventEmitter = require('events');
const fileManager = require('./fileManager');
const { migrateProject } = require('./migrationManager');
const { getProjectIndex } = require('./projectIndex');
const { loadProjectTree } = require('./treeBuilder');

// Event emitter for tree changes
const treeEventEmitter = new EventEmitter();

/**
 * Register all IPC handlers
 * @param {string} projectPath - Current project path
 */
function registerIpcHandlers(projectPath) {
  // Create file
  ipcMain.handle('create-file', async (event, fileName, parentId, content) => {
    try {
      const file = await fileManager.createFile(projectPath, fileName, parentId, content);
      
      treeEventEmitter.emit('tree-change', {
        reason: 'file-created',
        affectedFiles: [file.id]
      });

      return { success: true, file };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Move file
  ipcMain.handle('move-file', async (event, fileId, newParentId) => {
    try {
      await fileManager.moveFile(projectPath, fileId, newParentId);
      
      treeEventEmitter.emit('tree-change', {
        reason: 'file-moved',
        affectedFiles: [fileId]
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Delete file
  ipcMain.handle('delete-file', async (event, fileId) => {
    try {
      await fileManager.deleteFile(projectPath, fileId);
      
      treeEventEmitter.emit('tree-change', {
        reason: 'file-deleted',
        affectedFiles: [fileId]
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Rename file
  ipcMain.handle('rename-file', async (event, fileId, newName) => {
    try {
      await fileManager.renameFile(projectPath, fileId, newName);
      
      treeEventEmitter.emit('tree-change', {
        reason: 'file-renamed',
        affectedFiles: [fileId]
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get project files
  ipcMain.handle('get-project-files', async () => {
    try {
      const tree = await loadProjectTree(projectPath);
      return { success: true, tree };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Reorder files
  ipcMain.handle('reorder-files', async (event, updates) => {
    try {
      await fileManager.reorderFiles(projectPath, updates);
      
      const affectedFiles = updates.map(u => u.id);
      treeEventEmitter.emit('tree-change', {
        reason: 'files-reordered',
        affectedFiles
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Update file metadata
  ipcMain.handle('update-file-metadata', async (event, fileId, metadataUpdates) => {
    try {
      await fileManager.updateFileMetadata(projectPath, fileId, metadataUpdates);
      
      treeEventEmitter.emit('tree-change', {
        reason: 'metadata-updated',
        affectedFiles: [fileId]
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Save file - DISABLED: Using handler in electron.js instead
  // This handler conflicts with the one in electron.js which expects different parameters
  // ipcMain.handle('save-file', async (event, fileId, content, metadata) => {
  //   try {
  //     await fileManager.saveFile(projectPath, fileId, content);
  //     
  //     if (metadata) {
  //       await fileManager.updateFileMetadata(projectPath, fileId, metadata);
  //     }
  //
  //     return { success: true };
  //   } catch (error) {
  //     return { success: false, error: error.message };
  //   }
  // });

  // Get siblings
  ipcMain.handle('get-siblings', async (event, fileId) => {
    try {
      const siblings = await fileManager.getSiblings(projectPath, fileId);
      return { success: true, siblings };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Migrate project
  ipcMain.handle('migrate-project', async () => {
    try {
      const result = await migrateProject(projectPath);
      
      if (result.success) {
        treeEventEmitter.emit('tree-change', {
          reason: 'project-migrated',
          affectedFiles: []
        });
      }

      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // Get project index
  ipcMain.handle('get-project-index', async () => {
    try {
      const files = await getProjectIndex(projectPath);
      return { success: true, files };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

/**
 * Remove all IPC handlers
 */
function removeIpcHandlers() {
  ipcMain.removeHandler('create-file');
  ipcMain.removeHandler('move-file');
  ipcMain.removeHandler('delete-file');
  ipcMain.removeHandler('rename-file');
  ipcMain.removeHandler('get-project-files');
  ipcMain.removeHandler('reorder-files');
  ipcMain.removeHandler('update-file-metadata');
  ipcMain.removeHandler('save-file');
  ipcMain.removeHandler('get-siblings');
  ipcMain.removeHandler('migrate-project');
  ipcMain.removeHandler('get-project-index');
}

/**
 * Send tree change event to renderer
 * @param {BrowserWindow} mainWindow - Main window instance
 */
function setupTreeChangeEvents(mainWindow) {
  treeEventEmitter.on('tree-change', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tree-change', data);
    }
  });
}

module.exports = {
  registerIpcHandlers,
  removeIpcHandlers,
  setupTreeChangeEvents,
  treeEventEmitter
};
