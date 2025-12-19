// TypeEditorModal - Create/edit object types with properties
import { useState, useEffect } from 'react';
import type { ObjectType, PropertyDefinition, PropertyType } from '../../types/object';
import { useObjectStore } from '../../stores/objectStore';
import { useToast, IconPicker, LucideIcon, ConfirmDialog } from '../common';
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
    const deleteObjectType = useObjectStore(s => s.deleteObjectType);
    const countObjectsByType = useObjectStore(s => s.objects).reduce((acc, obj) => {
        acc[obj.type] = (acc[obj.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const toast = useToast();

    // Form State
    const [name, setName] = useState('');
    const [namePlural, setNamePlural] = useState('');
    const [icon, setIcon] = useState('FileText');
    const [color, setColor] = useState('#6366f1');
    const [properties, setProperties] = useState<PropertyDefinition[]>([]);
    const [template, setTemplate] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // UI State
    const [activeTab, setActiveTab] = useState<'properties' | 'template'>('properties');
    const [activePopover, setActivePopover] = useState<string | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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
        setActiveTab('properties');
    }, [editingType, isOpen]);

    // Close popovers on click outside
    useEffect(() => {
        const handleClickOutside = () => setActivePopover(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

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

    const handleMoveProperty = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === properties.length - 1) return;

        const newProperties = [...properties];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        [newProperties[index], newProperties[targetIndex]] = [newProperties[targetIndex], newProperties[index]];
        setProperties(newProperties);
    };

    const handleDeleteProperty = (index: number) => {
        setProperties(properties.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('El nombre es obligatorio');
            setActiveTab('properties');
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

    const handleDeleteType = () => {
        if (!editingType) return;

        // Double check usage
        const count = countObjectsByType[editingType.id] || 0;
        if (count > 0) {
            setError(`No se puede eliminar este tipo porque hay ${count} objeto(s) usándolo. Elimina los objetos primero.`);
            return;
        }

        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteType = async () => {
        if (!editingType) return;

        setIsSaving(true);
        try {
            await deleteObjectType(editingType.id);
            toast.success('Tipo eliminado', `"${editingType.name}" ha sido eliminado correctamente.`);
            setIsDeleteConfirmOpen(false);
            onClose();
        } catch (err) {
            setError((err as Error).message);
            toast.error('Error', (err as Error).message);
            setIsDeleteConfirmOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    // --- Render Helpers ---

    const renderConfigurationCell = (prop: PropertyDefinition, index: number) => {
        switch (prop.type) {
            case 'select':
            case 'multiselect':
                return (
                    <div className="config-chips">
                        {prop.options?.map((opt, optIndex) => (
                            <span key={optIndex} className="config-chip">
                                {opt}
                                <span
                                    className="chip-remove"
                                    onClick={() => {
                                        const newOptions = prop.options?.filter((_, i) => i !== optIndex);
                                        handleUpdateProperty(index, { options: newOptions });
                                    }}
                                >×</span>
                            </span>
                        ))}
                        <input
                            type="text"
                            placeholder={prop.options?.length ? "+ Opción" : "Añadir opciones..."}
                            className="config-input-ghost"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (e.target as HTMLInputElement).value.trim();
                                    if (val) {
                                        handleUpdateProperty(index, {
                                            options: [...(prop.options || []), val]
                                        });
                                        (e.target as HTMLInputElement).value = '';
                                    }
                                }
                            }}
                        />
                    </div>
                );

            case 'relation':
                return (
                    <div className="relation-config" onClick={e => e.stopPropagation()}>
                        <div className="relation-badges">
                            {(!prop.relationTypeId || prop.relationTypeId === 'any') ? (
                                <span className="relation-badge" style={{ '--badge-color': '#64748b' } as React.CSSProperties}>
                                    Cualquier tipo
                                </span>
                            ) : (
                                prop.relationTypeId.split(',').map(typeId => {
                                    const type = objectTypes.find(t => t.id === typeId);
                                    return (
                                        <span
                                            key={typeId}
                                            className="relation-badge"
                                            style={{ '--badge-color': type?.color || '#64748b' } as React.CSSProperties}
                                        >
                                            {type?.name || typeId}
                                        </span>
                                    );
                                })
                            )}
                        </div>

                        {/* Type Selector Trigger */}
                        <button
                            className={`relation-popover-trigger ${activePopover === `rel-${prop.id}` ? 'active' : ''}`}
                            onClick={() => {
                                // Close others, toggle this one
                                setActivePopover(prev => prev === `rel-${prop.id}` ? null : `rel-${prop.id}`);
                            }}
                            title="Configurar tipos permitidos"
                        >
                            ⚙️
                        </button>

                        {/* Popover */}
                        {activePopover === `rel-${prop.id}` && (
                            <div className="relation-popover" onClick={e => e.stopPropagation()}>
                                <div className="popover-section">
                                    <div className="popover-header">Tipos permitidos</div>
                                    <div className="relation-list">
                                        <label className="relation-option">
                                            <input
                                                type="checkbox"
                                                checked={!prop.relationTypeId || prop.relationTypeId === 'any'}
                                                onChange={e => {
                                                    handleUpdateProperty(index, {
                                                        relationTypeId: e.target.checked ? 'any' : objectTypes[0]?.id
                                                    });
                                                }}
                                            />
                                            <span>Cualquier tipo</span>
                                        </label>

                                        {prop.relationTypeId !== 'any' && objectTypes.map(t => (
                                            <label key={t.id} className="relation-option">
                                                <input
                                                    type="checkbox"
                                                    checked={prop.relationTypeId?.split(',').includes(t.id)}
                                                    onChange={e => {
                                                        const current = prop.relationTypeId?.split(',').filter(x => x && x !== 'any') || [];
                                                        let next;
                                                        if (e.target.checked) {
                                                            next = [...current, t.id];
                                                        } else {
                                                            next = current.filter(id => id !== t.id);
                                                        }
                                                        handleUpdateProperty(index, {
                                                            relationTypeId: next.length ? next.join(',') : ''
                                                        });
                                                    }}
                                                />
                                                <LucideIcon name={t.icon} size={14} color={t.color} />
                                                <span>{t.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="popover-section">
                                    <div className="popover-header">Avanzado</div>
                                    <label className="relation-option">
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
                                        <span>Propiedad calculada</span>
                                    </label>
                                    <label className="relation-option">
                                        <input
                                            type="checkbox"
                                            checked={prop.twoWayLinked || false}
                                            onChange={e => {
                                                handleUpdateProperty(index, {
                                                    twoWayLinked: e.target.checked,
                                                    linkedTypeId: e.target.checked ? (prop.relationTypeId?.split(',')[0] || '') : undefined
                                                });
                                            }}
                                        />
                                        <span>Enlace bidireccional</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'text':
            case 'number':
            case 'url':
            case 'email':
                return (
                    <input
                        type="text"
                        className="config-placeholder"
                        placeholder="Valor por defecto (opcional)"
                        value={prop.defaultValue as string || ''}
                        onChange={e => handleUpdateProperty(index, { defaultValue: e.target.value })}
                    />
                );

            default:
                return <span className="config-placeholder">Sin configuración</span>;
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="type-editor-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="modal-header">
                    <div className="header-title-row">
                        <h2>{editingType ? 'Editar tipo' : 'Nuevo tipo'}</h2>
                        {(name || icon) && (
                            <div className="type-preview-badge">
                                <LucideIcon name={icon} size={16} color={color} />
                                <span>{name || 'Sin nombre'}</span>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {editingType && (
                            <button
                                className="modal-header-action delete"
                                onClick={handleDeleteType}
                                title="Eliminar tipo"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    padding: '0.25rem'
                                }}
                            >
                                🗑️
                            </button>
                        )}
                        <button className="modal-close" onClick={onClose}>✕</button>
                    </div>
                </header>

                {/* Tabs */}
                <div className="type-editor-tabs">
                    <button
                        className={`tab-button ${activeTab === 'properties' ? 'active' : ''}`}
                        onClick={() => setActiveTab('properties')}
                    >
                        Propiedades
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'template' ? 'active' : ''}`}
                        onClick={() => setActiveTab('template')}
                    >
                        Plantilla
                    </button>
                </div>

                {/* Body Content */}
                <div className="modal-body">
                    {activeTab === 'properties' && (
                        <>
                            {/* Basic Info Section - Moved here */}
                            <div className="type-basic-info-layout">
                                <div className="info-row">
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
                                        <div className="color-field-row">
                                            <input
                                                type="color"
                                                value={color}
                                                onChange={e => setColor(e.target.value)}
                                                className="color-input-small"
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
                                <div className="info-row name-row">
                                    <div className="field-group flex-1">
                                        <label>Nombre (singular)</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Ej: Idea"
                                            className="name-input"
                                        />
                                    </div>
                                    <div className="field-group flex-1">
                                        <label>Nombre (plural)</label>
                                        <input
                                            type="text"
                                            value={namePlural}
                                            onChange={e => setNamePlural(e.target.value)}
                                            placeholder="Ej: Ideas"
                                            className="name-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="properties-section-title">PROPIEDADES</div>

                            <div className="properties-table">
                                {/* Header */}
                                <div className="prop-table-header">
                                    <div className="prop-header-cell">Etiqueta</div>
                                    <div className="prop-header-cell">Tipo</div>
                                    <div className="prop-header-cell">Requerido</div>
                                    <div className="prop-header-cell">Configuración</div>
                                    <div className="prop-header-cell"></div>
                                </div>

                                {/* Rows */}
                                {properties.map((prop, index) => (
                                    <div key={prop.id} className="prop-table-row">
                                        <div className="prop-cell">
                                            <input
                                                type="text"
                                                value={prop.name}
                                                onChange={e => handleUpdateProperty(index, { name: e.target.value })}
                                                placeholder="Nombre de la propiedad"
                                            />
                                        </div>
                                        <div className="prop-cell">
                                            <select
                                                value={prop.type}
                                                onChange={e => handleUpdateProperty(index, { type: e.target.value as PropertyType })}
                                            >
                                                {PROPERTY_TYPES.map(pt => (
                                                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="prop-cell prop-cell-center">
                                            <input
                                                type="checkbox"
                                                checked={prop.required || false}
                                                onChange={e => handleUpdateProperty(index, { required: e.target.checked })}
                                            />
                                        </div>
                                        <div className="prop-cell">
                                            {renderConfigurationCell(prop, index)}
                                        </div>
                                        <div className="prop-cell prop-cell-center" style={{ gap: '0.25rem' }}>
                                            <button
                                                className="property-delete"
                                                onClick={() => handleMoveProperty(index, 'up')}
                                                disabled={index === 0}
                                                title="Mover arriba"
                                            >
                                                ↑
                                            </button>
                                            <button
                                                className="property-delete"
                                                onClick={() => handleMoveProperty(index, 'down')}
                                                disabled={index === properties.length - 1}
                                                title="Mover abajo"
                                            >
                                                ↓
                                            </button>
                                            <button
                                                className="property-delete"
                                                onClick={() => handleDeleteProperty(index)}
                                                title="Eliminar propiedad"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="add-property-row">
                                <button className="add-prop-ghost" onClick={handleAddProperty}>
                                    + Añadir nueva propiedad
                                </button>
                            </div>
                        </>
                    )}

                    {activeTab === 'template' && (
                        <div className="template-editor">
                            <div className="template-hint">
                                Esta plantilla se aplicará automáticamente al cuerpo de los nuevos objetos de este tipo.
                            </div>
                            <textarea
                                value={template}
                                onChange={e => setTemplate(e.target.value)}
                                placeholder="Escribe el contenido inicial..."
                                className="template-textarea"
                            />
                        </div>
                    )}
                </div>

                {
                    error && (
                        <div className="modal-error" style={{ margin: '0 1.5rem 1rem' }}>{error}</div>
                    )
                }

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
            </div >


            <ConfirmDialog
                isOpen={isDeleteConfirmOpen}
                title="Eliminar tipo de objeto"
                message={`¿Estás seguro de que quieres eliminar el tipo "${editingType?.name}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                variant="danger"
                onConfirm={confirmDeleteType}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                isLoading={isSaving}
            />
        </div >
    );
};
