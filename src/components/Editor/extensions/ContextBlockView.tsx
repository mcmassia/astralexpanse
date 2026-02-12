import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useMemo } from 'react';
import { useObjectStore } from '../../../stores/objectStore';
import { extractContext } from '../../../utils/contextExtractor';
import { LucideIcon } from '../../common';
import './ContextBlock.css';

interface ContextBlockAttrs {
    sourceId: string;
}

export function ContextBlockView({ node }: NodeViewProps) {
    const { sourceId } = node.attrs as ContextBlockAttrs;

    // Get all objects and object types from store
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);

    // If no sourceId is provided, we can default to the currently selected object 
    // (though in strict TipTap node logic, attributes should be explicit)
    // For now, let's assume sourceId represents the object *hosting* this block,
    // so we want to find OTHER objects that link TO it.

    // Wait... if the user inserts this block into Object A, they want to see mentions of Object A in other objects.
    // So sourceId should be Object A's ID.

    const relevantContexts = useMemo(() => {
        if (!sourceId) return [];

        const contexts: Array<{
            objectId: string;
            objectTitle: string;
            objectIcon: string | null;
            objectColor: string;
            snippets: string[];
            updatedAt: Date;
        }> = [];

        objects.forEach(obj => {
            // Check if this object links to our sourceId
            // 1. Check direct links array (old style)
            // 2. Check properties (new style relations)
            // 3. Check content mentions (most important for context)

            // We use extractContext which checks the HTML content directly for mentions/links
            // This is the most accurate for "contextual" info in the body
            const snippets = extractContext(obj.content, sourceId);

            if (snippets.length > 0) {
                const type = objectTypes.find(t => t.id === obj.type);
                contexts.push({
                    objectId: obj.id,
                    objectTitle: obj.title,
                    objectIcon: type?.icon || 'FileText',
                    objectColor: type?.color || '#ccc',
                    snippets: snippets,
                    updatedAt: new Date(obj.updatedAt),
                });
            }
        });

        // Sort by date (newest first)
        return contexts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    }, [objects, sourceId, objectTypes]);

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
                                <div className="context-source-badge">
                                    <LucideIcon name={ctx.objectIcon || 'FileText'} size={14} color={ctx.objectColor} />
                                    <span className="source-title">{ctx.objectTitle}</span>
                                </div>
                                <span className="source-date">
                                    {ctx.updatedAt.toLocaleDateString()}
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
