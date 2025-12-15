// AttachmentBlock - TipTap extension for inline file attachments in the editor
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { AttachmentBlockView } from '../AttachmentBlockView';

export interface AttachmentBlockOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        attachmentBlock: {
            setAttachmentBlock: (options: {
                fileId: string;
                fileName: string;
                mimeType: string;
                size: number;
            }) => ReturnType;
        };
    }
}

export const AttachmentBlock = Node.create<AttachmentBlockOptions>({
    name: 'attachmentBlock',

    group: 'block',

    atom: true,

    draggable: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            fileId: {
                default: null,
                parseHTML: element => element.getAttribute('data-file-id'),
                renderHTML: attributes => ({
                    'data-file-id': attributes.fileId,
                }),
            },
            fileName: {
                default: '',
                parseHTML: element => element.getAttribute('data-file-name'),
                renderHTML: attributes => ({
                    'data-file-name': attributes.fileName,
                }),
            },
            mimeType: {
                default: 'application/octet-stream',
                parseHTML: element => element.getAttribute('data-mime-type'),
                renderHTML: attributes => ({
                    'data-mime-type': attributes.mimeType,
                }),
            },
            size: {
                default: 0,
                parseHTML: element => parseInt(element.getAttribute('data-size') || '0', 10),
                renderHTML: attributes => ({
                    'data-size': attributes.size,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-attachment-block]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(
            { 'data-attachment-block': '' },
            this.options.HTMLAttributes,
            HTMLAttributes
        )];
    },

    addNodeView() {
        return ReactNodeViewRenderer(AttachmentBlockView);
    },

    addCommands() {
        return {
            setAttachmentBlock: (options) => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: options,
                });
            },
        };
    },
});
