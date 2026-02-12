import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ContextBlockView } from './ContextBlockView';

export interface ContextBlockOptions {
    HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        contextBlock: {
            setContextBlock: (attributes?: { sourceId: string }) => ReturnType;
        };
    }
}

export const ContextBlock = Node.create<ContextBlockOptions>({
    name: 'contextBlock',

    group: 'block',

    atom: true, // It's a leaf node, doesn't contain editable content directly

    addAttributes() {
        return {
            sourceId: {
                default: null,
                parseHTML: element => element.getAttribute('data-source-id'),
                renderHTML: attributes => {
                    return {
                        'data-source-id': attributes.sourceId,
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="context-block"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'context-block' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ContextBlockView);
    },

    addCommands() {
        return {
            setContextBlock:
                (attributes) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: attributes,
                        });
                    },
        };
    },
});
