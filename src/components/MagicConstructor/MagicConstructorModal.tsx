import React, { useState } from 'react';
import { X, Sparkles, Check, Loader2, AlertTriangle } from 'lucide-react';
import { aiService } from '../../services/ai';
import type { AstralObject, PropertyValue } from '../../types/object';
import { DEFAULT_OBJECT_TYPES } from '../../types/object';
import { useObjectStore } from '../../stores/objectStore';
import './MagicConstructor.css';

interface MagicConstructorModalProps {
    onClose: () => void;
    onSuccess: (objectId: string) => void;
}

export const MagicConstructorModal: React.FC<MagicConstructorModalProps> = ({ onClose, onSuccess }) => {
    const [input, setInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [preview, setPreview] = useState<Partial<AstralObject> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { createObject } = useObjectStore();

    const handleAnalyze = async () => {
        if (!input.trim()) return;

        setIsAnalyzing(true);
        setError(null);

        try {
            // Build context about available types
            const typesInfo = DEFAULT_OBJECT_TYPES.map(t =>
                `- ID: ${t.id} (${t.name}): Properties: ${t.properties.map(p => p.id).join(', ')}`
            ).join('\n');

            const prompt = `
        Analyze the following text/URL and extract an Astral Object.
        
        AVAILABLE TYPES:
        ${typesInfo}
        
        INSTRUCTIONS:
        1. Determine the best Object Type ID from the list.
        2. Extract a Title.
        3. Create a Summary (HTML format) for the content.
        4. Extract relevant tags (lowercase).
        5. Extract values for the specific properties defined for that type.
        
        INPUT:
        "${input}"
        
        Respond JSON with format:
        {
          "type": "string (id)",
          "title": "string",
          "content": "string (html summary)",
          "tags": ["string"],
          "properties": { "key": "value" }
        }
      `;

            const result = await aiService.generateObject(prompt);

            // Basic validation
            if (!result.title || !result.type) {
                throw new Error('AI failed to identify a valid object.');
            }

            setPreview(result);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSave = async () => {
        if (!preview || !preview.title || !preview.type) return;

        try {
            // Call createObject with correct signature: type, title, content, autoSelect, initialProperties
            const newObject = await createObject(
                preview.type,
                preview.title,
                preview.content || '',
                true, // Auto-select
                preview.properties as Record<string, PropertyValue> || {}
            );

            onSuccess(newObject.id);
        } catch (e) {
            console.error(e);
            setError('Failed to save object');
        }
    };

    return (
        <div className="magic-modal-overlay">
            <div className="magic-modal">
                <div className="magic-header">
                    <div className="magic-title">
                        <Sparkles className="magic-icon" />
                        <h2>Magic Constructor</h2>
                    </div>
                    <button onClick={onClose} className="close-btn"><X size={20} /></button>
                </div>

                <div className="magic-body">
                    {!preview ? (
                        <div className="input-stage">
                            <p className="instruction">
                                Paste a link, a quote, or a messy thought. The AI will structure it for you.
                            </p>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="e.g., 'Read Dune by Frank Herbert, amazing sci-fi book from 1965...'"
                                rows={6}
                                autoFocus
                            />
                            <div className="actions">
                                {error && <div className="error-msg"><AlertTriangle size={16} /> {error}</div>}
                                <button
                                    className="analyze-btn"
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || !input.trim()}
                                >
                                    {isAnalyzing ? <><Loader2 className="spin" size={18} /> Processing...</> : <><Sparkles size={18} /> Construe</>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="preview-stage">
                            <div className="preview-card">
                                <div className="preview-header">
                                    <span className="type-badge">{preview.type?.toUpperCase()}</span>
                                    <h3>{preview.title}</h3>
                                </div>
                                <div className="preview-content">
                                    <p className="section-label">Summary</p>
                                    <div className="preview-summary" dangerouslySetInnerHTML={{ __html: preview.content || '' }} />

                                    <p className="section-label">Extracted Properties</p>
                                    <div className="preview-props">
                                        {Object.entries(preview.properties || {}).map(([key, val]) => (
                                            <div key={key} className="prop-row">
                                                <span className="prop-key">{key}:</span>
                                                <span className="prop-val">{String(val)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <p className="section-label">Tags</p>
                                    <div className="preview-tags">
                                        {preview.tags?.map(t => <span key={t} className="tag">#{t}</span>)}
                                    </div>
                                </div>
                            </div>

                            <div className="actions preview-actions">
                                <button className="secondary-btn" onClick={() => setPreview(null)}>
                                    Back
                                </button>
                                <button className="primary-btn" onClick={handleSave}>
                                    <Check size={18} /> Confirm Creation
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
