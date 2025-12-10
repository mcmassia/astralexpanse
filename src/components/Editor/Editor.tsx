// TipTap Rich Text Editor component
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mention from '@tiptap/extension-mention';
import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import './Editor.css';

// Custom Mention extension with parseHTML to persist mentions
const CustomMention = Mention.extend({
    parseHTML() {
        return [
            {
                tag: 'span[data-type="mention"]',
                getAttrs: (element) => {
                    const el = element as HTMLElement;
                    return {
                        id: el.getAttribute('data-mention-id'),
                        label: el.getAttribute('data-mention-label'),
                    };
                },
            },
        ];
    },
});

interface EditorProps {
    content: string;
    onChange: (html: string) => void;
    onCreateObject?: (type: string, title: string) => Promise<{ id: string; label: string }>;
    onMentionClick?: (id: string) => void;
    placeholder?: string;
    editable?: boolean;
}

export interface EditorRef {
    focus: () => void;
    getHTML: () => string;
}

// Parse "new:type:title" format
const parseNewItemId = (id: string): { type: string; title: string } | null => {
    if (!id.startsWith('new:')) return null;
    const withoutPrefix = id.slice(4);
    const colonIndex = withoutPrefix.indexOf(':');
    if (colonIndex === -1) return null;
    return {
        type: withoutPrefix.slice(0, colonIndex),
        title: withoutPrefix.slice(colonIndex + 1),
    };
};

export const Editor = forwardRef<EditorRef, EditorProps>(({
    content,
    onChange,
    onCreateObject,
    onMentionClick,
    placeholder = 'Escribe algo...',
    editable = true,
}, ref) => {
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialContentRef = useRef(content);
    const isInternalUpdate = useRef(false);
    const isCreatingRef = useRef(false);

    const onCreateObjectRef = useRef(onCreateObject);
    onCreateObjectRef.current = onCreateObject;

    const getSuggestionItems = useCallback(({ query }: { query: string }) => {
        const lowerQuery = query.toLowerCase().trim();

        const slashIndex = lowerQuery.indexOf('/');
        let typeFilter: string | null = null;
        let searchTerm = lowerQuery;
        let createNewTitle: string | null = null;

        if (slashIndex > 0) {
            const typePart = lowerQuery.slice(0, slashIndex);
            const matchingType = objectTypes.find(t =>
                t.name.toLowerCase().startsWith(typePart) ||
                t.id.toLowerCase().startsWith(typePart)
            );
            if (matchingType) {
                typeFilter = matchingType.id;
                searchTerm = lowerQuery.slice(slashIndex + 1).trim();
                createNewTitle = searchTerm;
            }
        }

        const matchedObjects = objects
            .filter(obj => {
                if (typeFilter && obj.type !== typeFilter) return false;
                if (!searchTerm) return true;
                return obj.title.toLowerCase().includes(searchTerm);
            })
            .slice(0, 8)
            .map(obj => {
                const type = objectTypes.find(t => t.id === obj.type);
                return {
                    id: obj.id,
                    label: obj.title,
                    type: obj.type,
                    icon: type?.icon || '📄',
                    color: type?.color || '#6366f1',
                    isNew: false,
                };
            });

        if (typeFilter && createNewTitle && createNewTitle.length > 0) {
            const type = objectTypes.find(t => t.id === typeFilter);
            const exactMatch = matchedObjects.find(
                o => o.label.toLowerCase() === createNewTitle?.toLowerCase()
            );

            if (!exactMatch) {
                const formattedTitle = createNewTitle
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                matchedObjects.push({
                    id: `new:${typeFilter}:${formattedTitle}`,
                    label: `Crear "${formattedTitle}"`,
                    type: typeFilter,
                    icon: type?.icon || '📄',
                    color: type?.color || '#6366f1',
                    isNew: true,
                });
            }
        }

        return matchedObjects;
    }, [objects, objectTypes]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({
                placeholder,
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            CustomMention.configure({
                HTMLAttributes: {
                    class: 'mention',
                },
                suggestion: {
                    allowSpaces: true,
                    items: getSuggestionItems,
                    render: () => {
                        let popup: HTMLDivElement | null = null;
                        let selectedIndex = 0;
                        let items: Array<{ id: string; label: string; icon: string; color: string; type?: string; isNew?: boolean }> = [];
                        let commandFn: ((item: { id: string; label: string }) => void) | null = null;

                        const updatePopup = () => {
                            if (!popup) return;
                            popup.innerHTML = items.length === 0
                                ? '<div class="mention-empty">No se encontraron resultados</div>'
                                : items.map((item, index) => `
                  <div class="mention-item ${index === selectedIndex ? 'selected' : ''} ${item.isNew ? 'new-item' : ''}" data-index="${index}">
                    <span class="mention-icon">${item.icon}</span>
                    <span class="mention-label">${item.label}</span>
                    ${item.isNew ? '<span class="mention-new-badge">+ Nuevo</span>' : ''}
                  </div>
                `).join('');

                            popup.querySelectorAll('.mention-item').forEach((el, idx) => {
                                el.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelect(idx);
                                });
                            });
                        };

                        const handleSelect = async (index: number) => {
                            const item = items[index];
                            if (!item) return;

                            // For existing objects - use the command normally (this works!)
                            if (!item.id.startsWith('new:')) {
                                if (commandFn) {
                                    commandFn({ id: item.id, label: item.label });
                                }
                                return;
                            }

                            // For NEW objects - simplified flow
                            if (isCreatingRef.current) return;

                            const parsed = parseNewItemId(item.id);
                            if (!parsed) return;

                            const { type, title } = parsed;
                            const createFn = onCreateObjectRef.current;

                            if (!createFn) return;

                            // Close popup
                            popup?.remove();
                            popup = null;

                            try {
                                isCreatingRef.current = true;

                                // Just create the object - don't try to insert mention
                                // The user can write @name to reference it afterwards
                                await createFn(type, title);

                                // Show a subtle notification that the object was created
                                showNotification(`"${title}" creado. Escribe @${title.split(' ')[0]} para mencionarlo.`);

                            } catch (error) {
                                console.error('Error creating object:', error);
                                showNotification('Error al crear objeto');
                            } finally {
                                isCreatingRef.current = false;
                            }
                        };

                        return {
                            onStart: (props) => {
                                popup = document.createElement('div');
                                popup.className = 'mention-popup';
                                items = props.items as typeof items;
                                commandFn = props.command;
                                updatePopup();

                                const rect = props.clientRect?.();
                                if (rect && popup) {
                                    popup.style.left = `${rect.left}px`;
                                    popup.style.top = `${rect.bottom + 8}px`;
                                }
                                document.body.appendChild(popup);
                            },
                            onUpdate: (props) => {
                                items = props.items as typeof items;
                                commandFn = props.command;
                                selectedIndex = 0;
                                updatePopup();

                                const rect = props.clientRect?.();
                                if (rect && popup) {
                                    popup.style.left = `${rect.left}px`;
                                    popup.style.top = `${rect.bottom + 8}px`;
                                }
                            },
                            onKeyDown: (props) => {
                                if (props.event.key === 'ArrowDown') {
                                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                                    updatePopup();
                                    return true;
                                }
                                if (props.event.key === 'ArrowUp') {
                                    selectedIndex = Math.max(selectedIndex - 1, 0);
                                    updatePopup();
                                    return true;
                                }
                                if (props.event.key === 'Enter') {
                                    handleSelect(selectedIndex);
                                    return true;
                                }
                                return false;
                            },
                            onExit: () => {
                                popup?.remove();
                                popup = null;
                            },
                        };
                    },
                },
                renderHTML: ({ node }) => {
                    const obj = objects.find(o => o.id === node.attrs.id);
                    const type = objectTypes.find(t => t.id === obj?.type);
                    return [
                        'span',
                        {
                            'data-type': 'mention',
                            class: 'mention',
                            'data-mention-id': node.attrs.id,
                            'data-mention-label': node.attrs.label || obj?.title || 'Unknown',
                            style: `--mention-color: ${type?.color || '#6366f1'}`,
                        },
                        `${type?.icon || '📄'} ${node.attrs.label || obj?.title || 'Unknown'}`,
                    ];
                },
            }),
        ],
        content: initialContentRef.current,
        editable,
        onUpdate: ({ editor }) => {
            isInternalUpdate.current = true;
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            debounceRef.current = setTimeout(() => {
                onChange(editor.getHTML());
                isInternalUpdate.current = false;
            }, 1000);
        },
    });

    useImperativeHandle(ref, () => ({
        focus: () => editor?.commands.focus(),
        getHTML: () => editor?.getHTML() || '',
    }));

    useEffect(() => {
        if (editor && !isInternalUpdate.current) {
            const currentContent = editor.getHTML();
            if (content !== currentContent && content !== initialContentRef.current) {
                editor.commands.setContent(content, { emitUpdate: false });
                initialContentRef.current = content;
            }
        }
    }, [content, editor]);

    // Handle click on mentions
    const handleEditorClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const mentionEl = target.classList.contains('mention')
            ? target
            : target.closest('.mention') as HTMLElement | null;

        if (mentionEl && onMentionClick) {
            const mentionId = mentionEl.getAttribute('data-mention-id');
            if (mentionId) {
                e.preventDefault();
                e.stopPropagation();
                onMentionClick(mentionId);
            }
        }
    }, [onMentionClick]);

    if (!editor) return null;

    return (
        <div className="editor-container" onClick={handleEditorClick}>
            <EditorContent editor={editor} className="editor-content" />
        </div>
    );
});

Editor.displayName = 'Editor';

// Simple notification helper
function showNotification(message: string) {
    const notification = document.createElement('div');
    notification.className = 'editor-notification';
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--bg-primary, #1a1a2e);
    color: var(--text-primary, #fff);
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease;
    border: 1px solid var(--border-default, #333);
  `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
