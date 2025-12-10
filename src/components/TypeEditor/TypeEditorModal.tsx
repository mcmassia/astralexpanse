// TypeEditorModal - Create/edit object types with properties
import { useState, useEffect } from 'react';
import type { ObjectType, PropertyDefinition, PropertyType } from '../../types/object';
import { useObjectStore } from '../../stores/objectStore';
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

const EMOJI_SUGGESTIONS = ['📄', '👤', '📚', '💡', '🎯', '📅', '🏢', '📍', '🎬', '🎵', '🖼️', '🔗', '📝', '⭐', '🏷️', '📊', '💼', '🎓', '🏠', '🚗'];

const COLOR_SUGGESTIONS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#3b82f6', '#14b8a6', '#f97316', '#84cc16'];

export const TypeEditorModal = ({ isOpen, onClose, editingType }: TypeEditorModalProps) => {
    const createObjectType = useObjectStore(s => s.createObjectType);
    const updateObjectType = useObjectStore(s => s.updateObjectType);
    const objectTypes = useObjectStore(s => s.objectTypes);

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
            setIcon('📄');
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
            const typeData = {
                name: name.trim(),
                namePlural: namePlural.trim() || `${name.trim()}s`,
                icon,
                color,
                properties: properties.filter(p => p.name.trim()),
                template,
            };

            if (editingType) {
                await updateObjectType(editingType.id, typeData);
            } else {
                await createObjectType(typeData);
            }

            onClose();
        } catch (err) {
            setError((err as Error).message);
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
                                    <div className="emoji-selector">
                                        <button className="emoji-current" style={{ borderColor: color }}>
                                            {icon}
                                        </button>
                                        <div className="emoji-dropdown">
                                            {EMOJI_SUGGESTIONS.map(emoji => (
                                                <button
                                                    key={emoji}
                                                    className={`emoji-option ${icon === emoji ? 'selected' : ''}`}
                                                    onClick={() => setIcon(emoji)}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
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
                                                    checked={!prop.relationTypeId || prop.relationTypeId === 'any'}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            handleUpdateProperty(index, { relationTypeId: 'any' });
                                                        } else {
                                                            handleUpdateProperty(index, { relationTypeId: '' });
                                                        }
                                                    }}
                                                />
                                                <span>Cualquier tipo</span>
                                            </label>
                                            {(!prop.relationTypeId || prop.relationTypeId === 'any') ? null : (
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
                                                                <span>{t.icon} {t.name}</span>
                                                            </label>
                                                        );
                                                    })}
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
