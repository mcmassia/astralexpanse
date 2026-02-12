// Object view component - main content area for viewing/editing objects
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useObjectStore, useSelectedObject } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { Editor } from '../Editor';
import type { EditorRef } from '../Editor';
import { PropertiesPanel } from './PropertiesPanel';
import { ConfirmDialog, useToast, LucideIcon } from '../common';
import { EntityExtractor } from '../Editor/EntityExtractor';
import { BrainCircuit, ChevronDown, ChevronRight, X } from 'lucide-react';
import './ObjectView.css';

interface ObjectViewContentProps {
    objectId: string;
    isModal?: boolean;
    onClose?: () => void;
}

export const ObjectViewContent = ({ objectId, isModal = false, onClose }: ObjectViewContentProps) => {
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const updateObject = useObjectStore(s => s.updateObject);
    const deleteObject = useObjectStore(s => s.deleteObject);
    const createObject = useObjectStore(s => s.createObject);
    const goBack = useObjectStore(s => s.goBack);
    const goForward = useObjectStore(s => s.goForward);
    const historyIndex = useObjectStore(s => s.historyIndex);
    const navigationHistory = useObjectStore(s => s.navigationHistory);
    const { focusMode, toggleFocusMode, setHighlightSearchText, backlinksPanelOpen, toggleBacklinksPanel, openObjectModal } = useUIStore();
    const toast = useToast();

    const selectedObject = useMemo(() => objects.find(o => o.id === objectId), [objects, objectId]);

    // Reactive navigation state (only relevant for main view)
    const canGoBack = historyIndex > 0;
    const canGoForward = historyIndex < navigationHistory.length - 1;

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showEntityExtractor, setShowEntityExtractor] = useState(false);
    const editorRef = useRef<EditorRef>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const objectType = selectedObject
        ? objectTypes.find(t => t.id === selectedObject.type)
        : null;

    // Calculate backlinks reactively (includes both content mentions and property relations)
    const backlinkedObjects = useMemo(() => {
        if (!selectedObject) return [];
        return objects.filter(o => {
            // Check content mentions (existing behavior)
            if (o.links?.includes(selectedObject.id)) return true;

            // Check property relations (new: relations in properties count as backlinks)
            for (const propValue of Object.values(o.properties)) {
                if (Array.isArray(propValue) && propValue.some(v =>
                    typeof v === 'object' && v !== null && 'id' in v && v.id === selectedObject.id
                )) {
                    return true;
                }
            }
            return false;
        });
    }, [objects, selectedObject]);

    // Contextual Backlinks: State for context snippets and expanded toggles
    const [backlinkContexts, setBacklinkContexts] = useState<Record<string, string[]>>({});
    const [expandedBacklinks, setExpandedBacklinks] = useState<Set<string>>(new Set());

    // Fetch context snippets using the unified contextExtractor
    useEffect(() => {
        if (!selectedObject) {
            setBacklinkContexts({});
            return;
        }

        objects.forEach(obj => {
            if (backlinkedObjects.some(bo => bo.id === obj.id)) {
                import('../../utils/contextExtractor').then(({ extractContext }) => {
                    const snippets = extractContext(obj.content, selectedObject.id);
                    if (snippets.length > 0) {
                        setBacklinkContexts(prev => ({
                            ...prev,
                            [obj.id]: snippets
                        }));
                    }
                });
            }
        });
    }, [selectedObject, objects, backlinkedObjects]);

    // Toggle handler for "Ver contexto"
    const toggleBacklinkContext = (objectId: string) => {
        setExpandedBacklinks(prev => {
            const next = new Set(prev);
            if (next.has(objectId)) {
                next.delete(objectId);
            } else {
                next.add(objectId);
            }
            return next;
        });
    };

    const handleTitleClick = () => {
        if (selectedObject) {
            setTitleValue(selectedObject.title);
            setIsEditingTitle(true);
        }
    };

    const handleTitleBlur = async () => {
        if (selectedObject && titleValue.trim() && titleValue !== selectedObject.title) {
            await updateObject(selectedObject.id, { title: titleValue.trim() });
        }
        setIsEditingTitle(false);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleTitleBlur();
            editorRef.current?.focus();
        }
        if (e.key === 'Escape') {
            setIsEditingTitle(false);
        }
    };

    const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
    const typeSelectorRef = useRef<HTMLDivElement>(null);

    // Close type selector on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (typeSelectorRef.current && !typeSelectorRef.current.contains(event.target as Node)) {
                setIsTypeSelectorOpen(false);
            }
        };

        if (isTypeSelectorOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTypeSelectorOpen]);

    const handleContentChange = useCallback((html: string) => {
        if (!selectedObject) return;

        // Clear any pending save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounce saves to avoid too many updates
        saveTimeoutRef.current = setTimeout(() => {
            updateObject(selectedObject.id, { content: html });
        }, 1500);
    }, [selectedObject, updateObject]);

    // Handle creating new objects from @ mentions (don't auto-select to prevent editor unmount)
    const handleCreateObject = useCallback(async (type: string, title: string): Promise<{ id: string; label: string }> => {
        const newObj = await createObject(type, title, '', false);
        return { id: newObj.id, label: newObj.title };
    }, [createObject]);

    const handleDelete = () => {
        if (!selectedObject) return;
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedObject) return;
        const deletedTitle = selectedObject.title;
        setIsDeleting(true);
        try {
            await deleteObject(selectedObject.id);
            toast.success('Objeto eliminado', `"${deletedTitle}" ha sido eliminado correctamente.`);
            if (isModal && onClose) {
                onClose();
            }
        } catch (error) {
            toast.error('Error al eliminar', 'No se pudo eliminar el objeto. Inténtalo de nuevo.');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleBacklinkClick = (id: string) => {
        // In modals, clicking a backlink should open another modal? or navigate main view?
        // Let's open another modal to preserve context stack
        openObjectModal(id);
    };

    // Handle clicking on mentions, hashtags, and inline tasks within the content
    const handleMentionClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;

        const getTargetId = (selector: string, attr: string) => {
            const el = target.closest(selector);
            return el ? el.getAttribute(attr) : null;
        };

        let targetId =
            getTargetId('.hashtag-pill', 'data-hashtag-id') ||
            getTargetId('.task-inline', 'data-task-id') ||
            getTargetId('.mention', 'data-mention-id');

        // Check for Object Link Pill (New formatted links)
        const objectLinkEl = target.closest('.object-link-pill') || target.closest('a[href^="object:"]');
        if (objectLinkEl) {
            const href = objectLinkEl.getAttribute('href');
            if (href && href.startsWith('object:')) {
                targetId = href.split(':')[1];
            }
        }

        if (targetId) {
            e.preventDefault();
            e.stopPropagation();
            openObjectModal(targetId);
        }
    }, [openObjectModal]);

    if (!selectedObject) {
        return (
            <div className="object-view empty">
                <div className="empty-state">
                    <span className="empty-icon">✦</span>
                    <h2>Objeto no encontrado</h2>
                </div>
            </div>
        );
    }

    return (
        <div className={`object-view ${isModal ? 'modal-view' : ''}`} onClick={handleMentionClick}>
            <header className="object-header">
                <div className="object-header-top">
                    <div className="object-type-selector" ref={typeSelectorRef}>
                        <div
                            className="object-type-badge clickable"
                            style={{ '--type-color': objectType?.color } as React.CSSProperties}
                            onClick={() => setIsTypeSelectorOpen(!isTypeSelectorOpen)}
                            title="Cambiar tipo de objeto"
                        >
                            <span className="type-name">{objectType?.name.toUpperCase()}</span>
                            <span className="type-chevron">▼</span>
                        </div>

                        {isTypeSelectorOpen && (
                            <div className="type-dropdown">
                                <div className="type-dropdown-header">Cambiar tipo a...</div>
                                <div className="type-dropdown-list">
                                    {objectTypes.map(type => (
                                        <button
                                            key={type.id}
                                            className={`type-option ${type.id === objectType?.id ? 'active' : ''}`}
                                            onClick={() => {
                                                updateObject(selectedObject.id, { type: type.id });
                                                setIsTypeSelectorOpen(false);
                                                toast.success('Tipo actualizado', `El objeto ahora es de tipo "${type.name}"`);
                                            }}
                                        >
                                            <LucideIcon name={type.icon} size={14} color={type.color} />
                                            <span>{type.name}</span>
                                            {type.id === objectType?.id && <span className="check-icon">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="object-actions">
                        {!isModal && (
                            <>
                                <button
                                    className="action-btn nav"
                                    onClick={goBack}
                                    disabled={!canGoBack}
                                    title="Atrás"
                                >
                                    ←
                                </button>
                                <button
                                    className="action-btn nav"
                                    onClick={goForward}
                                    disabled={!canGoForward}
                                    title="Adelante"
                                >
                                    →
                                </button>
                                <button
                                    className={`action-btn focus ${focusMode ? 'active' : ''}`}
                                    onClick={toggleFocusMode}
                                    title={focusMode ? 'Salir del modo foco (Esc)' : 'Modo foco (⌘.)'}
                                >
                                    {focusMode ? '◉' : '○'}
                                </button>
                            </>
                        )}
                        <button
                            className="action-btn ai-extract"
                            onClick={() => setShowEntityExtractor(true)}
                            title="Extraer entidades (IA)"
                            style={{ color: 'var(--accent-primary)', opacity: 1 }}
                        >
                            <BrainCircuit size={20} />
                        </button>
                        <button className="action-btn delete" onClick={handleDelete} title="Eliminar">
                            🗑️
                        </button>
                        {isModal && onClose && (
                            <button className="action-btn close-modal" onClick={onClose} title="Cerrar">
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>

                {isEditingTitle ? (
                    <input
                        className="object-title-input"
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        autoFocus
                    />
                ) : (
                    <h1 className="object-title" onClick={handleTitleClick}>
                        {selectedObject.title}
                    </h1>
                )}

                <div className="object-meta">
                    <span className="meta-item">
                        Actualizado: {selectedObject.updatedAt.toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                    {selectedObject.driveFileId && (
                        <span className="meta-item synced">☁ Sincronizado</span>
                    )}
                </div>
            </header>

            {showEntityExtractor && selectedObject && (
                <EntityExtractor
                    content={selectedObject.content}
                    onClose={() => setShowEntityExtractor(false)}
                />
            )}

            {objectType && (
                <PropertiesPanel
                    object={selectedObject}
                    objectType={objectType}
                    onUpdate={(updates) => updateObject(selectedObject.id, updates)}
                    onRelationClick={(id) => openObjectModal(id)}
                />
            )}

            <Editor
                key={selectedObject.id}
                ref={editorRef}
                content={selectedObject.content}
                onChange={handleContentChange}
                onCreateObject={handleCreateObject}
                onMentionClick={(id) => openObjectModal(id)}
                placeholder="Empieza a escribir... Usa @tipo/nombre para mencionar o crear objetos"
            />

            {backlinkedObjects.length > 0 && (
                <div className={`object-backlinks ${backlinksPanelOpen ? 'expanded' : 'collapsed'}`}>
                    <h3
                        className="backlinks-title"
                        onClick={toggleBacklinksPanel}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleBacklinksPanel();
                            }
                        }}
                    >
                        <span className={`backlinks-chevron ${backlinksPanelOpen ? 'expanded' : ''}`}>▶</span>
                        Enlaces entrantes
                        <span className="backlinks-count">{backlinkedObjects.length}</span>
                    </h3>
                    {backlinksPanelOpen && (
                        <div className="backlinks-list">
                            {backlinkedObjects.map(obj => {
                                const type = objectTypes.find(t => t.id === obj.type);
                                const contexts = backlinkContexts[obj.id] || [];
                                const isExpanded = expandedBacklinks.has(obj.id);

                                return (
                                    <div key={obj.id} className="backlink-card">
                                        <button
                                            className="backlink-item"
                                            onClick={() => handleBacklinkClick(obj.id)}
                                            style={{ '--type-color': type?.color } as React.CSSProperties}
                                        >
                                            <span className="backlink-type-badge" style={{ backgroundColor: type?.color }}>
                                                {type?.name?.toUpperCase() || 'OBJETO'}
                                            </span>
                                            <LucideIcon name={type?.icon || 'FileText'} size={14} color={type?.color} />
                                            <span className="backlink-title">{obj.title}</span>
                                        </button>

                                        {contexts.length > 0 && (
                                            <button
                                                className="context-toggle"
                                                onClick={() => toggleBacklinkContext(obj.id)}
                                            >
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                <span>Ver contexto ({contexts.length})</span>
                                            </button>
                                        )}

                                        {isExpanded && contexts.length > 0 && (
                                            <div className="backlink-contexts">
                                                {contexts.map((ctx, i) => {
                                                    return (
                                                        <blockquote
                                                            key={i}
                                                            className="context-snippet clickable"
                                                            onClick={() => {
                                                                // Set highlight text (try to strip HTML for search)
                                                                const tempDiv = document.createElement('div');
                                                                tempDiv.innerHTML = ctx;
                                                                const plainText = tempDiv.textContent || ctx;

                                                                setHighlightSearchText(plainText.slice(0, 50));
                                                                handleBacklinkClick(obj.id);
                                                            }}
                                                            title="Haz clic para ir a esta referencia"
                                                        >
                                                            <div dangerouslySetInnerHTML={{ __html: ctx }} />
                                                        </blockquote>
                                                    );
                                                })}
                                            </div>
                                        )}

                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Eliminar objeto"
                message={`¿Estás seguro de que quieres eliminar "${selectedObject.title}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                isLoading={isDeleting}
            />
        </div>
    );
};

export const ObjectView = () => {
    const selectedObject = useSelectedObject();

    if (!selectedObject) {
        return (
            <div className="object-view empty">
                <div className="empty-state">
                    <span className="empty-icon">✦</span>
                    <h2>Selecciona un objeto</h2>
                    <p>Elige un elemento de la barra lateral o crea uno nuevo</p>
                </div>
            </div>
        );
    }

    return <ObjectViewContent objectId={selectedObject.id} />;
};
