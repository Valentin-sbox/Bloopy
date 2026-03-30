/**
 * ============================================================================
 * MAIN INDEX - Punto de entrada del sistema de metadatos
 * ============================================================================
 * 
 * Este módulo exporta todas las funcionalidades del nuevo sistema de metadatos
 * para ser usado desde electron.js
 */

const metadataParser = require('./metadataParser');
const metadataWriter = require('./metadataWriter');
const treeBuilder = require('./treeBuilder');
const projectIndex = require('./projectIndex');
const fileManager = require('./fileManager');
const migrationManager = require('./migrationManager');
const FileWatcher = require('./fileWatcher');
const { TransactionManager, validateMetadataStructure } = require('./transactionManager');

module.exports = {
    // OPTIMIZACIÓN: Todas las funciones de manipulación de archivos y árbol usan lógica eficiente y no recorren todo el workspace innecesariamente
  // Parser
  parseFile: metadataParser.parseFile,
  extractMetadata: metadataParser.extractMetadata,
  generateDefaultMetadata: metadataParser.generateDefaultMetadata,
  validateMetadata: metadataParser.validateMetadata,

  // Writer
  writeFile: metadataWriter.writeFile,
  updateMetadata: metadataWriter.updateMetadata,

  // Tree Builder
  buildTree: treeBuilder.buildTree,
  sortSiblings: treeBuilder.sortSiblings,
  findFileById: treeBuilder.findFileById,
  getAncestors: treeBuilder.getAncestors,
  loadProjectTree: treeBuilder.loadProjectTree,

  // Project Index
  loadProjectIndex: projectIndex.loadProjectIndex,
  saveProjectIndex: projectIndex.saveProjectIndex,
  getProjectIndex: projectIndex.getProjectIndex,
  rebuildProjectIndex: projectIndex.rebuildProjectIndex,
  invalidateProjectIndex: projectIndex.invalidateProjectIndex,

  // File Manager
  createFile: fileManager.createFile,
  deleteFile: fileManager.deleteFile,
  renameFile: fileManager.renameFile,
  moveFile: fileManager.moveFile,
  reorderFiles: fileManager.reorderFiles,
  getSiblings: fileManager.getSiblings,
  saveFile: fileManager.saveFile,
  updateFileMetadata: fileManager.updateFileMetadata,

  // Migration
  needsMigration: migrationManager.needsMigration,
  migrateProject: migrationManager.migrateProject,
  needsProjectIdMigration: migrationManager.needsProjectIdMigration,
  migrateFileProjectId: migrationManager.migrateFileProjectId,
  migrateWorkspaceProjectIds: migrationManager.migrateWorkspaceProjectIds,

  // File Watcher
  FileWatcher,

  // Transactions
  TransactionManager,
  validateMetadataStructure
};
