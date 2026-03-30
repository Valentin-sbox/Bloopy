const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { parseFile } = require('./metadataParser');

const INDEX_FILENAME = 'project.index.json';

/**
 * Load project index from cache
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<object|null>} - Index object or null if invalid
 */
async function loadProjectIndex(projectPath) {
  const indexPath = path.join(projectPath, INDEX_FILENAME);
  
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(content);
    
    if (await isCacheValid(projectPath, index)) {
      return index;
    }
    
    console.log('Cache invalid, rebuilding...');
    return null;
  } catch (error) {
    // Cache doesn't exist or is corrupted
    return null;
  }
}

/**
 * Save project index to cache
 * @param {string} projectPath - Path to project directory
 * @param {Array<object>} files - Array of file metadata
 * @returns {Promise<void>}
 */
async function saveProjectIndex(projectPath, files) {
  const indexPath = path.join(projectPath, INDEX_FILENAME);
  
  const index = {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    checksum: calculateChecksum(files),
    files: files.map(f => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      projectId: f.projectId !== undefined ? f.projectId : null, // Include projectId
      order: f.order,
      children: f.children || [],
      prevSibling: f.prevSibling,
      nextSibling: f.nextSibling,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      lastCharCount: f.lastCharCount,
      path: f.path
    }))
  };

  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Check if cache is valid
 * @param {string} projectPath - Path to project directory
 * @param {object} index - Index object
 * @returns {Promise<boolean>}
 */
async function isCacheValid(projectPath, index) {
  if (!index || !index.files || !index.checksum) {
    return false;
  }

  try {
    // Quick check: compare file count
    const entries = await fs.readdir(projectPath);
    const txtFiles = entries.filter(e => e.endsWith('.txt') || e.endsWith('.canvas'));
    
    if (txtFiles.length !== index.files.length) {
      return false;
    }

    // Verify checksum
    const currentChecksum = calculateChecksum(index.files);
    return currentChecksum === index.checksum;
  } catch (error) {
    return false;
  }
}

/**
 * Rebuild project index from individual files
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<Array<object>>} - Array of file metadata
 */
async function rebuildProjectIndex(projectPath) {
  const entries = await fs.readdir(projectPath);
  const files = [];

  for (const entry of entries) {
    if (!entry.endsWith('.txt') && !entry.endsWith('.canvas')) continue;

    const fullPath = path.join(projectPath, entry);
    try {
      const { metadata } = await parseFile(fullPath);
      files.push({
        ...metadata,
        path: fullPath
      });
    } catch (error) {
      console.warn(`Failed to parse ${entry}: ${error.message}`);
    }
  }

  await saveProjectIndex(projectPath, files);
  return files;
}

/**
 * Invalidate project index cache
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<void>}
 */
async function invalidateProjectIndex(projectPath) {
  const indexPath = path.join(projectPath, INDEX_FILENAME);
  try {
    await fs.unlink(indexPath);
  } catch (error) {
    // Ignore if file doesn't exist
  }
}

/**
 * Calculate checksum for file list
 * @param {Array<object>} files - Array of file metadata
 * @returns {string} - Checksum hash
 */
function calculateChecksum(files) {
  const data = files.map(f => `${f.id}:${f.updatedAt}`).sort().join('|');
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Get or rebuild project index
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<Array<object>>} - Array of file metadata
 */
async function getProjectIndex(projectPath) {
  const index = await loadProjectIndex(projectPath);
  
  if (index && index.files) {
    return index.files;
  }

  return await rebuildProjectIndex(projectPath);
}

module.exports = {
  loadProjectIndex,
  saveProjectIndex,
  isCacheValid,
  rebuildProjectIndex,
  invalidateProjectIndex,
  getProjectIndex
};
