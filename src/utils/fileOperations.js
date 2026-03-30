/**
 * ============================================================================
 *  FILE OPERATIONS UTILITIES
 * ============================================================================
 * 
 * Utilidades para operaciones de archivos con preservación de jerarquía.
 * 
 * FUNCIONALIDADES:
 * - Guardar archivos preservando estructura jerárquica
 * - Verificar existencia de carpetas .d
 * - Preservar array de items en archivos padre
 * 
 * ============================================================================
 */

/**
 * Guarda un archivo verificando y preservando su estructura jerárquica.
 * 
 * ACTUALIZADO: Ahora usa el nuevo sistema de metadatos YAML
 * 
 * @param {string} fullPath - Ruta completa del archivo a guardar
 * @param {string} content - Contenido HTML del archivo
 * @param {Object} metadata - Metadatos del archivo (status, goal, comments, etc.)
 * @returns {Promise<Object>} Metadata actualizada con items preservados si aplica
 */
export async function saveFileWithHierarchyCheck(fullPath, content, metadata) {
  try {
    console.log('[SAVE-FILE] Actualizando archivo con nuevo sistema:', fullPath);

    // El nuevo sistema usa metadata YAML embebida, por lo que saveFile
    // ya se encarga de preservar la jerarquía (que está en los metadatos)
    await window.electronAPI.saveFile(fullPath, content, metadata);

    return {
      ...metadata,
      type: 'file'
    };

  } catch (error) {
    console.error('[SAVE-FILE] Error en saveFileWithHierarchyCheck:', error);
    throw error;
  }
}

// hasHierarchy y getSubFiles han sido eliminados por ser obsoletos (usaban carpetas .d)
// El sistema ahora gestiona la jerarquía a través de los metadatos embebidos.

/**
 * ============================================================================
 * OPERATION QUEUE - Sistema de cola para prevenir race conditions
 * ============================================================================
 */

/**
 * Cola de operaciones para serializar actualizaciones de archivos.
 * Previene race conditions y sobrescritura de datos en actualizaciones encadenadas.
 */
class OperationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  /**
   * Encola una operación para ejecución secuencial.
   * 
   * @param {Function} operation - Función async que ejecuta la operación
   * @returns {Promise} Promesa que se resuelve con el resultado de la operación
   */
  async enqueue(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      this.process();
    });
  }

  /**
   * Procesa la cola de operaciones secuencialmente.
   */
  async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const { operation, resolve, reject } = this.queue.shift();

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.processing = false;
      this.process(); // Procesar siguiente operación
    }
  }
}

// Instancia global de la cola de operaciones
const fileOperationQueue = new OperationQueue();

/**
 * Actualiza un archivo de forma segura con verificación de existencia e integridad.
 * 
 * Esta función implementa la corrección del Bug #8: Prevenir sobrescritura de datos
 * en actualizaciones encadenadas.
 * 
 * COMPORTAMIENTO:
 * 1. Encola la operación para evitar race conditions
 * 2. Verifica que el archivo existe antes de actualizar
 * 3. Realiza la actualización usando saveFileWithHierarchyCheck
 * 4. Verifica la integridad del contenido después de guardar
 * 5. Lanza error si la verificación falla
 * 
 * @param {string} fullPath - Ruta completa del archivo a actualizar
 * @param {string} content - Contenido HTML del archivo
 * @param {Object} metadata - Metadatos del archivo
 * @returns {Promise<Object>} Metadata actualizada si la operación es exitosa
 * @throws {Error} Si el archivo no existe o la verificación de integridad falla
 * 
 * @example
 * try {
 *   const result = await safeUpdateFile(
 *     '/path/to/file.txt',
 *     '<p>Contenido actualizado</p>',
 *     { status: 'draft', goal: 30000 }
 *   );
 *   console.log('Archivo actualizado:', result);
 * } catch (error) {
 *   console.error('Error al actualizar:', error.message);
 * }
 */
export async function safeUpdateFile(fullPath, content, metadata) {
  return fileOperationQueue.enqueue(async () => {
    try {
      console.log('[SAFE-UPDATE] Iniciando actualización segura:', fullPath);

      // 1. Verificar que el archivo existe
      const exists = await window.electronAPI.pathExists(fullPath);
      if (!exists) {
        const error = new Error(`File not found: ${fullPath}`);
        console.error('[SAFE-UPDATE] Archivo no encontrado:', fullPath);
        throw error;
      }

      console.log('[SAFE-UPDATE] Archivo existe, procediendo con actualización');

      // 2. Realizar actualización usando saveFileWithHierarchyCheck
      const updatedMetadata = await saveFileWithHierarchyCheck(fullPath, content, metadata);

      console.log('[SAFE-UPDATE] Actualización completada, verificando integridad');

      // 3. Verificar integridad: leer el archivo guardado
      const savedContent = await window.electronAPI.readFile(fullPath);

      // 4. Comparar contenido guardado con contenido esperado
      if (savedContent !== content) {
        const error = new Error('Content verification failed: saved content does not match expected content');
        console.error('[SAFE-UPDATE] Verificación de integridad falló');
        console.error('[SAFE-UPDATE] Contenido esperado (primeros 100 chars):', content.substring(0, 100));
        console.error('[SAFE-UPDATE] Contenido guardado (primeros 100 chars):', savedContent.substring(0, 100));
        throw error;
      }

      console.log('[SAFE-UPDATE] Verificación de integridad exitosa');

      // 5. Retornar metadata actualizada
      return updatedMetadata;

    } catch (error) {
      console.error('[SAFE-UPDATE] Error en safeUpdateFile:', error);
      throw error;
    }
  });
}
