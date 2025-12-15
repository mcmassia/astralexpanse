// EditorToolbar component for formatting actions
import { useState, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { LinkModal } from './LinkModal';
import { ImageModal } from './ImageModal';
import { uploadImageToDrive, isDriveConnected, uploadFileToDrive, getAttachmentTypeInfo, formatFileSize, getDriveViewUrl } from '../../services/drive';
import { useObjectStore } from '../../stores/objectStore';
import './EditorToolbar.css';

interface EditorToolbarProps {
    editor: Editor | null;
    linkModalOpen?: boolean;
    onLinkModalClose?: () => void;
}

export function EditorToolbar({ editor, linkModalOpen, onLinkModalClose }: EditorToolbarProps) {
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [showImageDropdown, setShowImageDropdown] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    // Access object store for creating Adjunto objects
    const createObject = useObjectStore(s => s.createObject);

    // Handle external open request (from Cmd+K)
    useEffect(() => {
        if (linkModalOpen) {
            setIsLinkModalOpen(true);
        }
    }, [linkModalOpen]);

    if (!editor) return null;

    const insertTable = () => {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    };

    const openLinkModal = () => {
        setIsLinkModalOpen(true);
    };

    const handleLinkConfirm = (url: string, text?: string) => {
        // Ensure URL has protocol
        let finalUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://') &&
            !url.startsWith('mailto:') && !url.startsWith('/') && !url.startsWith('#')) {
            finalUrl = 'https://' + url;
        }

        if (text && !editor.state.selection.empty === false) {
            // If text is provided and nothing is selected, insert text with link
            editor.chain().focus()
                .insertContent(`<a href="${finalUrl}">${text}</a>`)
                .run();
        } else {
            // Apply link to selection or extend existing link
            editor.chain().focus()
                .extendMarkRange('link')
                .setLink({ href: finalUrl })
                .run();
        }
        setIsLinkModalOpen(false);
    };

    const handleLinkRemove = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setIsLinkModalOpen(false);
    };

    const handleLinkCancel = () => {
        setIsLinkModalOpen(false);
        onLinkModalClose?.();
        editor.chain().focus().run();
    };

    const insertMath = () => {
        // Insert an inline math formula as an example
        editor.chain().focus().insertContent('$E = mc^2$').run();
    };

    const insertMermaidBlock = () => {
        // Use the MermaidBlock extension command
        (editor.chain().focus() as any).setMermaidBlock().run();
    };

    // Image insertion handlers
    const handleImageUrlConfirm = (url: string, alt?: string) => {
        editor.chain().focus().setImage({ src: url, alt: alt || '' }).run();
        setIsImageModalOpen(false);
    };

    const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!isDriveConnected()) {
            alert('Conecta con Google Drive para subir imágenes');
            return;
        }

        try {
            const { url } = await uploadImageToDrive(file);
            editor.chain().focus().setImage({ src: url }).run();
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error al subir imagen');
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Attachment insertion handler - creates Adjunto object and inserts block
    const handleAttachmentFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!isDriveConnected()) {
            alert('Conecta con Google Drive para subir archivos');
            return;
        }

        try {
            // Upload file to Drive
            const attachment = await uploadFileToDrive(file);
            console.log('Attachment uploaded:', attachment);

            // First, insert block in editor immediately while editor has focus
            if (editor && !editor.isDestroyed) {
                console.log('Inserting attachment block...');
                editor.chain().focus().insertContent({
                    type: 'attachmentBlock',
                    attrs: {
                        fileId: attachment.fileId,
                        fileName: attachment.fileName,
                        mimeType: attachment.mimeType,
                        size: attachment.size,
                    },
                }).run();
                console.log('Block inserted successfully');
            }

            // Then create Adjunto object (non-blocking for editor)
            const { label: tipoArchivo } = getAttachmentTypeInfo(attachment.mimeType);
            createObject('adjunto', attachment.fileName, '', false, {
                tipoArchivo,
                driveFileId: attachment.fileId,
                driveUrl: getDriveViewUrl(attachment.fileId),
                tamaño: formatFileSize(attachment.size),
                mimeType: attachment.mimeType,
            }).catch(err => console.error('Error creating Adjunto object:', err));

        } catch (error) {
            console.error('Error uploading attachment:', error);
            alert('Error al subir archivo');
        }

        // Reset file input
        if (attachmentInputRef.current) {
            attachmentInputRef.current.value = '';
        }
    };

    const currentLinkUrl = editor.getAttributes('link').href || '';
    const hasSelection = !editor.state.selection.empty;

    return (
        <>
            <div className="editor-toolbar">
                {/* Text formatting */}
                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={editor.isActive('bold') ? 'is-active' : ''}
                        title="Negrita (Ctrl+B)"
                    >
                        <strong>B</strong>
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={editor.isActive('italic') ? 'is-active' : ''}
                        title="Itálica (Ctrl+I)"
                    >
                        <em>I</em>
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={editor.isActive('underline') ? 'is-active' : ''}
                        title="Subrayado (Ctrl+U)"
                    >
                        <span style={{ textDecoration: 'underline' }}>U</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={editor.isActive('strike') ? 'is-active' : ''}
                        title="Tachado"
                    >
                        <span style={{ textDecoration: 'line-through' }}>S</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        className={editor.isActive('code') ? 'is-active' : ''}
                        title="Código inline"
                    >
                        <code>&lt;/&gt;</code>
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Headings */}
                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                        className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                        title="Encabezado 1"
                    >
                        H1
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                        title="Encabezado 2"
                    >
                        H2
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
                        title="Encabezado 3"
                    >
                        H3
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Lists */}
                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={editor.isActive('bulletList') ? 'is-active' : ''}
                        title="Lista con viñetas"
                    >
                        •
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={editor.isActive('orderedList') ? 'is-active' : ''}
                        title="Lista numerada"
                    >
                        1.
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleTaskList().run()}
                        className={editor.isActive('taskList') ? 'is-active' : ''}
                        title="Lista de tareas"
                    >
                        ☑
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Blocks */}
                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={editor.isActive('blockquote') ? 'is-active' : ''}
                        title="Cita"
                    >
                        "
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        className={editor.isActive('codeBlock') ? 'is-active' : ''}
                        title="Bloque de código"
                    >
                        {'{ }'}
                    </button>
                    <button
                        type="button"
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        title="Línea horizontal"
                    >
                        ―
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Insert */}
                <div className="toolbar-group">
                    <button
                        type="button"
                        onClick={insertTable}
                        className={editor.isActive('table') ? 'is-active' : ''}
                        title="Insertar tabla"
                    >
                        ⊞
                    </button>
                    <button
                        type="button"
                        onClick={openLinkModal}
                        className={editor.isActive('link') ? 'is-active' : ''}
                        title="Insertar enlace (⌘K)"
                    >
                        🔗
                    </button>
                    <button
                        type="button"
                        onClick={insertMath}
                        title="Insertar fórmula matemática"
                    >
                        ∑
                    </button>
                    <button
                        type="button"
                        onClick={insertMermaidBlock}
                        title="Insertar diagrama Mermaid"
                    >
                        ◇
                    </button>
                    <div className="toolbar-image-dropdown">
                        <button
                            type="button"
                            onClick={() => setShowImageDropdown(!showImageDropdown)}
                            className={editor.isActive('image') ? 'is-active' : ''}
                            title="Insertar imagen"
                        >
                            🖼️
                        </button>
                        {showImageDropdown && (
                            <div className="image-dropdown-menu">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowImageDropdown(false);
                                        setIsImageModalOpen(true);
                                    }}
                                >
                                    Insertar URL
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowImageDropdown(false);
                                        fileInputRef.current?.click();
                                    }}
                                >
                                    Subir imagen
                                </button>
                            </div>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        style={{ display: 'none' }}
                    />
                    <button
                        type="button"
                        onClick={() => attachmentInputRef.current?.click()}
                        title="Insertar adjunto"
                    >
                        📎
                    </button>
                    <input
                        ref={attachmentInputRef}
                        type="file"
                        onChange={handleAttachmentFileChange}
                        style={{ display: 'none' }}
                    />
                </div>

                {/* Table controls - only show when inside a table */}
                {editor.isActive('table') && (
                    <>
                        <div className="toolbar-divider" />
                        <div className="toolbar-group table-controls">
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnBefore().run()}
                                title="Añadir columna antes"
                            >
                                ⇤+
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                title="Añadir columna después"
                            >
                                +⇥
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteColumn().run()}
                                title="Eliminar columna"
                            >
                                ⊟
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowBefore().run()}
                                title="Añadir fila arriba"
                            >
                                ↑+
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                title="Añadir fila abajo"
                            >
                                +↓
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteRow().run()}
                                title="Eliminar fila"
                            >
                                ⊟
                            </button>
                            <button
                                type="button"
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                className="danger"
                                title="Eliminar tabla"
                            >
                                🗑
                            </button>
                        </div>
                    </>
                )}
            </div>

            <LinkModal
                isOpen={isLinkModalOpen}
                initialUrl={currentLinkUrl}
                hasSelection={hasSelection}
                onConfirm={handleLinkConfirm}
                onRemove={currentLinkUrl ? handleLinkRemove : undefined}
                onCancel={handleLinkCancel}
            />

            <ImageModal
                isOpen={isImageModalOpen}
                onConfirm={handleImageUrlConfirm}
                onCancel={() => setIsImageModalOpen(false)}
            />
        </>
    );
}

