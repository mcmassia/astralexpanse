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
            const { svg } = await mermaid.render(id, diagramCode);
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
