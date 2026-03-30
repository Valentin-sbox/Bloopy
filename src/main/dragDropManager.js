/**
 * ============================================================================
 * DRAG & DROP MANAGER
 * ============================================================================
 * 
 * Gestiona las operaciones de drag & drop con el nuevo sistema de metadatos
 */

const metadata = require('./index');
const path = require('path');

/**
 * Mueve un archivo a un nuevo padre
 * @param {string} sourcePath - Ruta del archivo a mover
 * @param {string} destPath - Ruta del archivo padre destino
 * @returns {Promise<void>}
 */
async function moveFileToParent(sourcePath, destPath) {
  const projectPath = path.dirname(sourcePath);
  
  // Obtener IDs
  const { metadata: sourceMeta } = await metadata.parseFile(sourcePath);
  const { metadata: destMeta } = await metadata.parseFile(destPath);
  
  // Mover usando el sistema de metadatos
  await metadata.moveFile(projectPath, sourceMeta.id, destMeta.id);
  
  console.log(`[DRAG-DROP] Archivo ${sourceMeta.name} movido a ${destMeta.name}`);
}

/**
 * Reordena archivos hermanos
 * @param {string} projectPath - Ruta del proyecto
 * @param {Array<{id: string, order: number}>} reorderData - Datos de reordenamiento
 * @returns {Promise<void>}
 */
async function reorderSiblings(projectPath, reorderData) {
  // Construir updates con sibling links
  const updates = [];
  
  for (let i = 0; i < reorderData.length; i++) {
    const item = reorderData[i];
    const prevSibling = i > 0 ? reorderData[i - 1].id : null;
    const nextSibling = i < reorderData.length - 1 ? reorderData[i + 1].id : null;
    
    updates.push({
      id: item.id,
      order: i,
      prevSibling,
      nextSibling
    });
  }
  
  await metadata.reorderFiles(projectPath, updates);
  
  console.log(`[DRAG-DROP] Reordenados ${updates.length} archivos`);
}

/**
 * Mueve un archivo entre posiciones de hermanos
 * @param {string} projectPath - Ruta del proyecto
 * @param {string} fileId - ID del archivo a mover
 * @param {number} fromIndex - Índice origen
 * @param {number} toIndex - Índice destino
 * @param {Array<string>} siblingIds - IDs de todos los hermanos en orden
 * @returns {Promise<void>}
 */
async function moveBetweenSiblings(projectPath, fileId, fromIndex, toIndex, siblingIds) {
  // Crear nuevo orden
  const newOrder = [...siblingIds];
  newOrder.splice(fromIndex, 1);
  newOrder.splice(toIndex, 0, fileId);
  
  // Construir datos de reordenamiento
  const reorderData = newOrder.map((id, index) => ({ id, order: index }));
  
  await reorderSiblings(projectPath, reorderData);
  
  console.log(`[DRAG-DROP] Archivo movido de posición ${fromIndex} a ${toIndex}`);
}

/**
 * Mueve un archivo a la raíz del proyecto
 * @param {string} sourcePath - Ruta del archivo a mover
 * @returns {Promise<void>}
 */
async function moveToRoot(sourcePath) {
  const projectPath = path.dirname(sourcePath);
  const { metadata: sourceMeta } = await metadata.parseFile(sourcePath);
  
  // Mover a root (parentId = null)
  await metadata.moveFile(projectPath, sourceMeta.id, null);
  
  console.log(`[DRAG-DROP] Archivo ${sourceMeta.name} movido a raíz`);
}

/**
 * Obtiene los hermanos de un archivo
 * @param {string} filePath - Ruta del archivo
 * @returns {Promise<Array<object>>} - Array de hermanos
 */
async function getSiblings(filePath) {
  const projectPath = path.dirname(filePath);
  const { metadata: fileMeta } = await metadata.parseFile(filePath);
  
  return await metadata.getSiblings(projectPath, fileMeta.id);
}

module.exports = {
  moveFileToParent,
  reorderSiblings,
  moveBetweenSiblings,
  moveToRoot,
  getSiblings
};
