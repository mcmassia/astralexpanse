// ResizableImage - React component for rendering images with resize handles
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useRef, useState, useCallback, useEffect } from 'react';

export const ResizableImage = ({ node, updateAttributes, selected }: NodeViewProps) => {
    const imageRef = useRef<HTMLImageElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const { src, alt, title, width, height } = node.attrs;

    // Initialize with src only if it's a real URL (not drive://, drive.google/thumbnail, or lh3), otherwise wait for loader
    const [imageUrl, setImageUrl] = useState(() => {
        if (src.startsWith('drive://')) return '';
        if (src.includes('drive.google.com/thumbnail')) return '';
        // Keeping legacy checks just in case
        if (src.includes('drive.google.com') && src.includes('id=') && !src.includes('thumbnail')) return '';
        if (src.includes('lh3.googleusercontent.com/d/')) return '';
        return src;
    });

    // Handle drive:// protocol and standard Drive URLs
    useEffect(() => {
        let isMounted = true;

        const loadDriveImage = async () => {
            let fileId = null;

            if (src.startsWith('drive://')) {
                fileId = src.replace('drive://', '');
            } else if (src.includes('drive.google.com')) {
                const match = src.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                if (match) fileId = match[1];
            } else if (src.includes('lh3.googleusercontent.com/d/')) {
                // Extract ID from https://lh3.googleusercontent.com/d/FILE_ID
                const parts = src.split('/d/');
                if (parts.length > 1) fileId = parts[1].split('/')[0];
            }

            if (fileId) {
                try {
                    const { getDriveFileUrl } = await import('../../services/drive');
                    const url = await getDriveFileUrl(fileId);
                    if (isMounted) setImageUrl(url);
                } catch (error) {
                    console.error('Error loading Drive image:', error);
                    // Fallback to original SRC if secure load fails (might work if public)
                    if (isMounted && src.startsWith('http')) setImageUrl(src);
                }
            } else {
                setImageUrl(src);
            }
        };

        loadDriveImage();

        return () => {
            isMounted = false;
            // Cleanup object URL if it was created
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [src]);

    // Handle resize start
    const handleResizeStart = useCallback((e: React.MouseEvent, corner: string) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = imageRef.current?.offsetWidth || 200;
        const startHeight = imageRef.current?.offsetHeight || 200;
        const aspectRatio = startWidth / startHeight;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;

            // Maintain aspect ratio based on which corner is dragged
            if (corner.includes('e')) {
                newWidth = Math.max(50, startWidth + deltaX);
                newHeight = newWidth / aspectRatio;
            } else if (corner.includes('w')) {
                newWidth = Math.max(50, startWidth - deltaX);
                newHeight = newWidth / aspectRatio;
            }

            if (corner.includes('s') && !corner.includes('e') && !corner.includes('w')) {
                newHeight = Math.max(50, startHeight + deltaY);
                newWidth = newHeight * aspectRatio;
            } else if (corner.includes('n') && !corner.includes('e') && !corner.includes('w')) {
                newHeight = Math.max(50, startHeight - deltaY);
                newWidth = newHeight * aspectRatio;
            }

            updateAttributes({ width: Math.round(newWidth), height: Math.round(newHeight) });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [updateAttributes]);

    // Handle context menu
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
        setShowContextMenu(true);
    }, []);

    // Close context menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setShowContextMenu(false);
        if (showContextMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showContextMenu]);

    // Copy image URL to clipboard
    const handleCopyUrl = useCallback(() => {
        navigator.clipboard.writeText(src);
        setShowContextMenu(false);
    }, [src]);

    // Copy image to clipboard
    const handleCopyImage = useCallback(async () => {
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ]);
        } catch (err) {
            // Fallback: copy URL
            navigator.clipboard.writeText(src);
        }
        setShowContextMenu(false);
    }, [src]);

    return (
        <NodeViewWrapper className="editor-image-wrapper">
            <div
                className={`editor-image-container ${selected ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
                onContextMenu={handleContextMenu}
            >
                <img
                    ref={imageRef}
                    src={imageUrl}
                    alt={alt || ''}
                    title={title || ''}
                    style={{
                        width: width ? `${width}px` : 'auto',
                        height: height ? `${height}px` : 'auto',
                        maxWidth: '100%',
                    }}
                    draggable={false}
                />

                {/* Resize handles - only show when selected */}
                {selected && (
                    <>
                        <div
                            className="editor-image-resize-handle nw"
                            onMouseDown={(e) => handleResizeStart(e, 'nw')}
                        />
                        <div
                            className="editor-image-resize-handle ne"
                            onMouseDown={(e) => handleResizeStart(e, 'ne')}
                        />
                        <div
                            className="editor-image-resize-handle sw"
                            onMouseDown={(e) => handleResizeStart(e, 'sw')}
                        />
                        <div
                            className="editor-image-resize-handle se"
                            onMouseDown={(e) => handleResizeStart(e, 'se')}
                        />
                    </>
                )}
            </div>

            {/* Context menu */}
            {showContextMenu && (
                <div
                    className="editor-image-context-menu"
                    style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
                >
                    <button onClick={handleCopyImage}>Copiar imagen</button>
                    <button onClick={handleCopyUrl}>Copiar URL</button>
                </div>
            )}
        </NodeViewWrapper>
    );
};
