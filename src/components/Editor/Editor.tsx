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
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Underline } from '@tiptap/extension-underline';
import { Typography } from '@tiptap/extension-typography';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import { MermaidBlock } from './MermaidBlock';
import { HashtagNode, HashtagExtension, TaskInlineNode, TaskShortcutExtension, ImageExtension, AttachmentBlock, CollapsibleHeading, ObjectLink, CodeBlockPasteHandler } from './extensions';
import { uploadImageToDrive, isDriveConnected } from '../../services/drive';
import { common, createLowlight } from 'lowlight';
import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';

import { EditorToolbar } from './EditorToolbar';
import {
    parsePropertyAssignments,
    convertPropertyValues,
    formatPropertiesPreview,
} from '../../utils/propertyAssignmentParser';
import type { PropertyValue } from '../../types/object';
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

// Parse "new:type:title" format (simple, no JSON)
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

    // Store pending properties for new object creation (avoids JSON in IDs)
    const pendingPropertiesRef = useRef<Record<string, PropertyValue>>({});

    // State for Cmd+K link modal
    const [linkModalOpen, setLinkModalOpen] = useState(false);

    const getSuggestionItems = useCallback(({ query }: { query: string }) => {
        const lowerQuery = query.toLowerCase().trim();

        // Check for property assignment syntax (> for create with props)
        let baseQuery = lowerQuery;
        let rawProperties: Record<string, string> = {};
        let valueSuggestions: Array<{ id: string; label: string; icon: string; color: string; type?: string; typeName?: string; isNew?: boolean; isValueSuggestion?: boolean }> = [];

        // Handle > syntax - extract the base query and properties
        const arrowIndex = query.indexOf('>');
        if (arrowIndex > 0) {
            baseQuery = query.slice(0, arrowIndex).trim().toLowerCase();
            const propsStr = query.slice(arrowIndex + 1).trim();
            if (propsStr) {
                rawProperties = parsePropertyAssignments(propsStr);
            }

            // Check if we're typing a value after = (for autocomplete)
            const equalsIndex = query.lastIndexOf('=');
            if (equalsIndex > arrowIndex) {
                // We're typing a property value - show matching objects as value suggestions
                const partialValue = query.slice(equalsIndex + 1).trim().toLowerCase();

                // Find objects that match the partial value (for value autocomplete)
                valueSuggestions = objects
                    .filter(obj => obj.title.toLowerCase().includes(partialValue))
                    .slice(0, 5)
                    .map(obj => {
                        const type = objectTypes.find(t => t.id === obj.type);
                        return {
                            id: `value:${obj.id}:${obj.title}`,
                            label: obj.title,
                            type: obj.type,
                            typeName: type?.name?.toUpperCase() || 'OBJETO',
                            icon: type?.icon || 'FileText',
                            color: type?.color || '#6366f1',
                            isNew: false,
                            isValueSuggestion: true,
                        };
                    });
                // Don't return - continue to also include the Create option
            }
        }

        // Normalize accents for comparison
        const normalizeAccents = (str: string) =>
            str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        // Check for type/name format
        const slashIndex = baseQuery.indexOf('/');
        let typeFilter: string | null = null;
        let searchTerm = baseQuery;
        let createNewTitle: string | null = null;

        if (slashIndex > 0) {
            const typePart = baseQuery.slice(0, slashIndex);
            const normalizedTypePart = normalizeAccents(typePart);

            const matchingType = objectTypes.find(t => {
                const normalizedName = normalizeAccents(t.name);
                const normalizedPlural = normalizeAccents(t.namePlural);
                const normalizedId = normalizeAccents(t.id);
                return normalizedName.startsWith(normalizedTypePart) ||
                    normalizedPlural.startsWith(normalizedTypePart) ||
                    normalizedId.startsWith(normalizedTypePart);
            });
            if (matchingType) {
                typeFilter = matchingType.id;
                searchTerm = baseQuery.slice(slashIndex + 1).trim();
                createNewTitle = searchTerm;
            }
        }

        // Find matching existing objects
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
                    typeName: type?.name?.toUpperCase() || 'OBJETO',
                    icon: type?.icon || 'FileText',
                    color: type?.color || '#6366f1',
                    isNew: false,
                };
            });

        // Add create option if type/name syntax with no exact match
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

                // Convert and store properties in ref (NOT in the ID!)
                let propsPreview = '';
                if (Object.keys(rawProperties).length > 0 && type) {
                    const { properties } = convertPropertyValues(rawProperties, type, objects);
                    pendingPropertiesRef.current = properties;
                    propsPreview = formatPropertiesPreview(rawProperties, type);
                } else {
                    pendingPropertiesRef.current = {};
                }

                // Simple ID without JSON encoding
                matchedObjects.push({
                    id: `new:${typeFilter}:${formattedTitle}`,
                    label: propsPreview
                        ? `Crear "${formattedTitle}" (${propsPreview})`
                        : `Crear "${formattedTitle}"`,
                    type: typeFilter,
                    typeName: type?.name?.toUpperCase() || 'OBJETO',
                    icon: type?.icon || 'FileText',
                    color: type?.color || '#6366f1',
                    isNew: true,
                });
            }
        }
        // Combine value suggestions (if any) with matched objects
        // Value suggestions appear first, then the create option
        return [...valueSuggestions, ...matchedObjects];
    }, [objects, objectTypes]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false, // Using custom CollapsibleHeading
                bulletList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                orderedList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                codeBlock: false, // Using CodeBlockLowlight instead
                horizontalRule: false, // Using custom HorizontalRule
                link: false, // Using custom Link configuration
                underline: false, // Using custom Underline configuration
            }),
            CollapsibleHeading.configure({
                levels: [1, 2, 3],
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
            TableCell,
            ObjectLink.configure({
                openOnClick: false, // We handle it manually in handleLinkClick to avoid default behavior
                HTMLAttributes: {
                    class: 'editor-link',
                    // Removed target='_blank' to allow intercepting
                },
            }),
            CodeBlockLowlight.configure({
                lowlight,
            }),
            // Custom paste handler for code blocks - fixes multi-line paste issue
            CodeBlockPasteHandler,
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
            // Attachment blocks for inline file display
            AttachmentBlock,
            // Image extension with Drive upload
            ImageExtension.configure({
                inline: false,
                allowBase64: false,
                onUpload: async (file: File) => {
                    if (!isDriveConnected()) {
                        showNotification('Conecta con Drive para subir imágenes');
                        throw new Error('Drive not connected');
                    }
                    try {
                        showNotification('Subiendo imagen...');
                        const { url } = await uploadImageToDrive(file);
                        showNotification('Imagen subida correctamente');
                        return url;
                    } catch (error) {
                        console.error('Error uploading image:', error);
                        showNotification('Error al subir imagen');
                        throw error;
                    }
                },
            }),
            // Hashtag extensions (#tag)
            HashtagNode.configure({
                getObjects: () => objects,
            }),
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
                        let items: Array<{ id: string; label: string; icon: string; color: string; type?: string; typeName?: string; isNew?: boolean }> = [];
                        let commandFn: ((item: { id: string; label: string }) => void) | null = null;
                        let currentEditor: any = null;

                        const updatePopup = () => {
                            if (!popup) return;
                            popup.innerHTML = items.length === 0
                                ? '<div class="mention-empty">No se encontraron resultados</div>'
                                : items.map((item, index) => `
                  <div class="mention-item ${index === selectedIndex ? 'selected' : ''} ${item.isNew ? 'new-item' : ''}" data-index="${index}">
                    <span class="mention-type-badge" style="background-color: ${item.color}">${item.typeName || 'OBJETO'}</span>
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

                            // For value suggestions (property autocomplete)
                            // Insert the value into the query and update the popup
                            if (item.id.startsWith('value:')) {
                                const parts = item.id.split(':');
                                const selectedTitle = parts.slice(2).join(':'); // Get the title part

                                // We need to replace the partial value with the selected title
                                // Find the current query from the editor and update it
                                const state = currentEditor?.state;
                                if (state) {
                                    // Find the mention trigger position
                                    const beforeText = state.doc.textBetween(Math.max(0, state.selection.from - 200), state.selection.from, '\n');
                                    const atIndex = beforeText.lastIndexOf('@');
                                    if (atIndex >= 0) {
                                        const mentionText = beforeText.slice(atIndex + 1);
                                        const equalsIndex = mentionText.lastIndexOf('=');
                                        if (equalsIndex >= 0) {
                                            // Build new query with selected value
                                            const baseText = mentionText.slice(0, equalsIndex + 1);
                                            const newQuery = baseText + ' ' + selectedTitle;

                                            // Replace the text in editor
                                            const startPos = state.selection.from - mentionText.length;
                                            currentEditor?.chain().focus().deleteRange({ from: startPos, to: state.selection.from }).insertContent(newQuery).run();

                                            // Close popup
                                            popup?.remove();
                                            popup = null;
                                        }
                                    }
                                }
                                return;
                            }

                            // For existing objects - use the command normally
                            if (!item.id.startsWith('new:')) {
                                if (commandFn) {
                                    commandFn({ id: item.id, label: item.label });
                                }
                                return;
                            }

                            // For NEW objects
                            if (isCreatingRef.current) return;

                            const parsed = parseNewItemId(item.id);
                            if (!parsed) return;

                            const { type, title } = parsed;
                            // Get properties from ref (stored by getSuggestionItems)
                            const properties = pendingPropertiesRef.current;

                            // Close popup
                            popup?.remove();
                            popup = null;

                            try {
                                isCreatingRef.current = true;

                                // Create the object with properties if available
                                // Don't auto-select (false) - stay in current document
                                await createObject(type, title, '', false, properties);

                                // Clear pending properties
                                pendingPropertiesRef.current = {};

                                // Show notification
                                const propsNote = Object.keys(properties).length > 0
                                    ? ` con ${Object.keys(properties).length} propiedades`
                                    : '';
                                showNotification(`"${title}" creado${propsNote}. Escribe @${title.split(' ')[0]} para mencionarlo.`);

                            } catch (error) {
                                console.error('Error creating object:', error);
                                showNotification('Error al crear objeto');
                            } finally {
                                isCreatingRef.current = false;
                            }
                        };

                        return {
                            onStart: (props) => {
                                currentEditor = props.editor;
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
                            'data-mention-label': obj?.title || node.attrs.label || 'Unknown',
                            style: `--mention-color: ${type?.color || '#6366f1'}`,
                        },
                        obj?.title || node.attrs.label || 'Unknown',
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

    // Scroll to and highlight text from backlink context click
    const { highlightSearchText, setHighlightSearchText } = useUIStore();

    useEffect(() => {
        if (!editor || !highlightSearchText) return;

        console.log('[Editor] highlightSearchText triggered:', highlightSearchText.slice(0, 50));

        // Wait for the editor content to be fully loaded after navigation
        const timeoutId = setTimeout(() => {
            if (!editor.state || !editor.state.doc) {
                console.log('[Editor] Editor not ready, skipping highlight');
                setHighlightSearchText(null);
                return;
            }

            const doc = editor.state.doc;
            const fullSearchText = highlightSearchText.toLowerCase();
            let foundPos = -1;
            let foundLength = 0;

            // Split into words - The first word is often a tag/mention name which is NOT plain text in TipTap
            // So we try: all words, then skip first word, then individual words from the end
            const allWords = fullSearchText.split(/\s+/).filter(w => w.length > 2);

            // Strategy: Skip first word (likely tag name), search from word 2 onwards
            const searchAttempts = [
                allWords.slice(1, 5).join(' '),  // Skip first word, get next 4
                allWords.slice(1, 3).join(' '),  // Skip first word, get next 2
                allWords.slice(2, 4).join(' '),  // Skip first 2 words
                allWords[1] || '',               // Second word alone
                allWords[2] || '',               // Third word alone
                allWords[allWords.length - 1] || '' // Last word
            ].filter(s => s.length > 3);

            console.log('[Editor] Words:', allWords);
            console.log('[Editor] Search attempts (skipping tag):', searchAttempts);

            for (const searchText of searchAttempts) {
                if (foundPos !== -1) break;

                doc.descendants((node, pos) => {
                    if (foundPos !== -1) return false;

                    if (node.isText && node.text) {
                        const nodeText = node.text.toLowerCase();
                        const index = nodeText.indexOf(searchText);

                        if (index !== -1) {
                            foundPos = pos + index;
                            foundLength = searchText.length;
                            console.log('[Editor] Found "' + searchText + '" at pos:', foundPos);
                            return false;
                        }
                    }
                });
            }


            if (foundPos !== -1) {
                try {
                    // Move cursor to the found position
                    editor.commands.focus();

                    // Set selection to highlight the found text
                    const endPos = Math.min(foundPos + foundLength, doc.content.size);
                    editor.commands.setTextSelection({ from: foundPos, to: endPos });

                    // Use a small delay to let the selection render, then scroll to center
                    setTimeout(() => {
                        // Get the DOM selection and scroll the focused element to center
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            const rect = range.getBoundingClientRect();

                            // Find the scrollable container
                            const scrollContainer = editor.view.dom.closest('.editor-content');

                            if (scrollContainer && rect) {
                                const containerRect = scrollContainer.getBoundingClientRect();
                                // Calculate how much to scroll to center the selection
                                const selectionCenterY = rect.top + rect.height / 2;
                                const containerCenterY = containerRect.top + containerRect.height / 2;
                                const scrollAdjustment = selectionCenterY - containerCenterY;

                                scrollContainer.scrollBy({
                                    top: scrollAdjustment,
                                    behavior: 'smooth'
                                });
                            }
                        }
                    }, 50);

                    console.log('[Editor] Scrolled and selected from', foundPos, 'to', endPos);


                } catch (err) {
                    console.warn('[Editor] Error during scroll/select:', err);
                }
            } else {
                console.log('[Editor] Text not found in document');
            }

            // Clear the highlight state
            setHighlightSearchText(null);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [editor, highlightSearchText, setHighlightSearchText]);






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
