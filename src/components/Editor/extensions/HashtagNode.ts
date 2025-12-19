// HashtagNode - TipTap Node for rendering hashtag pills
import { Node, mergeAttributes } from '@tiptap/core';

export interface HashtagNodeOptions {
    HTMLAttributes: Record<string, unknown>;
    getObjects?: () => Array<{ id: string; title: string; type: string }>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        hashtagNode: {
            insertHashtag: (attrs: { id: string; label: string; color?: string }) => ReturnType;
        };
    }
}

export const HashtagNode = Node.create<HashtagNodeOptions>({
    name: 'hashtag',

    group: 'inline',
    inline: true,
    selectable: true,
    atom: true,

    addOptions() {
        return {
            HTMLAttributes: {},
            getObjects: undefined,
        };
    },

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-hashtag-id'),
                renderHTML: attributes => ({
                    'data-hashtag-id': attributes.id,
                }),
            },
            label: {
                default: null,
                parseHTML: element => element.getAttribute('data-hashtag-label'),
                renderHTML: attributes => ({
                    'data-hashtag-label': attributes.label,
                }),
            },
            color: {
                default: '#f472b6',
                parseHTML: element => element.getAttribute('data-hashtag-color') || '#f472b6',
                renderHTML: attributes => ({
                    'data-hashtag-color': attributes.color,
                    style: `--hashtag-color: ${attributes.color}`,
                }),
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-type="hashtag"]',
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        // Resolve live title from objects if available
        let displayLabel = node.attrs.label;
        if (this.options.getObjects && node.attrs.id) {
            const objects = this.options.getObjects();
            const obj = objects.find(o => o.id === node.attrs.id);
            if (obj) {
                displayLabel = obj.title;
            }
        }

        return [
            'span',
            mergeAttributes(
                {
                    'data-type': 'hashtag',
                    class: 'hashtag-pill',
                },
                this.options.HTMLAttributes,
                HTMLAttributes
            ),
            `#${displayLabel}`,
        ];
    },

    addCommands() {
        return {
            insertHashtag:
                (attrs) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs,
                        });
                    },
        };
    },
});
