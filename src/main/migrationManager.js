const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateDefaultMetadata, parseFile } = require('./metadataParser');
const { writeFile } = require('./metadataWriter');
const { saveProjectIndex } = require('./projectIndex');

/**
 * Check if project needs migration
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<boolean>}
 */
async function needsMigration(projectPath) {
  try {
    const entries = await fs.readdir(projectPath);
    
    // Check for .d folders
    for (const entry of entries) {
      const fullPath = path.join(projectPath, entry);
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory() && entry.endsWith('.d')) {
        return true;
      }
    }

    // Check if any .txt or .canvas files lack metadata
    for (const entry of entries) {
      if (!entry.endsWith('.txt') && !entry.endsWith('.canvas')) continue;
      
      const fullPath = path.join(projectPath, entry);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        if (!content.startsWith('---')) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Build migration plan by scanning old structure
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<Array<object>>} - Migration plan
 */
async function buildMigrationPlan(projectPath) {
  const plan = [];
  
  async function scanDirectory(dirPath, parentId = null) {
    const entries = await fs.readdir(dirPath);
    const files = [];

    // First pass: collect all .txt and .canvas files
    for (const entry of entries) {
      if (!entry.endsWith('.txt') && !entry.endsWith('.canvas')) continue;
      
      const fullPath = path.join(dirPath, entry);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      const id = uuidv4();
      const name = entry.replace(/\.(txt|canvas)$/, '');
      const ext = entry.endsWith('.canvas') ? '.canvas' : '.txt';
      
      files.push({
        id,
        name,
        oldPath: fullPath,
        newPath: path.join(projectPath, `${name}${ext}`), // FIXED: Usar nombre legible, NO UUID
        parentId,
        content,
        order: files.length
      });
    }

    // Sort alphabetically for consistent ordering
    files.sort((a, b) => a.name.localeCompare(b.name));
    
    // Update order after sorting
    files.forEach((file, index) => {
      file.order = index;
      plan.push(file);
    });

    // Second pass: scan .d folders
    for (const entry of entries) {
      if (!entry.endsWith('.d')) continue;
      
      const folderPath = path.join(dirPath, entry);
      const parentName = entry.replace('.d', '');
      
      // Find parent file
      const parentFile = files.find(f => f.name === parentName);
      if (parentFile) {
        await scanDirectory(folderPath, parentFile.id);
      }
    }
  }

  await scanDirectory(projectPath);
  return plan;
}

/**
 * Execute migration
 * @param {string} projectPath - Path to project directory
 * @param {Array<object>} plan - Migration plan
 * @returns {Promise<void>}
 */
async function executeMigration(projectPath, plan) {
  const migratedFiles = [];

  // Write metadata to all files
  for (const item of plan) {
    const metadata = generateDefaultMetadata({
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      order: item.order,
      lastCharCount: item.content.length
    });

    // Update children array for parents
    const children = plan
      .filter(p => p.parentId === item.id)
      .map(p => p.id);
    metadata.children = children;

    // Write file with metadata
    await writeFile(item.newPath, metadata, item.content);
    
    migratedFiles.push({
      ...metadata,
      path: item.newPath
    });

    // Delete old file if different from new path
    if (item.oldPath !== item.newPath) {
      try {
        await fs.unlink(item.oldPath);
      } catch (error) {
        console.warn(`Failed to delete old file ${item.oldPath}`);
      }
    }
  }

  // Delete empty .d folders
  await cleanupDFolders(projectPath);

  // Create project index
  await saveProjectIndex(projectPath, migratedFiles);
}

/**
 * Clean up .d folders recursively
 * @param {string} dirPath - Directory path
 */
async function cleanupDFolders(dirPath) {
  const entries = await fs.readdir(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      if (entry.endsWith('.d')) {
        // Recursively clean subdirectories first
        await cleanupDFolders(fullPath);
        
        // Try to remove the directory
        try {
          await fs.rmdir(fullPath);
          console.log(`Removed empty folder: ${entry}`);
        } catch (error) {
          console.warn(`Failed to remove ${entry}: ${error.message}`);
        }
      } else {
        // Recurse into non-.d directories
        await cleanupDFolders(fullPath);
      }
    }
  }
}

/**
 * Create backup before migration
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<string>} - Backup path
 */
async function createBackup(projectPath) {
  const backupPath = `${projectPath}.backup-${Date.now()}`;
  
  async function copyRecursive(src, dest) {
    const stat = await fs.stat(src);
    
    if (stat.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      const entries = await fs.readdir(src);
      
      for (const entry of entries) {
        await copyRecursive(
          path.join(src, entry),
          path.join(dest, entry)
        );
      }
    } else {
      await fs.copyFile(src, dest);
    }
  }

  await copyRecursive(projectPath, backupPath);
  return backupPath;
}

/**
 * Rollback migration
 * @param {string} projectPath - Path to project directory
 * @param {string} backupPath - Backup path
 */
async function rollbackMigration(projectPath, backupPath) {
  console.log('Rolling back migration...');
  
  // Delete current project files
  const entries = await fs.readdir(projectPath);
  for (const entry of entries) {
    const fullPath = path.join(projectPath, entry);
    const stat = await fs.stat(fullPath);
    
    if (stat.isFile()) {
      await fs.unlink(fullPath);
    }
  }

  // Restore from backup
  const backupEntries = await fs.readdir(backupPath);
  for (const entry of backupEntries) {
    await fs.rename(
      path.join(backupPath, entry),
      path.join(projectPath, entry)
    );
  }

  // Remove backup directory
  await fs.rmdir(backupPath);
}

/**
 * Verify migration success
 * @param {string} projectPath - Path to project directory
 * @param {Array<object>} plan - Migration plan
 * @returns {Promise<boolean>}
 */
async function verifyMigration(projectPath, plan) {
  try {
    // Check all files exist with metadata
    for (const item of plan) {
      const { metadata } = await parseFile(item.newPath);
      
      if (metadata.id !== item.id) {
        return false;
      }
    }

    // Check no .d folders remain
    const hasDFolders = await needsMigration(projectPath);
    return !hasDFolders;
  } catch (error) {
    return false;
  }
}

/**
 * Perform complete migration with backup and rollback
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function migrateProject(projectPath) {
  let backupPath = null;

  try {
    // Check if migration needed
    if (!await needsMigration(projectPath)) {
      return { success: true, message: 'No migration needed' };
    }

    // Create backup
    backupPath = await createBackup(projectPath);
    console.log(`Backup created at ${backupPath}`);

    // Build plan
    const plan = await buildMigrationPlan(projectPath);
    console.log(`Migration plan: ${plan.length} files`);

    // Execute migration
    await executeMigration(projectPath, plan);

    // Verify
    const verified = await verifyMigration(projectPath, plan);
    if (!verified) {
      throw new Error('Migration verification failed');
    }

    // Clean up backup
    await fs.rm(backupPath, { recursive: true, force: true });

    return { success: true, message: `Migrated ${plan.length} files successfully` };
  } catch (error) {
    console.error('Migration failed:', error);

    // Rollback if backup exists
    if (backupPath) {
      try {
        await rollbackMigration(projectPath, backupPath);
        return { success: false, message: `Migration failed and rolled back: ${error.message}` };
      } catch (rollbackError) {
        return { success: false, message: `Migration and rollback failed: ${error.message}` };
      }
    }

    return { success: false, message: `Migration failed: ${error.message}` };
  }
}

module.exports = {
  needsMigration,
  buildMigrationPlan,
  executeMigration,
  createBackup,
  rollbackMigration,
  verifyMigration,
  migrateProject
};

/**
 * Check if a file needs projectId migration
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>}
 */
async function needsProjectIdMigration(filePath) {
  try {
    const { metadata } = await parseFile(filePath);
    // Check if projectId field is missing or undefined
    return metadata.projectId === undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Migrate a single file to add projectId field
 * @param {string} filePath - Path to the file
 * @param {string} workspacePath - Workspace root path
 * @returns {Promise<boolean>} - True if migration was performed
 */
async function migrateFileProjectId(filePath, workspacePath) {
  try {
    const { metadata, content } = await parseFile(filePath);
    
    // Skip if projectId already exists
    if (metadata.projectId !== undefined) {
      return false;
    }
    
    // Determine projectId based on file location
    const fileDir = path.dirname(filePath);
    let projectId = null;
    
    // If file is not in workspace root, it's in a project
    if (fileDir !== workspacePath) {
      // Find the project directory (immediate child of workspace)
      // This handles deeply nested files: workspace/project/subdir/file.txt
      let currentDir = fileDir;
      let projectDir = null;
      
      while (currentDir !== workspacePath && currentDir !== path.dirname(currentDir)) {
        const parentDir = path.dirname(currentDir);
        if (parentDir === workspacePath) {
          projectDir = currentDir;
          break;
        }
        currentDir = parentDir;
      }
      
      if (projectDir) {
        // Generate deterministic UUID from project path (same as getProjectId in fileManager)
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(projectDir).digest('hex');
        projectId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
      }
    }
    
    // Update metadata with projectId
    const updatedMetadata = {
      ...metadata,
      projectId: projectId
    };
    
    // Write back to file
    await writeFile(filePath, updatedMetadata, content);
    
    console.log(`[MIGRATION] Added projectId to ${path.basename(filePath)}: ${projectId || 'null'}`);
    return true;
  } catch (error) {
    console.error(`[MIGRATION] Error migrating file ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Migrate all files in workspace to add projectId field
 * @param {string} workspacePath - Workspace root path
 * @returns {Promise<{migrated: number, skipped: number, errors: number}>}
 */
async function migrateWorkspaceProjectIds(workspacePath) {
  const stats = { migrated: 0, skipped: 0, errors: 0 };
  
  async function scanDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip hidden files and directories
        if (entry.name.startsWith('.')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await scanDirectory(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.txt') || entry.name.endsWith('.canvas'))) {
          // Migrate .txt and .canvas files
          try {
            const migrated = await migrateFileProjectId(fullPath, workspacePath);
            if (migrated) {
              stats.migrated++;
            } else {
              stats.skipped++;
            }
          } catch (error) {
            console.error(`[MIGRATION] Error processing ${fullPath}:`, error.message);
            stats.errors++;
          }
        }
      }
    } catch (error) {
      console.error(`[MIGRATION] Error scanning directory ${dirPath}:`, error.message);
    }
  }
  
  console.log(`[MIGRATION] Starting projectId migration for workspace: ${workspacePath}`);
  await scanDirectory(workspacePath);
  console.log(`[MIGRATION] Migration complete. Migrated: ${stats.migrated}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
  
  return stats;
}

module.exports = {
  needsMigration,
  buildMigrationPlan,
  executeMigration,
  createBackup,
  rollbackMigration,
  verifyMigration,
  migrateProject,
  needsProjectIdMigration,
  migrateFileProjectId,
  migrateWorkspaceProjectIds
};
