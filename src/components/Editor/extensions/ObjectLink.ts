
import { Link } from '@tiptap/extension-link';
import { useObjectStore } from '../../../stores/objectStore';

export const ObjectLink = Link.extend({
    name: 'objectLink',

    priority: 1000, // Higher priority than standard Link

    addAttributes() {
        return {
            ...this.parent?.(),
            href: {
                default: null,
            },
            target: {
                default: this.options.HTMLAttributes.target,
            },
            class: {
                default: null,
            },
            'data-id': {
                default: null,
                parseHTML: element => element.getAttribute('data-id'),
                renderHTML: attributes => {
                    if (!attributes.href?.startsWith('object:')) return {};
                    return { 'data-id': attributes.href.split(':')[1] };
                },
            },
            // Dynamic attributes for styling (using data attributes for CSS)
            'data-type-color': {
                default: null,
                renderHTML: attributes => {
                    if (!attributes.href?.startsWith('object:')) return {};
                    const id = attributes.href.split(':')[1];
                    const obj = useObjectStore.getState().objects.find(o => o.id === id);
                    if (!obj) return {};
                    const type = useObjectStore.getState().objectTypes.find(t => t.id === obj.type);
                    const color = type?.color || '#a855f7';
                    return {
                        'data-type-color': color,
                        style: `--obj-color: ${color}`
                    };
                }
            },
            'data-type-name': {
                default: null,
                renderHTML: attributes => {
                    if (!attributes.href?.startsWith('object:')) return {};
                    const id = attributes.href.split(':')[1];
                    const obj = useObjectStore.getState().objects.find(o => o.id === id);
                    if (!obj) return {};
                    const type = useObjectStore.getState().objectTypes.find(t => t.id === obj.type);
                    return { 'data-type-name': type?.name?.toUpperCase() || 'OBJECT' };
                }
            },
            'data-icon-char': {
                default: null,
                renderHTML: attributes => {
                    if (!attributes.href?.startsWith('object:')) return {};
                    const id = attributes.href.split(':')[1];
                    const obj = useObjectStore.getState().objects.find(o => o.id === id);
                    if (!obj) return {};
                    const type = useObjectStore.getState().objectTypes.find(t => t.id === obj.type);
                    // We can't easily render Lucide icons in CSS content, but we can try emoji or generic text
                    // Or we could use a NodeView, but that's complex for inline marks.
                    // For now, let's use the type name in the badge.
                    return {};
                }
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'a[href^="object:"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        if (HTMLAttributes.href?.startsWith('object:')) {
            return ['a', {
                ...HTMLAttributes,
                class: `object-link-pill ${HTMLAttributes.class || ''}`,
                // Prevent Editor from intercepting click? No, we want editor link behavior (openOnClick)
            }, 0];
        }
        return ['a', HTMLAttributes, 0];
    },
});
