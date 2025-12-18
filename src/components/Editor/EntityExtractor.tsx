import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Calendar, User, CheckSquare, BrainCircuit } from 'lucide-react';
import { aiService } from '../../services/ai';
import { useObjectStore } from '../../stores/objectStore';
import { useToast } from '../common';
import './EntityExtractor.css';

interface EntityExtractorProps {
    content: string;
    onClose: () => void;
}

interface ExtractedEntity {
    type: 'task' | 'event' | 'person';
    title: string;
    details?: Record<string, any>;
    originalText?: string;
}

export const EntityExtractor: React.FC<EntityExtractorProps> = ({ content, onClose }) => {
    const [analyzing, setAnalyzing] = useState(true);
    const [entities, setEntities] = useState<ExtractedEntity[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [processing, setProcessing] = useState(false);

    const { createObject } = useObjectStore();
    const toast = useToast();

    useEffect(() => {
        const analyze = async () => {
            try {
                // Strip HTML tags for analysis
                const textContent = content.replace(/<[^>]*>/g, ' ');
                if (!textContent.trim()) {
                    setEntities([]);
                    setAnalyzing(false);
                    return;
                }

                const result = await aiService.extractEntities(textContent);
                setEntities(result);
                // Select all by default
                setSelectedIndices(new Set(result.map((_, i) => i)));
            } catch (e) {
                console.error(e);
                toast.error('Error', 'Failed to extract entities');
            } finally {
                setAnalyzing(false);
            }
        };

        analyze();
    }, [content]);

    const toggleSelection = (index: number) => {
        const next = new Set(selectedIndices);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        setSelectedIndices(next);
    };

    const handleProcess = async () => {
        setProcessing(true);
        let createdCount = 0;

        try {
            const selectedEntities = entities.filter((_, i) => selectedIndices.has(i));

            for (const entity of selectedEntities) {
                let typeId = 'note';
                let props: Record<string, any> = {};

                // Map abstract types to actual Object IDs in the system
                // Assuming 'task', 'event', 'person' exist as type IDs or similar
                // Adjust these IDs based on actual DEFAULT_OBJECT_TYPES
                switch (entity.type) {
                    case 'task':
                        typeId = 'task'; // Ensure this matches actual id
                        props = { status: 'todo', ...entity.details };
                        break;
                    case 'event':
                        typeId = 'event'; // Ensure this matches actual id
                        props = { ...entity.details };
                        break;
                    case 'person':
                        typeId = 'person'; // Ensure this matches actual id
                        props = { ...entity.details };
                        break;
                }

                await createObject(
                    typeId,
                    entity.title,
                    entity.originalText ? `Context: "${entity.originalText}"` : '', // Content
                    false, // Auto-select false
                    props
                );
                createdCount++;
            }

            toast.success('Success', `Created ${createdCount} objects.`);
            onClose();
        } catch (e) {
            console.error(e);
            toast.error('Error', 'Failed to create objects');
        } finally {
            setProcessing(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'task': return <CheckSquare size={16} />;
            case 'event': return <Calendar size={16} />;
            case 'person': return <User size={16} />;
            default: return <BrainCircuit size={16} />;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'task': return '#ef4444'; // Red for tasks/action
            case 'event': return '#f59e0b'; // Amber for calendar
            case 'person': return '#3b82f6'; // Blue for people
            default: return '#64748b';
        }
    };

    return (
        <div className="entity-extractor-overlay" onClick={onClose}>
            <div className="entity-extractor-modal" onClick={e => e.stopPropagation()}>
                <div className="ee-header">
                    <h3>
                        <BrainCircuit size={20} />
                        Entity Extractor
                    </h3>
                    <button className="ee-close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="ee-content">
                    {analyzing ? (
                        <div className="ee-loading">
                            <Loader2 className="animate-spin" size={32} />
                            <p>Analyzing content with AI...</p>
                        </div>
                    ) : entities.length === 0 ? (
                        <div className="ee-empty">
                            <p>No entities found in this text.</p>
                        </div>
                    ) : (
                        <div className="ee-list">
                            <p className="ee-description">Select entities to create:</p>
                            {entities.map((entity, idx) => (
                                <div
                                    key={idx}
                                    className={`ee-item ${selectedIndices.has(idx) ? 'selected' : ''}`}
                                    onClick={() => toggleSelection(idx)}
                                    style={{ '--type-color': getColor(entity.type) } as React.CSSProperties}
                                >
                                    <div className="ee-checkbox">
                                        {selectedIndices.has(idx) && <Check size={14} />}
                                    </div>
                                    <div className="ee-item-icon" style={{ color: getColor(entity.type) }}>
                                        {getIcon(entity.type)}
                                    </div>
                                    <div className="ee-item-details">
                                        <div className="ee-item-title">{entity.title}</div>
                                        <div className="ee-item-type">{entity.type.toUpperCase()}</div>
                                        {entity.originalText && (
                                            <div className="ee-item-context">"{entity.originalText}"</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="ee-footer">
                    <button className="ee-cancel-btn" onClick={onClose}>Cancel</button>
                    <button
                        className="ee-confirm-btn"
                        onClick={handleProcess}
                        disabled={analyzing || processing || entities.length === 0 || selectedIndices.size === 0}
                    >
                        {processing ? (
                            <>
                                <Loader2 className="animate-spin" size={16} /> Creating...
                            </>
                        ) : (
                            `Create ${selectedIndices.size} Objects`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
