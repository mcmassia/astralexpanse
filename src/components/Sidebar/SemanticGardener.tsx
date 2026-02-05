import React, { useMemo } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useAIStore } from '../../stores/aiStore';
import { Network, Tag } from 'lucide-react';
import './SemanticGardener.css';

// Cosine similarity helper
const cosineSimilarity = (vecA: number[], vecB: number[]) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const SemanticGardener: React.FC = () => {
    const { isEnabled, featureFlags } = useAIStore();
    const { objects, selectedObjectId, selectObject } = useObjectStore();

    const selectedObject = objects.find(o => o.id === selectedObjectId);

    const suggestions = useMemo(() => {
        if (!selectedObject || !selectedObject.embedding || !isEnabled || !featureFlags.semanticGardener) return [];

        const candidates = objects.filter(o =>
            o.id !== selectedObject.id &&
            o.embedding &&
            !selectedObject.links.includes(o.id) // Exclude already linked
        );

        const scored = candidates.map(obj => ({
            obj,
            score: cosineSimilarity(selectedObject.embedding!, obj.embedding!)
        }));

        // Sort by score desc
        return scored
            .filter(s => s.score > 0.70) // Threshold
            .sort((a, b) => b.score - a.score)
            .slice(0, 5); // Top 5
    }, [selectedObject, objects, isEnabled]);

    const suggestedTags = useMemo(() => {
        if (suggestions.length === 0) return [];

        // Collect tags from top 3 similar objects
        const tags = new Set<string>();
        suggestions.slice(0, 3).forEach(s => {
            s.obj.tags.forEach(t => {
                if (!selectedObject?.tags.includes(t)) {
                    tags.add(t);
                }
            });
        });

        return Array.from(tags).slice(0, 5);
    }, [suggestions, selectedObject]);

    if (!isEnabled || !featureFlags.semanticGardener) {
        return (
            <div className="semantic-gardener disabled">
                <p>AI Gardener is disabled.</p>
            </div>
        );
    }

    if (!selectedObject) return null;

    return (
        <div className="semantic-gardener">
            <div className="sg-header">
                <Network size={16} className="sg-icon" />
                <h3>Semantic Gardener</h3>
            </div>

            <div className="sg-content">
                {!selectedObject.embedding ? (
                    <p className="sg-hint">Generating semantic map...</p>
                ) : suggestions.length === 0 ? (
                    <p className="sg-hint">No close connections found yet.</p>
                ) : (
                    <>
                        <div className="sg-section">
                            <h4>Suggested Links</h4>
                            <ul className="sg-list">
                                {suggestions.map(({ obj, score }) => (
                                    <li key={obj.id} className="sg-item" onClick={() => selectObject(obj.id)}>
                                        <div className="sg-item-header">
                                            <span className="sg-item-title">{obj.title}</span>
                                            <span className="sg-score">{Math.round(score * 100)}%</span>
                                        </div>
                                        <p className="sg-snippet">
                                            {/* Simple snippet logic, take first 50 chars */}
                                            {obj.content.replace(/<[^>]*>/g, '').slice(0, 60)}...
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {suggestedTags.length > 0 && (
                            <div className="sg-section">
                                <h4>Suggested Tags</h4>
                                <div className="sg-tags">
                                    {suggestedTags.map(tag => (
                                        <span key={tag} className="sg-tag">
                                            <Tag size={10} /> {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
