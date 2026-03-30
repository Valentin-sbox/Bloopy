const { parseFile } = require('./metadataParser');
const fs = require('fs').promises;
const path = require('path');

/**
 * Build tree structure from flat file list
 * @param {Array<{path: string, metadata: object}>} files - Array of files with metadata
 * @returns {Array<object>} - Root level nodes
 */
function buildTree(files) {
  const fileMap = new Map();
  const rootNodes = [];

  // First pass: create map of all files by ID
  for (const file of files) {
    const node = {
      ...file.metadata,
      path: file.path,
      children: []
    };
    fileMap.set(file.metadata.id, node);
  }

  // Detect and break circular references
  detectAndBreakCircularReferences(fileMap);

  // Second pass: build parent-child relationships
  for (const node of fileMap.values()) {
    if (node.parentId && fileMap.has(node.parentId)) {
      const parent = fileMap.get(node.parentId);
      parent.children.push(node);
    } else {
      // No parent or parent doesn't exist - treat as root
      node.parentId = null;
      rootNodes.push(node);
    }
  }

  // Sort siblings at each level
  sortSiblings(rootNodes);
  for (const node of fileMap.values()) {
    if (node.children.length > 0) {
      sortSiblings(node.children);
    }
  }

  return rootNodes;
}

/**
 * Sort siblings using order field and sibling links
 * @param {Array<object>} siblings - Array of sibling nodes
 */
function sortSiblings(siblings) {
  // Try to use sibling links first
  const linkedOrder = buildLinkedOrder(siblings);
  if (linkedOrder.length === siblings.length) {
    siblings.splice(0, siblings.length, ...linkedOrder);
    return;
  }

  // Fallback to order field
  siblings.sort((a, b) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    // Secondary sort by name for stability
    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Build order using sibling links
 * @param {Array<object>} siblings - Array of sibling nodes
 * @returns {Array<object>} - Ordered array
 */
function buildLinkedOrder(siblings) {
  if (siblings.length === 0) return [];

  const nodeMap = new Map(siblings.map(s => [s.id, s]));
  
  // Find the head (node with no prevSibling or prevSibling not in set)
  let head = null;
  for (const node of siblings) {
    if (!node.prevSibling || !nodeMap.has(node.prevSibling)) {
      head = node;
      break;
    }
  }

  if (!head) return []; // Circular or broken links

  // Follow nextSibling links
  const ordered = [];
  let current = head;
  const visited = new Set();

  while (current && ordered.length < siblings.length) {
    if (visited.has(current.id)) break; // Circular reference
    visited.add(current.id);
    ordered.push(current);
    
    if (current.nextSibling && nodeMap.has(current.nextSibling)) {
      current = nodeMap.get(current.nextSibling);
    } else {
      break;
    }
  }

  return ordered;
}

/**
 * Detect and break circular references in parent-child relationships
 * @param {Map<string, object>} fileMap - Map of file ID to node
 */
function detectAndBreakCircularReferences(fileMap) {
  for (const node of fileMap.values()) {
    if (hasCircularReference(node, fileMap)) {
      console.warn(`Circular reference detected for file ${node.id} (${node.name}). Breaking cycle.`);
      node.parentId = null;
    }
  }
}

/**
 * Check if a node has circular reference in its ancestry
 * @param {object} node - Node to check
 * @param {Map<string, object>} fileMap - Map of file ID to node
 * @returns {boolean}
 */
function hasCircularReference(node, fileMap) {
  const visited = new Set();
  let current = node;

  while (current.parentId) {
    if (visited.has(current.id)) {
      return true; // Circular reference detected
    }
    visited.add(current.id);

    if (!fileMap.has(current.parentId)) {
      break; // Parent doesn't exist
    }
    current = fileMap.get(current.parentId);
  }

  return false;
}

/**
 * Find a file by ID in the tree
 * @param {Array<object>} tree - Tree root nodes
 * @param {string} id - File ID to find
 * @returns {object|null}
 */
function findFileById(tree, id) {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findFileById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get ancestors of a file
 * @param {object} node - Node to get ancestors for
 * @param {Map<string, object>} fileMap - Map of file ID to node
 * @returns {Array<object>} - Array of ancestor nodes from root to parent
 */
function getAncestors(node, fileMap) {
  const ancestors = [];
  let current = node;

  while (current.parentId && fileMap.has(current.parentId)) {
    const parent = fileMap.get(current.parentId);
    ancestors.unshift(parent);
    current = parent;
  }

  return ancestors;
}

/**
 * Load project files and build tree
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<Array<object>>} - Root level nodes
 */
async function loadProjectTree(projectPath) {
  try {
    const entries = await fs.readdir(projectPath);
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(projectPath, entry);
      const stat = await fs.stat(fullPath);

      if (stat.isFile() && (entry.endsWith('.txt') || entry.endsWith('.canvas'))) {
        try {
          const { metadata } = await parseFile(fullPath);
          files.push({ path: fullPath, metadata });
        } catch (error) {
          console.warn(`Failed to parse ${entry}: ${error.message}`);
        }
      }
    }

    return buildTree(files);
  } catch (error) {
    throw new Error(`Failed to load project tree: ${error.message}`);
  }
}

module.exports = {
  buildTree,
  sortSiblings,
  findFileById,
  getAncestors,
  detectAndBreakCircularReferences,
  loadProjectTree
};
