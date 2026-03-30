const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { generateDefaultMetadata, parseFile } = require('./metadataParser');
const { writeFile, updateMetadata } = require('./metadataWriter');
const { saveProjectIndex, getProjectIndex } = require('./projectIndex');

/**
 * Generate a deterministic UUID for a project based on its path
 * @param {string} projectPath - Path to project directory
 * @returns {string} - UUID for the project
 */
function getProjectId(projectPath) {
  // Generate a deterministic UUID from the project path
  // This ensures the same project always gets the same UUID
  const hash = crypto.createHash('sha256').update(projectPath).digest('hex');
  // Convert hash to UUID format (8-4-4-4-12)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Determine if a path is a workspace root or a project directory
 * @param {string} dirPath - Directory path to check
 * @param {string} workspacePath - Workspace root path (optional)
 * @returns {string|null} - Project UUID if in project, null if in workspace root
 */
function determineProjectId(dirPath, workspacePath = null) {
  // If workspacePath is provided and dirPath equals it, this is a root file
  if (workspacePath && dirPath === workspacePath) {
    return null;
  }

  // Otherwise, generate project UUID from the directory path
  return getProjectId(dirPath);
}

/**
 * Generate empty canvas snapshot for new .canvas files
 * 
 * Structure:
 * - tldrawSnapshot: Contains the tldraw editor state
 *   - store: Empty object for tldraw records (shapes, pages, etc.)
 *   - schema: Version information for tldraw compatibility
 *     - schemaVersion: Schema version (1)
 *     - storeVersion: Store version (4)
 *     - recordVersions: Version numbers for each entity type
 *       - asset: Assets like images, videos (v1)
 *       - camera: Camera position and zoom (v1)
 *       - document: Document-level settings (v2)
 *       - instance: Editor instance state (v22)
 *       - instance_page_state: Page-specific instance state (v5)
 *       - page: Page records (v1)
 *       - shape: Shape records (v3)
 *       - instance_presence: Collaboration presence (v5)
 *       - pointer: Pointer/cursor state (v1)
 * - metadata: Bloopy-specific metadata
 *   - created: ISO timestamp of creation
 *   - modified: ISO timestamp of last modification
 *   - version: Canvas format version
 *   - appVersion: Bloopy application version
 * 
 * @returns {object} - Empty tldraw snapshot with metadata
 */
function getEmptyCanvasSnapshot() {
  return {
    tldrawSnapshot: {
      store: {},
      schema: {
        schemaVersion: 1,
        storeVersion: 4,
        recordVersions: {
          asset: { version: 1 },
          camera: { version: 1 },
          document: { version: 2 },
          instance: { version: 22 },
          instance_page_state: { version: 5 },
          page: { version: 1 },
          shape: { version: 3 },
          instance_presence: { version: 5 },
          pointer: { version: 1 }
        }
      }
    },
    metadata: {
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      version: '1.0',
      appVersion: '1.0.0'
    }
  };
}

/**
 * Create a new file
 * @param {string} projectPath - Path to project directory or workspace root
 * @param {string} fileName - Name of the file
 * @param {string} parentId - Parent file ID (null for root)
 * @param {string} content - Initial content
 * @param {string} workspacePath - Workspace root path (optional, for determining projectId)
 * @returns {Promise<object>} - Created file metadata
 */
async function createFile(projectPath, fileName, parentId = null, content = '', workspacePath = null) {
  const id = uuidv4();

  // Determine projectId based on location
  const projectId = determineProjectId(projectPath, workspacePath);

  // Detectar si es archivo .canvas
  const isCanvas = fileName.toLowerCase().endsWith('.canvas');
  
  // Limpiar nombre de archivo
  const cleanName = fileName.replace(/\.(txt|canvas)$/i, '').trim();

  // Sanitizar para nombre de archivo físico
  const safeName = cleanName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim();

  const finalSafeName = safeName || (isCanvas ? 'Nota sin nombre' : 'Archivo sin nombre');

  const metadata = generateDefaultMetadata({
    id,
    name: cleanName,
    parentId,
    projectId,
    lastCharCount: isCanvas ? 0 : content.length,
    uuid: id
  });

  // Determinar extensión y contenido inicial
  const fileExt = isCanvas ? '.canvas' : '.txt';
  const fileNameWithExt = `${finalSafeName}${fileExt}`;
  const filePath = path.join(projectPath, fileNameWithExt);
  
  // Si es canvas y no hay contenido, usar snapshot vacío
  let finalContent = content;
  if (isCanvas && !content) {
    finalContent = JSON.stringify(getEmptyCanvasSnapshot(), null, 2);
  }

  // Verificar si ya existe un archivo con ese nombre
  let finalPath = filePath;
  let counter = 1;
  while (true) {
    try {
      await fs.access(finalPath);
      finalPath = path.join(projectPath, `${finalSafeName} (${counter})${fileExt}`);
      counter++;
    } catch {
      break;
    }
  }

  await writeFile(finalPath, metadata, finalContent);

  if (parentId) {
    // Pasar projectPath como contexto para encontrar al padre
    await addChildToParent(projectPath, parentId, id);
  }

  await updateProjectCache(projectPath);

  return { ...metadata, path: finalPath };
}

/**
 * Delete a file
 * @param {string} projectPath - Path to project directory
 * @param {string} fileId - File ID to delete
 * @returns {Promise<void>}
 */
async function deleteFile(projectPath, fileId) {
  const files = await getProjectIndex(projectPath);
  const file = files.find(f => f.id === fileId);

  if (!file) {
    throw new Error(`File ${fileId} not found`);
  }

  // Remove from parent's children array
  if (file.parentId) {
    await removeChildFromParent(projectPath, file.parentId, fileId);
  }

  // Update sibling links
  await updateSiblingLinks(projectPath, file.prevSibling, file.nextSibling);

  // Delete physical file - buscar por UUID usando búsqueda robusta
  const fileName = await findFileByUUID(projectPath, fileId);

  if (fileName) {
    const filePath = path.join(projectPath, fileName);
    await fs.unlink(filePath);
  }

  // Update cache
  await updateProjectCache(projectPath);
}

/**
 * Rename a file
 * @param {string} projectPath - Path to project directory
 * @param {string} fileId - File ID to rename
 * @param {string} newName - New file name
 * @returns {Promise<string>} - New file path
 */
async function renameFile(projectPath, fileId, newName) {
  const { parseFile } = require('./metadataParser');

  // Encontrar archivo actual usando búsqueda robusta
  const oldFileName = await findFileByUUID(projectPath, fileId);

  if (!oldFileName) {
    throw new Error(`File with ID ${fileId} not found`);
  }

  const oldPath = path.join(projectPath, oldFileName);
  
  // Detectar si es archivo .canvas
  const isCanvas = oldFileName.toLowerCase().endsWith('.canvas');
  const fileExt = isCanvas ? '.canvas' : '.txt';

  // Limpiar nuevo nombre
  const cleanName = newName.replace(/\.(txt|canvas)$/i, '').trim();

  // Sanitizar para nombre de archivo físico - MEJORADO
  const safeName = cleanName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim();

  // Validar que el nombre no esté vacío
  const finalSafeName = safeName || (isCanvas ? 'Nota sin nombre' : 'Archivo sin nombre');

  // Construir nuevo nombre: SOLO nombre limpio, SIN UUID, con extensión correcta
  const newFileName = `${finalSafeName}${fileExt}`;
  let newPath = path.join(projectPath, newFileName);

  // Verificar si ya existe y agregar número si es necesario
  let counter = 1;
  while (true) {
    try {
      await fs.access(newPath);
      // Si existe y no es el mismo archivo, agregar número
      if (newPath !== oldPath) {
        newPath = path.join(projectPath, `${finalSafeName} (${counter})${fileExt}`);
        counter++;
      } else {
        break; // Es el mismo archivo, no hacer nada
      }
    } catch {
      // No existe, usar este nombre
      break;
    }
  }

  // Leer contenido actual
  const { metadata, content } = await parseFile(oldPath);

  // Actualizar metadata con nuevo nombre
  metadata.name = cleanName;
  metadata.updatedAt = new Date().toISOString();

  // Escribir en nueva ubicación
  await writeFile(newPath, metadata, content);

  // Eliminar archivo antiguo solo si es diferente
  if (oldPath !== newPath) {
    await fs.unlink(oldPath);
  }

  await updateProjectCache(projectPath);

  return newPath;
}

/**
 * Move a file to a new parent
 * @param {string} projectPath - Path to project directory
 * @param {string} fileId - File ID to move
 * @param {string} newParentId - New parent ID (null for root)
 * @param {string} destPath - Destination path (optional, for determining projectId)
 * @param {string} workspacePath - Workspace root path (optional, for determining projectId)
 * @returns {Promise<void>}
 */
async function moveFile(projectPath, fileId, newParentId, destPath = null, workspacePath = null) {
  const files = await getProjectIndex(projectPath);
  const file = files.find(f => f.id === fileId);

  if (!file) {
    throw new Error(`File ${fileId} not found`);
  }

  // Identificar directorios origen y destino
  const sourceDir = projectPath;
  let destDir = destPath || projectPath;

  // Si destPath es un archivo, obtener su directorio
  try {
    const stats = await fs.lstat(destDir);
    if (!stats.isDirectory()) {
      destDir = path.dirname(destDir);
    }
  } catch (e) {
    // Si no existe, asumir que path.dirname nos da el contenedor
    if (destDir.endsWith('.txt') || destDir.endsWith('.canvas')) {
      destDir = path.dirname(destDir);
    }
  }

  // Remove from old parent
  if (file.parentId) {
    await removeChildFromParent(sourceDir, file.parentId, fileId);
  }

  // Update sibling links in old location
  await updateSiblingLinks(sourceDir, file.prevSibling, file.nextSibling);

  // Buscar archivo físico por UUID
  const fileName = await findFileByUUID(sourceDir, fileId);
  if (!fileName) {
    throw new Error(`Physical file for ${fileId} not found in ${sourceDir}`);
  }

  const sourceFilePath = path.join(sourceDir, fileName);
  let finalDestPath = path.join(destDir, fileName);

  // Manejar colisiones en el destino si es una carpeta diferente
  if (sourceDir !== destDir) {
    let counter = 1;
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    while (true) {
      try {
        await fs.access(finalDestPath);
        finalDestPath = path.join(destDir, `${baseName} (${counter})${ext}`);
        counter++;
      } catch {
        break;
      }
    }
    
    // MOVER FÍSICAMENTE EL ARCHIVO
    console.log(`[MOVE-FILE] Moviendo físicamente: ${sourceFilePath} -> ${finalDestPath}`);
    await fs.rename(sourceFilePath, finalDestPath);
  }

  // Determine new projectId
  const newProjectId = determineProjectId(destDir, workspacePath);

  // Update file's parentId and projectId in metadata
  await updateMetadata(finalDestPath, {
    parentId: newParentId,
    projectId: newProjectId,
    prevSibling: null,
    nextSibling: null
  });

  // Add to new parent (en el directorio de destino)
  if (newParentId) {
    await addChildToParent(destDir, newParentId, fileId);
  }

  // Update caches
  await updateProjectCache(sourceDir);
  if (sourceDir !== destDir) {
    await updateProjectCache(destDir);
  }
}

/**
 * Reorder files (update order and sibling links)
 * @param {string} projectPath - Path to project directory
 * @param {Array<{id: string, order: number, prevSibling: string|null, nextSibling: string|null}>} updates - Array of updates
 * @returns {Promise<void>}
 */
async function reorderFiles(projectPath, updates) {
  for (const update of updates) {
    const fileName = await findFileByUUID(projectPath, update.id);
    if (fileName) {
      const filePath = path.join(projectPath, fileName);
      await updateMetadata(filePath, {
        order: update.order,
        prevSibling: update.prevSibling,
        nextSibling: update.nextSibling
      });
    }
  }

  await updateProjectCache(projectPath);
}

/**
 * Get siblings of a file
 * @param {string} projectPath - Path to project directory
 * @param {string} fileId - File ID
 * @returns {Promise<Array<object>>} - Array of sibling files
 */
async function getSiblings(projectPath, fileId) {
  const files = await getProjectIndex(projectPath);
  const file = files.find(f => f.id === fileId);

  if (!file) {
    return [];
  }

  return files.filter(f => f.parentId === file.parentId && f.id !== fileId);
}

/**
 * Save file content and update metadata
 * @param {string} projectPath - Path to project directory
 * @param {string} fileId - File ID
 * @param {string} content - New content
 * @returns {Promise<void>}
 */
async function saveFile(projectPath, fileId, content) {
  const { parseFile } = require('./metadataParser');
  const fs = require('fs').promises;

  // Buscar archivo físico por UUID en metadata
  const dirFiles = await fs.readdir(projectPath);
  let targetFile = null;
  let isCanvas = false;

  for (const fileName of dirFiles) {
    if (!fileName.endsWith('.txt') && !fileName.endsWith('.canvas')) continue;

    try {
      const filePath = path.join(projectPath, fileName);
      const { metadata } = await parseFile(filePath);

      // Buscar por UUID en metadata
      if (metadata.id === fileId || metadata.uuid === fileId) {
        targetFile = fileName;
        isCanvas = fileName.endsWith('.canvas');
        break;
      }
    } catch (e) {
      // Ignorar archivos que no se pueden parsear
      continue;
    }
  }

  if (!targetFile) {
    throw new Error(`Physical file for ${fileId} not found`);
  }

  const filePath = path.join(projectPath, targetFile);
  const { metadata } = await parseFile(filePath);

  // Validar JSON y estructura tldraw si es archivo .canvas
  if (isCanvas) {
    try {
      const parsed = JSON.parse(content);
      
      // Validar estructura tldraw completa
      if (!parsed.tldrawSnapshot || typeof parsed.tldrawSnapshot !== 'object') {
        throw new Error('Falta la propiedad tldrawSnapshot en el archivo');
      }
      
      const snapshot = parsed.tldrawSnapshot;
      
      if (!snapshot.store || typeof snapshot.store !== 'object') {
        throw new Error('Falta la propiedad tldrawSnapshot.store');
      }
      
      if (!snapshot.schema || typeof snapshot.schema !== 'object') {
        throw new Error('Falta la propiedad tldrawSnapshot.schema');
      }
      
      if (typeof snapshot.schema.schemaVersion !== 'number') {
        throw new Error('La propiedad schema.schemaVersion debe ser un número');
      }
      
      if (typeof snapshot.schema.storeVersion !== 'number') {
        throw new Error('La propiedad schema.storeVersion debe ser un número');
      }
      
    } catch (e) {
      throw new Error(`Archivo .canvas inválido: ${e.message}`);
    }
  }

  metadata.lastCharCount = isCanvas ? 0 : content.length;
  metadata.updatedAt = new Date().toISOString();

  await writeFile(filePath, metadata, content);
  await updateProjectCache(projectPath);
}

/**
 * Update file metadata
 * @param {string} projectPath - Path to project directory
 * @param {string} fileId - File ID
 * @param {object} metadataUpdates - Partial metadata updates
 * @returns {Promise<void>}
 */
async function updateFileMetadata(projectPath, fileId, metadataUpdates) {
  // Buscar archivo físico por UUID usando búsqueda robusta
  const fileName = await findFileByUUID(projectPath, fileId);

  if (!fileName) {
    throw new Error(`Physical file for ${fileId} not found`);
  }

  const filePath = path.join(projectPath, fileName);
  await updateMetadata(filePath, metadataUpdates);
  await updateProjectCache(projectPath);
}

// Helper functions

/**
 * Find physical file by UUID in metadata
 * @param {string} projectPath - Path to project directory
 * @param {string} fileId - File UUID to search for
 * @returns {Promise<string|null>} - File name or null if not found
 */
async function findFileByUUID(searchPath, fileId) {
  const { parseFile } = require('./metadataParser');

  try {
    const dirFiles = await fs.readdir(searchPath);

    // Primero intentar búsqueda rápida por nombre de archivo
    const quickMatch = dirFiles.find(f =>
      (f.endsWith('.txt') || f.endsWith('.canvas')) && f.includes(fileId.substring(0, 8))
    );

    if (quickMatch) {
      try {
        const filePath = path.join(searchPath, quickMatch);
        const { metadata } = await parseFile(filePath);
        if (metadata.id === fileId || metadata.uuid === fileId) {
          return quickMatch;
        }
      } catch (e) {
        // Fallback to exhaustive search
      }
    }

    // Búsqueda exhaustiva
    for (const fileName of dirFiles) {
      if (!fileName.endsWith('.txt') && !fileName.endsWith('.canvas')) continue;

      try {
        const filePath = path.join(searchPath, fileName);
        const { metadata } = await parseFile(filePath);

        if (metadata.id === fileId || metadata.uuid === fileId) {
          return fileName;
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  } catch (e) {
    console.error(`[FIND-FILE] Error searching in ${searchPath}:`, e.message);
    return null;
  }
}

async function addChildToParent(directoryPath, parentId, childId) {
  const { parseFile } = require('./metadataParser');

  // Buscar archivo padre por UUID usando búsqueda robusta
  const parentFileName = await findFileByUUID(directoryPath, parentId);

  if (!parentFileName) {
    throw new Error(`Parent file ${parentId} not found`);
  }

  const parentPath = path.join(directoryPath, parentFileName);
  const { metadata, content } = await parseFile(parentPath);

  if (!metadata.children.includes(childId)) {
    metadata.children.push(childId);
    await writeFile(parentPath, metadata, content);
  }
}

async function removeChildFromParent(directoryPath, parentId, childId) {
  const { parseFile } = require('./metadataParser');

  // Buscar archivo padre por UUID usando búsqueda robusta
  const parentFileName = await findFileByUUID(directoryPath, parentId);

  if (!parentFileName) {
    return; // Parent might have been deleted
  }

  const parentPath = path.join(directoryPath, parentFileName);
  const { metadata, content } = await parseFile(parentPath);

  metadata.children = metadata.children.filter(id => id !== childId);
  await writeFile(parentPath, metadata, content);
}

async function updateSiblingLinks(projectPath, prevSiblingId, nextSiblingId) {
  if (prevSiblingId) {
    const prevFileName = await findFileByUUID(projectPath, prevSiblingId);
    if (prevFileName) {
      const prevPath = path.join(projectPath, prevFileName);
      await updateMetadata(prevPath, { nextSibling: nextSiblingId });
    }
  }

  if (nextSiblingId) {
    const nextFileName = await findFileByUUID(projectPath, nextSiblingId);
    if (nextFileName) {
      const nextPath = path.join(projectPath, nextFileName);
      await updateMetadata(nextPath, { prevSibling: prevSiblingId });
    }
  }
}

async function updateProjectCache(projectPath) {
  const { rebuildProjectIndex } = require('./projectIndex');
  await rebuildProjectIndex(projectPath);
}

module.exports = {
  createFile,
  deleteFile,
  renameFile,
  moveFile,
  reorderFiles,
  getSiblings,
  saveFile,
  updateFileMetadata,
  getProjectId,
  determineProjectId,
  getEmptyCanvasSnapshot
};
