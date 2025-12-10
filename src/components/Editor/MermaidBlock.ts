// MermaidBlock extension for TipTap - renders Mermaid diagrams
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MermaidBlockView } from './MermaidBlockView';

export interface MermaidBlockOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        mermaidBlock: {
            setMermaidBlock: () => ReturnType;
        };
    }
}

export const MermaidBlock = Node.create<MermaidBlockOptions>({
    name: 'mermaidBlock',

    group: 'block',

    content: 'text*',

    marks: '',

    defining: true,

    isolating: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="mermaid-block"]',
            },
            {
                tag: 'pre',
                preserveWhitespace: 'full',
                getAttrs: (node) => {
                    const el = node as HTMLElement;
                    const code = el.querySelector('code');
                    if (code?.classList.contains('language-mermaid')) {
                        return {};
                    }
                    return false;
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'mermaid-block' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MermaidBlockView);
    },

    addCommands() {
        return {
            setMermaidBlock:
                () =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            content: [
                                {
                                    type: 'text',
                                    text: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do something]
    B -->|No| D[Do something else]
    C --> E[End]
    D --> E`,
                                },
                            ],
                        });
                    },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-Alt-m': () => this.editor.commands.setMermaidBlock(),
        };
    },
});
