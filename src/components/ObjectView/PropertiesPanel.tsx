// PropertiesPanel - Display and edit object properties based on type definition
import { useCallback } from 'react';
import type { AstralObject, ObjectType, PropertyDefinition, PropertyValue } from '../../types/object';
import { useObjectStore } from '../../stores/objectStore';
import { useToast } from '../common';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
    object: AstralObject;
    objectType: ObjectType;
    onUpdate: (updates: Partial<AstralObject>) => void;
    onRelationClick?: (objectId: string) => void;
}

export const PropertiesPanel = ({ object, objectType, onUpdate, onRelationClick }: PropertiesPanelProps) => {
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);

    const handlePropertyChange = useCallback((propId: string, value: PropertyValue) => {
        onUpdate({
            properties: {
                ...object.properties,
                [propId]: value,
            },
        });
    }, [object.properties, onUpdate]);

    if (!objectType.properties || objectType.properties.length === 0) {
        return null;
    }

    const toast = useToast();

    return (
        <div className="properties-panel">
            <h3 className="properties-title">Propiedades</h3>
            <div className="properties-grid">
                {objectType.properties.map(prop => (
                    <PropertyInput
                        key={prop.id}
                        definition={prop}
                        value={object.properties[prop.id]}
                        currentObject={object}
                        currentObjectType={objectType}
                        onChange={(value) => handlePropertyChange(prop.id, value)}
                        objects={objects}
                        objectTypes={objectTypes}
                        onRelationClick={onRelationClick}
                        toast={toast}
                    />
                ))}
            </div>
        </div>
    );
};

// Individual property input component
interface PropertyInputProps {
    definition: PropertyDefinition;
    value: PropertyValue | undefined;
    currentObject: AstralObject;
    currentObjectType: ObjectType;
    onChange: (value: PropertyValue) => void;
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onRelationClick?: (objectId: string) => void;
    toast: ReturnType<typeof useToast>;
}

const PropertyInput = ({ definition, value, currentObject, currentObjectType, onChange, objects, objectTypes, onRelationClick, toast }: PropertyInputProps) => {

    // Calculate computed property value by traversing through relations
    const computedValue = (() => {
        if (!definition.computed || !definition.computedFrom) return null;

        const { throughProperty, collectProperty } = definition.computedFrom;
        const throughRelations = (currentObject.properties[throughProperty] as { id: string; title: string }[]) || [];

        // Collect all values from the collectProperty of each related object
        const collected: { id: string; title: string }[] = [];
        const seenIds = new Set<string>();

        for (const rel of throughRelations) {
            const relatedObj = objects.find(o => o.id === rel.id);
            if (relatedObj) {
                const collectedRels = (relatedObj.properties[collectProperty] as { id: string; title: string }[]) || [];
                for (const c of collectedRels) {
                    if (!seenIds.has(c.id)) {
                        seenIds.add(c.id);
                        collected.push(c);
                    }
                }
            }
        }

        return collected;
    })();

    const renderInput = () => {
        switch (definition.type) {
            case 'text':
                return (
                    <input
                        type="text"
                        value={(value as string) || ''}
                        onChange={e => onChange(e.target.value)}
                        placeholder={`Añadir ${definition.name.toLowerCase()}...`}
                        className="prop-input"
                    />
                );

            case 'number':
                return (
                    <input
                        type="number"
                        value={(value as number) ?? ''}
                        onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
                        placeholder="0"
                        className="prop-input"
                    />
                );

            case 'url':
                return (
                    <input
                        type="url"
                        value={(value as string) || ''}
                        onChange={e => onChange(e.target.value)}
                        placeholder="https://..."
                        className="prop-input"
                    />
                );

            case 'date':
                // Simple text input for date
                return (
                    <input
                        type="text"
                        value={(value as string) || ''}
                        onChange={e => onChange(e.target.value)}
                        placeholder="YYYY/MM/DD"
                        className="prop-input"
                    />
                );

            case 'datetime':
                // Datetime input - store as ISO string
                let datetimeValue = '';
                if (value) {
                    try {
                        let dateStr = '';

                        // Handle Firestore Timestamp
                        if (typeof value === 'object' && value !== null && 'seconds' in value) {
                            const ts = value as unknown as { seconds: number };
                            dateStr = new Date(ts.seconds * 1000).toISOString();
                        }
                        // Handle Date objects
                        else if (value instanceof Date) {
                            dateStr = value.toISOString();
                        }
                        // Handle string
                        else if (typeof value === 'string') {
                            dateStr = value;
                        }

                        if (dateStr) {
                            // Format for datetime-local input (YYYY-MM-DDTHH:mm)
                            datetimeValue = dateStr.slice(0, 16);
                        }
                    } catch {
                        // Invalid datetime
                    }
                }
                return (
                    <input
                        type="datetime-local"
                        value={datetimeValue}
                        onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
                        className="prop-input"
                    />
                );

            case 'email':
                return (
                    <input
                        type="email"
                        value={(value as string) || ''}
                        onChange={e => onChange(e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="prop-input"
                    />
                );

            case 'image':
                return (
                    <div className="prop-image">
                        {value && (
                            <img src={value as string} alt="" className="image-preview" />
                        )}
                        <input
                            type="url"
                            value={(value as string) || ''}
                            onChange={e => onChange(e.target.value)}
                            placeholder="URL de la imagen..."
                            className="prop-input"
                        />
                    </div>
                );

            case 'boolean':
                return (
                    <label className="prop-checkbox">
                        <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={e => onChange(e.target.checked)}
                        />
                        <span className="checkbox-label">{value ? 'Sí' : 'No'}</span>
                    </label>
                );

            case 'select':
                return (
                    <select
                        value={(value as string) || ''}
                        onChange={e => onChange(e.target.value)}
                        className="prop-select"
                    >
                        <option value="">Seleccionar...</option>
                        {definition.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                );

            case 'multiselect':
                const selectedValues = (value as string[]) || [];
                return (
                    <div className="prop-multiselect">
                        {definition.options?.map(opt => (
                            <label key={opt} className="multiselect-option">
                                <input
                                    type="checkbox"
                                    checked={selectedValues.includes(opt)}
                                    onChange={e => {
                                        if (e.target.checked) {
                                            onChange([...selectedValues, opt]);
                                        } else {
                                            onChange(selectedValues.filter(v => v !== opt));
                                        }
                                    }}
                                />
                                <span>{opt}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'rating':
                const ratingValue = (value as number) || 0;
                return (
                    <div className="prop-rating">
                        {[1, 2, 3, 4, 5].map(star => (
                            <button
                                key={star}
                                className={`rating-star ${star <= ratingValue ? 'filled' : ''}`}
                                onClick={() => onChange(star === ratingValue ? 0 : star)}
                            >
                                {star <= ratingValue ? '★' : '☆'}
                            </button>
                        ))}
                    </div>
                );

            case 'relation':
                // Support multiple relation types or any type if not specified
                const relationTypeIds = definition.relationTypeId
                    ? definition.relationTypeId.split(',').map(s => s.trim())
                    : [];
                const allowAnyType = relationTypeIds.length === 0 || relationTypeIds.includes('any');

                const relatedObjects = allowAnyType
                    ? objects
                    : objects.filter(o => relationTypeIds.includes(o.type));

                const currentRelations = (value as { id: string; title: string }[]) || [];
                const selectedIds = currentRelations.map(r => r.id);

                // Group objects by type for better UX
                const groupedByType: Record<string, AstralObject[]> = {};
                for (const obj of relatedObjects.filter(o => !selectedIds.includes(o.id))) {
                    if (!groupedByType[obj.type]) groupedByType[obj.type] = [];
                    groupedByType[obj.type].push(obj);
                }

                return (
                    <div className="prop-relation">
                        <select
                            value=""
                            onChange={e => {
                                if (e.target.value) {
                                    const obj = objects.find(o => o.id === e.target.value);
                                    if (obj && !selectedIds.includes(obj.id)) {
                                        onChange([...currentRelations, { id: obj.id, title: obj.title }]);
                                    }
                                    e.target.value = '';
                                }
                            }}
                            className="prop-select"
                        >
                            <option value="">Añadir relación...</option>
                            {Object.entries(groupedByType).map(([typeId, objs]) => {
                                const type = objectTypes.find(t => t.id === typeId);
                                return (
                                    <optgroup key={typeId} label={`${type?.icon || '📄'} ${type?.namePlural || typeId}`}>
                                        {objs.map(obj => (
                                            <option key={obj.id} value={obj.id}>
                                                {obj.title}
                                            </option>
                                        ))}
                                    </optgroup>
                                );
                            })}
                        </select>
                        {currentRelations.length > 0 && (
                            <div className="relation-tags">
                                {currentRelations.map(rel => {
                                    const relObj = objects.find(o => o.id === rel.id);
                                    const relType = relObj ? objectTypes.find(t => t.id === relObj.type) : null;
                                    return (
                                        <span
                                            key={rel.id}
                                            className={`relation-tag ${onRelationClick ? 'clickable' : ''}`}
                                            style={{ '--type-color': relType?.color || '#6366f1' } as React.CSSProperties}
                                            onClick={() => onRelationClick?.(rel.id)}
                                            role={onRelationClick ? 'button' : undefined}
                                            tabIndex={onRelationClick ? 0 : undefined}
                                            onKeyDown={(e) => {
                                                if (onRelationClick && (e.key === 'Enter' || e.key === ' ')) {
                                                    e.preventDefault();
                                                    onRelationClick(rel.id);
                                                }
                                            }}
                                        >
                                            {relType?.icon || '📄'} {rel.title}
                                            <button
                                                className="relation-remove"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onChange(currentRelations.filter(r => r.id !== rel.id));
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );

            case 'tags':
                const tags = (value as string[]) || [];
                return (
                    <div className="prop-tags">
                        <div className="tags-list">
                            {tags.map((tag, index) => (
                                <span key={index} className="tag">
                                    {tag}
                                    <button
                                        className="tag-remove"
                                        onClick={() => onChange(tags.filter((_, i) => i !== index))}
                                    >
                                        ✕
                                    </button>
                                </span>
                            ))}
                        </div>
                        <input
                            type="text"
                            placeholder="Añadir etiqueta..."
                            className="prop-input tag-input"
                            onKeyDown={e => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                    const newTag = e.currentTarget.value.trim();
                                    if (!tags.includes(newTag)) {
                                        onChange([...tags, newTag]);
                                    }
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    </div>
                );

            default:
                return <span className="prop-unsupported">Tipo no soportado</span>;
        }
    };

    // Render computed property as read-only
    if (definition.computed && computedValue !== null) {
        // Build info message for toast
        const handleShowComputedInfo = () => {
            const throughPropDef = currentObjectType.properties?.find(p => p.id === definition.computedFrom?.throughProperty);
            const throughPropName = throughPropDef?.name || 'desconocida';

            // Get target type name
            let targetTypeName = 'objetos';
            if (throughPropDef?.linkedTypeId) {
                const targetType = objectTypes.find(t => t.id === throughPropDef.linkedTypeId);
                targetTypeName = targetType?.namePlural || targetType?.name || 'objetos';
            } else if (throughPropDef?.relationTypeId && throughPropDef.relationTypeId !== 'any') {
                const typeIds = throughPropDef.relationTypeId.split(',');
                const targetType = objectTypes.find(t => t.id === typeIds[0]);
                targetTypeName = targetType?.namePlural || targetType?.name || 'objetos';
            }

            // Get collect property name
            const collectPropId = definition.computedFrom?.collectProperty;
            let collectPropName = 'desconocida';
            for (const type of objectTypes) {
                const prop = type.properties?.find(p => p.id === collectPropId);
                if (prop) {
                    collectPropName = prop.name;
                    break;
                }
            }

            toast.info(
                'Propiedad calculada',
                `A través de "${throughPropName}" se recogen las "${collectPropName}" de ${targetTypeName}.`
            );
        };

        return (
            <div className="property-row computed">
                <label className="property-label">
                    {definition.name}
                    <button
                        className="computed-indicator"
                        onClick={handleShowComputedInfo}
                        title="Propiedad calculada - clic para más info"
                    >
                        ƒ
                    </button>
                </label>
                <div className="property-value">
                    {computedValue.length > 0 ? (
                        <div className="relation-tags computed-tags">
                            {computedValue.map(rel => {
                                const relObj = objects.find(o => o.id === rel.id);
                                const relType = relObj ? objectTypes.find(t => t.id === relObj.type) : null;
                                return (
                                    <span
                                        key={rel.id}
                                        className={`relation-tag computed-relation ${onRelationClick ? 'clickable' : ''}`}
                                        style={{ '--type-color': relType?.color || '#6366f1' } as React.CSSProperties}
                                        onClick={() => onRelationClick?.(rel.id)}
                                        role={onRelationClick ? 'button' : undefined}
                                        tabIndex={onRelationClick ? 0 : undefined}
                                        onKeyDown={(e) => {
                                            if (onRelationClick && (e.key === 'Enter' || e.key === ' ')) {
                                                e.preventDefault();
                                                onRelationClick(rel.id);
                                            }
                                        }}
                                    >
                                        {relType?.icon || '📄'} {rel.title}
                                    </span>
                                );
                            })}
                        </div>
                    ) : (
                        <span className="computed-empty">Sin elementos</span>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="property-row">
            <label className="property-label">{definition.name}</label>
            <div className="property-value">
                {renderInput()}
            </div>
        </div>
    );
};
