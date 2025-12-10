// MermaidBlockView - React component for rendering Mermaid diagrams in TipTap
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import './MermaidBlock.css';

// Initialize mermaid with dark theme
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: '#fff',
        primaryBorderColor: '#4f46e5',
        lineColor: '#888',
        secondaryColor: '#1e1e2e',
        tertiaryColor: '#2a2a3e',
    },
    flowchart: {
        htmlLabels: true,
        curve: 'basis',
    },
});

/**
 * Normalize Mermaid diagram code that may have lost newlines.
 * This handles cases where the code is on a single line and inserts
 * appropriate line breaks to make it valid Mermaid syntax.
 */
function normalizeMermaidCode(code: string): string {
    // If the code already has newlines, it's probably fine
    if (code.includes('\n')) {
        return code;
    }

    const trimmed = code.trim();

    // Match the diagram type declaration at the start
    const graphMatch = trimmed.match(/^(graph\s+(?:TD|TB|BT|RL|LR)|flowchart\s+(?:TD|TB|BT|RL|LR))\s*/i);

    if (graphMatch) {
        const diagramType = graphMatch[1];
        let rest = trimmed.substring(graphMatch[0].length);

        // For graph/flowchart: Insert newlines after node closures followed by new nodes
        // Pattern: closing bracket/brace/paren followed by space and node ID
        // e.g., "] A[" or "} B{" or ") C(" or "] B -->" 
        rest = rest
            // After a complete connection ending with a node closure, before a new node starts
            .replace(/([\]\}\)])(\s+)([A-Za-z_][A-Za-z0-9_]*\s*(?:[\[\{\(]|-->|--\||---|\.->|==>))/g, '$1\n    $3')
            // Also handle when the arrow comes right after the closing bracket
            .replace(/([\]\}\)])\s*(-->|--\||---|\.->|==>)\s*(\|[^|]*\|)?\s*([A-Za-z_][A-Za-z0-9_]*[\[\{\(])/g, '$1 $2 $3 $4');

        return diagramType + '\n    ' + rest.trim();
    }

    // For sequence diagrams
    const seqMatch = trimmed.match(/^(sequenceDiagram)\s*/i);
    if (seqMatch) {
        let rest = trimmed.substring(seqMatch[0].length);
        rest = rest
            .replace(/\s+(participant\s+)/gi, '\n    $1')
            .replace(/\s+([A-Za-z_][A-Za-z0-9_]*\s*->>)/g, '\n    $1')
            .replace(/\s+(Note\s+)/gi, '\n    $1')
            .replace(/\s+(loop\s+|alt\s+|else\s*|end\b)/gi, '\n    $1');
        return 'sequenceDiagram\n    ' + rest.trim();
    }

    // For class diagrams
    const classMatch = trimmed.match(/^(classDiagram)\s*/i);
    if (classMatch) {
        let rest = trimmed.substring(classMatch[0].length);
        rest = rest
            .replace(/\s+(class\s+)/gi, '\n    $1')
            .replace(/\s+([A-Za-z_][A-Za-z0-9_]*\s*(?:<\|--|-->|--\*|--o|--|\.\.>|\.\.))/g, '\n    $1');
        return 'classDiagram\n    ' + rest.trim();
    }

    // For other diagram types, try a generic approach
    // Split before common Mermaid keywords/patterns
    const otherMatch = trimmed.match(/^(stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline)\s*/i);
    if (otherMatch) {
        const diagramType = otherMatch[1];
        let rest = trimmed.substring(otherMatch[0].length);
        // Generic: split on multiple spaces that precede identifiers
        rest = rest.replace(/\s{2,}([A-Za-z_])/g, '\n    $1');
        return diagramType + '\n    ' + rest.trim();
    }

    // Unknown format, return as-is
    return code;
}

interface MermaidBlockViewProps {
    node: {
        textContent: string;
    };
    updateAttributes: (attrs: Record<string, unknown>) => void;
    editor: {
        isEditable: boolean;
    };
}

export function MermaidBlockView({ node, editor }: MermaidBlockViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const diagramCode = node.textContent;

    const renderDiagram = useCallback(async () => {
        if (!diagramCode.trim()) {
            setSvgContent('');
            setError(null);
            return;
        }

        try {
            const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            // Normalize the code to restore newlines if they were lost
            const normalizedCode = normalizeMermaidCode(diagramCode);
            const { svg } = await mermaid.render(id, normalizedCode);
            setSvgContent(svg);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error rendering diagram');
            setSvgContent('');
        }
    }, [diagramCode]);

    useEffect(() => {
        if (!isEditing) {
            const timeoutId = setTimeout(renderDiagram, 300);
            return () => clearTimeout(timeoutId);
        }
    }, [diagramCode, isEditing, renderDiagram]);

    const handleEdit = () => {
        if (editor.isEditable) {
            setIsEditing(true);
        }
    };

    const handleBlur = () => {
        setIsEditing(false);
    };

    return (
        <NodeViewWrapper className="mermaid-block-wrapper">
            <div className="mermaid-block-header">
                <span className="mermaid-block-label">◇ Diagrama Mermaid</span>
                {editor.isEditable && (
                    <button
                        type="button"
                        className="mermaid-block-toggle"
                        onClick={() => setIsEditing(!isEditing)}
                    >
                        {isEditing ? 'Ver diagrama' : 'Editar código'}
                    </button>
                )}
            </div>

            {isEditing || !svgContent ? (
                <div
                    className="mermaid-block-editor"
                    onClick={handleEdit}
                    onBlur={handleBlur}
                >
                    <NodeViewContent as="div" className="mermaid-code" />
                </div>
            ) : (
                <div
                    ref={containerRef}
                    className="mermaid-block-preview"
                    onClick={handleEdit}
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                />
            )}

            {error && (
                <div className="mermaid-block-error">
                    <span>⚠️ Error: {error}</span>
                </div>
            )}
        </NodeViewWrapper>
    );
}
