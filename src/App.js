/**
 * ============================================================================
 *  APP.JS
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

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';

// Importación de componentes
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import TitleBar from './components/TitleBar';
import Editor from './components/LexicalEditor';
import WelcomeScreen from './components/WelcomeScreen';
import ConfirmModal from './components/ConfirmModal';
import InputModal from './components/InputModal';
import NotificationContainer from './components/NotificationContainer';
import SplashScreen from './components/SplashScreen';
import TabBar from './components/TabBar';
import SplitEditor from './components/SplitEditor';
import SubFilesFooter from './components/SubFilesFooter';
import CommentsSidebar from './components/CommentsSidebar';
import { SpecialCharsPanel } from './components/EditorSidebar';

// Importación de hooks personalizados
import { useAutoSave, useKeyboardShortcuts, useDragDrop } from './hooks';

// Importación de utilidades
import { generateUUID, validateSplitViewState } from './utils/helpers';
import { applyTheme } from './utils/themes';
import {
  registerShortcutCallback,
  subscribeToShortcutChanges,
  updateShortcuts
} from './utils/shortcuts';
import { ensureIdsOnProjects, updateProjectPaths } from './utils/helpers';
import { useTranslation } from './utils/i18n';
import { migrateConfig, validateConfig, sanitizeConfig } from './utils/configMigration';
import { saveFileWithHierarchyCheck } from './utils/fileOperations';
import SaveOperationTracker from './utils/SaveOperationTracker';
import ContentHashManager from './utils/ContentHashManager';

import Icon from '@mdi/react';
import * as mdi from '@mdi/js';
const { 
  mdiFormatParagraph, 
  mdiFormatSize, 
  mdiKeyboard, 
  mdiChartBar, 
  mdiTarget,
  mdiArrowUp,
  mdiArrowDown,
  mdiClose
} = mdi;

// Función simple de hash para detectar cambios en contenido
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  return hash.toString(36);
};

// Lazy-loaded components
const CanvasNote = React.lazy(() => import('./components/CanvasNote'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
const SpellCheckModal = React.lazy(() => import('./components/SpellCheckModal'));
const TextAnalyticsModal = React.lazy(() => import('./components/TextAnalyticsModal'));
const UpdateModal = React.lazy(() => import('./components/UpdateModal'));
const ProjectViewer = React.lazy(() => import('./components/ProjectViewer'));
const OnboardingModal = React.lazy(() => import('./components/OnboardingModal'));

function App() {
  const { t, changeLanguage } = useTranslation();

  // =============================================================================
  // ESTADOS PRINCIPALES
  // =============================================================================

  // Ruta del workspace actual
  const [workspacePath, setWorkspacePath] = useState(null);

  // Lista de proyectos y archivos
  const [projects, setProjects] = useState([]);

  // Lista unificada de archivos (root files + projects mixed)
  const [allFiles, setAllFiles] = useState([]);

  // Archivo actualmente abierto
  const [activeFile, setActiveFile] = useState(null);

  // Índice del proyecto del archivo activo
  const [activeProjectIndex, setActiveProjectIndex] = useState(null);

  // Estado del sidebar (colapsado/expandido)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Estado para panel derecho (comentarios o caracteres especiales)
  const [activeRightPanel, setActiveRightPanel] = useState(null); // 'comments', 'specialChars' o null

  // Visibilidad de modales
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpellCheckOpen, setIsSpellCheckOpen] = useState(false);
  const [isTextAnalyticsOpen, setIsTextAnalyticsOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [inputModal, setInputModal] = useState(null);
  // Modal de checklist para estados custom
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);

  // ID del párrafo activo para comentarios
  const [activeParagraphId, setActiveParagraphId] = useState(null);

  // Proyecto siendo visualizado (viewer)
  const [viewingProject, setViewingProject] = useState(null);

  // Lista de notificaciones
  const [notifications, setNotifications] = useState([]);

  // =============================================================================
  // ESTADOS PARA SISTEMA DE TABS Y SPLIT VIEW
  // =============================================================================

  // Pestañas abiertas (archivos)
  const [openTabs, setOpenTabs] = useState([]);

  // Índice de la pestaña activa
  const [activeTabIndex, setActiveTabIndex] = useState(-1);

  // Modo de vista dividida: 'none', 'horizontal', 'vertical'
  const [splitMode, setSplitMode] = useState('none');

  // (sidebar collapse is user-controlled only)

  // Archivos en cada panel del split
  const [leftPanelFile, setLeftPanelFile] = useState(null);
  const [rightPanelFile, setRightPanelFile] = useState(null);

  // Contenido de cada panel
  const [leftPanelContent, setLeftPanelContent] = useState('<p><br></p>');
  const [rightPanelContent, setRightPanelContent] = useState('<p><br></p>');

  // Referencias de editores para split
  const editorRefLeft = useRef(null);
  const editorRefRight = useRef(null);

  // Estado para rastrear qué panel del split está activo
  const [activePanelSide, setActivePanelSide] = useState('left'); // 'left' o 'right'

  // Estado para persistencia de Split View - USAR IDs EN VEZ DE ÍNDICES
  const [splitViewState, setSplitViewState] = useState({
    isActive: false,
    leftTabId: null,  // fullPath del archivo izquierdo
    rightTabId: null, // fullPath del archivo derecho
    mode: 'none', // 'horizontal' | 'vertical' | 'none'
    activeSide: 'left'
  });

  // Estado para iconos personalizados de archivos
  // Map<fullPath, iconId>
  const [fileIcons, setFileIcons] = useState(new Map());

  // Estado para scroll position por tab
  // { [fullPath]: scrollPosition }
  const [tabScrollPositions, setTabScrollPositions] = useState({});

  // Estado para último split cerrado (para botón de restaurar)
  const [lastClosedSplit, setLastClosedSplit] = useState(null);
  const lastClosedSplitTimerRef = useRef(null);

  // REGLA: Auto-ocultar sidebar cuando estamos en modo DUAL (Split View activo)
  useEffect(() => {
    if (splitMode !== 'none' && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
  }, [splitMode]);


  // Configuración de la aplicación
  const [config, setConfig] = useState({
    states: [
      { id: 'draft', name: t('states.draft'), color: '#ff3b30', goal: 30000, countType: 'absolute' },
      { id: 'review', name: t('states.review'), color: '#ff9500', goal: 15000, countType: 'edited' },
      { id: 'final', name: t('states.final'), color: '#34c759', goal: 5000, countType: 'delta' }
    ],
    autosaveInterval: 30,
    defaultGoal: 30000,
    theme: 'dark',
    customTheme: null,
    customThemes: [],  // Array de temas personalizados
    customColors: null, // Colores del tema personalizado
    customThemeName: 'Mi Tema', // Nombre del tema personalizado
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
        { name: 'LanguageTool', url: 'https://languagetool.org/', default: true },
        { name: 'Correctoronline', url: 'https://www.correctoronline.com/', default: false }
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
  // Coordinación: imagen cargada + tiempo mínimo antes de ocultar splash
  const splashImageReadyRef = useRef(false);
  const splashMinTimeReadyRef = useRef(false);
  const splashHideRef = useRef(null);

  const tryHideSplash = useCallback(() => {
    if (splashImageReadyRef.current && splashMinTimeReadyRef.current) {
      // Pequeño delay extra para que se vea la imagen completa
      if (!splashHideRef.current) {
        splashHideRef.current = setTimeout(() => {
          setShowSplash(false);
        }, 600);
      }
    }
  }, []);

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

  // Áreas de trabajo recientes
  const [recentWorkspaces, setRecentWorkspaces] = useState([]);

  // Referencias para timeouts y optimización
  const autosaveTimerRef = useRef(null);
  const editorChangeTimeoutRef = useRef(null);
  const safetyDraftTimeoutRef = useRef(null);
  const statsDebounceRef = useRef(null);

  // Referencia al componente Editor para acceder a sus métodos
  const editorRef = useRef(null);

  // Referencia al último contenido guardado para evitar ciclos en Canvas
  const lastSavedCanvasContentRef = useRef('');

  // Singleton instances for save tracking and content hashing
  const saveTrackerRef = useRef(null);
  const contentHashManagerRef = useRef(null);

  // Initialize singletons
  if (!saveTrackerRef.current) {
    saveTrackerRef.current = new SaveOperationTracker();
    console.log('[SAVE-CYCLE] SaveOperationTracker initialized');
  }
  if (!contentHashManagerRef.current) {
    contentHashManagerRef.current = new ContentHashManager();
    console.log('[SAVE-CYCLE] ContentHashManager initialized');
  }

  // Referencias para drag & drop
  const dragStateRef = useRef({
    isDragging: false,
    draggedItem: null,
    draggedPath: null,
    draggedProjectIndex: null
  });


  // =============================================================================
  // HANDLERS & CORE LOGIC (Move high up to avoid TDZ issues)
  // =============================================================================

  /**
   * Actualiza las estadísticas del editor.
   * Memoizada con useCallback y debounce de 150ms para evitar recálculos innecesarios.
   * @param {string} content - Contenido HTML
   */
  const updateStats = useCallback((content) => {
    if (statsDebounceRef.current) clearTimeout(statsDebounceRef.current);
    statsDebounceRef.current = setTimeout(() => {
      const text = content.replace(/<[^>]*>/g, '');
      const lines = content.split(/<p|<div|<h[1-6]/).length - 1;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      setStats({ lines, words, chars });
    }, 150);
  }, []);

  const activeFooterFile = splitMode !== 'none'
    ? (activePanelSide === 'left' ? leftPanelFile : rightPanelFile)
    : activeFile;

  const activeFooterContent = splitMode !== 'none'
    ? (activePanelSide === 'left' ? leftPanelContent : rightPanelContent)
    : editorContent;

  useEffect(() => {
    updateStats(activeFooterContent || '<p><br></p>');
  }, [activeFooterContent]);

  // =============================================================================
  // EFECTO: SINCRONIZACIÓN DE activeFile CON PANEL ACTIVO EN SPLIT VIEW
  // =============================================================================
  useEffect(() => {
    // Solo sincronizar cuando el split view está activo
    if (splitMode !== 'none') {
      // Obtener el archivo del panel activo
      const panelFile = activePanelSide === 'left' ? leftPanelFile : rightPanelFile;
      
      // Solo actualizar si el archivo del panel es diferente al activeFile actual
      if (panelFile && panelFile.fullPath !== activeFile?.fullPath) {
        console.log('[SPLIT-SYNC] Sincronizando activeFile con panel activo:', activePanelSide);
        setActiveFile(panelFile);
        
        // Actualizar activeTabIndex para que coincida con el archivo del panel activo
        const tabIndex = openTabs.findIndex(tab => tab.fullPath === panelFile.fullPath);
        if (tabIndex >= 0) {
          console.log('[SPLIT-SYNC] Actualizando activeTabIndex a:', tabIndex);
          setActiveTabIndex(tabIndex);
        }
      }
    }
  }, [activePanelSide, leftPanelFile, rightPanelFile, splitMode, openTabs, activeFile]);

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

      // Actualizar tabs abiertas si alguna tiene la ruta antigua
      setOpenTabs(prev => {
        const updated = prev.map(tab => {
          if (tab.fullPath && tab.fullPath.startsWith(action.oldPath)) {
            const newFull = action.newPath + tab.fullPath.slice(action.oldPath.length);
            // Actualizar nombre si es el archivo renombrado directamente
            const newName = tab.fullPath === action.oldPath
              ? action.newPath.split(/[/\\]/).pop()
              : tab.name;
            return { ...tab, fullPath: newFull, name: newName };
          }
          return tab;
        });
        return updated;
      });

      // Actualizar splitViewState si las tabs del split fueron renombradas
      setSplitViewState(prev => {
        if (!prev.isActive) return prev;

        const newState = { ...prev };
        if (prev.leftTabId && prev.leftTabId.startsWith(action.oldPath)) {
          newState.leftTabId = action.newPath + prev.leftTabId.slice(action.oldPath.length);
        }
        if (prev.rightTabId && prev.rightTabId.startsWith(action.oldPath)) {
          newState.rightTabId = action.newPath + prev.rightTabId.slice(action.oldPath.length);
        }
        return newState;
      });

      // Actualizar leftPanelFile y rightPanelFile si están en split view
      if (splitMode !== 'none') {
        if (leftPanelFile && leftPanelFile.fullPath && leftPanelFile.fullPath.startsWith(action.oldPath)) {
          const newFull = action.newPath + leftPanelFile.fullPath.slice(action.oldPath.length);
          setLeftPanelFile(prev => prev ? { ...prev, fullPath: newFull } : prev);
        }
        if (rightPanelFile && rightPanelFile.fullPath && rightPanelFile.fullPath.startsWith(action.oldPath)) {
          const newFull = action.newPath + rightPanelFile.fullPath.slice(action.oldPath.length);
          setRightPanelFile(prev => prev ? { ...prev, fullPath: newFull } : prev);
        }
      }
    }

    // Handle file move events
    if (action.type === 'move' && action.oldPath && action.newPath) {
      console.log('[TAB-SYNC] File moved:', action.oldPath, '->', action.newPath);

      // Update activeFile if it matches oldPath
      if (activeFile && activeFile.fullPath === action.oldPath) {
        console.log('[TAB-SYNC] Updating activeFile path');
        setActiveFile(prev => prev ? { ...prev, fullPath: action.newPath } : prev);
      }

      // Update all tabs with matching oldPath (solo si newPath es archivo .txt; así no se asigna una carpeta como tab)
      setOpenTabs(prev => {
        return prev.map(tab => {
          if (tab.fullPath === action.oldPath && action.newPath && action.newPath.endsWith('.txt')) {
            console.log('[TAB-SYNC] Updating tab path:', tab.name);
            return { ...tab, fullPath: action.newPath };
          }
          return tab;
        });
      });

      // Update splitViewState if tabs in split were moved
      setSplitViewState(prev => {
        if (!prev.isActive) return prev;

        const newState = { ...prev };
        if (prev.leftTabId === action.oldPath) {
          console.log('[TAB-SYNC] Updating left split panel path');
          newState.leftTabId = action.newPath;
        }
        if (prev.rightTabId === action.oldPath) {
          console.log('[TAB-SYNC] Updating right split panel path');
          newState.rightTabId = action.newPath;
        }
        return newState;
      });

      // Update leftPanelFile and rightPanelFile if in split view
      if (splitMode !== 'none') {
        if (leftPanelFile && leftPanelFile.fullPath === action.oldPath) {
          console.log('[TAB-SYNC] Updating left panel file path');
          setLeftPanelFile(prev => prev ? { ...prev, fullPath: action.newPath } : prev);
        }
        if (rightPanelFile && rightPanelFile.fullPath === action.oldPath) {
          console.log('[TAB-SYNC] Updating right panel file path');
          setRightPanelFile(prev => prev ? { ...prev, fullPath: action.newPath } : prev);
        }
      }
    }
  };

  /**
   * Abre un archivo para edición.
   * Soporta archivos normales y sub-archivos (formato: path#subFileId)
   * @param {number} projectIndex - Índice del proyecto
   * @param {Object} file - Archivo a abrir
   */
  const handleOpenFile = async (projectIndex, file, forceSplit = false) => {
    console.log('[OPEN-FILE] Abriendo archivo:', file.fullPath);

    // Usar el sistema de tabs
    await handleOpenFileInTab(projectIndex, file, forceSplit);

    // Cerrar ProjectViewer automáticamente
    setViewingProject(null);
  };

  // =============================================================================
  // EFECTO: INICIALIZACIÓN DE LA APLICACIÓN
  // =============================================================================

  useEffect(() => {
    initializeApp();

    // Cargar workspaces recientes
    const savedRecents = localStorage.getItem('bg.recentWorkspaces');
    if (savedRecents) {
      try { setRecentWorkspaces(JSON.parse(savedRecents)); } catch (e) { console.error(e); }
    }

    // Hacer disponible la función para abrir el modal de actualizaciones globalmente
    window.openUpdateModal = () => setIsUpdateModalOpen(true);

    return () => {
      delete window.openUpdateModal;
    };
  }, []); // Sin dependencias - solo se ejecuta una vez

  // Cleanup de timeouts al desmontar
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      if (editorChangeTimeoutRef.current) {
        clearTimeout(editorChangeTimeoutRef.current);
      }
      if (safetyDraftTimeoutRef.current) {
        clearTimeout(safetyDraftTimeoutRef.current);
      }
    };
  }, []);

  // =============================================================================
  // FUNCIÓN: loadWorkspace (movida aquí para evitar error de inicialización)
  // =============================================================================
  
  /**
   * Carga los proyectos y archivos del workspace.
   * @param {string} path - Ruta del workspace
   */
  const loadWorkspace = useCallback(async (path) => {
    if (!path) {
      console.warn('[WORKSPACE] No se proporcionó ruta de workspace');
      return;
    }

    try {
      console.log('[WORKSPACE] Cargando workspace desde:', path);

      // Esperar a que se completen operaciones pendientes antes de leer
      if (window.electronAPI && window.electronAPI.waitPendingOps) {
        await window.electronAPI.waitPendingOps(3000);
      }

      const projectsData = await window.electronAPI.readWorkspace(path);
      console.log('[WORKSPACE] Proyectos leídos:', projectsData?.length || 0);

      // Normalizar: asegurar ids y referencias parentId para uso en UI
      const normalized = ensureIdsOnProjects(projectsData || []);
      
      // Validación defensiva: verificar que todos los archivos tengan propiedades requeridas
      const validateFileStructure = (items) => {
        if (!items || !Array.isArray(items)) return [];
        
        return items.map(item => {
          try {
            // Verificar propiedades mínimas requeridas
            if (!item || typeof item !== 'object') {
              console.warn('[WORKSPACE] Item inválido encontrado, omitiendo:', item);
              return null;
            }
            
            // Los PROYECTOS tienen 'path', los ARCHIVOS tienen 'fullPath'
            // Asegurar que al menos uno existe
            if (!item.fullPath && !item.path) {
              console.warn('[WORKSPACE] Item sin fullPath ni path válido, omitiendo:', item);
              return null;
            }
            
            // Asegurar que name existe y es un string
            if (!item.name || typeof item.name !== 'string') {
              const pathToUse = item.fullPath || item.path;
              console.warn('[WORKSPACE] Item sin name válido, usando fallback:', pathToUse);
              item.name = pathToUse.split(/[\\/]/).pop() || 'Sin nombre';
            }
            
            // Asegurar que type existe - NO cambiar el tipo si ya existe
            // Los proyectos NO tienen type, solo los archivos
            if (!item.type && item.fullPath) {
              console.warn('[WORKSPACE] Item sin type, usando fallback "file":', item.fullPath);
              item.type = 'file';
            }
            
            // Para archivos .canvas, asegurar que content existe
            if (item.type === 'file' && item.fullPath?.toLowerCase().endsWith('.canvas')) {
              if (typeof item.content === 'undefined' || item.content === null) {
                console.warn('[WORKSPACE] Archivo .canvas sin content, inicializando vacío:', item.fullPath);
                item.content = '';
              }
            }
            
            // Validar recursivamente items anidados
            if (item.items && Array.isArray(item.items)) {
              item.items = validateFileStructure(item.items).filter(Boolean);
            }
            
            return item;
          } catch (err) {
            console.error('[WORKSPACE] Error validando item:', item, err);
            return null;
          }
        }).filter(Boolean); // Filtrar items null
      };
      
      // const validated = validateFileStructure(normalized);
      // console.log('[WORKSPACE] Items validados:', validated.length);
      // console.log('[WORKSPACE] Items detalle:', validated.map(v => ({ 
      //   name: v.name, 
      //   type: v.type, 
      //   hasPath: !!v.path, 
      //   path: v.path,
      //   hasItems: !!v.items,
      //   itemsCount: v.items?.length || 0
      // })));
      const validated = validateFileStructure(normalized);
      setProjects(validated);

      // Set unified file list (allFiles) - same as projects for now
      // This will be used by Sidebar to render the unified tree
      setAllFiles(validated);
      // console.log('[WORKSPACE] Unified file list set:', validated.length, 'items');

      // Cargar iconos personalizados desde metadata de archivos
      const iconsMap = new Map();
      const extractIcons = (items) => {
        if (!items) return;
        items.forEach(item => {
          try {
            // Validación defensiva: verificar que item existe y tiene propiedades requeridas
            if (!item || !item.fullPath) return;
            
            if (item.type === 'file' && item.customIcon) {
              iconsMap.set(item.fullPath, item.customIcon);
            }
            // Recursivamente extraer iconos de sub-archivos
            if (item.items && item.items.length > 0) {
              extractIcons(item.items);
            }
          } catch (err) {
            console.warn('[WORKSPACE] Error extrayendo icono de item:', item, err);
          }
        });
      };
      extractIcons(validated);
      setFileIcons(iconsMap);
      console.log('[WORKSPACE] Iconos personalizados cargados:', iconsMap.size);

      console.log('[WORKSPACE] Workspace cargado exitosamente');
      // No mostrar notificación en cada recarga (solo en acciones del usuario)
    } catch (error) {
      console.error('[WORKSPACE] Error loading workspace:', error);
      // No usar notify aquí para evitar dependencias circulares
      // El error se muestra en consola para debugging
      // Establecer proyectos vacíos en caso de error
      setProjects([]);
    }
  }, []); // Sin dependencias para evitar problemas de inicialización

  // =============================================================================
  // LISTENER: Escuchar cambios en el workspace desde Electron
  // =============================================================================
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.on) return;

    console.log('[WORKSPACE-LISTENER] Registrando listener para workspace-changed');

    const unsubscribe = window.electronAPI.on('workspace-changed', async () => {
      console.log('[WORKSPACE-LISTENER] Evento workspace-changed recibido, recargando...');
      if (workspacePath) {
        try {
          await loadWorkspace(workspacePath);
          console.log('[WORKSPACE-LISTENER] Workspace recargado exitosamente');
        } catch (error) {
          console.error('[WORKSPACE-LISTENER] Error recargando workspace:', error);
        }
      }
    });

    return () => {
      if (unsubscribe) {
        console.log('[WORKSPACE-LISTENER] Desregistrando listener');
        unsubscribe();
      }
    };
  }, [workspacePath, loadWorkspace]);

  // Failsafe: Asegurar que el splash se oculte después de máximo 10 segundos
  useEffect(() => {
    const failsafeTimer = setTimeout(() => {
      if (showSplash) {
        console.warn('[FAILSAFE] Splash aún visible después de 10s, ocultando forzadamente');
        setShowSplash(false);
        setIsLoading(false);
      }
    }, 10000);

    return () => clearTimeout(failsafeTimer);
  }, [showSplash]);

  // Redimensionar ventana según el estado de la aplicación
  useEffect(() => {
    const resizeWindow = async () => {
      try {
        if (!window.electronAPI?.resizeWindow) return;

        // Prioridad: splash > onboarding > workspace
        if (showSplash) {
          console.log('[RESIZE] Ajustando a tamaño splash: 800x600');
          await window.electronAPI.resizeWindow(800, 600);
        } else if (showOnboarding) {
          console.log('[RESIZE] Ajustando a tamaño onboarding: 1000, 700');
          await window.electronAPI.resizeWindow(1000, 700);
        } else if (workspacePath) {
          // Solo restaurar si hay workspace cargado
          console.log('[RESIZE] Restaurando tamaño workspace: 1400x900');
          await window.electronAPI.resizeWindow(1400, 900);
        }
      } catch (error) {
        console.warn('[RESIZE] Error al redimensionar ventana:', error);
      }
    };

    // Pequeño delay para evitar conflictos de redimensionamiento
    const timer = setTimeout(resizeWindow, 100);
    return () => clearTimeout(timer);
  }, [showSplash, showOnboarding, workspacePath]);

  // Prevenir cierre con cambios sin guardar
  useEffect(() => {
    // Calcular archivos sin guardar combinando activeFile y openTabs
    const getUnsavedFilesList = () => {
      const unsavedNames = new Set();

      // 1. Revisar si el archivo activo tiene cambios
      if (hasChanges && activeFile && activeFile.name) {
        unsavedNames.add(activeFile.name);
      }

      // 2. Revisar todas las pestañas abiertas
      openTabs.forEach(tab => {
        if (tab.hasChanges && tab.name) {
          unsavedNames.add(tab.name);
        }
      });

      return Array.from(unsavedNames);
    };

    const unsavedFiles = getUnsavedFilesList();
    const isGloballyUnsaved = unsavedFiles.length > 0;

    // Exponer para electron
    window.__hasUnsavedChanges = isGloballyUnsaved;
    window.__getUnsavedFiles = getUnsavedFilesList;

    const handleBeforeUnload = (e) => {
      if (isGloballyUnsaved) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requiere esto
        return 'Tienes cambios sin guardar. ¿Seguro que quieres salir?';
      }
    };

    // Listener para guardar antes de cerrar (desde electron)
    const handleSaveBeforeClose = async () => {
      if (hasChanges && activeFile) {
        try {
          console.log('[SAVE-BEFORE-CLOSE] Guardando archivo activo antes de cerrar...');
          const sanitizedComments = (activeFile.comments || []).map(comment => ({
            id: comment.id || generateUUID(),
            text: String(comment.text || ''),
            timestamp: comment.timestamp || Date.now(),
            author: String(comment.author || userName || 'Anónimo'),
            fileId: comment.fileId || activeFile.fullPath
          }));

          const metadata = {
            status: activeFile.status || 'draft',
            goal: activeFile.goal || 30000,
            lastCharCount: stats.chars,
            initialCharCount: activeFile.initialCharCount || 0,
            comments: sanitizedComments,
            lastUpdated: Date.now()
          };

          // Guardar archivo activo
          await saveFileWithHierarchyCheck(activeFile.fullPath, editorContent, metadata);
          setHasChanges(false);
          console.log('[SAVE-BEFORE-CLOSE] Archivo activo guardado exitosamente');

          // NOTA: Si hay otras pestañas con cambios, sus cambios están en los safetyDrafts
          // Para ser exhaustivos, se podrían recuperar y guardar, pero el safetyDraft 
          // asegura que no se pierdan. El usuario las verá al reabrir.
        } catch (error) {
          console.error('[SAVE-BEFORE-CLOSE] Error saving file:', error);
        }
      }

      // Indicar a electron que puede cerrar si es necesario
      if (window.electronAPI && window.electronAPI.closeWindow) {
        // Cerramos nosotros mismos
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Escuchar el evento IPC de Electron
    let unsubscribe;
    if (window.electronAPI && window.electronAPI.on) {
      unsubscribe = window.electronAPI.on('save-before-close', handleSaveBeforeClose);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      delete window.__getUnsavedFiles;
      if (unsubscribe) unsubscribe();
    };
  }, [hasChanges, activeFile, editorContent, stats, userName, openTabs]);

  // =============================================================================
  // PERSISTENCIA: Guardar openTabs y splitViewState en localStorage
  // =============================================================================

  useEffect(() => {
    // Guardar openTabs en localStorage (sin contenido para ahorrar espacio)
    try {
      const tabsToSave = openTabs.map(tab => ({
        fullPath: tab.fullPath,
        name: tab.name,
        type: tab.type,
        hasChanges: tab.hasChanges
      }));
      localStorage.setItem('bloopy.openTabs', JSON.stringify(tabsToSave));
      localStorage.setItem('bloopy.activeTabIndex', activeTabIndex.toString());
    } catch (error) {
      console.error('[PERSISTENCE] Error guardando tabs:', error);
    }
  }, [openTabs, activeTabIndex]);

  useEffect(() => {
    // Guardar splitViewState en localStorage
    try {
      if (splitViewState.isActive) {
        localStorage.setItem('bloopy.splitViewState', JSON.stringify(splitViewState));
      } else {
        localStorage.removeItem('bloopy.splitViewState');
      }
    } catch (error) {
      console.error('[PERSISTENCE] Error guardando splitViewState:', error);
    }
  }, [splitViewState]);

  // Cargar estado persistido al iniciar
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        // Cargar tabs guardadas
        const savedTabs = localStorage.getItem('bloopy.openTabs');
        const savedActiveIndex = localStorage.getItem('bloopy.activeTabIndex');
        const savedSplitState = localStorage.getItem('bloopy.splitViewState');

        if (savedTabs && workspacePath) {
          const tabsData = JSON.parse(savedTabs).filter(t => t.fullPath && t.fullPath.endsWith('.txt'));
          console.log('[PERSISTENCE] Restaurando', tabsData.length, 'tabs');

          // Cargar contenido de cada tab
          const restoredTabs = [];
          for (const tabData of tabsData) {
            try {
              const content = await window.electronAPI.readFile(tabData.fullPath);
              restoredTabs.push({
                ...tabData,
                content: content || '<p><br></p>',
                hasChanges: false // Reset hasChanges al restaurar
              });
            } catch (error) {
              console.warn('[PERSISTENCE] No se pudo cargar tab:', tabData.fullPath);
            }
          }

          if (restoredTabs.length > 0) {
            setOpenTabs(restoredTabs);

            // Restaurar tab activa
            const activeIndex = savedActiveIndex ? parseInt(savedActiveIndex, 10) : 0;
            if (activeIndex >= 0 && activeIndex < restoredTabs.length) {
              setActiveTabIndex(activeIndex);
              setActiveFile(restoredTabs[activeIndex]);
              setEditorContent(restoredTabs[activeIndex].content);
              setHasChanges(false);
            }

            // Restaurar split view si estaba activo
            if (savedSplitState) {
              const splitState = JSON.parse(savedSplitState);
              const leftTab = restoredTabs.find(t => t.fullPath === splitState.leftTabId);
              const rightTab = restoredTabs.find(t => t.fullPath === splitState.rightTabId);

              if (leftTab && rightTab) {
                console.log('[PERSISTENCE] Restaurando split view');
                setSplitMode(splitState.mode);
                setLeftPanelFile(leftTab);
                setRightPanelFile(rightTab);
                setLeftPanelContent(leftTab.content);
                setRightPanelContent(rightTab.content);
                setActivePanelSide(splitState.activeSide || 'left');
                setSplitViewState(splitState);
              }
            }
          }
        }
      } catch (error) {
        console.error('[PERSISTENCE] Error cargando estado:', error);
      }
    };

    // Solo cargar una vez cuando el workspace esté listo
    if (workspacePath && !isLoading) {
      loadPersistedState();
    }
  }, [workspacePath, isLoading]); // Solo ejecutar cuando workspace cambie o termine de cargar

  /**
   * Hook: Auto-save del archivo actual
   */
  // Referencia para debouncing de notificaciones
  const notificationQueue = useRef(new Map());

  // Función de notificaciones con debouncing y filtrado
  const notify = useCallback((message, type = 'info', options = {}) => {
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
  }, [config]);

  const { isSaving, saveFile } = useAutoSave(
    activeFile,
    editorContent,
    config,
    config?.autosaveInterval || 30,
    notify,
    contentHashManagerRef.current,
    saveTrackerRef.current
  );

  /**
   * Guarda un draft de seguridad en localStorage
   */
  const saveSafetyDraft = useCallback(async (filePath, content, metadata) => {
    try {
      // Comparar con el contenido en disco antes de guardar
      try {
        const diskContent = await window.electronAPI.readFile(filePath);
        if (diskContent === content) {
          // Contenido idéntico, limpiar draft en lugar de guardarlo
          clearSafetyDraft(filePath);
          console.log('[SAFETY-DRAFT] Contenido idéntico a disco, draft limpiado:', filePath);
          return;
        }
      } catch (error) {
        // Si falla la lectura, guardar el draft por seguridad
        console.log('[SAFETY-DRAFT] No se pudo leer archivo en disco, guardando draft por seguridad:', filePath);
      }

      const safetyDrafts = JSON.parse(localStorage.getItem('Bloopy_safetyDrafts') || '{}');

      safetyDrafts[filePath] = {
        content,
        metadata,
        timestamp: Date.now()
      };

      localStorage.setItem('Bloopy_safetyDrafts', JSON.stringify(safetyDrafts));
      console.log('[SAFETY-DRAFT] Draft guardado:', filePath);
    } catch (error) {
      console.error('[SAFETY-DRAFT] Error guardando draft:', error);
    }
  }, []);

  /**
   * Limpia el draft de seguridad de un archivo
   */
  const clearSafetyDraft = useCallback((filePath) => {
    try {
      const safetyDrafts = JSON.parse(localStorage.getItem('Bloopy_safetyDrafts') || '{}');
      delete safetyDrafts[filePath];
      localStorage.setItem('Bloopy_safetyDrafts', JSON.stringify(safetyDrafts));
      console.log('[SAFETY-DRAFT] Draft limpiado:', filePath);
    } catch (error) {
      console.error('[SAFETY-DRAFT] Error limpiando draft:', error);
    }
  }, []);

  /**
   * Guarda el archivo actual.
   * (movido arriba para evitar referencia antes de inicialización al registrar atajos)
   */
  const handleSaveFile = useCallback(async (contentOverride = null, metadataOverride = null) => {
      if (!activeFile) return;

      try {
        console.log('[SAVE] Guardando archivo:', activeFile.fullPath);

        // Si el botón onClick pasó un evento de React/DOM como primer argumento, ignorarlo
        if (contentOverride && typeof contentOverride === 'object') {
          const isEvent =
            !!contentOverride.nativeEvent ||
            typeof contentOverride.preventDefault === 'function' ||
            typeof contentOverride.stopPropagation === 'function' ||
            ('type' in contentOverride && 'target' in contentOverride);
          if (isEvent) {
            try { contentOverride.preventDefault && contentOverride.preventDefault(); } catch (_) {}
            contentOverride = null;
          }
        }

        const isCanvas = activeFile.fullPath && activeFile.fullPath.toLowerCase().endsWith('.canvas');
        
        // CRÍTICO: Asegurar que tenemos el contenido más reciente
        let currentContent = contentOverride;
        if (currentContent === null) {
          if (isCanvas) {
            currentContent = activeFile.content || '';
          } else {
            currentContent = editorContent || '';
          }
        }

        // Si el contenido es un objeto (no debería pasar), serializarlo
        if (typeof currentContent === 'object' && currentContent !== null) {
          console.warn('[SAVE] El contenido es un objeto, serializando a JSON...', currentContent);
          try {
            currentContent = JSON.stringify(currentContent);
          } catch (e) {
            console.error('[SAVE] Error serializando objeto de contenido:', e);
            currentContent = String(currentContent);
          }
        }

        const contentLength = (typeof currentContent === 'string') ? currentContent.length : 0;
        console.log('[SAVE] Tipo de archivo:', isCanvas ? 'canvas' : 'txt', 'Longitud contenido:', contentLength);

        // 3.2.2: Usar contentHashManager.hasChanged para detectar cambios
        if (contentHashManagerRef.current && !contentHashManagerRef.current.hasChanged(activeFile.fullPath, currentContent) && !metadataOverride) {
          console.log('[SAVE] Contenido sin cambios (detectado por ContentHashManager), omitiendo guardado');
          return;
        }

        // 3.2.3: Usar contentHashManager.updateHash después de detectar cambios
        // 3.2.1: Reemplazar simpleHash con contentHashManager.computeHash
        const contentHash = contentHashManagerRef.current 
          ? contentHashManagerRef.current.computeHash(currentContent)
          : simpleHash(currentContent);

        // 3.2.4: Registrar operación con saveTracker.registerSave
        const operationId = saveTrackerRef.current 
          ? saveTrackerRef.current.registerSave(activeFile.fullPath, contentHash)
          : null;

        const sanitizedComments = (metadataOverride?.comments || activeFile.comments || []).map(comment => ({
          id: comment.id || generateUUID(),
          text: String(comment.text || ''),
          timestamp: comment.timestamp || Date.now(),
          author: String(comment.author || userName || 'Anónimo'),
          fileId: comment.fileId || activeFile.fullPath
        }));

        const metadata = {
          status: metadataOverride?.status || activeFile.status || 'draft',
          goal: metadataOverride?.goal || activeFile.goal || 30000,
          lastCharCount: stats.chars,
          initialCharCount: activeFile.initialCharCount || 0,
          comments: sanitizedComments,
          lastUpdated: Date.now(),
          contentHash: contentHash,
          customChecks: activeFile.customChecks || {}
        };

        try {
          // Verificación de serialización profunda para evitar errores de clonación IPC
          JSON.stringify(metadata);
        } catch (serErr) {
          console.error('[SAVE] Metadata no serializable:', serErr);
          notify(t('notifications.errorPreparingData'), 'error');
          return;
        }

        console.log('[SAVE] Guardando con metadata:', {
          status: metadata.status,
          goal: metadata.goal,
          commentsCount: metadata.comments.length,
          charCount: metadata.lastCharCount,
          contentLength: contentLength
        });

        const isLargeFile = contentLength > 50000;
        if (isLargeFile) {
          notify(t('notifications.savingLargeFile'), 'info');
        }

        try {
          const updatedMetadata = await saveFileWithHierarchyCheck(
            activeFile.fullPath,
            currentContent,
            metadata
          );

          // 3.2.3: Actualizar hash después de guardar exitosamente
          if (contentHashManagerRef.current) {
            contentHashManagerRef.current.updateHash(activeFile.fullPath, currentContent);
          }

          setActiveFile(prev => ({
            ...prev,
            ...updatedMetadata,
            content: currentContent,
            contentHash: contentHash
          }));

          setHasChanges(false);

          if (isCanvas) {
            lastSavedCanvasContentRef.current = currentContent;
          }

          if (activeTabIndex >= 0 && openTabs.length > 0) {
            const newTabs = [...openTabs];
            newTabs[activeTabIndex] = {
              ...newTabs[activeTabIndex],
              content: currentContent,
              hasChanges: false,
              contentHash: contentHash
            };
            setOpenTabs(newTabs);
          }

          localStorage.removeItem(`draft_${activeFile.fullPath}`);
          clearSafetyDraft(activeFile.fullPath);

          console.log('[SAVE] Archivo guardado exitosamente y borradores limpiados');
          notify(isLargeFile ? 'Archivo grande guardado exitosamente' : 'Archivo guardado', 'success');

          if (workspacePath && !recentWorkspaces.includes(workspacePath)) {
            const newRecents = [workspacePath, ...recentWorkspaces.filter(w => w !== workspacePath)].slice(0, 5);
            setRecentWorkspaces(newRecents);
            localStorage.setItem('bg.recentWorkspaces', JSON.stringify(newRecents));
          }

          if (!isLargeFile) {
            await loadWorkspace(workspacePath);
          }

        } catch (error) {
          // 3.2.5: Limpiar operación con saveTracker.clearOperation en caso de error
          if (saveTrackerRef.current && operationId) {
            saveTrackerRef.current.clearOperation(activeFile.fullPath);
            console.log('[SAVE] Operación de guardado limpiada debido a error');
          }

          if (error.message?.includes('ENOENT') && error.message?.includes('bloopy-temp')) {
            console.warn('[SAVE] Error de temp file, verificando si el archivo final existe...');

            try {
              const diskContent = await window.electronAPI.readFile(activeFile.fullPath);
              // Usar contentHashManager para verificar el hash
              const diskHash = contentHashManagerRef.current 
                ? contentHashManagerRef.current.computeHash(diskContent)
                : simpleHash(diskContent);
              const expectedHash = contentHashManagerRef.current 
                ? contentHashManagerRef.current.computeHash(currentContent)
                : simpleHash(currentContent);

              if (diskHash === expectedHash) {
                console.log('[SAVE] ¡El archivo se guardó correctamente a pesar del error de temp!');
                // Actualizar hash en contentHashManager
                if (contentHashManagerRef.current) {
                  contentHashManagerRef.current.updateHash(activeFile.fullPath, currentContent);
                }
                setActiveFile({ ...activeFile, content: currentContent, contentHash: expectedHash });
                setHasChanges(false);
                clearSafetyDraft(activeFile.fullPath);
                return;
              }
            } catch (verifyError) {
              console.error('[SAVE] No se pudo verificar el archivo guardado:', verifyError);
            }
          }

          throw error;
        }

      } catch (error) {
        console.error('[SAVE] Error saving file:', error);
        // 3.2.5: Limpiar operación en caso de error no manejado
        if (saveTrackerRef.current && activeFile?.fullPath) {
          saveTrackerRef.current.clearOperation(activeFile.fullPath);
          console.log('[SAVE] Operación de guardado limpiada debido a error no manejado');
        }
        notify(t('notifications.fileSaveErrorWithMessage', { message: error.message }), 'error');
      }
    }, [activeFile, editorContent, stats, userName, workspacePath, recentWorkspaces, notify, clearSafetyDraft, hasChanges, loadWorkspace, activeTabIndex, openTabs]);



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
   * Verifica si hay drafts de seguridad en localStorage
   * y pregunta al usuario si quiere restaurarlos
   */
  const checkForSafetyDrafts = async () => {
    try {
      const safetyDrafts = localStorage.getItem('Bloopy_safetyDrafts');
      if (!safetyDrafts) return;

      const drafts = JSON.parse(safetyDrafts);
      const draftKeys = Object.keys(drafts);

      if (draftKeys.length === 0) return;

      console.log('[SAFETY-DRAFT] Encontrados', draftKeys.length, 'drafts de seguridad');

      // Validar cada draft comparando con el contenido en disco
      const validDrafts = {};
      for (const filePath of draftKeys) {
        try {
          const diskContent = await window.electronAPI.readFile(filePath);
          const draftContent = drafts[filePath].content;
          
          // Solo considerar válido si el contenido es diferente
          if (diskContent !== draftContent) {
            validDrafts[filePath] = drafts[filePath];
            console.log('[SAFETY-DRAFT] Draft válido (contenido diferente):', filePath);
          } else {
            console.log('[SAFETY-DRAFT] Draft obsoleto (contenido idéntico):', filePath);
          }
        } catch (error) {
          // Si el archivo no existe en disco, el draft es válido
          validDrafts[filePath] = drafts[filePath];
          console.log('[SAFETY-DRAFT] Draft válido (archivo no existe en disco):', filePath);
        }
      }

      const validDraftKeys = Object.keys(validDrafts);

      // Si no hay drafts válidos, limpiar localStorage sin mostrar modal
      if (validDraftKeys.length === 0) {
        localStorage.removeItem('Bloopy_safetyDrafts');
        console.log('[SAFETY-DRAFT] Todos los drafts obsoletos, limpiados automáticamente');
        return;
      }

      // Actualizar localStorage con solo drafts válidos
      localStorage.setItem('Bloopy_safetyDrafts', JSON.stringify(validDrafts));
      console.log('[SAFETY-DRAFT] Drafts válidos:', validDraftKeys.length);

      // Esperar a que el splash screen se oculte antes de mostrar el modal
      await new Promise((resolve) => {
        const checkSplash = () => {
          if (!showSplash) {
            resolve();
          } else {
            setTimeout(checkSplash, 100);
          }
        };
        checkSplash();
      });

      // Preguntar al usuario si quiere restaurar
      const shouldRestore = await new Promise((resolve) => {
        setConfirmModal({
          title: 'Drafts de Seguridad Encontrados',
          message: `Se encontraron ${validDraftKeys.length} archivo(s) con cambios no guardados de la última sesión. ¿Deseas restaurarlos?`,
          onConfirm: () => {
            setConfirmModal(null);
            resolve(true);
          },
          onCancel: () => {
            setConfirmModal(null);
            resolve(false);
          }
        });
      });

      if (shouldRestore) {
        // Restaurar drafts
        for (const filePath of validDraftKeys) {
          const draft = validDrafts[filePath];
          console.log('[SAFETY-DRAFT] Restaurando:', filePath);

          try {
            await window.electronAPI.saveFile(filePath, draft.content, draft.metadata || {});
            notify(`Restaurado: ${draft.metadata?.name || filePath}`, 'success');
          } catch (error) {
            console.error('[SAFETY-DRAFT] Error restaurando:', error);
            notify(`Error restaurando: ${draft.metadata?.name || filePath}`, 'error');
          }
        }

        // Limpiar drafts después de restaurar
        localStorage.removeItem('Bloopy_safetyDrafts');
        notify(t('notifications.safetyDraftsRestored'), 'success');

        // Recargar workspace
        if (workspacePath) {
          await loadWorkspace(workspacePath);
        }
      } else {
        // Usuario no quiere restaurar, limpiar drafts
        localStorage.removeItem('Bloopy_safetyDrafts');
        console.log('[SAFETY-DRAFT] Drafts descartados por el usuario');
      }
    } catch (error) {
      console.error('[SAFETY-DRAFT] Error verificando drafts:', error);
    }
  };

  /**
   * Inicializa la aplicación cargando configuración y datos guardados.
   */
  const initializeApp = async () => {
    console.log('[INIT] Iniciando aplicación...');

    try {
      // 1) Buscar actualizaciones primero (solo si hay internet)
      setSplashPhase('checking');
      setShowSplash(true);

      // Verificar conexión a internet
      const hasInternet = navigator.onLine;
      console.log('[INIT] Estado de internet:', hasInternet ? 'CONECTADO' : 'SIN CONEXIÓN');

      if (hasInternet) {
        try {
          if (window.electronAPI && window.electronAPI.checkForUpdates) {
            console.log('[INIT] Verificando actualizaciones...');
            console.log('[INIT] Repositorio: Valentin-sbox/Bloopy');
            // Llamada con timeout para no bloquear el arranque
            const checkPromise = window.electronAPI.checkForUpdates();
            const result = await Promise.race([
              checkPromise,
              new Promise((res) => setTimeout(() => res({ success: false, timeout: true }), 3500))
            ]);

            if (result && result.timeout) {
              console.warn('[INIT] Timeout al verificar actualizaciones (3.5s)');
            } else if (result && result.hasUpdate) {
              console.log('[INIT] ¡Actualización disponible!');
              console.log('[INIT] Versión actual:', result.currentVersion);
              console.log('[INIT] Nueva versión:', result.latestVersion);
              notify(`Nueva versión disponible: ${result.latestVersion}`, 'info');
            } else if (result && result.success) {
              console.log('[INIT] No hay actualizaciones disponibles');
              console.log('[INIT] Versión actual:', result.currentVersion);
            } else if (result && !result.success) {
              console.warn('[INIT] Error al verificar actualizaciones:', result.error);
            }
          }
        } catch (err) {
          console.warn('[INIT] Error checkForUpdates:', err);
        }
      } else {
        console.log('[INIT] Sin internet, saltando verificación de actualizaciones');
      }

      // Cambiar a fase de carga normal
      console.log('[INIT] Cambiando a fase de carga...');
      setSplashPhase('loading');

      // Cargar configuración
      console.log('[INIT] Cargando configuración...');
      const savedConfig = await window.electronAPI.getConfig();
      console.log('[INIT] Configuración cargada:', savedConfig ? 'OK' : 'NULL');

      // Ejecutar migraciones
      console.log('[INIT] Ejecutando migraciones...');
      const migratedConfig = migrateConfig(savedConfig);

      // Hacer merge de la configuración guardada con los valores por defecto
      // Esto asegura que siempre tengamos todos los campos necesarios
      const mergedConfig = {
        ...config, // Valores por defecto del estado inicial
        ...migratedConfig, // Sobrescribir con valores guardados y migrados
        // Hacer merge profundo de objetos anidados
        editorEffects: {
          ...config.editorEffects,
          ...(migratedConfig.editorEffects || {})
        },
        spellCheck: {
          ...config.spellCheck,
          ...(migratedConfig.spellCheck || {}),
          pages: migratedConfig.spellCheck?.pages || config.spellCheck.pages
        },
        shortcuts: {
          ...config.shortcuts,
          ...(migratedConfig.shortcuts || {})
        }
      };

      // Sanitizar configuración
      const sanitizedConfig = sanitizeConfig(mergedConfig);

      // Validar configuración
      const validation = validateConfig(sanitizedConfig);
      if (!validation.valid) {
        console.warn('[INIT] Advertencias de validación:', validation.errors);
      }

      console.log('[INIT] Configuración merged y validada:', sanitizedConfig);

      // Si hubo migraciones, guardar la configuración actualizada
      if (migratedConfig !== savedConfig) {
        console.log('[INIT] Guardando configuración migrada...');
        await window.electronAPI.saveConfig(sanitizedConfig);
      }

      setConfig(sanitizedConfig);
      setUserName(sanitizedConfig.userName || 'Escritor');

      // Aplicar idioma si está guardado
      if (sanitizedConfig.language) {
        console.log('[INIT] Aplicando idioma:', sanitizedConfig.language);
        changeLanguage(sanitizedConfig.language);
      }

      // Aplicar tema
      console.log('[INIT] Aplicando tema:', sanitizedConfig.theme || 'dark');
      applyTheme(sanitizedConfig.theme || 'dark', sanitizedConfig.customColors);

      // Cargar avatar
      console.log('[INIT] Cargando avatar...');
      const savedAvatar = await window.electronAPI.getAvatar();
      setAvatar(savedAvatar);
      console.log('[INIT] Avatar cargado:', savedAvatar ? 'OK' : 'NULL');

      // Verificar si hay workspace guardado
      console.log('[INIT] Verificando workspace...');
      const savedWorkspace = await window.electronAPI.getWorkspacePath();
      console.log('[INIT] Workspace guardado:', savedWorkspace || 'NINGUNO');

      if (savedWorkspace) {
        // Ya tiene workspace, cargarlo
        console.log('[INIT] Cargando workspace existente...');
        setWorkspacePath(savedWorkspace);
        await loadWorkspace(savedWorkspace);
        console.log('[INIT] Workspace cargado exitosamente');

        // Verificar si hay drafts de seguridad
        await checkForSafetyDrafts();
      } else {
        // Primera vez, mostrar onboarding
        console.log('[INIT] Primera vez, mostrando onboarding');
        setShowOnboarding(true);
      }

      // Ocultar splash después de un tiempo mínimo para que se aprecie
      console.log('[INIT] Tiempo mínimo splash: 3000ms...');
      setTimeout(() => {
        splashMinTimeReadyRef.current = true;
        tryHideSplash();
      }, 3000);

      console.log('[INIT] Inicialización completada exitosamente');

    } catch (error) {
      console.error('[INIT] Error crítico en inicialización:', error);
      notify(t('notifications.initErrorWithMessage', { message: error.message }), 'error');

      // Asegurar que el splash se oculte incluso si hay error (con tiempo mínimo)
      setTimeout(() => {
        splashMinTimeReadyRef.current = true;
        splashImageReadyRef.current = true; // en error, no esperamos imagen
        tryHideSplash();
      }, 3000);
    } finally {
      console.log('[INIT] Finalizando inicialización, setIsLoading(false)');
      setIsLoading(false);
    }
  };

  // =============================================================================
  // FUNCIONES: GESTIÓN DEL WORKSPACE
  // =============================================================================

  /**
   * Crea un nuevo workspace.
   */
  const handleCreateWorkspace = async () => {
    try {
      console.log('[WORKSPACE] Creando nuevo workspace...');
      const newWorkspacePath = await window.electronAPI.createWorkspace();
      if (newWorkspacePath) {
        console.log('[WORKSPACE] Workspace creado:', newWorkspacePath);

        // Guardar la ruta del workspace
        await window.electronAPI.setWorkspacePath(newWorkspacePath);

        setWorkspacePath(newWorkspacePath);

        // Agregar a recientes
        const newRecents = [newWorkspacePath, ...recentWorkspaces.filter(w => w !== newWorkspacePath)].slice(0, 5);
        setRecentWorkspaces(newRecents);
        localStorage.setItem('bg.recentWorkspaces', JSON.stringify(newRecents));

        await loadWorkspace(newWorkspacePath);
        notify(t('notifications.workspaceCreated'), 'success');
      }
    } catch (error) {
      console.error('[WORKSPACE] Error creating workspace:', error);
      notify(t('notifications.workspaceError'), 'error');
    }
  };

  /**
   * Selecciona un workspace existente.
   */
  const handleSelectWorkspace = async () => {
    try {
      console.log('[WORKSPACE] Seleccionando workspace...');
      const selectedPath = await window.electronAPI.selectWorkspace();
      if (selectedPath) {
        console.log('[WORKSPACE] Workspace seleccionado:', selectedPath);

        // Guardar la ruta del workspace
        await window.electronAPI.setWorkspacePath(selectedPath);

        setWorkspacePath(selectedPath);

        // Agregar a recientes
        const newRecents = [selectedPath, ...recentWorkspaces.filter(w => w !== selectedPath)].slice(0, 5);
        setRecentWorkspaces(newRecents);
        localStorage.setItem('bg.recentWorkspaces', JSON.stringify(newRecents));

        await loadWorkspace(selectedPath);
        notify(t('notifications.workspaceSelected'), 'success');
      }
    } catch (error) {
      console.error('[WORKSPACE] Error selecting workspace:', error);
      notify(t('notifications.workspaceError'), 'error');
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
      notify(t('notifications.projectError'), 'error');
    }
  };

  /**
   * Crea un nuevo archivo.
   * @param {number} projectIndex - Índice del proyecto
   * @param {string} fileName - Nombre del archivo
   * @param {string} parentPath - Ruta del archivo padre (opcional, para sub-archivos)
   * @param {string} targetDir - Directorio donde crear el archivo (opcional, para carpetas)
   */
  const handleCreateFile = async (projectIndex, fileName, parentPath = null, targetDir = null) => {
    if (!workspacePath) return;

    try {
      // Detección de contexto
      let targetProjectIndex = projectIndex;
      let targetParentPath = parentPath;
      let targetDirectory = targetDir;
      let projectPath;

      // Si se proporciona projectIndex === null, estamos en el workspace root
      if (projectIndex === null) {
        projectPath = workspacePath;
        targetProjectIndex = null;
        targetParentPath = null;
      } else if (projectIndex === undefined) {
        // Si no se proporciona nada (ej: desde el IconBar), detectar contexto
        // 1. Si hay archivo activo, usar su proyecto
        if (activeFile && activeProjectIndex !== null) {
          targetProjectIndex = activeProjectIndex;
        }
        // 2. Si hay proyecto activo pero no archivo, usar proyecto activo
        else if (activeProjectIndex !== null && activeProjectIndex >= 0) {
          targetProjectIndex = activeProjectIndex;
        }
        // 3. Si no hay contexto, usar Workspace Root (NUEVO: Por defecto a root)
        else {
          targetProjectIndex = null;
          projectPath = workspacePath;
        }

        if (targetProjectIndex !== null) {
          const project = projects[targetProjectIndex];
          projectPath = targetDirectory || (project ? project.path : workspacePath);
        }
      } else {
        // projectIndex proporcionado
        const project = projects[targetProjectIndex];
        if (!project) {
          notify(t('notifications.projectNotFound'), 'error');
          return;
        }
        projectPath = targetDirectory || project.path;
      }

      // Generar nombre "Untitled-{timestamp}.txt" si no se proporciona
      const finalFileName = fileName || `Untitled-${Date.now()}.txt`;

      // Crear archivo con metadata inicial
      await window.electronAPI.createFile(projectPath, finalFileName, targetParentPath);

      // Recargar workspace
      await loadWorkspace(workspacePath);

      notify(`Archivo "${finalFileName}" creado`, 'success');

      // Buscar archivo recién creado y abrirlo en nueva pestaña
      // Si el archivo se creó en la raíz o en un proyecto
      const createdFile = findFileByPath(projects, projectPath, finalFileName);
      if (createdFile) {
        await handleOpenFileInTab(targetProjectIndex, createdFile);
      }
    } catch (error) {
      console.error('Error creating file:', error);
      notify(t('notifications.fileError'), 'error');
    }
  }
  /**
     * Busca un archivo recursivamente en la estructura de proyectos.
     * @param {Array} projectsList - Lista de proyectos
     * @param {string} parentPath - Ruta del padre donde buscar
     * @param {string} fileName - Nombre del archivo a buscar
     * @returns {Object|null} Archivo encontrado o null
     */
  const findFileByPath = (projectsList, parentPath, fileName) => {
    for (const project of projectsList) {
      // Buscar en la raíz del proyecto
      if (project.path === parentPath && project.items) {
        const found = project.items.find(item => item.name === fileName);
        if (found) return found;
      }

      // Buscar recursivamente en items
      if (project.items) {
        const result = searchInItems(project.items, parentPath, fileName);
        if (result) return result;
      }
    }
    return null;
  };

  /**
   * Busca recursivamente en items.
   * @param {Array} items - Lista de items
   * @param {string} parentPath - Ruta del padre
   * @param {string} fileName - Nombre del archivo
   * @returns {Object|null} Archivo encontrado o null
   */
  const searchInItems = (items, parentPath, fileName) => {
    for (const item of items) {
      // Si el item es el padre, buscar en sus hijos
      if (item.fullPath === parentPath && item.items) {
        const found = item.items.find(child => child.name === fileName);
        if (found) return found;
      }

      // Buscar recursivamente
      if (item.items) {
        const result = searchInItems(item.items, parentPath, fileName);
        if (result) return result;
      }
    }
    return null;
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

      // ✅ CORRECCIÓN: Pasar la ruta del archivo directamente para que electron.js
      // use el sistema de metadata en lugar de carpetas .d legacy
      await window.electronAPI.createFile(parentPath, subFileName);

      await loadWorkspace(workspacePath);
      notify(`Sub-archivo "${subFileName}" creado`, 'success');

      // Si el padre está abierto, tal vez refrescar? (Auto refresco por loadWorkspace debería bastar)
    } catch (error) {
      console.error('Error creating sub-file:', error);
      notify(t('notifications.subfileError'), 'error');
    }
  };

  /**
   * Solicita creación de sub-archivo (abre modal).
   */
  const handleRequestCreateSubFile = (parentFile) => {
    showInput(t('projectViewer.addSubfile'), t('modals.input.placeholder'), (name) => {
      handleCreateSubFile(parentFile, name);
    });
  };




  // Función global para actualizar openTabs cuando se mueve un archivo via drag & drop
  window.updateOpenTabsPath = (oldPath, newPath) => {
    setOpenTabs(prevTabs => {
      const updatedTabs = prevTabs.map(tab => {
        if (tab.fullPath === oldPath) {
          console.log('[DRAG-DROP] Actualizando tab:', oldPath, '->', newPath);
          return { ...tab, fullPath: newPath };
        }
        return tab;
      });
      return updatedTabs;
    });

    // También actualizar activeFile si es el archivo movido
    setActiveFile(prevFile => {
      if (prevFile && prevFile.fullPath === oldPath) {
        console.log('[DRAG-DROP] Actualizando activeFile:', oldPath, '->', newPath);
        return { ...prevFile, fullPath: newPath };
      }
      return prevFile;
    });
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
  // FUNCIONES: SISTEMA DE TABS Y SPLIT VIEW
  // =============================================================================

  /**
   * Abre un archivo en una nueva pestaña o cambia a la pestaña existente.
   * @param {number} projectIndex - Índice del proyecto
   * @param {Object} file - Archivo a abrir
   */
  const handleOpenFileInTab = async (projectIndex, file, forceSplit = false) => {
    // Auto-cerrar split view si se abre un archivo .canvas
    if (file.fullPath && file.fullPath.toLowerCase().endsWith('.canvas') && splitMode !== 'none') {
      console.log('[CANVAS] Auto-cerrando split view para archivo canvas');
      
      // Guardar configuración del split para restauración posterior
      setLastClosedSplit({
        leftTabId: splitViewState.leftTabId,
        rightTabId: splitViewState.rightTabId,
        mode: splitViewState.mode,
        activeSide: splitViewState.activeSide,
        timestamp: Date.now()
      });

      // Cerrar split view
      setSplitMode('none');
      setLeftPanelFile(null);
      setRightPanelFile(null);
      setLeftPanelContent('<p><br></p>');
      setRightPanelContent('<p><br></p>');
      setActivePanelSide('left');
      setSidebarCollapsed(false);

      // Limpiar splitViewState
      setSplitViewState({
        isActive: false,
        leftTabId: null,
        rightTabId: null,
        mode: 'none',
        activeSide: 'left'
      });
    }

    // Verificar si el archivo ya está abierto
    const existingTabIndex = openTabs.findIndex(tab => tab.fullPath === file.fullPath);

    if (existingTabIndex !== -1) {
      // Ya está abierto, solo cambiar a esa pestaña
      // Mantener el split view activo si está activo
      setActiveTabIndex(existingTabIndex);
      setActiveFile(openTabs[existingTabIndex]);
      setEditorContent(openTabs[existingTabIndex].content);
      return;
    }

    // Mostrar indicador de carga para archivos grandes
    const isLargeFile = file.size && file.size > 100000; // > 100KB
    if (isLargeFile) {
      notify(t('notifications.loadingLargeFile'), 'info');
    }

    // Leer contenido del archivo con optimización
    let content = '<p><br></p>';
    try {
      if (file.isSubFile) {
        content = file.content || '<p><br></p>';
      } else {
        // Usar requestIdleCallback para no bloquear UI
        content = await new Promise((resolve) => {
          if (window.requestIdleCallback) {
            window.requestIdleCallback(async () => {
              const fileContent = await window.electronAPI.readFile(file.fullPath);
              resolve(fileContent);
            }, { timeout: 2000 });
          } else {
            // Fallback para navegadores sin requestIdleCallback
            setTimeout(async () => {
              const fileContent = await window.electronAPI.readFile(file.fullPath);
              resolve(fileContent);
            }, 0);
          }
        });
      }

      // Agregar a tabs con carga diferida de stats
      const newTab = { ...file, content, hasChanges: false };
      setOpenTabs(prev => [...prev, newTab]);
      const newTabIndex = openTabs.length;

      // Si forceSplit es true, activar split view
      if (forceSplit) {
        // Verificar que hay un archivo activo y que no es el mismo
        if (activeFile && activeFile.fullPath !== newTab.fullPath) {
          // Validar que no sean el mismo archivo
          if (!validateSplitFiles(activeFile, newTab)) {
            notify(t('notifications.cannotOpenSameFileInBothPanels'), 'warning');
            return;
          }

          // Activar split view si no está activo
          if (splitMode === 'none') {
            setSplitMode('horizontal');
          }

          // Asignar archivos a los paneles
          setLeftPanelFile(activeFile);
          setLeftPanelContent(editorContent);
          setRightPanelFile(newTab);
          setRightPanelContent(content);
          setActivePanelSide('right');

          // Actualizar splitViewState
          setSplitViewState({
            isActive: true,
            leftTabId: activeFile.fullPath,
            rightTabId: newTab.fullPath,
            mode: 'horizontal',
            activeSide: 'right'
          });

          notify(t('notifications.splitViewActivated'), 'success');
          return;
        } else {
          notify(t('notifications.needActiveFileForSplit'), 'warning');
        }
      }

      // Mantener el split view activo si está activo
      // La nueva tab se agrega como tab regular sin afectar el split

      setActiveTabIndex(newTabIndex);
      setActiveFile(newTab);
      setEditorContent(content);
      setActiveProjectIndex(projectIndex);
      setHasChanges(false);

      // Calcular stats de forma asíncrona para no bloquear
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          updateStats(content);
        });
      } else {
        setTimeout(() => updateStats(content), 0);
      }

      if (isLargeFile) {
        notify(t('notifications.fileLoadedCorrectly'), 'success');
      }
    } catch (error) {
      console.error('[OPEN-FILE-TAB] Error:', error);
      notify(t('notifications.fileOpenError'), 'error');
    }
  };

  /**
   * Cambia a una pestaña específica.
   * @param {number} index - Índice de la pestaña
   */
  const handleTabClick = (index) => {
    // Si estamos en split view y la pestaña clickeada es la pestaña fusionada (split-tab)
    // O si estamos navegando entre pestañas que forman parte del split
    if (splitMode !== 'none' && splitViewState.isActive) {
      const clickedTab = openTabs[index];
      const isLeftTab = clickedTab && clickedTab.fullPath === splitViewState.leftTabId;
      const isRightTab = clickedTab && clickedTab.fullPath === splitViewState.rightTabId;

      if (isLeftTab || isRightTab) {
        // Estamos dentro del split, solo cambiar el foco
        setActiveTabIndex(index);
        setActiveFile(clickedTab);
        setEditorContent(clickedTab.content);
        setActivePanelSide(isLeftTab ? 'left' : 'right');
        return;
      }
      
      // La tab clickeada NO es parte del split: ocultar split SIN perder la agrupación
      console.log('[SPLIT-VIEW] Ocultando split view para mostrar tab individual (agrupación persistente):', index);
      // Desactivar split visible y limpiar paneles, pero conservar IDs en splitViewState
      setSplitMode('none');
      setLeftPanelFile(null);
      setRightPanelFile(null);
      setLeftPanelContent('<p><br></p>');
      setRightPanelContent('<p><br></p>');
      setActivePanelSide('left');
      setSidebarCollapsed(false);
      setSplitViewState({
        isActive: false, // oculto
        leftTabId: splitViewState.leftTabId,
        rightTabId: splitViewState.rightTabId,
        mode: splitViewState.mode,
        activeSide: splitViewState.activeSide
      });
    }

    // Si NO estamos en split y la pestaña clickeada es parte del grupo de split persistente, restaurar
    if (splitMode === 'none' && splitViewState && (splitViewState.leftTabId || splitViewState.rightTabId)) {
      const clickedTab = openTabs[index];
      const isPartOfPersistedSplit = clickedTab && (
        clickedTab.fullPath === splitViewState.leftTabId ||
        clickedTab.fullPath === splitViewState.rightTabId
      );

      if (isPartOfPersistedSplit) {
        console.log('[SPLIT-VIEW] Restaurando split persistente al seleccionar pestaña del grupo');
        handleRestoreSplit(); // Usará splitViewState si no hay lastClosedSplit
        return;
      }
    }

    // Guardar scroll position de la tab actual antes de cambiar
    if (activeTabIndex >= 0 && activeTabIndex < openTabs.length && activeFile) {
      const currentScrollPos = editorRef?.current?.getScrollPosition ? editorRef.current.getScrollPosition() : 0;
      if (currentScrollPos > 0) {
        setTabScrollPositions(prev => {
          return { ...prev, [activeFile.fullPath]: currentScrollPos };
        });
      }
    }

    // Guardar el contenido actual en la tab activa antes de cambiar
    let tabs = [...openTabs]; // Crear copia inmediatamente
    if (activeTabIndex >= 0 && activeTabIndex < tabs.length) {
      tabs[activeTabIndex] = {
        ...tabs[activeTabIndex],
        content: editorContent,
        hasChanges: hasChanges
      };
      setOpenTabs(tabs); // Actualizar estado
    }

    // (Restauración del split se hace vía splitViewState persistido o lastClosedSplit)

    // Cambiar a la tab seleccionada (modo normal)
    setActiveTabIndex(index);
    setActiveFile(tabs[index]);
    setEditorContent(tabs[index].content);
    setHasChanges(tabs[index].hasChanges || false);
    updateStats(tabs[index].content);

    // Restaurar scroll position de la nueva tab
    setTimeout(() => {
      const savedScrollPos = tabScrollPositions[tabs[index].fullPath];
      if (savedScrollPos && editorRef?.current?.setScrollPosition) {
        editorRef.current.setScrollPosition(savedScrollPos);
      }
    }, 100); // Pequeño delay para asegurar que el editor esté renderizado
  }

  /**
   * Cierra una o varias pestañas.
   * @param {number|number[]} indices - Índice o array de índices de pestañas a cerrar
   */
  const handleTabClose = async (indices) => {
    const indicesToClose = Array.isArray(indices) ? [...indices].sort((a, b) => b - a) : [indices];
    let currentTabs = [...openTabs];
    let newActiveIndex = activeTabIndex;

    // Solo pedir confirmación si es una sola pestaña con cambios
    if (indicesToClose.length === 1) {
      const index = indicesToClose[0];
      const tab = currentTabs[index];
      
      if (tab && tab.hasChanges) {
        const isCanvas = tab.fullPath && tab.fullPath.toLowerCase().endsWith('.canvas');
        
        if (isCanvas) {
          const action = await new Promise((resolve) => {
            showConfirm(
              t('canvas.confirmClose.title'),
              t('canvas.confirmClose.message'),
              () => {
                setConfirmModal(null);
                resolve('save');
              }
            );
            
            setTimeout(() => {
              const modal = document.querySelector('.confirm-modal');
              if (modal) {
                const btnContainer = modal.querySelector('.modal-actions');
                if (btnContainer) {
                  btnContainer.innerHTML = '';
                  const saveBtn = document.createElement('button');
                  saveBtn.className = 'btn-primary';
                  saveBtn.innerHTML = `<i class="fas fa-save"></i> ${t('canvas.confirmClose.saveAndClose')}`;
                  saveBtn.onclick = () => { setConfirmModal(null); resolve('save'); };
                  const discardBtn = document.createElement('button');
                  discardBtn.className = 'btn-danger';
                  discardBtn.innerHTML = `<i class="fas fa-times"></i> ${t('canvas.confirmClose.closeWithoutSave')}`;
                  discardBtn.onclick = () => { setConfirmModal(null); resolve('discard'); };
                  const cancelBtn = document.createElement('button');
                  cancelBtn.className = 'btn-cancel';
                  cancelBtn.innerHTML = `<i class="fas fa-ban"></i> ${t('canvas.confirmClose.cancel')}`;
                  cancelBtn.onclick = () => { setConfirmModal(null); resolve('cancel'); };
                  btnContainer.appendChild(saveBtn);
                  btnContainer.appendChild(discardBtn);
                  btnContainer.appendChild(cancelBtn);
                }
              }
            }, 100);
          });
          
          if (action === 'cancel') return;
          if (action === 'save') {
            try {
              const metadata = { status: tab.status || 'draft', goal: tab.goal || 30000, lastUpdated: Date.now() };
              await saveFileWithHierarchyCheck(tab.fullPath, tab.content, metadata);
            } catch (error) {
              console.error('[CANVAS] Error guardando:', error);
              return;
            }
          }
        } else {
          const confirmed = await new Promise((resolve) => {
            showConfirm(
              t('modals.confirm.saveChanges'),
              t('modals.confirm.unsavedChanges', { name: tab.name }),
              () => { setConfirmModal(null); resolve(true); }
            );
            setTimeout(() => {
              const modal = document.querySelector('.confirm-modal');
              if (modal) {
                const cancelBtn = modal.querySelector('.btn-cancel');
                if (cancelBtn) cancelBtn.onclick = () => { setConfirmModal(null); resolve(false); };
              }
            }, 100);
          });
          
          if (confirmed) {
            const metadata = { status: tab.status || 'draft', goal: tab.goal || 30000, lastUpdated: Date.now() };
            await saveFileWithHierarchyCheck(tab.fullPath, tab.content, metadata);
          }
        }
      }
    }

    for (const index of indicesToClose) {
      const tab = currentTabs[index];
      if (!tab) continue;

      if (splitMode !== 'none' && splitViewState.isActive) {
        const isLeftTab = tab.fullPath === splitViewState.leftTabId;
        const isRightTab = tab.fullPath === splitViewState.rightTabId;
        if (isLeftTab || isRightTab) {
          setSplitMode('none');
          setSplitViewState({ isActive: false, leftTabId: null, rightTabId: null, mode: 'none', activeSide: 'left' });
        }
      }

      currentTabs.splice(index, 1);
      if (index === newActiveIndex) {
        newActiveIndex = Math.min(index, currentTabs.length - 1);
      } else if (index < newActiveIndex) {
        newActiveIndex--;
      }
    }

    setOpenTabs(currentTabs);
    if (currentTabs.length === 0) {
      setActiveTabIndex(-1);
      setActiveFile(null);
      setEditorContent('<p><br></p>');
      setHasChanges(false);
      setSplitMode('none');
    } else {
      const nextTab = currentTabs[newActiveIndex];
      setActiveTabIndex(newActiveIndex);
      setActiveFile(nextTab);
      setEditorContent(nextTab.content);
      setHasChanges(nextTab.hasChanges || false);
      updateStats(nextTab.content);
    }
  };

  /**
   * Reordena las pestañas mediante drag & drop.
   * @param {number} fromIndex - Índice origen
   * @param {number} toIndex - Índice destino
   */
  const handleTabReorder = (fromIndex, toIndex) => {
    const newTabs = [...openTabs];
    const [movedTab] = newTabs.splice(fromIndex, 1);
    newTabs.splice(toIndex, 0, movedTab);
    setOpenTabs(newTabs);

    // Ajustar activeTabIndex
    if (fromIndex === activeTabIndex) {
      setActiveTabIndex(toIndex);
    } else if (fromIndex < activeTabIndex && toIndex >= activeTabIndex) {
      setActiveTabIndex(activeTabIndex - 1);
    } else if (fromIndex > activeTabIndex && toIndex <= activeTabIndex) {
      setActiveTabIndex(activeTabIndex + 1);
    }

    // NO es necesario recalcular índices porque usamos IDs
    // El splitViewState mantiene leftTabId y rightTabId que no cambian al reordenar
    console.log('[TAB-REORDER] Tabs reordenadas, splitViewState mantiene IDs intactos');
  };

  /**
   * Valida si dos archivos pueden estar en split view juntos.
   */
  const validateSplitFiles = (leftFile, rightFile) => {
    if (!leftFile || !rightFile) return false;
    
    if (leftFile.fullPath === rightFile.fullPath) {
      notify(t('splitView.sameFileError') || 'No puedes abrir el mismo archivo en ambos paneles', 'warning');
      return false;
    }
    
    const isCanvas = (f) => f.fullPath && f.fullPath.toLowerCase().endsWith('.canvas');
    if (isCanvas(leftFile) || isCanvas(rightFile)) {
      notify('Los archivos .canvas no soportan vista dividida', 'warning');
      return false;
    }
    
    return true;
  };

  /**
   * Activa/desactiva el modo de vista dividida horizontal.
   * @param {Object} secondFile - Opcional: Archivo para el panel derecho
   */
  const handleSplitHorizontal = async (secondFile = null) => {
    if (splitMode !== 'none' && !secondFile) {
      // Cerrar split (comportamiento anterior si se llama sin argumentos estando en split)
      handleCloseSplit();
    } else {
      // Validar que el archivo activo no sea .canvas
      if (activeFile && activeFile.fullPath && activeFile.fullPath.toLowerCase().endsWith('.canvas')) {
        notify('Los archivos .canvas no soportan vista dividida', 'warning');
        return;
      }

      // Si se proporciona un secondFile, abrirlo directamente en el panel derecho
      if (secondFile) {
        // Validar que no sea el mismo archivo
        if (!validateSplitFiles(activeFile, secondFile)) {
          return;
        }

        // Si ya estamos en split, solo cambiar el panel derecho
        if (splitMode !== 'none') {
          handleRightFileSelect(secondFile);
          setActivePanelSide('right');
          return;
        }

        // Si no estamos en split, activarlo con ambos archivos
        setSplitMode('horizontal');
        setLeftPanelFile(activeFile);
        setLeftPanelContent(editorContent);
        
        // Cargar contenido del segundo archivo
        let rightContent = '<p><br></p>';
        if (secondFile.isSubFile) {
          rightContent = secondFile.content || '<p><br></p>';
        } else {
          rightContent = await window.electronAPI.readFile(secondFile.fullPath);
        }

        // Asegurar que el segundo archivo esté en tabs
        let tabs = [...openTabs];
        let rightIndex = tabs.findIndex(t => t.fullPath === secondFile.fullPath);
        if (rightIndex === -1) {
          const newTab = { ...secondFile, content: rightContent, hasChanges: false };
          tabs.push(newTab);
          setOpenTabs(tabs);
        }

        setRightPanelFile(secondFile);
        setRightPanelContent(rightContent);
        setActivePanelSide('right');
        setSidebarCollapsed(true);

        setSplitViewState({
          isActive: true,
          leftTabId: activeFile.fullPath,
          rightTabId: secondFile.fullPath,
          mode: 'horizontal',
          activeSide: 'right'
        });

        console.log('[SPLIT-VIEW] Split horizontal iniciado con archivos:', activeFile.fullPath, 'y', secondFile.fullPath);
      } else {
        // Comportamiento normal: abrir split y esperar selección
        setSplitMode('horizontal');
        setLeftPanelFile(activeFile);
        setLeftPanelContent(editorContent);
        setActivePanelSide('left');
        setSidebarCollapsed(true);

        if (activeFile) {
          setSplitViewState({
            isActive: true,
            leftTabId: activeFile.fullPath,
            rightTabId: null,
            mode: 'horizontal',
            activeSide: 'left'
          });
        }
      }
    }
  };

  /**
   * Desactiva el modo split view sin cerrar ninguna pestaña.
   * Simplemente vuelve a la vista de editor normal.
   */
  const handleDisableSplit = () => {
    console.log('[SPLIT-VIEW] Desactivando split view (ocultar)');
    
    // Sincronizar contenidos antes de ocultar
    const leftContent = editorRefLeft?.current?.getContent ? editorRefLeft.current.getContent() : leftPanelContent;
    const rightContent = editorRefRight?.current?.getContent ? editorRefRight.current.getContent() : rightPanelContent;

    // Actualizar tabs con contenido sincronizado
    const updatedTabs = openTabs.map(tab => {
      if (leftPanelFile && tab.fullPath === leftPanelFile.fullPath) {
        return { ...tab, content: leftContent };
      }
      if (rightPanelFile && tab.fullPath === rightPanelFile.fullPath) {
        return { ...tab, content: rightContent };
      }
      return tab;
    });
    setOpenTabs(updatedTabs);

    // Guardar estado para posible restauración
    setLastClosedSplit({
      leftTabId: leftPanelFile?.fullPath,
      rightTabId: rightPanelFile?.fullPath,
      mode: splitMode,
      activeSide: activePanelSide,
      timestamp: Date.now()
    });

    // Desactivar modo split pero mantener los archivos en los paneles
    setSplitMode('none');
    setSidebarCollapsed(false);

    // Mantener el archivo del panel activo como archivo activo principal
    const keepFile = activePanelSide === 'left' ? leftPanelFile : rightPanelFile;
    const keepContent = activePanelSide === 'left' ? leftContent : rightContent;

    if (keepFile) {
      const tabIndex = updatedTabs.findIndex(t => t.fullPath === keepFile.fullPath);
      if (tabIndex !== -1) {
        setActiveTabIndex(tabIndex);
        setActiveFile(updatedTabs[tabIndex]);
        setEditorContent(keepContent);
      }
    }
  };
  /**
   * Cierra la vista dividida y vuelve a la vista normal.
   */
  const handleCloseSplit = () => {
    console.log('[SPLIT-VIEW] Cerrando split view');

    // Guardar estado del split para restauración (30 segundos)
    if (leftPanelFile && rightPanelFile) {
      setLastClosedSplit({
        leftTabId: leftPanelFile.fullPath,
        rightTabId: rightPanelFile.fullPath,
        mode: splitMode,
        activeSide: activePanelSide,
        timestamp: Date.now()
      });

      // Limpiar después de 30 segundos
      if (lastClosedSplitTimerRef.current) {
        clearTimeout(lastClosedSplitTimerRef.current);
      }
      lastClosedSplitTimerRef.current = setTimeout(() => {
        setLastClosedSplit(null);
      }, 30000);
    }

    // 1. Sincronizar contenido desde editores antes de cerrar
    const leftContent = editorRefLeft?.current?.getContent ? editorRefLeft.current.getContent() : leftPanelContent;
    const rightContent = editorRefRight?.current?.getContent ? editorRefRight.current.getContent() : rightPanelContent;

    // 2. Actualizar tabs con contenido sincronizado
    const updatedTabs = openTabs.map(tab => {
      if (leftPanelFile && tab.fullPath === leftPanelFile.fullPath) {
        return { ...tab, content: leftContent };
      }
      if (rightPanelFile && tab.fullPath === rightPanelFile.fullPath) {
        return { ...tab, content: rightContent };
      }
      return tab;
    });
    setOpenTabs(updatedTabs);

    // 3. Determinar qué panel mantener (el activo)
    const keepSide = activePanelSide;
    const keepFile = keepSide === 'left' ? leftPanelFile : rightPanelFile;
    const keepContent = keepSide === 'left' ? leftContent : rightContent;
    const closeFile = keepSide === 'left' ? rightPanelFile : leftPanelFile;

    // 4. Limpiar estado de split view
    setSplitMode('none');
    setLeftPanelFile(null);
    setRightPanelFile(null);
    setLeftPanelContent('<p><br></p>');
    setRightPanelContent('<p><br></p>');
    setActivePanelSide('left');
    setSidebarCollapsed(false);
    if (editorRefLeft && typeof editorRefLeft !== 'function') {
      editorRefLeft.current = null;
    }
    if (editorRefRight && typeof editorRefRight !== 'function') {
      editorRefRight.current = null;
    }

    // 5. Limpiar splitViewState
    console.log('[SPLIT-VIEW] Limpiando split view state (cierre explícito)');
    setSplitViewState({
      isActive: false,
      leftTabId: null,
      rightTabId: null,
      mode: 'none',
      activeSide: 'left'
    });

    // 6. Cerrar tab del panel inactivo
    if (closeFile) {
      const closeIndex = updatedTabs.findIndex(t => t.fullPath === closeFile.fullPath);
      if (closeIndex !== -1) {
        console.log('[SPLIT-VIEW] Cerrando tab del panel inactivo:', closeIndex);

        // Remover tab directamente
        const newTabs = updatedTabs.filter((_, i) => i !== closeIndex);
        setOpenTabs(newTabs);

        // 7. Actualizar activeTabIndex correctamente
        if (keepFile) {
          const keepIndex = updatedTabs.findIndex(t => t.fullPath === keepFile.fullPath);
          // Calcular nuevo índice considerando la tab removida
          const newKeepIndex = closeIndex < keepIndex ? keepIndex - 1 : keepIndex;

          console.log('[SPLIT-VIEW] Actualizando activeTabIndex:', { keepIndex, closeIndex, newKeepIndex });

          if (newKeepIndex >= 0 && newKeepIndex < newTabs.length) {
            setActiveTabIndex(newKeepIndex);
            setActiveFile(newTabs[newKeepIndex]);
            setEditorContent(keepContent); // Usar contenido sincronizado
            setHasChanges(newTabs[newKeepIndex].hasChanges || false);
          } else if (newTabs.length > 0) {
            // Fallback: activar primera tab disponible
            setActiveTabIndex(0);
            setActiveFile(newTabs[0]);
            setEditorContent(newTabs[0].content);
            setHasChanges(newTabs[0].hasChanges || false);
          } else {
            // No hay tabs, ir a inicio
            setActiveTabIndex(-1);
            setActiveFile(null);
            setEditorContent('<p><br></p>');
            setHasChanges(false);
          }
        } else if (newTabs.length > 0) {
          // Si no hay keepFile pero hay tabs, activar la primera
          setActiveTabIndex(0);
          setActiveFile(newTabs[0]);
          setEditorContent(newTabs[0].content);
          setHasChanges(newTabs[0].hasChanges || false);
        } else {
          // No hay tabs, ir a inicio
          setActiveTabIndex(-1);
          setActiveFile(null);
          setEditorContent('<p><br></p>');
          setHasChanges(false);
        }

        return; // Salir temprano
      }
    }

    // Si no hay closeFile, solo mantener el keepFile activo
    if (keepFile) {
      const keepTabIndex = updatedTabs.findIndex(t => t.fullPath === keepFile.fullPath);

      if (keepTabIndex !== -1) {
        setActiveTabIndex(keepTabIndex);
        setActiveFile(updatedTabs[keepTabIndex]);
        setEditorContent(keepContent); // Usar contenido sincronizado
        setHasChanges(updatedTabs[keepTabIndex].hasChanges || false);
      } else if (updatedTabs.length > 0) {
        setActiveTabIndex(0);
        setActiveFile(updatedTabs[0]);
        setEditorContent(updatedTabs[0].content);
        setHasChanges(updatedTabs[0].hasChanges || false);
      } else {
        setActiveTabIndex(-1);
        setActiveFile(null);
        setEditorContent('<p><br></p>');
        setHasChanges(false);
      }
    } else if (updatedTabs.length > 0) {
      setActiveTabIndex(0);
      setActiveFile(updatedTabs[0]);
      setEditorContent(updatedTabs[0].content);
      setHasChanges(updatedTabs[0].hasChanges || false);
    } else {
      setActiveTabIndex(-1);
      setActiveFile(null);
      setEditorContent('<p><br></p>');
      setHasChanges(false);
    }
  };

  /**
   * Restaura el último split view cerrado (si existe y no han pasado más de 30 segundos)
   */
  const handleRestoreSplit = async () => {
    // Preferir restaurar desde splitViewState persistido (agrupación activa pero oculta)
    let leftId = splitViewState?.leftTabId;
    let rightId = splitViewState?.rightTabId;
    let mode = splitViewState?.mode || 'horizontal';
    let activeSide = splitViewState?.activeSide || 'left';

    // Fallback: usar lastClosedSplit si existe
    if ((!leftId || !rightId) && lastClosedSplit) {
      leftId = lastClosedSplit.leftTabId;
      rightId = lastClosedSplit.rightTabId;
      mode = lastClosedSplit.mode || mode;
      activeSide = lastClosedSplit.activeSide || activeSide;
    }

    if (!leftId || !rightId) {
      notify(t('notifications.noSplitToRestore'), 'info');
      return;
    }

    // Buscar las tabs por ID
    const leftTab = openTabs.find(t => t.fullPath === leftId);
    const rightTab = openTabs.find(t => t.fullPath === rightId);

    if (!leftTab || !rightTab) {
      notify(t('notifications.tabsNoLongerExist'), 'warning');
      return;
    }

    // Restaurar split view
    console.log('[SPLIT-VIEW] Restaurando último split cerrado');
    setSplitMode(mode);
    setLeftPanelFile(leftTab);
    setRightPanelFile(rightTab);
    setLeftPanelContent(leftTab.content);
    setRightPanelContent(rightTab.content);
    setActivePanelSide(activeSide);
    setSidebarCollapsed(true);

    // Actualizar splitViewState
    setSplitViewState({
      isActive: true,
      leftTabId: leftId,
      rightTabId: rightId,
      mode,
      activeSide
    });

    // No limpiar splitViewState agrupado; mantenerlo para persistencia visual
    // Limpiar lastClosedSplit si existía (no necesario, pero ordena)
    if (lastClosedSplit) setLastClosedSplit(null);
    if (lastClosedSplitTimerRef.current) clearTimeout(lastClosedSplitTimerRef.current);

    notify(t('notifications.splitRestored'), 'success');
  };

  /**
   * Maneja cambios en el panel izquierdo del split.
   * @param {string} content - Nuevo contenido
   */
  const handleLeftPanelChange = (content) => {
    setLeftPanelContent(content);
    setActivePanelSide('left'); // Marcar panel izquierdo como activo

    // Actualizar en tabs si está abierto
    if (leftPanelFile) {
      const tabIndex = openTabs.findIndex(t => t.fullPath === leftPanelFile.fullPath);
      if (tabIndex !== -1) {
        const newTabs = [...openTabs];
        newTabs[tabIndex] = { ...newTabs[tabIndex], content, hasChanges: true };
        setOpenTabs(newTabs);
      }
    }
  };

  /**
   * Maneja cambios en el panel derecho del split.
   * @param {string} content - Nuevo contenido
   */
  const handleRightPanelChange = (content) => {
    setRightPanelContent(content);
    setActivePanelSide('right'); // Marcar panel derecho como activo

    if (rightPanelFile) {
      const tabIndex = openTabs.findIndex(t => t.fullPath === rightPanelFile.fullPath);
      if (tabIndex !== -1) {
        const newTabs = [...openTabs];
        newTabs[tabIndex] = { ...newTabs[tabIndex], content, hasChanges: true };
        setOpenTabs(newTabs);
      }
    }
  };

  /**
   * Selecciona un archivo para el panel izquierdo.
   * @param {Object} file - Archivo seleccionado
   */
  const handleLeftFileSelect = async (file) => {
    // Validar que no sea el mismo archivo que el panel derecho
    if (!validateSplitFiles(file, rightPanelFile)) {
      return;
    }

    let content = '<p><br></p>';
    if (file.isSubFile) {
      content = file.content || '<p><br></p>';
    } else {
      content = await window.electronAPI.readFile(file.fullPath);
    }

    // Asegurar que el archivo exista como tab antes de usarlo en split
    let tabs = openTabs;
    let leftIndex = tabs.findIndex(t => t.fullPath === file.fullPath);

    if (leftIndex === -1) {
      const newTab = {
        ...file,
        content,
        hasChanges: false
      };
      tabs = [...tabs, newTab];
      setOpenTabs(tabs);
      leftIndex = tabs.length - 1;
    }

    const leftTab = tabs[leftIndex];

    setLeftPanelFile(leftTab);
    setLeftPanelContent(leftTab.content);
  };

  /**
   * Selecciona un archivo para el panel derecho.
   * @param {Object} file - Archivo seleccionado
   */
  const handleRightFileSelect = async (file) => {
    // Validar que no sea el mismo archivo que el panel izquierdo
    if (!validateSplitFiles(leftPanelFile, file)) {
      return;
    }

    let content = '<p><br></p>';
    if (file.isSubFile) {
      content = file.content || '<p><br></p>';
    } else {
      content = await window.electronAPI.readFile(file.fullPath);
    }

    // Asegurar que el archivo exista como tab antes de usarlo en split
    let tabs = openTabs;
    let rightIndex = tabs.findIndex(t => t.fullPath === file.fullPath);

    if (rightIndex === -1) {
      const newTab = {
        ...file,
        content,
        hasChanges: false
      };
      tabs = [...tabs, newTab];
      setOpenTabs(tabs);
      rightIndex = tabs.length - 1;
    }

    const rightTab = tabs[rightIndex];

    setRightPanelFile(rightTab);
    setRightPanelContent(rightTab.content);

    if (leftPanelFile) {
      // Actualizar splitViewState cuando ambos paneles están activos - USAR IDs
      console.log('[SPLIT-VIEW] Activando split view state con IDs:', {
        leftTabId: leftPanelFile.fullPath,
        rightTabId: rightTab.fullPath,
        mode: splitMode
      });

      setSplitViewState({
        isActive: true,
        leftTabId: leftPanelFile.fullPath,
        rightTabId: rightTab.fullPath,
        mode: splitMode,
        activeSide: activePanelSide
      });
    }
  };
  /**
   * Agrega un comentario en modo split.
   */
  const handleAddCommentInSplit = (file, text) => {
    const newComment = {
      id: generateUUID(),
      text: text,
      timestamp: Date.now(),
      author: userName || 'Anónimo',
      fileId: file.fullPath
    };

    // Actualizar el archivo correspondiente
    if (leftPanelFile && leftPanelFile.fullPath === file.fullPath) {
      const updatedFile = {
        ...leftPanelFile,
        comments: [...(leftPanelFile.comments || []), newComment]
      };
      setLeftPanelFile(updatedFile);
    }

    if (rightPanelFile && rightPanelFile.fullPath === file.fullPath) {
      const updatedFile = {
        ...rightPanelFile,
        comments: [...(rightPanelFile.comments || []), newComment]
      };
      setRightPanelFile(updatedFile);
    }

    // Actualizar en tabs
    const tabIndex = openTabs.findIndex(t => t.fullPath === file.fullPath);
    if (tabIndex !== -1) {
      const newTabs = [...openTabs];
      newTabs[tabIndex] = {
        ...newTabs[tabIndex],
        comments: [...(newTabs[tabIndex].comments || []), newComment]
      };
      setOpenTabs(newTabs);
    }

    notify(t('notifications.commentAdded'), 'success');
  };

  /**
   * Elimina un comentario en modo split.
   */
  const handleDeleteCommentInSplit = (file, commentId) => {
    // Actualizar el archivo correspondiente
    if (leftPanelFile && leftPanelFile.fullPath === file.fullPath) {
      const updatedFile = {
        ...leftPanelFile,
        comments: (leftPanelFile.comments || []).filter(c => c.id !== commentId)
      };
      setLeftPanelFile(updatedFile);
    }

    if (rightPanelFile && rightPanelFile.fullPath === file.fullPath) {
      const updatedFile = {
        ...rightPanelFile,
        comments: (rightPanelFile.comments || []).filter(c => c.id !== commentId)
      };
      setRightPanelFile(updatedFile);
    }

    // Actualizar en tabs
    const tabIndex = openTabs.findIndex(t => t.fullPath === file.fullPath);
    if (tabIndex !== -1) {
      const newTabs = [...openTabs];
      newTabs[tabIndex] = {
        ...newTabs[tabIndex],
        comments: (newTabs[tabIndex].comments || []).filter(c => c.id !== commentId)
      };
      setOpenTabs(newTabs);
    }

    notify(t('notifications.commentDeleted'), 'success');
  };
  /**
   * Maneja el click en un panel del split para marcarlo como activo.
   */
  const handlePanelClick = (side) => {
    setActivePanelSide(side);
    // Si el usuario cambia de panel, cerrar el panel derecho si es necesario o sincronizarlo
    // Para evitar duplicados, el activeRightPanel es global

    // Persistir activeSide en splitViewState
    if (splitViewState.isActive) {
      setSplitViewState(prev => ({
        ...prev,
        activeSide: side
      }));
    }
  };

  /**
   * Elimina un archivo o carpeta.
   * @param {string} itemPath - Ruta del elemento a eliminar
   * @param {boolean} isDirectory - true si es carpeta, false si es archivo
   */
  const handleDeleteItem = async (itemPath, isDirectory) => {
    if (!workspacePath) return;

    try {
      // Confirmar eliminación
      const itemType = isDirectory ? 'Sección' : 'Archivo';
      showConfirm(
        t('modals.confirm.title'),
        `${t('projectViewer.confirmDelete', { name: itemPath.split(/[\\/]/).pop() })}`,
        () => {
          window.electronAPI.deleteItem(itemPath, isDirectory)
            .then(() => {
              loadWorkspace(workspacePath);
              notify(t('notifications.itemDeleted'), 'success');
              if (activeFile && activeFile.fullPath === itemPath) {
                handleCloseFile();
              }
            })
            .catch(error => {
              console.error('Error deleting item:', error);
              notify(t('errors.deleteFailed'), 'error');
            });
        },
        'fa-exclamation-triangle'
      );
    } catch (error) {
      console.error('Error deleting item:', error);
      notify(t('notifications.deleteErrorWithMessage', { message: error.message }), 'error');
    }
  };



  // =============================================================================
  // FUNCIONES: EDITOR
  // =============================================================================



  /**
   * Maneja cambios en el editor.
   * @param {string} content - Nuevo contenido
   */
  const handleEditorChange = useCallback((content) => {
    // CRÍTICO: Asegurar que content sea un string
    if (typeof content === 'object' && content !== null) {
      console.warn('[EDITOR-CHANGE] Recibido objeto en lugar de string, serializando...', content);
      try {
        content = JSON.stringify(content);
      } catch (e) {
        console.error('[EDITOR-CHANGE] Error serializando objeto:', e);
        content = String(content);
      }
    }

    // Evitar actualizaciones excesivas con throttling más agresivo para archivos grandes
    if (editorChangeTimeoutRef.current) {
      clearTimeout(editorChangeTimeoutRef.current);
    }

    const contentLength = (typeof content === 'string') ? content.length : 0;
    const isLargeContent = contentLength > 50000;
    const throttleDelay = isLargeContent ? 200 : 50; // Más delay para archivos grandes

    editorChangeTimeoutRef.current = setTimeout(() => {
      setEditorContent(content);
      setHasChanges(true);

      const isCanvas = activeFile && activeFile.fullPath && activeFile.fullPath.toLowerCase().endsWith('.canvas');

      // Para archivos .canvas, también actualizar activeFile.content
      if (isCanvas) {
        console.log('[EDITOR-CHANGE] Actualizando contenido de archivo .canvas');
        setActiveFile(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            content: content
          };
        });
      }

      // Actualizar stats de forma diferida para archivos grandes
      if (isLargeContent) {
        if (window.requestIdleCallback) {
          window.requestIdleCallback(() => updateStats(content));
        } else {
          setTimeout(() => updateStats(content), 100);
        }
      } else {
        updateStats(content);
      }

      // Actualizar tab activo con hasChanges
      if (activeTabIndex >= 0 && activeTabIndex < openTabs.length) {
        setOpenTabs(prevTabs => {
          const newTabs = [...prevTabs];
          if (newTabs[activeTabIndex]) {
            newTabs[activeTabIndex] = { ...newTabs[activeTabIndex], content, hasChanges: true };
          }
          return newTabs;
        });
      }

      // Actualizar progreso en tiempo real solo si hay cambios significativos
      if (activeFile) {
        const plainText = (typeof content === 'string') ? content.replace(/<[^>]*>/g, '') : '';
        const newCharCount = plainText.length;
        const currentCharCount = activeFile.lastCharCount || 0;

        // Solo actualizar si hay más de 10 caracteres de diferencia
        if (Math.abs(newCharCount - currentCharCount) > 10) {
          setActiveFile(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              lastCharCount: newCharCount
            };
          });
        }

        // Guardar draft de seguridad con throttling (cada 5 segundos)
        if (safetyDraftTimeoutRef.current) {
          clearTimeout(safetyDraftTimeoutRef.current);
        }

        safetyDraftTimeoutRef.current = setTimeout(() => {
          saveSafetyDraft(activeFile.fullPath, content, {
            name: activeFile.name,
            status: activeFile.status,
            goal: activeFile.goal,
            lastCharCount: newCharCount
          });
        }, 5000);
      }

      // NOTA: El auto-guardado lo maneja useAutoSave hook
      // No duplicar la lógica aquí
    }, throttleDelay);
  }, [activeFile, activeTabIndex, openTabs.length, updateStats, saveSafetyDraft]);

  /**
   * Efecto: Registrar callbacks para atajos del sistema centralizado
   * (Colocado aquí para garantizar que todos los handlers referenciados
   *  ya estén definidos y evitar errores de inicialización temprana)
   */
  useEffect(() => {
    const unsubscribers = [
      registerShortcutCallback('save', () => handleSaveFile()),
      registerShortcutCallback('newFile', () =>
        showInput(t('projectViewer.newFile'), t('modals.input.placeholder'), (name) => {
          if (activeProjectIndex !== null) {
            handleCreateFile(activeProjectIndex, name);
          } else {
            notify(t('notifications.selectProjectFirst'), 'warning');
          }
        })
      ),
      registerShortcutCallback('newProject', () =>
        showInput(t('projectViewer.newFolder'), t('modals.input.placeholder'), handleCreateProject)
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
      }),

      // Format shortcuts - Manejados por LexicalEditor
      // heading1, heading2, heading3, strikethrough ya están en LexicalEditor

      // Search shortcuts - Manejados por LexicalEditor
      // find y findAndReplace ya están en LexicalEditor

      // Window shortcuts
      registerShortcutCallback('minimizeWindow', () => {
        if (window.electronAPI?.minimizeWindow) {
          window.electronAPI.minimizeWindow().catch(err =>
            console.error('Error minimizing window:', err)
          );
        }
      }),
      registerShortcutCallback('maximizeWindow', () => {
        if (window.electronAPI?.maximizeWindow) {
          window.electronAPI.maximizeWindow().catch(err =>
            console.error('Error maximizing window:', err)
          );
        }
      }),
      registerShortcutCallback('closeWindow', () => {
        if (window.electronAPI?.closeWindow) {
          window.electronAPI.closeWindow().catch(err =>
            console.error('Error closing window:', err)
          );
        }
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub?.());
    };
  }, [
    activeProjectIndex,
    projects,
    activeFile,
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
  const handleUpgradeStatus = async () => {
    if (!activeFile || !config || !config.states || config.states.length === 0) return;

    const currentIndex = config.states.findIndex(s => s.id === activeFile.status);
    let newState;

    // Si estamos en el final, volver al inicio (loop)
    if (currentIndex >= config.states.length - 1) {
      newState = config.states[0]; // Volver al inicio
    } else {
      // Si no estamos en el final, subir de estado
      const newIndex = currentIndex + 1;
      newState = config.states[newIndex];
    }

    if (!newState) return;

    console.log('[STATUS] Cambiando estado de', activeFile.status, 'a', newState.id);

    // Actualizar estado localmente
    const updatedFile = {
      ...activeFile,
      status: newState.id,
      goal: newState.goal || activeFile.goal
    };

    setActiveFile(updatedFile);
    setHasChanges(true);

    // Actualizar en tabs si está abierto
    if (activeTabIndex >= 0 && openTabs.length > 0) {
      const newTabs = [...openTabs];
      newTabs[activeTabIndex] = { ...newTabs[activeTabIndex], status: newState.id, goal: newState.goal || activeFile.goal };
      setOpenTabs(newTabs);
    }

    notify(`Estado actualizado a: ${newState.name}`, 'success');
  };

  /**
   * Abre el corrector ortográfico.
   */
  const handleSpellCheck = () => {
    if (stats.chars === 0) {
      notify(t('notifications.noTextToCheck'), 'error');
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
      notify(t('notifications.dataExported'), 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      notify(t('notifications.dataExportError'), 'error');
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
          // Asegurar que userName esté en config
          const configToSave = {
            ...data.config,
            userName: data.userName || data.config.userName || 'Escritor'
          };
          await window.electronAPI.saveConfig(configToSave);
          setConfig(configToSave);
        }
        if (data.userName) {
          setUserName(data.userName);
        }
        if (data.avatar) {
          setAvatar(data.avatar);
          await window.electronAPI.saveAvatar(data.avatar);
        }
        notify(t('notifications.dataImported'), 'success');
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (error) {
      console.error('Error importing data:', error);
      notify(t('notifications.dataImportError'), 'error');
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
      notify(t('notifications.cannotMoveIntoItself'), 'error');
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
      notify(t('notifications.fileMoved'), 'success');
    } catch (error) {
      console.error('Error moving file:', error);
      notify(t('notifications.fileMoveErrorWithMessage', { message: error.message }), 'error');
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
   * Abre el sidebar de comentarios para el archivo activo.
   */
  const openFileComments = () => {
    // Esta función ahora es manejada internamente por LexicalEditor
    // Pero la mantenemos por compatibilidad con otros componentes si fuera necesario
  };

  /**
   * Obtiene todos los comentarios del archivo activo.
   * @returns {Array} Lista de comentarios del archivo
   */
  const getFileComments = () => {
    if (!activeFile || !activeFile.comments) return [];
    // Retornar todos los comentarios del archivo
    return activeFile.comments;
  };

  // =============================================================================
  // FUNCIONES: ATAJOS DE TECLADO ADICIONALES
  // =============================================================================

  // NOTA: Los atajos de teclado ahora se manejan completamente con registerShortcutCallback
  // No es necesario un listener manual adicional

  // Zoom con Ctrl+/Ctrl-/Ctrl+0
  useEffect(() => {
    if (!window.electronAPI?.setZoomLevel || !window.electronAPI?.getZoomLevel) return;

    const handleZoom = async (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        const current = await window.electronAPI.getZoomLevel();
        window.electronAPI.setZoomLevel(Math.min(current + 0.5, 5));
      } else if (e.key === '-') {
        e.preventDefault();
        const current = await window.electronAPI.getZoomLevel();
        window.electronAPI.setZoomLevel(Math.max(current - 0.5, -5));
      } else if (e.key === '0') {
        e.preventDefault();
        window.electronAPI.setZoomLevel(0);
      }
    };

    window.addEventListener('keydown', handleZoom);
    return () => window.removeEventListener('keydown', handleZoom);
  }, []);

  // =============================================================================
  // FUNCIONES: ONBOARDING
  // =============================================================================

  /**
   * Maneja la finalización del onboarding.
   * @param {Object} data - Datos del usuario (nombre, avatar, workspacePath)
   */
  const handleOnboardingComplete = async (data) => {
    console.log('[ONBOARDING] Completando onboarding con datos:', {
      userName: data.userName,
      hasAvatar: !!data.avatar,
      workspacePath: data.workspacePath,
      language: data.language
    });

    setUserName(data.userName);
    setAvatar(data.avatar);
    setWorkspacePath(data.workspacePath);

    // Guardar workspace path
    if (data.workspacePath) {
      console.log('[ONBOARDING] Guardando workspace path:', data.workspacePath);
      await window.electronAPI.setWorkspacePath(data.workspacePath);
    }

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
    if (data.workspacePath) {
      await loadWorkspace(data.workspacePath);
    }

    // Ocultar onboarding
    setShowOnboarding(false);
    console.log('[ONBOARDING] Onboarding completado exitosamente');
    notify(t('notifications.welcomeToBloopy'), 'success');
  };

  // =============================================================================
  // RENDERIZADO: PANTALLA DE CARGA
  // =============================================================================

  /**
   * Handlers para el nuevo TitleBar
   */
  const handleUndo = useCallback(() => {
    if (editorRef.current && editorRef.current.handleUndo) {
      editorRef.current.handleUndo();
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (editorRef.current && editorRef.current.handleRedo) {
      editorRef.current.handleRedo();
    }
  }, []);

  const handleEditAction = useCallback((action) => {
    if (editorRef.current && editorRef.current.handleEditAction) {
      editorRef.current.handleEditAction(action);
    }
  }, []);

  const handleDevTools = () => {
    if (window.electronAPI && window.electronAPI.openDevTools) {
      window.electronAPI.openDevTools();
    }
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleRequestRenameCurrentFile = () => {
    if (!activeFile) return;
    
    // Detectar si es archivo .canvas o .txt
    const isCanvas = activeFile.fullPath && activeFile.fullPath.toLowerCase().endsWith('.canvas');
    const displayName = activeFile.name.replace(/\.(txt|canvas)$/i, '');
    
    showInput(t('sidebar.rename'), displayName, async (newName) => {
      if (newName && newName !== displayName) {
        try {
          // Agregar extensión correcta según tipo de archivo
          const finalName = isCanvas 
            ? (newName.endsWith('.canvas') ? newName : newName + '.canvas')
            : (newName.endsWith('.txt') ? newName : newName + '.txt');
          await window.electronAPI.renameFile(activeFile.fullPath, finalName);
          notify(t('notifications.fileRenamed'), 'success');
          // El refresco se maneja por loadWorkspace
          await loadWorkspace(workspacePath);
        } catch (error) {
          notify(t('notifications.fileRenameError'), 'error');
        }
      }
    });
  };

  /**
   * Maneja el renombrado de archivo desde el metadata del editor
   * @param {string} newName - Nuevo nombre del archivo (sin extensión)
   */
  const handleRenameFromMetadata = useCallback(async (newName) => {
    if (!activeFile || !newName || newName.trim() === '') return false;

    // Detectar si es archivo .canvas o .txt
    const isCanvas = activeFile.fullPath && activeFile.fullPath.toLowerCase().endsWith('.canvas');
    const displayName = activeFile.name.replace(/\.(txt|canvas)$/i, '');

    // Si el nombre no cambió, no hacer nada
    if (newName === displayName) {
      return true;
    }

    // Validar caracteres inválidos
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(newName)) {
      notify(t('notifications.invalidCharacters'), 'error');
      return false;
    }

    // Agregar extensión correcta según tipo de archivo
    const finalName = isCanvas 
      ? (newName.endsWith('.canvas') ? newName : newName + '.canvas')
      : (newName.endsWith('.txt') ? newName : newName + '.txt');
    const oldPath = activeFile.fullPath;

    try {
      // 1. Llamar al IPC para renombrar el archivo
      const result = await window.electronAPI.renameFile(oldPath, finalName);
      
      // El IPC puede devolver la nueva ruta o un objeto con la nueva ruta
      const newPath = typeof result === 'string' ? result : result?.newPath || oldPath.replace(/[^/\\]+$/, finalName);

      // 2. Actualizar el estado global de projects
      setProjects(prevProjects => {
        // Función recursiva para actualizar el archivo en el árbol
        const updateFileInTree = (items) => {
          return items.map(item => {
            if (item.fullPath === oldPath) {
              // Encontramos el archivo, actualizarlo
              return { ...item, name: finalName, fullPath: newPath };
            }
            if (item.items && item.items.length > 0) {
              // Buscar recursivamente en sub-items
              return { ...item, items: updateFileInTree(item.items) };
            }
            return item;
          });
        };

        return updateFileInTree(prevProjects);
      });

      // 3. Actualizar el estado activeFile con el nuevo nombre y ruta
      setActiveFile(prev => ({
        ...prev,
        name: finalName,
        fullPath: newPath
      }));

      // 4. Actualizar el título de la ventana
      document.title = `${newName} - Bloopy`;

      // Actualizar tabs abiertas si el archivo está en tabs
      setOpenTabs(prevTabs => {
        return prevTabs.map(tab => {
          if (tab.fullPath === oldPath) {
            return { ...tab, name: finalName, fullPath: newPath };
          }
          return tab;
        });
      });

      // Actualizar splitViewState si el archivo está en split view
      setSplitViewState(prev => {
        if (!prev.isActive) return prev;

        const newState = { ...prev };
        if (prev.leftTabId === oldPath) {
          newState.leftTabId = newPath;
        }
        if (prev.rightTabId === oldPath) {
          newState.rightTabId = newPath;
        }
        return newState;
      });

      // Actualizar paneles de split si están activos
      if (splitMode !== 'none') {
        if (leftPanelFile && leftPanelFile.fullPath === oldPath) {
          setLeftPanelFile(prev => ({ ...prev, name: finalName, fullPath: newPath }));
        }
        if (rightPanelFile && rightPanelFile.fullPath === oldPath) {
          setRightPanelFile(prev => ({ ...prev, name: finalName, fullPath: newPath }));
        }
      }

      notify(t('notifications.fileRenamed'), 'success');
      return true;
    } catch (error) {
      console.error('Error renaming file:', error);
      notify(t('notifications.fileRenameErrorWithMessage', { message: error.message }), 'error');
      
      // 5. Manejo de errores: revertir el nombre
      // El estado no se actualizó porque el try-catch capturó el error antes
      // No es necesario revertir explícitamente ya que nunca se actualizó
      return false;
    }
  }, [activeFile, notify, splitMode, leftPanelFile, rightPanelFile]);

  /**
   * Maneja la asignación de un icono personalizado a un archivo
   * @param {string} fullPath - Ruta completa del archivo
   * @param {string} iconId - ID del icono a asignar
   */
  const handleSetFileIcon = useCallback(async (fullPath, iconId) => {
    if (!fullPath || !iconId) {
      console.error('[ICON] fullPath e iconId son requeridos');
      return false;
    }

    try {
      console.log('[ICON] Asignando icono:', { fullPath, iconId });

      // Actualizar el estado de fileIcons
      setFileIcons((prevIcons) => {
        const newMap = new Map(prevIcons);
        newMap.set(fullPath, iconId);
        return newMap;
      });

      // Obtener el contenido actual del archivo (string).
      // readFile devuelve solo el contenido; la metadata se fusiona en el handler 'save-file'.
      const content = await window.electronAPI.readFile(fullPath);

      const updatedMetadata = {
        customIcon: iconId,
        lastUpdated: Date.now()
      };

      // Guardar el archivo con la metadata actualizada
      await saveFileWithHierarchyCheck(fullPath, content, updatedMetadata);

      console.log('[ICON] Icono guardado exitosamente');

      // Actualizar activeFile si es el archivo actual
      if (activeFile && activeFile.fullPath === fullPath) {
        setActiveFile((prev) => ({
          ...prev,
          customIcon: iconId
        }));
      }

      // Actualizar tabs si el archivo está abierto
      setOpenTabs((prevTabs) => {
        return prevTabs.map((tab) => {
          if (tab.fullPath === fullPath) {
            return { ...tab, customIcon: iconId };
          }
          return tab;
        });
      });

      // Actualizar archivos en split view si corresponde
      if (leftPanelFile && leftPanelFile.fullPath === fullPath) {
        setLeftPanelFile((prev) => ({ ...prev, customIcon: iconId }));
      }
      if (rightPanelFile && rightPanelFile.fullPath === fullPath) {
        setRightPanelFile((prev) => ({ ...prev, customIcon: iconId }));
      }

      // Recargar workspace para actualizar la UI en todos los componentes
      await loadWorkspace(workspacePath);

      notify(t('notifications.iconUpdated'), 'success');
      return true;
    } catch (error) {
      console.error('[ICON] Error al guardar icono:', error);
      notify(t('notifications.iconUpdateErrorWithMessage', { message: error.message }), 'error');

      // Revertir el cambio en el estado si falló
      setFileIcons((prevIcons) => {
        const newMap = new Map(prevIcons);
        newMap.delete(fullPath);
        return newMap;
      });

      return false;
    }
  }, [activeFile, workspacePath, leftPanelFile, rightPanelFile, notify, loadWorkspace]);

  /**
   * Agrega un comentario al archivo activo.
   */
  const handleAddComment = useCallback((text) => {
    if (!activeFile) return;

    const newComment = {
      id: generateUUID(),
      text,
      timestamp: Date.now(),
      author: userName || 'Anónimo',
      fileId: activeFile.fullPath
    };

    const updatedFile = {
      ...activeFile,
      comments: [...(activeFile.comments || []), newComment]
    };

    setActiveFile(updatedFile);
    setHasChanges(true);

    // Actualizar en tabs
    if (activeTabIndex >= 0 && openTabs.length > 0) {
      const newTabs = [...openTabs];
      newTabs[activeTabIndex] = {
        ...newTabs[activeTabIndex],
        comments: [...(newTabs[activeTabIndex].comments || []), newComment]
      };
      setOpenTabs(newTabs);
    }

    notify(t('notifications.commentAdded'), 'success');
  }, [activeFile, userName, activeTabIndex, openTabs, notify, t]);

  /**
   * Elimina un comentario del archivo activo.
   */
  const handleDeleteComment = useCallback((commentId) => {
    if (!activeFile) return;

    const updatedFile = {
      ...activeFile,
      comments: (activeFile.comments || []).filter(c => c.id !== commentId)
    };

    setActiveFile(updatedFile);
    setHasChanges(true);

    // Actualizar en tabs
    if (activeTabIndex >= 0 && openTabs.length > 0) {
      const newTabs = [...openTabs];
      newTabs[activeTabIndex] = {
        ...newTabs[activeTabIndex],
        comments: (newTabs[activeTabIndex].comments || []).filter(c => c.id !== commentId)
      };
      setOpenTabs(newTabs);
    }

    notify(t('notifications.commentDeleted'), 'success');
  }, [activeFile, activeTabIndex, openTabs, notify, t]);

  // =============================================================================
  // RENDERIZADO PRINCIPAL
  // =============================================================================

  return (
    <div className="app-root" data-theme={config?.theme || 'dark'}>
      <SplashScreen visible={showSplash} phase={splashPhase} onImageReady={() => {
        splashImageReadyRef.current = true;
        tryHideSplash();
      }} />
      {showOnboarding && <Suspense fallback={null}><OnboardingModal onComplete={handleOnboardingComplete} /></Suspense>}

      {!showSplash && !showOnboarding && (
        <>
          {/* Title Bar - Barra de título personalizada */}
          <TitleBar
            workspacePath={workspacePath}
            recentWorkspaces={recentWorkspaces}
            projects={projects}
            activeFile={activeFile}
            activeProjectIndex={activeProjectIndex}
            onSelectWorkspace={handleSelectWorkspace}
            onCreateWorkspace={handleCreateWorkspace}
            onCreateFile={handleCreateFile}
            onCreateProject={handleCreateProject}
            onCreateSubFile={handleRequestCreateSubFile}
            onRenameFile={handleRequestRenameCurrentFile}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onEditAction={handleEditAction}
            onDevTools={handleDevTools}
            onOpenSettings={handleOpenSettings}
            onCheckUpdates={() => setIsUpdateModalOpen(true)}
            showInput={showInput}
            notify={notify}
            onOpenWorkspace={(path) => {
              setWorkspacePath(path);
              localStorage.setItem('bg.workspace', path);
              window.electronAPI.setWorkspacePath(path);

              // Actualizar lista de recientes
              const newRecents = [path, ...recentWorkspaces.filter(w => w !== path)].slice(0, 5);
              setRecentWorkspaces(newRecents);
              localStorage.setItem('bg.recentWorkspaces', JSON.stringify(newRecents));

              loadWorkspace(path);
            }}
          />

          <div className="app-container">
            {/* Sidebar (solo si hay workspace) */}
            {workspacePath && (
              <Sidebar
                projects={projects}
                allFiles={allFiles}
                activeFile={activeFile}
                activeProjectIndex={activeProjectIndex}
                viewingProject={viewingProject}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => {
                  setSidebarCollapsed(!sidebarCollapsed);
                }}
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
                splitMode={splitMode}
                onCloseSplit={handleCloseSplit}
                onSplitHorizontal={handleSplitHorizontal}
                fileIcons={fileIcons}
              />
            )}

          {/* Contenido principal */}
          <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Barra superior con tabs integrados */}
            <TopBar
              activeFile={activeFile}
              activeFooterFile={activeFooterFile}
              activeProjectIndex={activeProjectIndex}
              projects={projects}
              onCloseFile={handleCloseFile}
              onSaveFile={handleSaveFile}
              onSpellCheck={handleSpellCheck}
              onToggleSidebar={() => {
                setSidebarCollapsed(!sidebarCollapsed);
              }}
              sidebarCollapsed={sidebarCollapsed}
              hasChanges={hasChanges}
              isSaving={isSaving}
              onViewProject={(project) => setViewingProject(project)}
              openTabs={openTabs}
              activeTabIndex={activeTabIndex}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
              onTabReorder={handleTabReorder}
              onSplitHorizontal={handleSplitHorizontal}
              splitMode={splitMode}
              leftPanelFile={leftPanelFile}
              rightPanelFile={rightPanelFile}
              onCloseSplit={handleCloseSplit}
              onDisableSplit={handleDisableSplit}
              onRestoreSplit={handleRestoreSplit}
              lastClosedSplit={lastClosedSplit}
              splitViewState={splitViewState}
              fileIcons={fileIcons}
            />

            {/* Área del editor / split */}
            <div className={`main-container ${splitMode !== 'none' ? 'split-active' : ''}`}>
              {/* ProjectViewer como overlay absoluto - no afecta el layout del editor */}
              {viewingProject && (
                <div className="project-viewer-overlay">
                  <Suspense fallback={null}>
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
                    fileIcons={fileIcons}
                  />
                  </Suspense>
                </div>
              )}

              {splitMode !== 'none' ? (
                <SplitEditor
                  splitMode={splitMode}
                  leftFile={leftPanelFile}
                  rightFile={rightPanelFile}
                  leftContent={leftPanelContent}
                  rightContent={rightPanelContent}
                  onLeftChange={handleLeftPanelChange}
                  onRightChange={handleRightPanelChange}
                  onLeftFileSelect={handleLeftFileSelect}
                  onRightFileSelect={handleRightFileSelect}
                  onCreateSubFile={handleRequestCreateSubFile}
                  onOpenSubFile={(subFile) => handleOpenFile(activeProjectIndex, subFile)}
                  onAddComment={handleAddCommentInSplit}
                  onDeleteComment={handleDeleteCommentInSplit}
                  onSetFileIcon={handleSetFileIcon}
                  onSpellCheck={() => setIsSpellCheckOpen(true)}
                  projects={projects}
                  activeProjectIndex={activeProjectIndex}
                  config={config}
                  editorRefLeft={editorRefLeft}
                  editorRefRight={editorRefRight}
                  activePanelSide={activePanelSide}
                  onPanelClick={handlePanelClick}
                  fileIcons={fileIcons}
                  onNotify={notify}
                  activeRightPanel={activeRightPanel}
                  setActiveRightPanel={setActiveRightPanel}
                />
              ) : activeFile ? (
                <>
                  {activeFile.fullPath && activeFile.fullPath.toLowerCase().endsWith('.canvas') ? (
                    <Suspense fallback={null}>
                      <CanvasNote
                        file={activeFile}
                        onContentChange={handleEditorChange}
                        onSave={handleSaveFile}
                        theme={config?.theme || {}}
                        language={config?.language || 'es'}
                        config={config}
                        onNotify={notify}
                        contentHashManager={contentHashManagerRef.current}
                        saveTracker={saveTrackerRef.current}
                      />
                    </Suspense>
                  ) : (
                    <Editor
                      ref={editorRef}
                      content={editorContent}
                      onChange={handleEditorChange}
                      activeFile={activeFile}
                      onOpenComments={() => setActiveRightPanel('comments')}
                      onAddComment={handleAddComment}
                      onDeleteComment={handleDeleteComment}
                      onCreateSubFile={handleRequestCreateSubFile}
                      onOpenSubFile={(subFile) => handleOpenFile(activeProjectIndex, subFile)}
                      onRenameFile={handleRenameFromMetadata}
                      onSetFileIcon={handleSetFileIcon}
                      onSpellCheck={() => setIsSpellCheckOpen(true)}
                      onToggleSpecialChars={() => setActiveRightPanel(prev => prev === 'specialChars' ? null : 'specialChars')}
                      activeRightPanel={activeRightPanel}
                      setActiveRightPanel={setActiveRightPanel}
                      config={config}
                      isSplitView={false}
                    />
                  )}
                </>
              ) : (
                <WelcomeScreen
                  workspacePath={workspacePath}
                  projects={projects}
                  userName={userName}
                  onCreateWorkspace={handleCreateWorkspace}
                  onSelectWorkspace={handleSelectWorkspace}
                  onOpenFile={handleOpenFile}
                  onCreateProject={handleCreateProject}
                  hasWorkspace={!!workspacePath}
                />
              )}
            </div>

            {/* Footer del editor */}
            {activeFooterFile && !activeFooterFile.fullPath?.toLowerCase().endsWith('.canvas') && (
              <div className="editor-footer">
                {/* Estadísticas */}
                <div className="stats">
                  <span><Icon path={mdiFormatParagraph} size={0.6} /> {stats.lines}</span>
                  <span><Icon path={mdiFormatSize} size={0.6} /> {stats.words}</span>
                  <span><Icon path={mdiKeyboard} size={0.6} /> {stats.chars}</span>
                  {activeFooterFile && (
                    <button className="btn-stats-analytics" onClick={() => setIsTextAnalyticsOpen(true)} title="Análisis detallado">
                      <Icon path={mdiChartBar} size={0.7} />
                    </button>
                  )}
                </div>

                {/* Controles derechos */}
                {activeFooterFile && config && (() => {
                  // Orden fijo: draft → ...custom... → review → final
                  const baseStates = config.states || [];
                  const customStates = config.customStates || [];
                  const draftState  = baseStates.find(s => s.id === 'draft');
                  const reviewState = baseStates.find(s => s.id === 'review');
                  const finalState  = baseStates.find(s => s.id === 'final');
                  const allStates = [
                    ...(draftState  ? [draftState]  : []),
                    ...customStates,
                    ...(reviewState ? [reviewState] : []),
                    ...(finalState  ? [finalState]  : []),
                  ];

                  const currentStateId = activeFooterFile.status || 'draft';
                  const currentState   = allStates.find(s => s.id === currentStateId) || allStates[0];
                  const currentIndex   = allStates.findIndex(s => s.id === currentStateId);
                  const isFinal        = currentState?.id === 'final';
                  const isCustomState  = customStates.some(s => s.id === currentStateId);

                  // Checklist del estado custom actual
                  const checklist  = isCustomState ? (currentState?.checklist || []) : [];
                  const checks     = (activeFooterFile.customChecks || {})[currentStateId] || checklist.map(() => false);
                  const doneCount  = checks.filter(Boolean).length;
                  const totalCount = checklist.length;
                  const allDone    = totalCount === 0 || doneCount === totalCount;

                  // Función para cambiar estado — siempre actualiza el archivo correcto
                  const changeState = () => {
                    if (isCustomState && !allDone) return;
                    // final → volver a draft; cualquier otro → avanzar
                    const newIndex = isFinal ? 0 : currentIndex + 1;
                    const newState = allStates[newIndex];
                    if (!newState) return;

                    // Actualizar el archivo correcto (split-aware)
                    const fileToUpdate = splitMode !== 'none'
                      ? (activePanelSide === 'left' ? leftPanelFile : rightPanelFile)
                      : activeFile;

                    const updatedFile = {
                      ...fileToUpdate,
                      status: newState.id,
                      goal: newState.goal || fileToUpdate.goal,
                      initialCharCount: stats.chars
                    };

                    if (splitMode !== 'none') {
                      if (activePanelSide === 'left') setLeftPanelFile(updatedFile);
                      else setRightPanelFile(updatedFile);
                    }
                    setActiveFile(updatedFile);
                    setHasChanges(true);

                    if (activeTabIndex >= 0 && openTabs.length > 0) {
                      const newTabs = [...openTabs];
                      newTabs[activeTabIndex] = { ...newTabs[activeTabIndex], status: newState.id, initialCharCount: stats.chars };
                      setOpenTabs(newTabs);
                    }
                    notify(`Estado: ${newState.name}`, 'success');
                  };

                  return (
                    <div className="footer-right">
                      {hasChanges && <span className="autosave-indicator" title="Cambios sin guardar"></span>}

                      {/* Badge estado */}
                      <div className="status-badge" style={{ background: currentState?.color || '#0071e3' }}>
                        {currentState?.name || 'Borrador'}
                      </div>

                      {/* Botón subir/bajar — siempre visible */}
                      <button
                        className="btn-upgrade-footer"
                        onClick={changeState}
                        disabled={isCustomState && !allDone}
                        title={isFinal ? 'Volver a Borrador' : `Avanzar a ${allStates[currentIndex + 1]?.name || ''}`}
                      >
                        <Icon path={isFinal ? mdiArrowDown : mdiArrowUp} size={0.6} />
                        {isFinal ? 'Bajar' : 'Subir'}
                      </button>

                      {/* Botón checklist — solo estados custom con checklist */}
                      {isCustomState && totalCount > 0 && (
                        <div className="checklist-dropdown-wrapper">
                          <button
                            className={`btn-checklist-footer${allDone ? ' all-done' : ''}`}
                            style={{ borderColor: currentState?.color, color: currentState?.color }}
                            onClick={() => setChecklistModalOpen(prev => !prev)}
                          >
                            Check {doneCount}/{totalCount}
                          </button>

                          {/* Dropdown hacia arriba — sin overlay */}
                          {checklistModalOpen && (
                            <div className="checklist-dropdown">
                              <div className="checklist-dropdown-header">
                                <span style={{ color: currentState.color }}>{currentState.name}</span>
                                <button className="checklist-modal-close" onClick={() => setChecklistModalOpen(false)}>
                                  <Icon path={mdiClose} size={0.6} />
                                </button>
                              </div>
                              <div className="checklist-dropdown-body">
                                {checklist.map((item, i) => (
                                  <label key={i} className="checklist-modal-item">
                                    <input
                                      type="checkbox"
                                      checked={checks[i] || false}
                                      onChange={() => {
                                        const newChecks = [...checks];
                                        newChecks[i] = !newChecks[i];
                                        const newCustomChecks = {
                                          ...(activeFooterFile.customChecks || {}),
                                          [currentStateId]: newChecks
                                        };
                                        // Actualizar archivo correcto (split-aware)
                                        const updater = prev => ({ ...prev, customChecks: newCustomChecks });
                                        if (splitMode !== 'none') {
                                          if (activePanelSide === 'left') setLeftPanelFile(updater);
                                          else setRightPanelFile(updater);
                                        }
                                        setActiveFile(updater);
                                        setHasChanges(true);
                                      }}
                                    />
                                    <span className={checks[i] ? 'done' : ''}>{item}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Meta numérica — solo estados base */}
                      {!isCustomState && (
                        <div className="footer-goal">
                          <Icon path={mdiTarget} size={0.7} />
                          <input
                            type="number"
                            value={activeFooterFile.goal || 30000}
                            onChange={(e) => {
                              if (splitMode !== 'none') return;
                              setActiveFile({ ...activeFile, goal: parseInt(e.target.value) || 30000 });
                              setHasChanges(true);
                            }}
                            className="mini-goal-input"
                          />
                          {(() => {
                            const goal       = activeFooterFile.goal || 30000;
                            const countType  = currentState?.countType || 'absolute';
                            const initial    = activeFooterFile.initialCharCount || 0;
                            const tracked    = countType === 'absolute' ? stats.chars : Math.abs(stats.chars - initial);
                            const pct        = Math.min(100, Math.round((tracked / goal) * 100));
                            return (
                              <>
                                <div className="mini-progress">
                                  <div className="mini-progress-fill" style={{ width: `${pct}%`, background: currentState?.color || '#0071e3' }}></div>
                                </div>
                                <span className="progress-text">{pct}%</span>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </main>
        </div>
      </>
      )}

      {/* Modales globales */}

        {/* Configuración */}
        {isSettingsOpen && (
          <Suspense fallback={null}>
          <SettingsModal
            config={config}
            userName={userName}
            avatar={avatar}
            onClose={() => setIsSettingsOpen(false)}
            onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
            onSave={async (newConfig, newUserName, newAvatar) => {
              // Guardar configuración incluyendo shortcuts Y userName
              const configToSave = {
                ...newConfig,
                userName: newUserName, // IMPORTANTE: Guardar userName en config
                shortcuts: newConfig.shortcuts || {}
              };

              console.log('[SETTINGS] Guardando configuración:', configToSave);

              // Validar configuración antes de guardar
              const validation = validateConfig(configToSave);
              if (!validation.valid) {
                console.warn('[SETTINGS] Advertencias de validación:', validation.errors);
                // Sanitizar para corregir problemas
                const sanitized = sanitizeConfig(configToSave);
                await window.electronAPI.saveConfig(sanitized);
                setConfig(sanitized);
              } else {
                await window.electronAPI.saveConfig(configToSave);
                setConfig(configToSave);
              }

              setUserName(newUserName);
              if (newAvatar !== avatar) {
                await window.electronAPI.saveAvatar(newAvatar);
                setAvatar(newAvatar);
              }
              applyTheme(newConfig.theme, newConfig.customColors);
              notify(t('notifications.settingsSaved'), 'success');
            }}
            onExport={handleExport}
            onImport={handleImport}
          />
          </Suspense>
        )}

        {/* Corrector ortográfico */}
        {isSpellCheckOpen && (
          <Suspense fallback={null}>
          <SpellCheckModal
            text={(activeFooterContent || '').replace(/<[^>]*>/g, '')}
            onClose={() => setIsSpellCheckOpen(false)}
            config={config}
          />
          </Suspense>
        )}

        {/* Análisis detallado de texto */}
        {isTextAnalyticsOpen && (
          <Suspense fallback={null}>
          <TextAnalyticsModal
            isOpen={isTextAnalyticsOpen}
            onClose={() => setIsTextAnalyticsOpen(false)}
            editorContent={editorContent}
          />
          </Suspense>
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

        {/* Modal de Actualización */}
        <Suspense fallback={null}>
        <UpdateModal
          isOpen={isUpdateModalOpen}
          onClose={() => setIsUpdateModalOpen(false)}
        />
        </Suspense>

        {/* Notificaciones */}
        <NotificationContainer notifications={notifications} />
      </div>
    );
}

export default App;
