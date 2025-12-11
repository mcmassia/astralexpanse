// HashtagExtension - Detects #hashtag pattern and creates/references tag objects
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { AstralObject, ObjectType } from '../../../types/object';

export interface HashtagExtensionOptions {
    // Callback to find or create a tag object
    onHashtag: (tagName: string) => Promise<{ id: string; label: string; color: string } | null>;
    // Current objects for lookup
    getObjects: () => AstralObject[];
    // Current object types for lookup
    getObjectTypes: () => ObjectType[];
}

export const HashtagExtension = Extension.create<HashtagExtensionOptions>({
    name: 'hashtagExtension',

    addOptions() {
        return {
            onHashtag: async () => null,
            getObjects: () => [],
            getObjectTypes: () => [],
        };
    },

    addProseMirrorPlugins() {
        const { onHashtag } = this.options;

        return [
            new Plugin({
                key: new PluginKey('hashtagExtension'),
                props: {
                    handleTextInput: (view, from, _to, text) => {
                        // When user types space or enter after a hashtag
                        if (text !== ' ' && text !== '\n') {
                            return false;
                        }

                        const { state } = view;
                        const $from = state.doc.resolve(from);
                        const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

                        // Look for hashtag pattern: #word (without spaces)
                        const hashtagMatch = textBefore.match(/#([a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+)$/);
                        if (!hashtagMatch) {
                            return false;
                        }

                        const tagName = hashtagMatch[1];
                        const hashtagStart = from - hashtagMatch[0].length;
                        const hashtagEnd = from;

                        // Process asynchronously
                        (async () => {
                            const tagData = await onHashtag(tagName);
                            if (!tagData) return;

                            const { tr } = view.state;

                            // Delete the #hashtag text
                            tr.delete(hashtagStart, hashtagEnd);

                            // Insert the hashtag node
                            const hashtagNode = view.state.schema.nodes.hashtag.create({
                                id: tagData.id,
                                label: tagData.label,
                                color: tagData.color,
                            });

                            tr.insert(hashtagStart, hashtagNode);

                            // Add the space/newline that triggered this
                            tr.insertText(text);

                            view.dispatch(tr);
                        })();

                        // Let the default handling continue for now
                        // The async handler will update the content
                        return false;
                    },
                },
                // Visual decoration for hashtags being typed (before conversion)
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, _oldSet) {
                        // Find hashtags being typed
                        const decorations: Decoration[] = [];
                        tr.doc.descendants((node, pos) => {
                            if (!node.isText || !node.text) return;

                            const text = node.text;
                            const regex = /#([a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+)/g;
                            let match;

                            while ((match = regex.exec(text)) !== null) {
                                const start = pos + match.index;
                                const end = start + match[0].length;

                                decorations.push(
                                    Decoration.inline(start, end, {
                                        class: 'hashtag-typing',
                                    })
                                );
                            }
                        });

                        return DecorationSet.create(tr.doc, decorations);
                    },
                },
            }),
        ];
    },
});
