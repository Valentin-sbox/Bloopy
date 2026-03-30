const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

/**
 * Write file with metadata and content
 * @param {string} filePath - Path to the file
 * @param {object} metadata - Metadata object
 * @param {string} content - File content
 * @returns {Promise<void>}
 */
async function writeFile(filePath, metadata, content) {
  console.log('[METADATA-WRITER] Escribiendo archivo:', filePath);
  console.log('[METADATA-WRITER] Metadata:', JSON.stringify(metadata, null, 2));
  console.log('[METADATA-WRITER] Tamaño del contenido:', content ? content.length : 0);
  
  const yamlBlock = yaml.dump(metadata, { lineWidth: -1 });
  const fileContent = `---\n${yamlBlock}---\n${content}`;
  
  console.log('[METADATA-WRITER] Tamaño total del archivo:', fileContent.length);
  
  // Atomic write pattern: write to temp file then rename
  const tempPath = `${filePath}.bloopy-temp`;
  
  try {
    console.log('[METADATA-WRITER] Escribiendo archivo temporal:', tempPath);
    await fs.writeFile(tempPath, fileContent, 'utf-8');
    
    console.log('[METADATA-WRITER] Renombrando archivo temporal a definitivo');
    await fs.rename(tempPath, filePath);
    
    console.log('[METADATA-WRITER] Archivo escrito exitosamente');
  } catch (error) {
    console.error('[METADATA-WRITER] Error al escribir archivo:', error);
    // Clean up temp file on failure
    try {
      await fs.unlink(tempPath);
      console.log('[METADATA-WRITER] Archivo temporal eliminado');
    } catch {}
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
  }
}

/**
 * Update metadata in an existing file
 * @param {string} filePath - Path to the file
 * @param {object} metadataUpdates - Partial metadata updates
 * @returns {Promise<void>}
 */
async function updateMetadata(filePath, metadataUpdates) {
  const { parseFile } = require('./metadataParser');
  
  try {
    const { metadata, content } = await parseFile(filePath);
    const updatedMetadata = {
      ...metadata,
      ...metadataUpdates,
      updatedAt: new Date().toISOString()
    };
    
    await writeFile(filePath, updatedMetadata, content);
  } catch (error) {
    throw new Error(`Failed to update metadata for ${filePath}: ${error.message}`);
  }
}

module.exports = {
  writeFile,
  updateMetadata
};
