// ImageExtension - Custom TipTap image extension with paste/drop upload and resizable view
import Image from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImage } from '../ResizableImage';

export interface ImageExtensionOptions {
    inline: boolean;
    allowBase64: boolean;
    HTMLAttributes: Record<string, unknown>;
    onUpload?: (file: File) => Promise<string>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        imageExtension: {
            setImage: (options: { src: string; alt?: string; title?: string; width?: number; height?: number }) => ReturnType;
        };
    }
}

export const ImageExtension = Image.extend<ImageExtensionOptions>({
    name: 'image',

    addOptions() {
        return {
            ...this.parent?.(),
            inline: false,
            allowBase64: false,
            HTMLAttributes: {},
            onUpload: undefined,
        };
    },

    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: element => element.getAttribute('width') || element.style.width?.replace('px', '') || null,
                renderHTML: attributes => {
                    if (!attributes.width) return {};
                    return { width: attributes.width, style: `width: ${attributes.width}px` };
                },
            },
            height: {
                default: null,
                parseHTML: element => element.getAttribute('height') || element.style.height?.replace('px', '') || null,
                renderHTML: attributes => {
                    if (!attributes.height) return {};
                    return { height: attributes.height, style: `height: ${attributes.height}px` };
                },
            },
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(ResizableImage);
    },

    addProseMirrorPlugins() {
        const { onUpload } = this.options;

        return [
            new Plugin({
                key: new PluginKey('imageUploadHandler'),
                props: {
                    handlePaste: (view, event) => {
                        if (!onUpload) return false;

                        const items = event.clipboardData?.items;
                        if (!items) return false;

                        for (const item of items) {
                            if (item.type.startsWith('image/')) {
                                event.preventDefault();
                                const file = item.getAsFile();
                                if (!file) continue;

                                // Upload and insert - get fresh view state after upload
                                onUpload(file).then(url => {
                                    // Get fresh state from the view to avoid stale references
                                    const { state } = view;
                                    const node = state.schema.nodes.image.create({ src: url });
                                    const tr = state.tr.replaceSelectionWith(node);
                                    view.dispatch(tr);
                                }).catch(err => {
                                    console.error('Image paste upload failed:', err);
                                });

                                return true;
                            }
                        }

                        return false;
                    },

                    handleDrop: (view, event) => {
                        if (!onUpload) return false;

                        const files = event.dataTransfer?.files;
                        if (!files || files.length === 0) return false;

                        const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
                        if (imageFiles.length === 0) return false;

                        event.preventDefault();

                        // Get drop position
                        const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                        if (!coordinates) return false;

                        // Upload each image - insert at end of document if original position is invalid
                        const insertPos = coordinates.pos;
                        imageFiles.forEach(file => {
                            onUpload(file).then(url => {
                                // Get fresh state from view
                                const { state } = view;
                                const node = state.schema.nodes.image.create({ src: url });
                                // Use current selection position if original drop position is out of bounds
                                const pos = Math.min(insertPos, state.doc.content.size);
                                const tr = state.tr.insert(pos, node);
                                view.dispatch(tr);
                            }).catch(err => {
                                console.error('Image drop upload failed:', err);
                            });
                        });

                        return true;
                    },
                },
            }),
        ];
    },
});
