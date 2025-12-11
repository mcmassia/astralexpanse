// Object view component - main content area for viewing/editing objects
import { useState, useCallback, useRef, useMemo } from 'react';
import { useObjectStore, useSelectedObject } from '../../stores/objectStore';
import { Editor } from '../Editor';
import type { EditorRef } from '../Editor';
import { PropertiesPanel } from './PropertiesPanel';
import { ConfirmDialog, useToast } from '../common';
import './ObjectView.css';

export const ObjectView = () => {
    const selectedObject = useSelectedObject();
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const updateObject = useObjectStore(s => s.updateObject);
    const deleteObject = useObjectStore(s => s.deleteObject);
    const selectObject = useObjectStore(s => s.selectObject);
    const createObject = useObjectStore(s => s.createObject);
    const toast = useToast();

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleValue, setTitleValue] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
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
        } catch (error) {
            toast.error('Error al eliminar', 'No se pudo eliminar el objeto. Inténtalo de nuevo.');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleBacklinkClick = (id: string) => {
        selectObject(id);
    };

    // Handle clicking on mentions, hashtags, and inline tasks within the content
    const handleMentionClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;

        // Check for hashtag pill click
        const hashtagEl = target.classList.contains('hashtag-pill')
            ? target
            : target.closest('.hashtag-pill') as HTMLElement | null;
        if (hashtagEl) {
            const tagId = hashtagEl.getAttribute('data-hashtag-id');
            if (tagId) {
                e.preventDefault();
                e.stopPropagation();
                selectObject(tagId);
                return;
            }
        }

        // Check for task inline click
        const taskEl = target.classList.contains('task-inline')
            ? target
            : target.closest('.task-inline') as HTMLElement | null;
        if (taskEl) {
            const taskId = taskEl.getAttribute('data-task-id');
            if (taskId) {
                e.preventDefault();
                e.stopPropagation();
                selectObject(taskId);
                return;
            }
        }

        // Check for mention click (existing behavior)
        if (target.classList.contains('mention') || target.closest('.mention')) {
            const mentionEl = target.classList.contains('mention') ? target : target.closest('.mention') as HTMLElement;
            const mentionId = mentionEl?.getAttribute('data-mention-id');
            if (mentionId) {
                selectObject(mentionId);
            }
        }
    }, [selectObject]);

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

    return (
        <div className="object-view" onClick={handleMentionClick}>
            <header className="object-header">
                <div className="object-type-badge" style={{ '--type-color': objectType?.color } as React.CSSProperties}>
                    <span className="type-icon">{objectType?.icon}</span>
                    <span className="type-name">{objectType?.name}</span>
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

                <div className="object-actions">
                    <button className="action-btn delete" onClick={handleDelete} title="Eliminar">
                        🗑️
                    </button>
                </div>
            </header>

            {objectType && (
                <PropertiesPanel
                    object={selectedObject}
                    objectType={objectType}
                    onUpdate={(updates) => updateObject(selectedObject.id, updates)}
                    onRelationClick={selectObject}
                />
            )}

            <Editor
                key={selectedObject.id}
                ref={editorRef}
                content={selectedObject.content}
                onChange={handleContentChange}
                onCreateObject={handleCreateObject}
                onMentionClick={selectObject}
                placeholder="Empieza a escribir... Usa @tipo/nombre para mencionar o crear objetos"
            />

            {backlinkedObjects.length > 0 && (
                <div className="object-backlinks">
                    <h3 className="backlinks-title">Enlaces entrantes ({backlinkedObjects.length})</h3>
                    <div className="backlinks-list">
                        {backlinkedObjects.map(obj => {
                            const type = objectTypes.find(t => t.id === obj.type);
                            return (
                                <button
                                    key={obj.id}
                                    className="backlink-item"
                                    onClick={() => handleBacklinkClick(obj.id)}
                                    style={{ '--type-color': type?.color } as React.CSSProperties}
                                >
                                    <span className="backlink-icon">{type?.icon}</span>
                                    <span className="backlink-title">{obj.title}</span>
                                </button>
                            );
                        })}
                    </div>
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
