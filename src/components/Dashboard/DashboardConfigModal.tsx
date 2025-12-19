// DashboardConfigModal - Create, edit, delete dashboard panels
import { useState, useEffect, useMemo } from 'react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useObjectStore } from '../../stores/objectStore';
import { useToast, IconPicker, LucideIcon, ConfirmDialog } from '../common';
import type { DashboardPanel, DashboardSection, PropertyFilter, ChartType } from '../../types/dashboard';
import './DashboardConfigModal.css';

interface DashboardConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SpecialFilter = 'orphans' | 'inbox' | 'recently_modified' | 'favorites' | null;

const SECTION_OPTIONS: { value: DashboardSection; label: string; icon: string }[] = [
    { value: 'capture', label: 'Captura', icon: '📥' },
    { value: 'action', label: 'Acción', icon: '🎯' },
    { value: 'gardening', label: 'Mantenimiento', icon: '🌱' },
    { value: 'custom', label: 'Mis Paneles', icon: '📌' },
];

const SPECIAL_FILTERS: { value: SpecialFilter; label: string; description: string }[] = [
    { value: null, label: 'Ninguno', description: 'Sin filtro especial' },
    { value: 'inbox', label: 'Bandeja de entrada', description: 'Sin etiquetas ni relaciones' },
    { value: 'orphans', label: 'Huérfanos', description: 'Sin backlinks ni etiquetas' },
    { value: 'recently_modified', label: 'Recientes', description: 'Modificados recientemente' },
    { value: 'favorites', label: 'Favoritos', description: 'Marcados como favoritos' },
];

const CHART_TYPES: { value: ChartType | 'none'; label: string; icon: string }[] = [
    { value: 'none', label: 'Lista', icon: 'List' },
    { value: 'count', label: 'Contador', icon: 'Hash' },
    { value: 'pie', label: 'Circular', icon: 'PieChart' },
    { value: 'bar', label: 'Barras', icon: 'BarChart2' },
    { value: 'progress', label: 'Progreso', icon: 'CheckCircle' },
    { value: 'timeline', label: 'Línea de tiempo', icon: 'TrendingUp' },
];

const COLOR_SUGGESTIONS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6',
    '#ef4444', '#3b82f6', '#14b8a6', '#f97316', '#84cc16'
];

const FILTER_OPERATORS: { value: PropertyFilter['operator']; label: string }[] = [
    { value: 'equals', label: 'igual a' },
    { value: 'not_equals', label: 'diferente de' },
    { value: 'contains', label: 'contiene' },
    { value: 'is_empty', label: 'está vacío' },
    { value: 'not_empty', label: 'no está vacío' },
    { value: 'gt', label: 'mayor que' },
    { value: 'lt', label: 'menor que' },
];

// Semantic date values that will be resolved at query time
const SEMANTIC_DATE_VALUES = [
    { value: '@hoy', label: 'Hoy' },
    { value: '@ayer', label: 'Ayer' },
    { value: '@mañana', label: 'Mañana' },
    { value: '@esta_semana', label: 'Esta semana' },
    { value: '@semana_pasada', label: 'Semana pasada' },
    { value: '@este_mes', label: 'Este mes' },
    { value: '@mes_pasado', label: 'Mes pasado' },
];

// Built-in properties available for all objects
const BUILTIN_PROPERTIES = [
    { id: 'createdAt', name: 'Fecha de creación', type: 'datetime' },
    { id: 'updatedAt', name: 'Última modificación', type: 'datetime' },
    { id: 'title', name: 'Título', type: 'text' },
    { id: 'type', name: 'Tipo', type: 'text' },
    { id: 'isFavorite', name: 'Favorito', type: 'boolean' },
];

export const DashboardConfigModal = ({ isOpen, onClose }: DashboardConfigModalProps) => {
    const panels = useDashboardStore(s => s.panels);
    const createPanel = useDashboardStore(s => s.createPanel);
    const updatePanel = useDashboardStore(s => s.updatePanel);
    const deletePanel = useDashboardStore(s => s.deletePanel);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const toast = useToast();

    // View state: 'list' or 'edit'
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [editingPanel, setEditingPanel] = useState<DashboardPanel | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('LayoutDashboard');
    const [color, setColor] = useState('#6366f1');
    const [section, setSection] = useState<DashboardSection>('custom');
    const [maxItems, setMaxItems] = useState(6);
    const [chartType, setChartType] = useState<ChartType | 'none'>('none');

    // Query state
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [specialFilter, setSpecialFilter] = useState<SpecialFilter>(null);
    const [propertyFilters, setPropertyFilters] = useState<PropertyFilter[]>([]);
    const [sortBy, setSortBy] = useState('updatedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // UI state
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // Reset form when opening/closing modal or switching to edit
    useEffect(() => {
        if (!isOpen) {
            setView('list');
            setEditingPanel(null);
        }
    }, [isOpen]);

    // Populate form when editing
    useEffect(() => {
        if (editingPanel) {
            setName(editingPanel.name);
            setIcon(editingPanel.icon);
            setColor(editingPanel.color || '#6366f1');
            setSection(editingPanel.section);
            setMaxItems(editingPanel.maxItems);
            setChartType(editingPanel.chartConfig?.type || 'none');
            setSelectedTypes(editingPanel.query.types || []);
            setSpecialFilter((editingPanel.query.specialFilter as SpecialFilter) || null);
            setPropertyFilters(editingPanel.query.propertyFilters || []);
            setSortBy(editingPanel.query.sortBy || 'updatedAt');
            setSortDirection(editingPanel.query.sortDirection || 'desc');
        } else {
            resetForm();
        }
    }, [editingPanel]);

    const resetForm = () => {
        setName('');
        setIcon('LayoutDashboard');
        setColor('#6366f1');
        setSection('custom');
        setMaxItems(6);
        setChartType('none');
        setSelectedTypes([]);
        setSpecialFilter(null);
        setPropertyFilters([]);
        setSortBy('updatedAt');
        setSortDirection('desc');
    };

    const handleNewPanel = () => {
        setEditingPanel(null);
        resetForm();
        setView('edit');
    };

    const handleEditPanel = (panel: DashboardPanel) => {
        setEditingPanel(panel);
        setView('edit');
    };

    const handleBack = () => {
        setView('list');
        setEditingPanel(null);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Error', 'El nombre es obligatorio');
            return;
        }

        setIsSaving(true);
        try {
            const panelData: Omit<DashboardPanel, 'id' | 'createdAt' | 'updatedAt'> = {
                name: name.trim(),
                icon,
                color,
                section,
                maxItems,
                displayMode: chartType === 'none' ? 'list' : 'chart',
                order: editingPanel?.order ?? panels.length,
                query: {
                    types: selectedTypes.length > 0 ? selectedTypes : undefined,
                    specialFilter: specialFilter || undefined,
                    propertyFilters: propertyFilters.length > 0 ? propertyFilters : undefined,
                    sortBy,
                    sortDirection,
                },
                chartConfig: chartType !== 'none' ? {
                    type: chartType,
                    groupByProperty: chartType === 'pie' || chartType === 'bar' ? 'type' : undefined,
                    showLegend: chartType === 'pie',
                } : undefined,
            };

            if (editingPanel) {
                await updatePanel(editingPanel.id, panelData);
                toast.success('Panel actualizado', `"${name}" ha sido actualizado.`);
            } else {
                await createPanel(panelData);
                toast.success('Panel creado', `"${name}" ha sido creado.`);
            }

            setView('list');
            setEditingPanel(null);
        } catch (err) {
            toast.error('Error', (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingPanel) return;

        setIsSaving(true);
        try {
            await deletePanel(editingPanel.id);
            toast.success('Panel eliminado', `"${editingPanel.name}" ha sido eliminado.`);
            setIsDeleteConfirmOpen(false);
            setView('list');
            setEditingPanel(null);
        } catch (err) {
            toast.error('Error', (err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleTypeFilter = (typeId: string) => {
        setSelectedTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(t => t !== typeId)
                : [...prev, typeId]
        );
    };

    const addPropertyFilter = () => {
        setPropertyFilters([...propertyFilters, {
            propertyId: '',
            operator: 'equals',
            value: ''
        }]);
    };

    const updatePropertyFilter = (index: number, updates: Partial<PropertyFilter>) => {
        const newFilters = [...propertyFilters];
        newFilters[index] = { ...newFilters[index], ...updates };
        setPropertyFilters(newFilters);
    };

    const removePropertyFilter = (index: number) => {
        setPropertyFilters(propertyFilters.filter((_, i) => i !== index));
    };

    // Get available properties based on selected types
    const availableProperties = useMemo(() => {
        const propsMap = new Map<string, { id: string; name: string; type: string }>();

        // Always include built-in properties
        BUILTIN_PROPERTIES.forEach(p => propsMap.set(p.id, p));

        // Get properties from selected types (or all types if none selected)
        const typesToCheck = selectedTypes.length > 0
            ? objectTypes.filter(t => selectedTypes.includes(t.id))
            : objectTypes;

        typesToCheck.forEach(type => {
            type.properties?.forEach(prop => {
                if (!propsMap.has(prop.id)) {
                    propsMap.set(prop.id, { id: prop.id, name: prop.name, type: prop.type });
                }
            });
        });

        return Array.from(propsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedTypes, objectTypes]);

    // Check if a property is date-type for showing semantic hints
    const isDateProperty = (propertyId: string) => {
        const prop = availableProperties.find(p => p.id === propertyId);
        return prop?.type === 'date' || prop?.type === 'datetime';
    };

    // Group panels by section for list view
    const panelsBySection = useMemo(() => {
        const grouped: Record<DashboardSection, DashboardPanel[]> = {
            capture: [],
            action: [],
            gardening: [],
            custom: [],
        };
        panels.sort((a, b) => a.order - b.order).forEach(p => {
            if (grouped[p.section]) {
                grouped[p.section].push(p);
            }
        });
        return grouped;
    }, [panels]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="dashboard-config-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="modal-header">
                    <div className="header-title-row">
                        {view === 'edit' && (
                            <button className="back-button" onClick={handleBack}>
                                <LucideIcon name="ArrowLeft" size={18} />
                            </button>
                        )}
                        <h2>
                            {view === 'list' ? 'Configurar paneles' : (editingPanel ? 'Editar panel' : 'Nuevo panel')}
                        </h2>
                        {view === 'edit' && name && (
                            <div className="panel-preview-badge" style={{ borderColor: color }}>
                                <LucideIcon name={icon} size={14} color={color} />
                                <span>{name}</span>
                            </div>
                        )}
                    </div>
                    <div className="header-actions">
                        {view === 'edit' && editingPanel && (
                            <button
                                className="danger-button"
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                title="Eliminar panel"
                            >
                                <LucideIcon name="Trash2" size={16} />
                            </button>
                        )}
                        <button className="modal-close" onClick={onClose}>✕</button>
                    </div>
                </header>

                {/* Body */}
                <div className="modal-body">
                    {view === 'list' ? (
                        <div className="panels-list-view">
                            <button className="new-panel-btn" onClick={handleNewPanel}>
                                <LucideIcon name="Plus" size={18} />
                                Crear nuevo panel
                            </button>

                            {SECTION_OPTIONS.map(sectionOpt => {
                                const sectionPanels = panelsBySection[sectionOpt.value];
                                if (sectionPanels.length === 0 && sectionOpt.value !== 'custom') return null;

                                return (
                                    <div key={sectionOpt.value} className="panels-section">
                                        <h3 className="section-label">
                                            <span>{sectionOpt.icon}</span>
                                            {sectionOpt.label}
                                        </h3>
                                        {sectionPanels.length === 0 ? (
                                            <div className="empty-section">Sin paneles</div>
                                        ) : (
                                            <div className="panels-grid">
                                                {sectionPanels.map(panel => (
                                                    <button
                                                        key={panel.id}
                                                        className="panel-card"
                                                        onClick={() => handleEditPanel(panel)}
                                                    >
                                                        <div
                                                            className="panel-card-icon"
                                                            style={{ backgroundColor: `${panel.color}20`, color: panel.color }}
                                                        >
                                                            <LucideIcon name={panel.icon} size={20} />
                                                        </div>
                                                        <div className="panel-card-info">
                                                            <span className="panel-card-name">{panel.name}</span>
                                                            <span className="panel-card-mode">
                                                                {panel.displayMode === 'chart' ? 'Gráfica' : 'Lista'}
                                                            </span>
                                                        </div>
                                                        <LucideIcon name="ChevronRight" size={16} className="panel-card-arrow" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="panel-edit-view">
                            {/* Basic Info */}
                            <section className="form-section">
                                <h3 className="form-section-title">Información básica</h3>
                                <div className="form-row">
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
                                <div className="form-row">
                                    <div className="field-group flex-1">
                                        <label>Nombre del panel</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Ej: Tareas pendientes"
                                            className="text-input"
                                        />
                                    </div>
                                    <div className="field-group">
                                        <label>Sección</label>
                                        <select
                                            value={section}
                                            onChange={e => setSection(e.target.value as DashboardSection)}
                                            className="select-input"
                                        >
                                            {SECTION_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.icon} {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* Display Mode */}
                            <section className="form-section">
                                <h3 className="form-section-title">Visualización</h3>
                                <div className="chart-type-grid">
                                    {CHART_TYPES.map(ct => (
                                        <button
                                            key={ct.value}
                                            className={`chart-type-btn ${chartType === ct.value ? 'active' : ''}`}
                                            onClick={() => setChartType(ct.value)}
                                        >
                                            <LucideIcon name={ct.icon} size={20} />
                                            <span>{ct.label}</span>
                                        </button>
                                    ))}
                                </div>
                                {chartType === 'none' && (
                                    <div className="form-row" style={{ marginTop: '1rem' }}>
                                        <div className="field-group">
                                            <label>Máximo de elementos</label>
                                            <input
                                                type="number"
                                                value={maxItems}
                                                onChange={e => setMaxItems(Number(e.target.value))}
                                                min={1}
                                                max={20}
                                                className="number-input"
                                            />
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* Query Filters */}
                            <section className="form-section">
                                <h3 className="form-section-title">Filtros</h3>

                                {/* Type filters */}
                                <div className="filter-group">
                                    <label>Tipos de objeto</label>
                                    <div className="type-chips">
                                        {objectTypes.map(type => (
                                            <button
                                                key={type.id}
                                                className={`type-chip ${selectedTypes.includes(type.id) ? 'active' : ''}`}
                                                style={{ '--chip-color': type.color } as React.CSSProperties}
                                                onClick={() => toggleTypeFilter(type.id)}
                                            >
                                                <LucideIcon name={type.icon} size={12} />
                                                {type.name}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedTypes.length === 0 && (
                                        <span className="filter-hint">Todos los tipos</span>
                                    )}
                                </div>

                                {/* Special filter */}
                                <div className="filter-group">
                                    <label>Filtro especial</label>
                                    <select
                                        value={specialFilter || ''}
                                        onChange={e => setSpecialFilter((e.target.value || null) as SpecialFilter)}
                                        className="select-input"
                                    >
                                        {SPECIAL_FILTERS.map(sf => (
                                            <option key={sf.value || 'none'} value={sf.value || ''}>
                                                {sf.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Property filters */}
                                <div className="filter-group">
                                    <label>Filtros de propiedades</label>
                                    {propertyFilters.map((pf, index) => (
                                        <div key={index} className="property-filter-row">
                                            <select
                                                value={pf.propertyId}
                                                onChange={e => updatePropertyFilter(index, { propertyId: e.target.value })}
                                                className="select-input property-select"
                                            >
                                                <option value="">Seleccionar propiedad...</option>
                                                <optgroup label="Propiedades del sistema">
                                                    {BUILTIN_PROPERTIES.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </optgroup>
                                                {availableProperties.filter(p => !BUILTIN_PROPERTIES.some(bp => bp.id === p.id)).length > 0 && (
                                                    <optgroup label="Propiedades de tipos">
                                                        {availableProperties
                                                            .filter(p => !BUILTIN_PROPERTIES.some(bp => bp.id === p.id))
                                                            .map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                            <select
                                                value={pf.operator}
                                                onChange={e => updatePropertyFilter(index, { operator: e.target.value as PropertyFilter['operator'] })}
                                                className="select-input operator-select"
                                            >
                                                {FILTER_OPERATORS.map(op => (
                                                    <option key={op.value} value={op.value}>{op.label}</option>
                                                ))}
                                            </select>
                                            {!['is_empty', 'not_empty'].includes(pf.operator) && (
                                                <div className="value-input-wrapper">
                                                    <input
                                                        type="text"
                                                        value={String(pf.value || '')}
                                                        onChange={e => updatePropertyFilter(index, { value: e.target.value })}
                                                        placeholder={isDateProperty(pf.propertyId) ? "Ej: @hoy, @ayer" : "Valor"}
                                                        className="text-input value-input"
                                                        list={isDateProperty(pf.propertyId) ? `date-hints-${index}` : undefined}
                                                    />
                                                    {isDateProperty(pf.propertyId) && (
                                                        <datalist id={`date-hints-${index}`}>
                                                            {SEMANTIC_DATE_VALUES.map(d => (
                                                                <option key={d.value} value={d.value}>{d.label}</option>
                                                            ))}
                                                        </datalist>
                                                    )}
                                                </div>
                                            )}
                                            <button
                                                className="remove-filter-btn"
                                                onClick={() => removePropertyFilter(index)}
                                            >
                                                <LucideIcon name="X" size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <button className="add-filter-btn" onClick={addPropertyFilter}>
                                        <LucideIcon name="Plus" size={14} />
                                        Añadir filtro
                                    </button>
                                </div>

                                {/* Sort */}
                                <div className="form-row">
                                    <div className="field-group">
                                        <label>Ordenar por</label>
                                        <select
                                            value={sortBy}
                                            onChange={e => setSortBy(e.target.value)}
                                            className="select-input"
                                        >
                                            <option value="updatedAt">Última modificación</option>
                                            <option value="createdAt">Fecha de creación</option>
                                            <option value="title">Título</option>
                                        </select>
                                    </div>
                                    <div className="field-group">
                                        <label>Dirección</label>
                                        <select
                                            value={sortDirection}
                                            onChange={e => setSortDirection(e.target.value as 'asc' | 'desc')}
                                            className="select-input"
                                        >
                                            <option value="desc">Descendente</option>
                                            <option value="asc">Ascendente</option>
                                        </select>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {view === 'edit' && (
                    <footer className="modal-footer">
                        <button className="btn-secondary" onClick={handleBack}>
                            Cancelar
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleSave}
                            disabled={isSaving || !name.trim()}
                        >
                            {isSaving ? 'Guardando...' : (editingPanel ? 'Guardar cambios' : 'Crear panel')}
                        </button>
                    </footer>
                )}
            </div>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={isDeleteConfirmOpen}
                title="Eliminar panel"
                message={`¿Estás seguro de que quieres eliminar el panel "${editingPanel?.name}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                variant="danger"
                onConfirm={handleDelete}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                isLoading={isSaving}
            />
        </div>
    );
};
