// TipTap Rich Text Editor component
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mention from '@tiptap/extension-mention';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Link } from '@tiptap/extension-link';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Underline } from '@tiptap/extension-underline';
import { Typography } from '@tiptap/extension-typography';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { MermaidBlock } from './MermaidBlock';
import { HashtagNode, HashtagExtension, TaskInlineNode, TaskShortcutExtension } from './extensions';
import { common, createLowlight } from 'lowlight';
import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { EditorToolbar } from './EditorToolbar';
import 'katex/dist/katex.min.css';
import './Editor.css';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

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
    const createObject = useObjectStore(s => s.createObject);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialContentRef = useRef(content);
    const isInternalUpdate = useRef(false);
    const isCreatingRef = useRef(false);

    const onCreateObjectRef = useRef(onCreateObject);
    onCreateObjectRef.current = onCreateObject;

    // State for Cmd+K link modal
    const [linkModalOpen, setLinkModalOpen] = useState(false);

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
                codeBlock: false, // Using CodeBlockLowlight instead
                horizontalRule: false, // Using custom HorizontalRule
                link: false, // Using custom Link configuration
                underline: false, // Using custom Underline configuration
            }),
            Placeholder.configure({
                placeholder,
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'editor-link',
                },
            }),
            CodeBlockLowlight.configure({
                lowlight,
            }),
            Underline,
            Typography,
            HorizontalRule,
            MathExtension.configure({
                evaluation: false,
                katexOptions: {
                    throwOnError: false,
                },
            }),
            MermaidBlock,
            // Hashtag extensions (#tag)
            HashtagNode,
            HashtagExtension.configure({
                onHashtag: async (tagName: string) => {
                    // Find existing tag by name (case-insensitive)
                    const tagType = objectTypes.find(t =>
                        t.name.toLowerCase() === 'etiqueta' || t.id === 'tag'
                    );
                    if (!tagType) {
                        console.warn('Tag type not found');
                        return null;
                    }

                    const existingTag = objects.find(o =>
                        o.type === tagType.id &&
                        o.title.toLowerCase() === tagName.toLowerCase()
                    );

                    if (existingTag) {
                        return {
                            id: existingTag.id,
                            label: existingTag.title,
                            color: tagType.color || '#f472b6',
                        };
                    }

                    // Create new tag
                    try {
                        const newTag = await createObject(tagType.id, tagName, '', false);
                        return {
                            id: newTag.id,
                            label: newTag.title,
                            color: tagType.color || '#f472b6',
                        };
                    } catch (error) {
                        console.error('Error creating tag:', error);
                        return null;
                    }
                },
                getObjects: () => objects,
                getObjectTypes: () => objectTypes,
            }),
            // Task inline extensions (TD)
            TaskInlineNode,
            TaskShortcutExtension.configure({
                onCreateTask: async (title: string) => {
                    // Find task type
                    const taskType = objectTypes.find(t =>
                        t.name.toLowerCase() === 'tarea' || t.id === 'task'
                    );
                    if (!taskType) {
                        console.warn('Task type not found');
                        return null;
                    }

                    try {
                        const newTask = await createObject(
                            taskType.id,
                            title,
                            '',
                            false,
                            { status: 'Pendiente' }
                        );
                        return {
                            id: newTask.id,
                            title: newTask.title,
                            status: 'Pendiente',
                        };
                    } catch (error) {
                        console.error('Error creating task:', error);
                        return null;
                    }
                },
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

    // Cmd+K keyboard shortcut for link modal (only when editor is focused)
    useEffect(() => {
        if (!editable || !editor) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle Cmd+K when the editor is focused
            if ((e.metaKey || e.ctrlKey) && e.key === 'k' && editor.isFocused) {
                e.preventDefault();
                e.stopPropagation();
                setLinkModalOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [editable, editor]);

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
            {editable && (
                <EditorToolbar
                    editor={editor}
                    linkModalOpen={linkModalOpen}
                    onLinkModalClose={() => setLinkModalOpen(false)}
                />
            )}
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
