// TypeEditorModal - Create/edit object types with properties
import { useState, useEffect } from 'react';
import type { ObjectType, PropertyDefinition, PropertyType } from '../../types/object';
import { useObjectStore } from '../../stores/objectStore';
import { useToast, IconPicker, LucideIcon } from '../common';
import './TypeEditorModal.css';

interface TypeEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingType?: ObjectType | null;
}

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
    { value: 'text', label: 'Texto' },
    { value: 'number', label: 'Número' },
    { value: 'date', label: 'Fecha' },
    { value: 'datetime', label: 'Fecha y hora' },
    { value: 'email', label: 'Email' },
    { value: 'url', label: 'URL' },
    { value: 'image', label: 'Imagen' },
    { value: 'boolean', label: 'Sí/No' },
    { value: 'select', label: 'Selector' },
    { value: 'multiselect', label: 'Multi-selector' },
    { value: 'relation', label: 'Relación' },
    { value: 'rating', label: 'Valoración' },
    { value: 'tags', label: 'Etiquetas' },
];

const COLOR_SUGGESTIONS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#a855f7'];

export const TypeEditorModal = ({ isOpen, onClose, editingType }: TypeEditorModalProps) => {
    const createObjectType = useObjectStore(s => s.createObjectType);
    const updateObjectType = useObjectStore(s => s.updateObjectType);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const toast = useToast();

    const [name, setName] = useState('');
    const [namePlural, setNamePlural] = useState('');
    const [icon, setIcon] = useState('📄');
    const [color, setColor] = useState('#6366f1');
    const [properties, setProperties] = useState<PropertyDefinition[]>([]);
    const [template, setTemplate] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize form when editing
    useEffect(() => {
        if (editingType) {
            setName(editingType.name);
            setNamePlural(editingType.namePlural);
            setIcon(editingType.icon);
            setColor(editingType.color);
            setProperties(editingType.properties || []);
            setTemplate(editingType.template || '');
        } else {
            setName('');
            setNamePlural('');
            setIcon('FileText');
            setColor('#6366f1');
            setProperties([]);
            setTemplate('');
        }
        setError(null);
    }, [editingType, isOpen]);

    const handleAddProperty = () => {
        const newProp: PropertyDefinition = {
            id: `prop-${Date.now()}`,
            name: '',
            type: 'text',
        };
        setProperties([...properties, newProp]);
    };

    const handleUpdateProperty = (index: number, updates: Partial<PropertyDefinition>) => {
        const newProperties = [...properties];
        newProperties[index] = { ...newProperties[index], ...updates };
        setProperties(newProperties);
    };

    const handleDeleteProperty = (index: number) => {
        setProperties(properties.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('El nombre es obligatorio');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // Clean properties - remove undefined values that Firestore rejects
            const cleanedProperties = properties.filter(p => p.name.trim()).map(p => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cleaned: any = {
                    id: p.id,
                    name: p.name,
                    type: p.type,
                };
                if (p.required !== undefined) cleaned.required = p.required;
                if (p.options !== undefined) cleaned.options = p.options;
                if (p.relationTypeId !== undefined) cleaned.relationTypeId = p.relationTypeId;
                if (p.defaultValue !== undefined) cleaned.defaultValue = p.defaultValue;
                if (p.twoWayLinked !== undefined) cleaned.twoWayLinked = p.twoWayLinked;
                if (p.linkedTypeId !== undefined) cleaned.linkedTypeId = p.linkedTypeId;
                if (p.linkedPropertyId !== undefined) cleaned.linkedPropertyId = p.linkedPropertyId;
                if (p.computed !== undefined) cleaned.computed = p.computed;
                if (p.computedFrom !== undefined && p.computedFrom.throughProperty && p.computedFrom.collectProperty) {
                    cleaned.computedFrom = p.computedFrom;
                }
                return cleaned as PropertyDefinition;
            });

            const typeData = {
                name: name.trim(),
                namePlural: namePlural.trim() || `${name.trim()}s`,
                icon,
                color,
                properties: cleanedProperties,
                template,
            };

            if (editingType) {
                await updateObjectType(editingType.id, typeData);
                toast.success('Tipo actualizado', `"${typeData.name}" ha sido actualizado correctamente.`);
            } else {
                await createObjectType(typeData);
                toast.success('Tipo creado', `"${typeData.name}" ha sido creado correctamente.`);
            }

            onClose();
        } catch (err) {
            setError((err as Error).message);
            toast.error('Error', (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="type-editor-modal" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h2>{editingType ? 'Editar tipo' : 'Nuevo tipo de objeto'}</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </header>

                <div className="modal-body">
                    {/* Basic Info */}
                    <section className="modal-section">
                        <div className="type-basic-info">
                            <div className="icon-color-row">
                                <div className="field-group">
                                    <label>Icono</label>
                                    <IconPicker
                                        selectedIcon={icon}
                                        color={color}
                                        onSelect={setIcon}
                                    />
                                </div>

                                <div className="field-group">
                                    <label>Color</label>
                                    <div className="color-selector">
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={e => setColor(e.target.value)}
                                            className="color-input"
                                        />
                                        <div className="color-presets">
                                            {COLOR_SUGGESTIONS.map(c => (
                                                <button
                                                    key={c}
                                                    className={`color-preset ${color === c ? 'selected' : ''}`}
                                                    style={{ background: c }}
                                                    onClick={() => setColor(c)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="name-fields">
                                <div className="field-group">
                                    <label>Nombre (singular)</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Ej: Libro"
                                    />
                                </div>

                                <div className="field-group">
                                    <label>Nombre (plural)</label>
                                    <input
                                        type="text"
                                        value={namePlural}
                                        onChange={e => setNamePlural(e.target.value)}
                                        placeholder="Ej: Libros"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Properties */}
                    <section className="modal-section">
                        <h3>Propiedades</h3>
                        <div className="properties-list">
                            {properties.map((prop, index) => (
                                <div key={prop.id} className="property-row">
                                    <input
                                        type="text"
                                        value={prop.name}
                                        onChange={e => handleUpdateProperty(index, { name: e.target.value })}
                                        placeholder="Nombre de propiedad"
                                        className="property-name"
                                    />
                                    <select
                                        value={prop.type}
                                        onChange={e => handleUpdateProperty(index, { type: e.target.value as PropertyType })}
                                        className="property-type"
                                    >
                                        {PROPERTY_TYPES.map(pt => (
                                            <option key={pt.value} value={pt.value}>{pt.label}</option>
                                        ))}
                                    </select>

                                    {/* Type-specific config */}
                                    {(prop.type === 'select' || prop.type === 'multiselect') && (
                                        <input
                                            type="text"
                                            defaultValue={prop.options?.join(', ') || ''}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    const target = e.target as HTMLInputElement;
                                                    handleUpdateProperty(index, {
                                                        options: target.value.split(',').map(s => s.trim()).filter(Boolean)
                                                    });
                                                }
                                            }}
                                            onBlur={e => {
                                                handleUpdateProperty(index, {
                                                    options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                                });
                                            }}
                                            placeholder="Opciones separadas por coma, pulsa Enter"
                                            className="property-options"
                                        />
                                    )}

                                    {prop.type === 'relation' && (
                                        <div className="relation-type-selector">
                                            <label className="relation-type-option">
                                                <input
                                                    type="checkbox"
                                                    checked={prop.relationTypeId === undefined || prop.relationTypeId === 'any'}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            handleUpdateProperty(index, { relationTypeId: 'any' });
                                                        } else {
                                                            // Set to empty string to indicate user wants to select specific types
                                                            // The list below will show when relationTypeId is not 'any' or undefined
                                                            handleUpdateProperty(index, { relationTypeId: objectTypes[0]?.id || '' });
                                                        }
                                                    }}
                                                />
                                                <span>Cualquier tipo</span>
                                            </label>
                                            {(prop.relationTypeId === undefined || prop.relationTypeId === 'any') ? null : (
                                                <div className="relation-types-list">
                                                    {objectTypes.map(t => {
                                                        const currentTypes = prop.relationTypeId?.split(',').map(s => s.trim()) || [];
                                                        const isSelected = currentTypes.includes(t.id);
                                                        return (
                                                            <label key={t.id} className="relation-type-option">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={e => {
                                                                        let newTypes: string[];
                                                                        if (e.target.checked) {
                                                                            newTypes = [...currentTypes.filter(id => id && id !== 'any'), t.id];
                                                                        } else {
                                                                            newTypes = currentTypes.filter(id => id !== t.id);
                                                                        }
                                                                        handleUpdateProperty(index, {
                                                                            relationTypeId: newTypes.length > 0 ? newTypes.join(',') : ''
                                                                        });
                                                                    }}
                                                                />
                                                                <LucideIcon name={t.icon} size={14} color={t.color} />
                                                                <span>{t.name}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Two-way linking configuration */}
                                            <div className="two-way-linking-section">
                                                <label className="relation-type-option two-way-toggle">
                                                    <input
                                                        type="checkbox"
                                                        checked={prop.twoWayLinked || false}
                                                        onChange={e => {
                                                            handleUpdateProperty(index, {
                                                                twoWayLinked: e.target.checked,
                                                                linkedTypeId: e.target.checked ? (prop.relationTypeId?.split(',')[0] || '') : undefined,
                                                                linkedPropertyId: undefined
                                                            });
                                                        }}
                                                    />
                                                    <span>🔗 Enlace bidireccional</span>
                                                </label>

                                                {prop.twoWayLinked && (
                                                    <div className="two-way-config">
                                                        <div className="two-way-field">
                                                            <label>Tipo destino:</label>
                                                            <select
                                                                value={prop.linkedTypeId || ''}
                                                                onChange={e => {
                                                                    handleUpdateProperty(index, {
                                                                        linkedTypeId: e.target.value,
                                                                        linkedPropertyId: ''
                                                                    });
                                                                }}
                                                                className="two-way-select"
                                                            >
                                                                <option value="">Seleccionar tipo...</option>
                                                                {objectTypes.map(t => (
                                                                    <option key={t.id} value={t.id}>
                                                                        {t.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {prop.linkedTypeId && (
                                                            <div className="two-way-field">
                                                                <label>Propiedad de enlace:</label>
                                                                <select
                                                                    value={prop.linkedPropertyId || ''}
                                                                    onChange={e => {
                                                                        handleUpdateProperty(index, {
                                                                            linkedPropertyId: e.target.value
                                                                        });
                                                                    }}
                                                                    className="two-way-select"
                                                                >
                                                                    <option value="">Seleccionar propiedad...</option>
                                                                    {(() => {
                                                                        const targetType = objectTypes.find(t => t.id === prop.linkedTypeId);
                                                                        const relationProps = targetType?.properties?.filter(p => p.type === 'relation') || [];
                                                                        return relationProps.map(p => (
                                                                            <option key={p.id} value={p.id}>
                                                                                {p.name}
                                                                            </option>
                                                                        ));
                                                                    })()}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Computed property configuration */}
                                    {prop.type === 'relation' && (
                                        <div className="computed-property-section">
                                            <label className="relation-type-option computed-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={prop.computed || false}
                                                    onChange={e => {
                                                        handleUpdateProperty(index, {
                                                            computed: e.target.checked,
                                                            computedFrom: e.target.checked ? { throughProperty: '', collectProperty: '' } : undefined
                                                        });
                                                    }}
                                                />
                                                <span>📊 Propiedad calculada</span>
                                            </label>

                                            {prop.computed && (
                                                <div className="computed-config">
                                                    <div className="computed-field">
                                                        <label>A través de:</label>
                                                        <select
                                                            value={prop.computedFrom?.throughProperty || ''}
                                                            onChange={e => {
                                                                handleUpdateProperty(index, {
                                                                    computedFrom: {
                                                                        throughProperty: e.target.value,
                                                                        collectProperty: prop.computedFrom?.collectProperty || ''
                                                                    }
                                                                });
                                                            }}
                                                            className="computed-select"
                                                        >
                                                            <option value="">Seleccionar propiedad...</option>
                                                            {properties.filter(p => p.type === 'relation' && p.id !== prop.id && !p.computed).map(p => (
                                                                <option key={p.id} value={p.id}>
                                                                    {p.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {prop.computedFrom?.throughProperty && (
                                                        <div className="computed-field">
                                                            <label>Recoger:</label>
                                                            <select
                                                                value={prop.computedFrom?.collectProperty || ''}
                                                                onChange={e => {
                                                                    handleUpdateProperty(index, {
                                                                        computedFrom: {
                                                                            throughProperty: prop.computedFrom?.throughProperty || '',
                                                                            collectProperty: e.target.value
                                                                        }
                                                                    });
                                                                }}
                                                                className="computed-select"
                                                            >
                                                                <option value="">Seleccionar propiedad...</option>
                                                                {(() => {
                                                                    // Find the through property to get its target type
                                                                    const throughProp = properties.find(p => p.id === prop.computedFrom?.throughProperty);
                                                                    if (!throughProp) return null;

                                                                    // Get target types - try relationTypeId first, then linkedTypeId for two-way links
                                                                    let targetTypeIds: string[] = [];

                                                                    if (throughProp.relationTypeId && throughProp.relationTypeId !== 'any') {
                                                                        targetTypeIds = throughProp.relationTypeId.split(',').map(s => s.trim()).filter(Boolean);
                                                                    } else if (throughProp.linkedTypeId) {
                                                                        // Use linkedTypeId if relationTypeId is 'any' but two-way link is configured
                                                                        targetTypeIds = [throughProp.linkedTypeId];
                                                                    } else {
                                                                        // If "Cualquier tipo" and no linkedTypeId, show all types' relation properties
                                                                        targetTypeIds = objectTypes.map(t => t.id);
                                                                    }

                                                                    // Collect all relation properties from target types
                                                                    const targetProps: { typeId: string; typeName: string; prop: typeof throughProp }[] = [];
                                                                    for (const typeId of targetTypeIds) {
                                                                        const targetType = objectTypes.find(t => t.id === typeId);
                                                                        if (targetType) {
                                                                            for (const tp of targetType.properties || []) {
                                                                                if (tp.type === 'relation') {
                                                                                    targetProps.push({ typeId, typeName: targetType.name, prop: tp });
                                                                                }
                                                                            }
                                                                        }
                                                                    }

                                                                    return targetProps.map(({ typeName, prop: tp }) => (
                                                                        <option key={tp.id} value={tp.id}>
                                                                            {typeName} → {tp.name}
                                                                        </option>
                                                                    ));
                                                                })()}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        className="property-delete"
                                        onClick={() => handleDeleteProperty(index)}
                                        title="Eliminar propiedad"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button className="add-property-btn" onClick={handleAddProperty}>
                            + Añadir propiedad
                        </button>
                    </section>

                    {/* Template */}
                    <section className="modal-section">
                        <h3>Plantilla (contenido inicial)</h3>
                        <textarea
                            value={template}
                            onChange={e => setTemplate(e.target.value)}
                            placeholder="Contenido que aparecerá por defecto al crear un nuevo objeto de este tipo..."
                            className="template-textarea"
                        />
                    </section>

                    {error && (
                        <div className="modal-error">{error}</div>
                    )}
                </div>

                <footer className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Guardando...' : (editingType ? 'Guardar cambios' : 'Crear tipo')}
                    </button>
                </footer>
            </div>
        </div>
    );
};
