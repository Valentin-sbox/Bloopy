/**
 * ============================================================================
 * BLOCK GUARD v4.0.0 - APP.JS
 * ============================================================================
 * 
 * COMPONENTE PRINCIPAL DE LA APLICACIÓN
 * 
 * Este es el componente raíz que gestiona el estado global de la aplicación
 * y coordina todos los demás componentes.
 * 
 * ARQUITECTURA:
 * - Estados globales: workspace, proyectos, archivo activo, configuración
 * - Efectos: inicialización, auto-guardado, atajos de teclado
 * - Handlers: operaciones CRUD, navegación, modales
 * 
 * FLUJO DE DATOS:
 * 1. Inicialización: carga config, avatar, workspace guardado
 * 2. Splash screen -> Onboarding (primera vez) o Workspace
 * 3. Navegación: Sidebar -> WelcomeScreen -> Editor
 * 
 * RELACIONADO CON:
 * - Todos los componentes en src/components/
 * - public/electron.js: APIs nativas vía window.electronAPI
 * - src/utils/themes.js: Aplicación de temas
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Importación de componentes
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Editor from './components/Editor';
import WelcomeScreen from './components/WelcomeScreen';
import SettingsModal from './components/SettingsModal';
import SpellCheckModal from './components/SpellCheckModal';
import ConfirmModal from './components/ConfirmModal';
import InputModal from './components/InputModal';
import CommentsSidebar from './components/CommentsSidebar';
import NotificationContainer from './components/NotificationContainer';
import SplashScreen from './components/SplashScreen';
import OnboardingModal from './components/OnboardingModal';
import ProjectViewer from './components/ProjectViewer';
import TextAnalyticsModal from './components/TextAnalyticsModal';

// Importación de hooks personalizados
import { useAutoSave, useKeyboardShortcuts, useDragDrop } from './hooks';

// Importación de utilidades
import { generateUUID } from './utils/helpers';
import { themes, applyTheme } from './utils/themes';
import {
  registerShortcutCallback,
  subscribeToShortcutChanges,
  updateShortcuts,
  getAllShortcuts
} from './utils/shortcuts';
import { ensureIdsOnProjects, updateProjectPaths } from './utils/helpers';
import { useTranslation } from './utils/i18n';

// Importación de estilos
import './styles/index.css';

function App() {
  const { changeLanguage } = useTranslation();
  
  // =============================================================================
  // ESTADOS PRINCIPALES
  // =============================================================================
  
  // Ruta del workspace actual
  const [workspacePath, setWorkspacePath] = useState(null);
  
  // Lista de proyectos y archivos
  const [projects, setProjects] = useState([]);
  
  // Archivo actualmente abierto
  const [activeFile, setActiveFile] = useState(null);
  
  // Índice del proyecto del archivo activo
  const [activeProjectIndex, setActiveProjectIndex] = useState(null);
  
  // Estado del sidebar (colapsado/expandido)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Visibilidad de modales
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpellCheckOpen, setIsSpellCheckOpen] = useState(false);
  const [isTextAnalyticsOpen, setIsTextAnalyticsOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [inputModal, setInputModal] = useState(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  
  // ID del párrafo activo para comentarios
  const [activeParagraphId, setActiveParagraphId] = useState(null);
  
  // Proyecto siendo visualizado (viewer)
  const [viewingProject, setViewingProject] = useState(null);
  
  // Lista de notificaciones
  const [notifications, setNotifications] = useState([]);
  
  // Configuración de la aplicación
  const [config, setConfig] = useState({
    states: [
      { id: 'draft', name: 'Primer Borrador', color: '#ff3b30', goal: 30000, countType: 'absolute' },
      { id: 'review', name: 'En Revisión', color: '#ff9500', goal: 15000, countType: 'edited' },
      { id: 'final', name: 'Últimos Retoques', color: '#34c759', goal: 5000, countType: 'delta' }
    ],
    autosaveInterval: 30,
    defaultGoal: 30000,
    theme: 'dark',
    customTheme: null,
    customThemes: [],  // Array de temas personalizados
    language: 'es',  // Idioma de la interfaz
    shortcuts: {},
    editorEffects: {
      enableBlockquoteStyle: true,
      enableHighlights: true,
      enableTextColors: true,
      enableFormatting: true,
      enableMarkdownShortcuts: true
    },
    spellCheck: {
      enabled: true,
      language: 'es',
      pages: [
        { name: 'LanguageTool', url: 'https://languagetool.org/es', default: true },
        { name: 'Corrector.co', url: 'https://www.corrector.co/', default: false }
      ],
      sectionSize: 5000
    }
  });
  
  // Estado de carga inicial
  const [isLoading, setIsLoading] = useState(true);
  
  // Mostrar splash screen
  const [showSplash, setShowSplash] = useState(true);
  // Fase del splash: 'checking' | 'loading'
  const [splashPhase, setSplashPhase] = useState('checking');
  
  // Mostrar onboarding (primera vez)
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Control de vista de bienvenida: 'home' | 'recent'
  const [welcomeView, setWelcomeView] = useState('home');
  
  // Contenido del editor
  const [editorContent, setEditorContent] = useState('<p><br></p>');
  
  // Estadísticas del editor
  const [stats, setStats] = useState({ lines: 0, words: 0, chars: 0 });
  
  // Si hay cambios sin guardar
  const [hasChanges, setHasChanges] = useState(false);
  
  // Nombre del usuario
  const [userName, setUserName] = useState('Escritor');
  
  // Avatar del usuario
  const [avatar, setAvatar] = useState(null);
  
  // Referencia al timer de auto-guardado
  const autosaveTimerRef = useRef(null);
  
  // Referencias para drag & drop
  const dragStateRef = useRef({
    isDragging: false,
    draggedItem: null,
    draggedPath: null,
    draggedProjectIndex: null
  });
  
  // =============================================================================
  // EFECTO: INICIALIZACIÓN DE LA APLICACIÓN
  // =============================================================================
  
  useEffect(() => {
    initializeApp();
    
    // Limpiar auto-guardado cuando se desmonta el componente
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Escuchar eventos del Sidebar (Inicio / Recientes)
  useEffect(() => {
    const goHome = () => {
      setViewingProject(null);
      setActiveFile(null);
      setWelcomeView('home');
    };
    const showRecent = () => {
      setViewingProject(null);
      setActiveFile(null);
      setWelcomeView('recent');
    };

    window.addEventListener('bg-go-home', goHome);
    window.addEventListener('bg-show-recent', showRecent);

    return () => {
      window.removeEventListener('bg-go-home', goHome);
      window.removeEventListener('bg-show-recent', showRecent);
    };
  }, []);

  /**
   * Hook: Auto-save del archivo actual
   */
  // Referencia para debouncing de notificaciones
  const notificationQueue = useRef(new Map());
  
  // Función de notificaciones con debouncing y filtrado
  function notify(message, type = 'info', options = {}) {
    // Respetar la configuración si existe
    if (config && config.showNotifications === false) return;

    // Filtrar notificaciones de bajo nivel (solo info)
    const lowPriorityMessages = [
      'Área de trabajo cargada',
      'Archivo guardado',  // Ya hay indicador visual de guardado
      'Estado actualizado'  // Ya hay indicador visual en la UI
    ];
    
    // Solo mostrar si es error, warning, o mensaje importante
    if (type === 'info' && !options.force) {
      if (lowPriorityMessages.some(msg => message.includes(msg))) {
        return;  // No mostrar notificaciones de bajo nivel
      }
    }

    // Debouncing: evitar notificaciones duplicadas en corto tiempo
    const key = `${type}-${message}`;
    
    if (notificationQueue.current.has(key)) {
      const lastTime = notificationQueue.current.get(key);
      if (Date.now() - lastTime < 2000) {  // 2 segundos
        return;  // Ignorar duplicado reciente
      }
    }
    
    // Registrar notificación
    notificationQueue.current.set(key, Date.now());
    
    // Limpiar entrada después de 3 segundos
    setTimeout(() => {
      notificationQueue.current.delete(key);
    }, 3000);

    // Mostrar notificación
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type }]);

    // Auto-eliminar después de duración variable según tipo
    const duration = type === 'error' ? 5000 : (type === 'warning' ? 4000 : 3000);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }

  const { isSaving, saveFile } = useAutoSave(
    activeFile,
    editorContent,
    config,
    config?.autosaveInterval || 30,
    notify
  );


  /**
   * Guarda el archivo actual.
   * (movido arriba para evitar referencia antes de inicialización al registrar atajos)
   */
  const handleSaveFile = async () => {
    if (!activeFile) return;

    try {
      // 1. Obtener todos los paragraphId válidos del contenido actual
      const parser = new DOMParser();
      const doc = parser.parseFromString(editorContent, 'text/html');
      const paragraphs = doc.querySelectorAll('[data-paragraph-id]');
      const validParagraphIds = Array.from(paragraphs).map(p => 
        p.getAttribute('data-paragraph-id')
      );

      // 2. Filtrar comentarios para mantener solo los que tienen párrafo válido
      const validComments = (activeFile.comments || []).filter(comment =>
        !comment.paragraphId || validParagraphIds.includes(comment.paragraphId)
      );

      // 3. Sanitizar comentarios para evitar objetos no serializables
      const sanitizedComments = validComments.map(comment => ({
        id: comment.id || generateUUID(),
        paragraphId: comment.paragraphId || null,
        text: String(comment.text || ''),
        timestamp: comment.timestamp || Date.now(),
        author: String(comment.author || userName || 'Anónimo')
      }));

      const metadata = {
        status: activeFile.status || 'draft',
        goal: activeFile.goal || 30000,
        lastCharCount: stats.chars,
        initialCharCount: activeFile.initialCharCount || 0,
        comments: sanitizedComments,
        lastUpdated: Date.now()
      };

      // Validar que metadata sea serializable
      try {
        JSON.stringify(metadata);
      } catch (serErr) {
        console.error('Metadata no serializable:', serErr);
        notify('Error al preparar datos para guardar', 'error');
        return;
      }

      await window.electronAPI.saveFile(activeFile.fullPath, editorContent, metadata);

      // Actualizar archivo activo
      setActiveFile({
        ...activeFile,
        ...metadata,
        content: editorContent
      });

      setHasChanges(false);
      notify('Archivo guardado', 'success');

      // Recargar workspace
      await loadWorkspace(workspacePath);
    } catch (error) {
      console.error('Error saving file:', error);
      notify('Error al guardar el archivo', 'error');
    }
  };

    

  /**
   * Efecto: Sincronizar atajos personalizados desde config
   */
  useEffect(() => {
    if (config?.shortcuts) {
      updateShortcuts(config.shortcuts);
    }
  }, [config?.shortcuts]);

  /**
   * Hook: Drag & Drop
   * (Inicializado más abajo una vez definido handleLocalUpdate)
   */
  
  /**
   * Inicializa la aplicación cargando configuración y datos guardados.
   */
  const initializeApp = async () => {
    try {
      // 1) Buscar actualizaciones primero
      setSplashPhase('checking');
      setShowSplash(true);
      try {
        if (window.electronAPI && window.electronAPI.checkForUpdates) {
          // Llamada con timeout para no bloquear el arranque
          const checkPromise = window.electronAPI.checkForUpdates();
          const result = await Promise.race([
            checkPromise,
            new Promise((res) => setTimeout(() => res({ success: false, timeout: true }), 3500))
          ]);
          // Si hay actualización disponible, dejaremos que los listeners/proceso la manejen (UpdateModal podrá abrirse)
          if (result && result.hasUpdate) {
            // Mantener splash o podríamos abrir modal; por ahora cambiamos a loading y notificamos
            notify('Actualización disponible', 'info');
          }
        }
      } catch (err) {
        console.warn('Error checkForUpdates:', err);
      }

      // Cambiar a fase de carga normal
      setSplashPhase('loading');

      // Cargar configuración
      const savedConfig = await window.electronAPI.getConfig();
      setConfig(savedConfig);
      setUserName(savedConfig.userName || 'Escritor');
      
      // Aplicar idioma si está guardado
      if (savedConfig.language) {
        changeLanguage(savedConfig.language);
      }
      
      // Aplicar tema
      applyTheme(savedConfig.theme || 'dark');
      
      // Cargar avatar
      const savedAvatar = await window.electronAPI.getAvatar();
      setAvatar(savedAvatar);
      
      // Verificar si hay workspace guardado
      const savedWorkspace = await window.electronAPI.getWorkspacePath();
      
      if (savedWorkspace) {
        // Ya tiene workspace, cargarlo
        setWorkspacePath(savedWorkspace);
        await loadWorkspace(savedWorkspace);
      } else {
        // Primera vez, mostrar onboarding
        setShowOnboarding(true);
      }
      
      // Mostrar la fase de "Cargando" por breve tiempo, luego ocultar
      setTimeout(() => {
        setShowSplash(false);
      }, 1200);
      
    } catch (error) {
      console.error('Error initializing app:', error);
      notify('Error al inicializar la aplicación', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  // =============================================================================
  // FUNCIONES: GESTIÓN DEL WORKSPACE
  // =============================================================================
  
  /**
   * Carga los proyectos y archivos del workspace.
   * @param {string} path - Ruta del workspace
   */
  const loadWorkspace = async (path) => {
    try {
      // Esperar a que se completen operaciones pendientes antes de leer
      if (window.electronAPI && window.electronAPI.waitPendingOps) {
        await window.electronAPI.waitPendingOps(3000);
      }
      const projectsData = await window.electronAPI.readWorkspace(path);
      // Normalizar: asegurar ids y referencias parentId para uso en UI
      const normalized = ensureIdsOnProjects(projectsData || []);
      setProjects(normalized);
      notify('Área de trabajo cargada', 'success');
    } catch (error) {
      console.error('Error loading workspace:', error);
      notify('Error al cargar el área de trabajo', 'error');
    }
  };
  
  /**
   * Crea un nuevo workspace.
   */
  const handleCreateWorkspace = async () => {
    try {
      const newWorkspacePath = await window.electronAPI.createWorkspace();
      if (newWorkspacePath) {
        setWorkspacePath(newWorkspacePath);
        await loadWorkspace(newWorkspacePath);
        notify('Nueva área de trabajo creada', 'success');
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      notify('Error al crear el área de trabajo', 'error');
    }
  };
  
  /**
   * Selecciona un workspace existente.
   */
  const handleSelectWorkspace = async () => {
    try {
      const selectedPath = await window.electronAPI.selectWorkspace();
      if (selectedPath) {
        setWorkspacePath(selectedPath);
        await loadWorkspace(selectedPath);
        notify('Área de trabajo seleccionada', 'success');
      }
    } catch (error) {
      console.error('Error selecting workspace:', error);
      notify('Error al seleccionar el área de trabajo', 'error');
    }
  };
  
  // =============================================================================
  // FUNCIONES: GESTIÓN DE PROYECTOS Y ARCHIVOS
  // =============================================================================
  
  /**
   * Crea un nuevo proyecto.
   * @param {string} projectName - Nombre del proyecto
   */
  const handleCreateProject = async (projectName) => {
    if (!workspacePath) return;
    
    try {
      await window.electronAPI.createProject(workspacePath, projectName);
      await loadWorkspace(workspacePath);
      notify(`Proyecto "${projectName}" creado`, 'success');
    } catch (error) {
      console.error('Error creating project:', error);
      notify('Error al crear el proyecto', 'error');
    }
  };
  
  /**
   * Crea un nuevo archivo.
   * @param {number} projectIndex - Índice del proyecto
   * @param {string} fileName - Nombre del archivo
   * @param {string} parentPath - Ruta de la carpeta padre (opcional)
   */
  const handleCreateFile = async (projectIndex, fileName, parentPath = null) => {
    if (!workspacePath) return;
    
    try {
      const project = projects[projectIndex];
      const targetPath = parentPath || project.path;
      
      await window.electronAPI.createFile(targetPath, fileName);
      await loadWorkspace(workspacePath);
      notify(`Archivo "${fileName}" creado`, 'success');
    } catch (error) {
      console.error('Error creating file:', error);
      notify('Error al crear el archivo', 'error');
    }
  };

  /**
   * Crea un sub-archivo (hijo de otro archivo).
   * @param {Object} parentFile - Archivo padre
   * @param {string} subFileName - Nombre del sub-archivo
   */
  const handleCreateSubFile = async (parentFile, subFileName) => {
    if (!workspacePath) return;
    
    try {
      const parentPath = parentFile.fullPath;
      const subDir = parentPath + '.d'; // Convención para carpetas de sub-archivos
      
      await window.electronAPI.createFile(subDir, subFileName);
      await loadWorkspace(workspacePath);
      notify(`Sub-archivo "${subFileName}" creado`, 'success');
      
      // Si el padre está abierto, tal vez refrescar? (Auto refresco por loadWorkspace debería bastar)
    } catch (error) {
      console.error('Error creating sub-file:', error);
      notify('Error al crear el sub-archivo', 'error');
    }
  };

  /**
   * Solicita creación de sub-archivo (abre modal).
   */
  const handleRequestCreateSubFile = (parentFile) => {
    showInput('Nuevo Sub-archivo', 'Nombre del sub-archivo', (name) => {
      handleCreateSubFile(parentFile, name);
    });
  };
  
  /**
   * Abre un archivo en el editor.
   * @param {number} projectIndex - Índice del proyecto
   * @param {Object} file - Archivo a abrir
   */
  const handleOpenFile = async (projectIndex, file) => {
    // Guardar archivo actual si hay cambios
    if (hasChanges && activeFile) {
      await handleSaveFile();
    }
    
    // Cerrar ProjectViewer automáticamente
    setViewingProject(null);
    
    setActiveProjectIndex(projectIndex);
    setActiveFile(file);
    setEditorContent(file.content || '<p><br></p>');
    setHasChanges(false);
    updateStats(file.content || '');
  };

  /**
   * Handle local update actions passed from Sidebar to update UI immediately
   * without waiting for a full reload. Supported action: { type: 'rename', oldPath, newPath }
   */
  const handleLocalUpdate = (action) => {
    if (!action || !action.type) return;
    if (action.type === 'rename' && action.oldPath && action.newPath) {
      setProjects(prev => updateProjectPaths(prev, action.oldPath, action.newPath));

      // Si el activeFile estaba en la ruta antigua, actualizarlo también
      if (activeFile && activeFile.fullPath && activeFile.fullPath.startsWith(action.oldPath)) {
        const newFull = action.newPath + activeFile.fullPath.slice(action.oldPath.length);
        setActiveFile(prev => prev ? { ...prev, fullPath: newFull } : prev);
      }
    }
  };

  // Inicializar hook de Drag & Drop ahora que handleLocalUpdate está disponible
  const { dragState: dragStateFromHook, startDrag, handleDragOver: handleDragOverHook, handleDragLeave, handleDrop: handleDragDrop } = useDragDrop(
    projects,
    setProjects,
    notify,
    handleLocalUpdate
  );
  
  /**
   * Cierra el archivo actual.
   */
  const handleCloseFile = async () => {
    if (hasChanges && activeFile) {
      await handleSaveFile();
    }
    
    setActiveFile(null);
    setActiveProjectIndex(null);
    setEditorContent('<p><br></p>');
    setHasChanges(false);
  };
  
 
  
  // =============================================================================
  // FUNCIONES: EDITOR
  // =============================================================================
  
  /**
   * Actualiza las estadísticas del editor.
   * @param {string} content - Contenido HTML
   */
  const updateStats = (content) => {
    const text = content.replace(/<[^>]*>/g, '');
    const lines = content.split(/<p|<div|<h[1-6]/).length - 1;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    
    setStats({ lines, words, chars });
  };
  
  /**
   * Maneja cambios en el editor.
   * @param {string} content - Nuevo contenido
   */
  const handleEditorChange = (content) => {
    setEditorContent(content);
    setHasChanges(true);
    updateStats(content);
    
    // Actualizar progreso en tiempo real
    if (activeFile) {
      setActiveFile(prev => ({
        ...prev,
        lastCharCount: content.replace(/<[^>]*>/g, '').length
      }));
    }
    
    // Configurar auto-guardado
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    
    const autosaveInterval = (config?.autosaveInterval || 30) * 1000;
    autosaveTimerRef.current = setTimeout(() => {
      if (hasChanges) {
        handleSaveFile();
      }
    }, autosaveInterval);
  };

  /**
   * Efecto: Registrar callbacks para atajos del sistema centralizado
   * (Colocado aquí para garantizar que todos los handlers referenciados
   *  ya estén definidos y evitar errores de inicialización temprana)
   */
  useEffect(() => {
    const unsubscribers = [
      registerShortcutCallback('save', () => handleSaveFile()),
      registerShortcutCallback('newFile', () => 
        showInput('Nuevo archivo', 'nombre_del_archivo', (name) => {
          if (activeProjectIndex !== null) {
            handleCreateFile(activeProjectIndex, name);
          } else {
            notify('Selecciona un proyecto primero', 'warning');
          }
        })
      ),
      registerShortcutCallback('newProject', () =>
        showInput('Nuevo proyecto', 'Nombre del proyecto', handleCreateProject)
      ),
      registerShortcutCallback('closeFile', () => handleCloseFile()),
      registerShortcutCallback('spellCheck', () => setIsSpellCheckOpen(true)),
      registerShortcutCallback('analytics', () => setIsTextAnalyticsOpen(true)),
      registerShortcutCallback('settings', () => setIsSettingsOpen(true)),
      registerShortcutCallback('toggleSidebar', () => setSidebarCollapsed(prev => !prev)),
      registerShortcutCallback('toggleTitleBar', () => {
        if (window.electronAPI?.toggleTitleBar) {
          window.electronAPI.toggleTitleBar().catch(err => 
            console.error('Error toggling title bar:', err)
          );
        }
      }),
      registerShortcutCallback('viewProject', () => {
        if (activeProjectIndex !== null) {
          setViewingProject(projects[activeProjectIndex]);
        }
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub?.());
    };
  }, [
    activeProjectIndex,
    projects,
    handleSaveFile,
    handleCreateFile,
    handleCreateProject,
    handleCloseFile
  ]);
  
  // =============================================================================
  // FUNCIONES: NOTIFICACIONES
  // =============================================================================
  
  
  // =============================================================================
  // FUNCIONES: MODALES
  // =============================================================================
  
  /**
   * Muestra un modal de confirmación.
   * @param {string} title - Título del modal
   * @param {string} text - Texto descriptivo
   * @param {Function} onConfirm - Callback al confirmar
   * @param {string} icon - Icono Font Awesome
   */
  const showConfirm = (title, text, onConfirm, icon = 'fa-question-circle') => {
    setConfirmModal({ title, text, onConfirm, icon });
  };
  
  /**
   * Muestra un modal de input.
   * @param {string} title - Título del modal
   * @param {string} placeholder - Placeholder del input
   * @param {Function} onConfirm - Callback con el valor
   */
  const showInput = (title, placeholder, onConfirm) => {
    setInputModal({ title, placeholder, onConfirm });
  };
  
  // =============================================================================
  // FUNCIONES: ACCIONES DEL ARCHIVO
  // =============================================================================
  
  /**
   * Cambia el estado del archivo (upgrade o downgrade).
   * Loop: al llegar al final, vuelve al inicio.
   */
  const handleUpgradeStatus = () => {
    if (!activeFile || !config || !config.states || config.states.length === 0) return;
    
    const currentIndex = config.states.findIndex(s => s.id === activeFile.status);
    
    // Si estamos en el final, volver al inicio (loop)
    if (currentIndex >= config.states.length - 1) {
      const newState = config.states[0]; // Volver al inicio
      setActiveFile({
        ...activeFile,
        status: newState.id,
        goal: newState.goal
      });
      setHasChanges(true);
      notify(`Estado reiniciado a: ${newState.name}`, 'info');
      return;
    }
    
    // Si no estamos en el final, subir de estado
    const newIndex = currentIndex + 1;
    if (newIndex >= config.states.length) return; // Protección adicional
    const newState = config.states[newIndex];
    setActiveFile({
      ...activeFile,
      status: newState.id,
      goal: newState.goal
    });
    setHasChanges(true);
    
    notify(`Estado actualizado a: ${newState.name}`, 'success');
  };
  
  /**
   * Abre el corrector ortográfico.
   */
  const handleSpellCheck = () => {
    if (stats.chars === 0) {
      notify('No hay texto para revisar', 'error');
      return;
    }
    setIsSpellCheckOpen(true);
  };
  
  // =============================================================================
  // FUNCIONES: IMPORTAR/EXPORTAR
  // =============================================================================
  
  /**
   * Exporta todos los datos de la aplicación.
   */
  const handleExport = async () => {
    try {
      const data = {
        version: '4.0.0',
        exportDate: new Date().toISOString(),
        config,
        userName,
        avatar,
        projects
      };
      
      await window.electronAPI.exportData(data);
      notify('Datos exportados correctamente', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      notify('Error al exportar datos', 'error');
    }
  };
  
  /**
   * Importa datos desde un archivo JSON.
   */
  const handleImport = async () => {
    try {
      const data = await window.electronAPI.importData();
      if (data) {
        if (data.config) {
          await window.electronAPI.saveConfig(data.config);
          setConfig(data.config);
        }
        if (data.userName) {
          setUserName(data.userName);
        }
        if (data.avatar) {
          setAvatar(data.avatar);
          await window.electronAPI.saveAvatar(data.avatar);
        }
        notify('Datos importados correctamente', 'success');
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      console.error('Error importing data:', error);
      notify('Error al importar datos', 'error');
    }
  };
  
  // =============================================================================
  // FUNCIONES: DRAG & DROP
  // =============================================================================
  
  /**
   * Inicia el arrastre de un archivo o proyecto.
   * @param {Object} item - Item que se está arrastrando
   * @param {number} projectIndex - Índice del proyecto
   * @param {string} path - Ruta del item
   */
  const handleDragStart = (item, projectIndex, path) => {
    dragStateRef.current = {
      isDragging: true,
      draggedItem: item,
      draggedPath: path,
      draggedProjectIndex: projectIndex
    };
  };
  
  /**
   * Maneja el drop de un item arrastrado.
   * @param {Object} targetItem - Item sobre el que se suelta
   * @param {number} targetProjectIndex - Índice del proyecto destino
   * @param {string} targetPath - Ruta del item destino
   * @param {string} position - Posición ('before' o 'after')
   */
  const handleDrop = async (targetItem, targetProjectIndex, targetPath, position) => {
    const { draggedItem, draggedProjectIndex, draggedPath } = dragStateRef.current;
    
    if (!draggedItem || draggedItem === targetItem) return;
    
    // Verificar que no sea descendiente (evitar ciclos)
    const isDescendant = (parent, child) => {
      if (!parent.items || parent.items.length === 0) return false;
      for (const item of parent.items) {
        if (item === child) return true;
        if (isDescendant(item, child)) return true;
      }
      return false;
    };
    
    if (isDescendant(draggedItem, targetItem)) {
      notify('No puedes mover un archivo dentro de sí mismo', 'error');
      return;
    }
    
    try {
      // Mover físicamente el archivo
      await window.electronAPI.moveFile(
        draggedItem.fullPath,
        targetItem.fullPath,
        position
      );
      
      // Recargar workspace
      await loadWorkspace(workspacePath);
      notify('Archivo movido', 'success');
    } catch (error) {
      console.error('Error moving file:', error);
      notify('Error al mover el archivo', 'error');
    }
    
    // Resetear estado de drag
    dragStateRef.current = {
      isDragging: false,
      draggedItem: null,
      draggedPath: null,
      draggedProjectIndex: null
    };
  };
  
  // =============================================================================
  // FUNCIONES: COMENTARIOS
  // =============================================================================
  
  /**
   * Abre el sidebar de comentarios para un párrafo específico.
   * @param {string} paragraphId - ID del párrafo
   */
  const openCommentsForParagraph = (paragraphId) => {
    setActiveParagraphId(paragraphId);
    setIsCommentsOpen(true);
  };
  
  /**
   * Obtiene los comentarios de un párrafo específico.
   * @param {string} paragraphId - ID del párrafo
   * @returns {Array} Lista de comentarios
   */
  const getCommentsForParagraph = (paragraphId) => {
    if (!activeFile || !activeFile.comments) return [];
    return activeFile.comments.filter(c => c.paragraphId === paragraphId);
  };
  
  // =============================================================================
  // FUNCIONES: ATAJOS DE TECLADO ADICIONALES
  // =============================================================================
  
  // NOTA: Los atajos de teclado ahora se manejan completamente con registerShortcutCallback
  // No es necesario un listener manual adicional
  
  // =============================================================================
  // FUNCIONES: ONBOARDING
  // =============================================================================
  
  /**
   * Maneja la finalización del onboarding.
   * @param {Object} data - Datos del usuario (nombre, avatar, workspacePath)
   */
  const handleOnboardingComplete = async (data) => {
    setUserName(data.userName);
    setAvatar(data.avatar);
    setWorkspacePath(data.workspacePath);
    
    // Guardar en configuración (incluyendo idioma)
    const newConfig = { 
      ...config, 
      userName: data.userName,
      language: data.language || 'es'
    };
    await window.electronAPI.saveConfig(newConfig);
    setConfig(newConfig);
    
    // Guardar avatar
    if (data.avatar) {
      await window.electronAPI.saveAvatar(data.avatar);
    }
    
    // Cargar workspace
    await loadWorkspace(data.workspacePath);
    
    // Ocultar onboarding
    setShowOnboarding(false);
    notify('¡Bienvenido a Block Guard!', 'success');
  };
  
  // =============================================================================
  // RENDERIZADO: PANTALLA DE CARGA
  // =============================================================================
  
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">
          <i className="fas fa-shield-halved"></i>
        </div>
        <p>Cargando Block Guard...</p>
      </div>
    );
  }
  
  // =============================================================================
  // RENDERIZADO PRINCIPAL
  // =============================================================================
  
  return (
    <div className="app-container" data-theme={config?.theme || 'dark'}>
      {/* Splash Screen */}
      <SplashScreen visible={showSplash} />
      
      {/* Onboarding (primera vez) */}
      {showOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}
      
      {/* Sidebar (solo si hay workspace) */}
      {workspacePath && (
        <Sidebar
          projects={projects}
          activeFile={activeFile}
          activeProjectIndex={activeProjectIndex}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onCreateProject={handleCreateProject}
          onCreateFile={handleCreateFile}
          onOpenFile={handleOpenFile}
          onViewProject={(project) => setViewingProject(project)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          workspacePath={workspacePath}
          userName={userName}
          avatar={avatar}
          config={config}
          showConfirm={showConfirm}
          showInput={showInput}
          notify={notify}
          onRefresh={() => loadWorkspace(workspacePath)}
          onLocalUpdate={(action) => handleLocalUpdate(action)}
        />
      )}
      
      {/* Contenido principal */}
      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Barra superior */}
        <TopBar
          activeFile={activeFile}
          activeProjectIndex={activeProjectIndex}
          projects={projects}
          onCloseFile={handleCloseFile}
          onSaveFile={handleSaveFile}
          onSpellCheck={handleSpellCheck}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          sidebarCollapsed={sidebarCollapsed}
          hasChanges={hasChanges}
          onViewProject={(project) => setViewingProject(project)}
        />
        
        {/* Visor de Proyecto y Editor en layout dividido */}
        {viewingProject ? (
          <div className="project-split">
            <ProjectViewer
              project={viewingProject}
              projectIndex={projects.indexOf(viewingProject)}
              onOpenFile={handleOpenFile}
              onClose={() => setViewingProject(null)}
              config={config}
              onCreateFile={handleCreateFile}
              onDeleteFile={(file) => handleDeleteItem(file.fullPath, false)}
              onDeleteFolder={(folder) => handleDeleteItem(folder.fullPath, true)}
              onCreateSubFile={handleRequestCreateSubFile}
              onRefresh={() => loadWorkspace(workspacePath)}
              notify={notify}
            />

            <div className="project-split-right">
              {activeFile ? (
                <Editor
                  ref={null}
                  content={editorContent}
                  onChange={handleEditorChange}
                  activeFile={activeFile}
                  onOpenComments={openCommentsForParagraph}
                  config={config}
                />
              ) : (
                <div className="project-empty-message">
                  <h2>Estás viendo el proyecto "{viewingProject?.name}"</h2>
                  <p>Selecciona un archivo para continuar escribiendo.</p>
                </div>
              )}
            </div>
          </div>
        ) : activeFile ? (
          <Editor
            ref={null}
            content={editorContent}
            onChange={handleEditorChange}
            activeFile={activeFile}
            onOpenComments={openCommentsForParagraph}
            config={config}
          />
        ) : (
          <WelcomeScreen
            workspacePath={workspacePath}
            projects={projects}
            userName={userName}
            onCreateWorkspace={handleCreateWorkspace}
            onSelectWorkspace={handleSelectWorkspace}
            onOpenFile={handleOpenFile}
            hasWorkspace={!!workspacePath}
          />
        )}
        
        {/* Footer del editor */}
        <div className="editor-footer">
          {/* Estadísticas */}
          <div className="stats">
            <span><i className="fas fa-paragraph"></i> {stats.lines}</span>
            <span><i className="fas fa-font"></i> {stats.words}</span>
            <span><i className="fas fa-keyboard"></i> {stats.chars}</span>
            
            {/* Botón de análisis detallado */}
            {activeFile && (
              <button 
                className="btn-stats-analytics"
                onClick={() => setIsTextAnalyticsOpen(true)}
                title="Análisis detallado del texto"
              >
                <i className="fas fa-chart-bar"></i>
              </button>
            )}
          </div>
          
          {/* Controles derechos (solo si hay archivo abierto) */}
          {activeFile && config && (
            <div className="footer-right">
              {/* Indicador de cambios sin guardar */}
              {hasChanges && <span className="autosave-indicator" title="Cambios sin guardar"></span>}
              
              {/* Badge de estado */}
              <div 
                className="status-badge" 
                style={{ 
                  background: config.states.find(s => s.id === activeFile.status)?.color || '#0071e3' 
                }}
              >
                {config.states.find(s => s.id === activeFile.status)?.name || 'Borrador'}
              </div>
              
              {/* Botón de upgrade/downgrade (reversible) */}
              <button 
                className="btn-upgrade-footer"
                onClick={handleUpgradeStatus}
                disabled={!activeFile}
                title={
                  config.states.findIndex(s => s.id === activeFile?.status) >= config.states.length - 1
                    ? 'Bajar estado (Reversible)'
                    : 'Subir estado'
                }
              >
                <i 
                  className={`fas fa-arrow-${
                    config.states.findIndex(s => s.id === activeFile?.status) >= config.states.length - 1
                      ? 'down'
                      : 'up'
                  }`}
                ></i>
                {config.states.findIndex(s => s.id === activeFile?.status) >= config.states.length - 1
                  ? 'Bajar'
                  : 'Subir'
                }
              </button>
              
              {/* Meta de caracteres */}
              <div className="footer-goal">
                <i className="fas fa-bullseye"></i>
                <input 
                  type="number" 
                  value={activeFile.goal || 30000}
                  onChange={(e) => {
                    setActiveFile({ 
                      ...activeFile, 
                      goal: parseInt(e.target.value) || 30000 
                    });
                    setHasChanges(true);
                  }}
                  className="mini-goal-input"
                />
                <div className="mini-progress">
                  <div 
                    className="mini-progress-fill" 
                    style={{ 
                      width: `${Math.min(100, (stats.chars / (activeFile.goal || 30000)) * 100)}%`,
                      background: config.states.find(s => s.id === activeFile.status)?.color || '#0071e3'
                    }}
                  ></div>
                </div>
                <span className="progress-text">
                  {Math.round((stats.chars / (activeFile.goal || 30000)) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Modales */}
      
      {/* Configuración */}
      {isSettingsOpen && (
        <SettingsModal
          config={config}
          userName={userName}
          avatar={avatar}
          onClose={() => setIsSettingsOpen(false)}
          onSave={async (newConfig, newUserName, newAvatar) => {
            // Guardar configuración incluyendo shortcuts
            const configToSave = {
              ...newConfig,
              shortcuts: newConfig.shortcuts || {}
            };
            
            await window.electronAPI.saveConfig(configToSave);
            setConfig(configToSave);
            setUserName(newUserName);
            if (newAvatar !== avatar) {
              await window.electronAPI.saveAvatar(newAvatar);
              setAvatar(newAvatar);
            }
            applyTheme(newConfig.theme);
            notify('Configuración guardada correctamente', 'success');
          }}
          onExport={handleExport}
          onImport={handleImport}
        />
      )}
      
      {/* Corrector ortográfico */}
      {isSpellCheckOpen && (
        <SpellCheckModal
          text={editorContent.replace(/<[^>]*>/g, '')}
          onClose={() => setIsSpellCheckOpen(false)}
          config={config}
        />
      )}
      
      {/* Análisis detallado de texto */}
      {isTextAnalyticsOpen && (
        <TextAnalyticsModal
          isOpen={isTextAnalyticsOpen}
          onClose={() => setIsTextAnalyticsOpen(false)}
          editorContent={editorContent}
        />
      )}
      
      {/* Confirmación */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          text={confirmModal.text}
          icon={confirmModal.icon}
          onConfirm={() => {
            confirmModal.onConfirm();
            setConfirmModal(null);
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
      
      {/* Input */}
      {inputModal && (
        <InputModal
          title={inputModal.title}
          placeholder={inputModal.placeholder}
          onConfirm={(value) => {
            inputModal.onConfirm(value);
            setInputModal(null);
          }}
          onCancel={() => setInputModal(null)}
        />
      )}
      
      {/* Comentarios */}
      {isCommentsOpen && (
        <CommentsSidebar
          comments={getCommentsForParagraph(activeParagraphId)}
          activeParagraphId={activeParagraphId}
          fileName={activeFile?.name}
          onClose={() => setIsCommentsOpen(false)}
          onAddComment={(text) => {
            // Validar que el párrafo todavía existe en el contenido
            const parser = new DOMParser();
            const doc = parser.parseFromString(editorContent, 'text/html');
            const paragraph = doc.querySelector(`[data-paragraph-id="${activeParagraphId}"]`);
            
            if (!paragraph) {
              notify('El párrafo ya no existe en el documento', 'warning');
              setIsCommentsOpen(false);
              return;
            }

            const newComment = {
              id: generateUUID(),
              paragraphId: activeParagraphId,
              text,
              timestamp: Date.now(),
              author: userName || 'Anónimo',
              fileId: activeFile?.fullPath  // Asociar al archivo
            };
            
            setActiveFile({
              ...activeFile,
              comments: [...(activeFile.comments || []), newComment]
            });
            setHasChanges(true);
            notify('Comentario agregado', 'success');
          }}
          onDeleteComment={(commentId) => {
            setActiveFile({
              ...activeFile,
              comments: activeFile.comments.filter(c => c.id !== commentId)
            });
            setHasChanges(true);
            notify('Comentario eliminado', 'success');
          }}
        />
      )}
      
      {/* Notificaciones */}
      <NotificationContainer notifications={notifications} />
    </div>
  );
}

export default App;
