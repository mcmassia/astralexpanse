import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import Heading from '@tiptap/extension-heading';
import { mergeAttributes } from '@tiptap/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// The React component for the heading
const CollapsibleHeadingComponent: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
    const { collapsed } = node.attrs;
    const level = node.attrs.level;
    const Tag = (`h${level}`) as any;

    const toggle = () => {
        updateAttributes({ collapsed: !collapsed });
    };

    return (
        <NodeViewWrapper as={Tag} className={`collapsible-heading heading-level-${level}`}>
            <div className="heading-row" style={{ display: 'flex', alignItems: 'center' }}>
                <button
                    contentEditable={false}
                    onClick={toggle}
                    className={`heading-toggle ${collapsed ? 'is-collapsed' : ''}`}
                    title={collapsed ? "Expandir" : "Colapsar"}
                    type="button"
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                <NodeViewContent className="heading-content" />
            </div>
        </NodeViewWrapper>
    );
};

// ProseMirror plugin to handle hiding content
const foldPlugin = new Plugin({
    key: new PluginKey('foldPlugin'),
    props: {
        decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];

            doc.descendants((node, pos) => {
                if (node.type.name === 'heading' && node.attrs.collapsed) {
                    const currentLevel = node.attrs.level;
                    const start = pos + node.nodeSize; // Start after the heading
                    let end = start;
                    let foundEnd = false;

                    // Find where the section ends
                    // The section ends at the next heading of same or higher level (smaller number), or end of doc
                    if (start < doc.content.size) {
                        doc.nodesBetween(start, doc.content.size, (childNode, childPos) => {
                            if (foundEnd) return false; // Stop iteration if end is found

                            // If we hit a heading with level <= currentLevel, stop
                            if (childNode.type.name === 'heading') {
                                if (childNode.attrs.level <= currentLevel) {
                                    end = childPos;
                                    foundEnd = true;
                                    return false; // Stop iteration
                                }
                            }
                            // Otherwise, this node is part of the section.
                            // We just continue to update 'end' to cover this node.
                            end = childPos + childNode.nodeSize;
                            return true;
                        });
                    }

                    // If we found a range to hide
                    if (end > start) {
                        // Strategy: iterate the nodes in the range and add Node decorations to each block
                        doc.nodesBetween(start, end, (childNode, childPos) => {
                            // Add decoration to the node itself
                            if (childPos >= start && childPos + childNode.nodeSize <= end) {
                                decorations.push(
                                    Decoration.node(childPos, childPos + childNode.nodeSize, {
                                        class: 'is-hidden-content'
                                    })
                                );
                            }
                        });
                    }
                }
            });

            return DecorationSet.create(doc, decorations);
        }
    }
});

export const CollapsibleHeading = Heading.extend({
    name: 'heading', // Overwrite default heading

    addAttributes() {
        return {
            ...this.parent?.(),
            collapsed: {
                default: false,
                parseHTML: element => element.hasAttribute('collapsed'),
                renderHTML: attributes => {
                    if (attributes.collapsed) {
                        return { collapsed: 'true', 'data-collapsed': 'true' };
                    }
                    return {};
                },
            },
        };
    },

    renderHTML({ HTMLAttributes }) {
        return ['h' + this.options.levels[0], mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(CollapsibleHeadingComponent);
    },

    addProseMirrorPlugins() {
        return [foldPlugin];
    },
});
