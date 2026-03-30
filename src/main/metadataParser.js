const fs = require('fs').promises;
const yaml = require('js-yaml');
const { v4: uuidv4 } = require('uuid');

/**
 * Parse a file to extract YAML metadata and content
 * @param {string} filePath - Path to the file
 * @returns {Promise<{metadata: object, content: string}>}
 */
async function parseFile(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return extractMetadata(fileContent);
  } catch (error) {
    throw new Error(`Failed to parse file ${filePath}: ${error.message}`);
  }
}

/**
 * Extract metadata from file content
 * @param {string} fileContent - Raw file content
 * @returns {{metadata: object, content: string}}
 */
function extractMetadata(fileContent) {
  const lines = fileContent.split('\n');
  
  // Check if file starts with YAML delimiter
  if (lines[0] !== '---') {
    return {
      metadata: generateDefaultMetadata(),
      content: fileContent
    };
  }

  // Find closing delimiter
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return {
      metadata: generateDefaultMetadata(),
      content: fileContent
    };
  }

  // Extract YAML block
  const yamlBlock = lines.slice(1, endIndex).join('\n');
  const content = lines.slice(endIndex + 1).join('\n');

  try {
    const metadata = yaml.load(yamlBlock) || {};
    const validatedMetadata = validateMetadata(metadata);
    return { metadata: validatedMetadata, content };
  } catch (error) {
    console.warn(`Invalid YAML metadata: ${error.message}`);
    return {
      metadata: generateDefaultMetadata(),
      content: fileContent
    };
  }
}

/**
 * Generate default metadata for a file
 * @param {object} overrides - Optional field overrides
 * @returns {object}
 */
function generateDefaultMetadata(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: 'Untitled',
    parentId: null,
    projectId: null, // null for root files, uuid for project files
    order: 0,
    children: [],
    prevSibling: null,
    nextSibling: null,
    createdAt: now,
    updatedAt: now,
    lastCharCount: 0,
    customIcon: null,
    ...overrides
  };
}

/**
 * Validate metadata and fill missing required fields
 * @param {object} metadata - Metadata object to validate
 * @returns {object} - Validated metadata with defaults
 */
function validateMetadata(metadata) {
  const defaults = generateDefaultMetadata();
  const validated = { ...defaults };

  // Preserve existing fields
  for (const key in metadata) {
    if (metadata[key] !== undefined && metadata[key] !== null) {
      validated[key] = metadata[key];
    }
  }

  // Ensure arrays are arrays
  if (!Array.isArray(validated.children)) {
    validated.children = [];
  }

  return validated;
}

module.exports = {
  parseFile,
  extractMetadata,
  generateDefaultMetadata,
  validateMetadata
};
