// HashtagNode - TipTap Node for rendering hashtag pills
import { Node, mergeAttributes } from '@tiptap/core';

export interface HashtagNodeOptions {
    HTMLAttributes: Record<string, unknown>;
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
            `#${node.attrs.label}`,
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
