import React, { useMemo, useEffect } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useObjectStore } from '../../../stores/objectStore';
import { useUIStore } from '../../../stores/uiStore';
import { extractContext } from '../../../utils/contextExtractor';
import { LucideIcon } from '../../common';
import './ContextBlock.css';

interface ContextBlockAttrs {
    sourceId: string;
}

export function ContextBlockView({ node, updateAttributes }: NodeViewProps) {
    const { sourceId } = node.attrs as ContextBlockAttrs;
    const { openObjectModal } = useUIStore();

    // Get all objects and object types from store
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);

    const relevantContexts = useMemo(() => {
        if (!sourceId) return [];

        const contexts: Array<{
            objectId: string;
            objectTitle: string;
            objectIcon: string | null;
            objectColor: string;
            snippets: string[];
            updatedAt: Date;
            sortDate: Date; // Property used for sorting
        }> = [];

        objects.forEach(obj => {
            const snippets = extractContext(obj.content, sourceId);

            if (snippets.length > 0) {
                const type = objectTypes.find(t => t.id === obj.type);

                // Find 'date' property for sorting
                let sortDate = new Date(obj.updatedAt);
                if (obj.properties) {
                    for (const [key, value] of Object.entries(obj.properties)) {
                        // We check for any property that looks like a date or is of type 'date' (if we had schema info here)
                        // For now, let's look for a property literally named "date" or "fecha" or check strict type if available
                        // Assuming value might be a date string.
                        // Ideally we check the Type definition, but we just have the object.
                        // Let's check if the type definition says it's a date.
                        const propDef = type?.properties.find(p => p.id === key);
                        if (propDef?.type === 'date' && value) {
                            sortDate = new Date(value as string);
                            break; // Use the first found date property
                        }
                    }
                }

                contexts.push({
                    objectId: obj.id,
                    objectTitle: obj.title,
                    objectIcon: type?.icon || 'FileText',
                    objectColor: type?.color || '#ccc',
                    snippets: snippets,
                    updatedAt: new Date(obj.updatedAt),
                    sortDate: sortDate
                });
            }
        });

        // Sort by date (descending)
        return contexts.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

    }, [objects, sourceId, objectTypes]);

    // Persistence: Update the node attribute with the rendered HTML representation
    // We construct a simple HTML representation of the current state
    useEffect(() => {
        if (relevantContexts.length === 0) return;

        // Generate HTML string
        const htmlParts = relevantContexts.map(ctx => `
            <div style="border-left: 2px solid ${ctx.objectColor}; padding-left: 8px; margin-bottom: 8px;">
                <strong>${ctx.objectTitle}</strong> <small>(${ctx.updatedAt.toLocaleDateString()})</small>
                <div>${ctx.snippets.join('<br/>')}</div>
            </div>
        `);
        const fullHtml = `<div class="context-block-persist">${htmlParts.join('')}</div>`;

        // Only update if changed to avoid loops (TipTap safeguards this usually, but good to be careful)
        if (node.attrs.cachedContent !== fullHtml) {
            // We use a timeout to avoid updating during render cycle
            setTimeout(() => {
                updateAttributes({ cachedContent: fullHtml });
            }, 0);
        }
    }, [relevantContexts, updateAttributes, node.attrs.cachedContent]);


    const handleLinkClick = (e: React.MouseEvent, objectId: string) => {
        e.preventDefault();
        openObjectModal(objectId);
    };

    if (!sourceId) {
        return (
            <NodeViewWrapper className="context-block-wrapper error">
                <div>⚠️ Context Block: No Source ID provided</div>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper className="context-block-wrapper">
            <div className="context-block-header">
                <span className="context-block-title">✦ Referencias y Contexto</span>
                <span className="context-block-count">{relevantContexts.length} fuentes</span>
            </div>

            {relevantContexts.length === 0 ? (
                <div className="context-block-empty">
                    No hay menciones o referencias a este objeto todavía.
                </div>
            ) : (
                <div className="context-block-list">
                    {relevantContexts.map(ctx => (
                        <div key={ctx.objectId} className="context-item">
                            <div className="context-item-header" style={{ '--type-color': ctx.objectColor } as React.CSSProperties}>
                                <button
                                    className="context-source-badge clickable"
                                    onClick={(e) => handleLinkClick(e, ctx.objectId)}
                                >
                                    <LucideIcon name={ctx.objectIcon || 'FileText'} size={14} color={ctx.objectColor} />
                                    <span className="source-title">{ctx.objectTitle}</span>
                                </button>
                                <span className="source-date">
                                    {ctx.sortDate.toLocaleDateString()}
                                </span>
                            </div>

                            <div className="context-snippets">
                                {ctx.snippets.map((html, idx) => (
                                    <div
                                        key={idx}
                                        className="context-snippet-content"
                                        dangerouslySetInnerHTML={{ __html: html }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </NodeViewWrapper>
    );
}
