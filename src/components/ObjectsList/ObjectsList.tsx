// ObjectsList - Full list view of all objects with search, filter, sort, and actions
import { useState, useMemo } from 'react';
import { useObjectStore, useSelectedObject } from '../../stores/objectStore';
import { TypeEditorModal } from '../TypeEditor';
import { ConfirmDialog, useToast, LucideIcon } from '../common';
import type { AstralObject, ObjectType } from '../../types/object';
import './ObjectsList.css';

type SortField = 'updatedAt' | 'title' | 'type' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface ObjectsListProps {
    onSelectObject: (id: string) => void;
}

export const ObjectsList = ({ onSelectObject }: ObjectsListProps) => {
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const deleteObject = useObjectStore(s => s.deleteObject);
    const updateObject = useObjectStore(s => s.updateObject);
    const selectedObject = useSelectedObject();
    const toast = useToast();

    // Filter & Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
    const [sortField, setSortField] = useState<SortField>('updatedAt');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<AstralObject | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Change type dropdown
    const [changeTypeTarget, setChangeTypeTarget] = useState<string | null>(null);

    // Type editor modal
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

    // Filter and sort objects
    const filteredObjects = useMemo(() => {
        let result = [...objects];

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(obj =>
                obj.title.toLowerCase().includes(query) ||
                obj.content?.toLowerCase().includes(query)
            );
        }

        // Type filter
        if (selectedTypes.size > 0) {
            result = result.filter(obj => selectedTypes.has(obj.type));
        }

        // Sort
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'updatedAt':
                    comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
                    break;
                case 'createdAt':
                    comparison = a.createdAt.getTime() - b.createdAt.getTime();
                    break;
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'type':
                    comparison = a.type.localeCompare(b.type);
                    break;
            }
            return sortDirection === 'desc' ? -comparison : comparison;
        });

        return result;
    }, [objects, searchQuery, selectedTypes, sortField, sortDirection]);

    const toggleTypeFilter = (typeId: string) => {
        setSelectedTypes(prev => {
            const next = new Set(prev);
            if (next.has(typeId)) {
                next.delete(typeId);
            } else {
                next.add(typeId);
            }
            return next;
        });
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedTypes(new Set());
    };

    const getTypeInfo = (typeId: string): ObjectType | undefined => {
        return objectTypes.find(t => t.id === typeId);
    };

    const formatDate = (date: Date): string => {
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleOpen = (obj: AstralObject) => {
        onSelectObject(obj.id);
    };

    const handleViewInDrive = (obj: AstralObject) => {
        if (obj.driveFileId) {
            window.open(`https://drive.google.com/file/d/${obj.driveFileId}/view`, '_blank');
        } else {
            toast.warning('No sincronizado', 'Este objeto no está sincronizado con Google Drive.');
        }
    };

    const handleDelete = (obj: AstralObject) => {
        setDeleteTarget(obj);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await deleteObject(deleteTarget.id);
            toast.success('Eliminado', `"${deleteTarget.title}" ha sido eliminado.`);
        } catch (error) {
            toast.error('Error', 'No se pudo eliminar el objeto.');
        } finally {
            setIsDeleting(false);
            setDeleteTarget(null);
        }
    };

    const handleChangeType = async (obj: AstralObject, newTypeId: string) => {
        try {
            await updateObject(obj.id, { type: newTypeId });
            const newType = getTypeInfo(newTypeId);
            toast.success('Tipo cambiado', `"${obj.title}" ahora es ${newType?.name || newTypeId}.`);
        } catch (error) {
            toast.error('Error', 'No se pudo cambiar el tipo.');
        }
        setChangeTypeTarget(null);
    };

    return (
        <div className="objects-list">
            {/* Toolbar */}
            <div className="objects-list-toolbar">
                {/* Search */}
                <div className="objects-search">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Buscar objetos..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    {searchQuery && (
                        <button
                            className="search-clear"
                            onClick={() => setSearchQuery('')}
                            title="Limpiar búsqueda"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Type Filter */}
                <div className="objects-type-filter">
                    <span className="filter-label">Tipos:</span>
                    <div className="type-chips">
                        {objectTypes.map(type => (
                            <button
                                key={type.id}
                                className={`type-chip ${selectedTypes.has(type.id) ? 'active' : ''}`}
                                onClick={() => toggleTypeFilter(type.id)}
                                style={{ '--chip-color': type.color } as React.CSSProperties}
                            >
                                <LucideIcon name={type.icon} size={12} color={selectedTypes.has(type.id) ? 'white' : type.color} />
                                {type.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sort */}
                <div className="objects-sort">
                    <select
                        value={sortField}
                        onChange={e => setSortField(e.target.value as SortField)}
                        className="sort-select"
                    >
                        <option value="updatedAt">Última modificación</option>
                        <option value="createdAt">Fecha de creación</option>
                        <option value="title">Título</option>
                        <option value="type">Tipo</option>
                    </select>
                    <button
                        className="sort-direction"
                        onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                        title={sortDirection === 'asc' ? 'Ascendente' : 'Descendente'}
                    >
                        {sortDirection === 'asc' ? '↑' : '↓'}
                    </button>
                </div>

                {/* Clear filters */}
                {(searchQuery || selectedTypes.size > 0) && (
                    <button className="clear-filters-btn" onClick={clearFilters}>
                        Limpiar filtros
                    </button>
                )}

                {/* New Type Button */}
                <button
                    className="new-type-btn"
                    onClick={() => setIsTypeModalOpen(true)}
                >
                    + Nuevo tipo objeto
                </button>
            </div>

            {/* Results count */}
            <div className="objects-list-meta">
                <span>{filteredObjects.length} objeto{filteredObjects.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Objects Table */}
            <div className="objects-table-wrapper">
                <table className="objects-table">
                    <thead>
                        <tr>
                            <th className="col-type">Tipo</th>
                            <th className="col-title">Título</th>
                            <th className="col-date">Modificado</th>
                            <th className="col-actions">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredObjects.length === 0 ? (
                            <tr className="empty-row">
                                <td colSpan={4}>
                                    <div className="empty-state">
                                        <span className="empty-icon">📭</span>
                                        <p>No se encontraron objetos</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredObjects.map(obj => {
                                const type = getTypeInfo(obj.type);
                                const isSelected = selectedObject?.id === obj.id;
                                const isChangingType = changeTypeTarget === obj.id;

                                return (
                                    <tr
                                        key={obj.id}
                                        className={`object-row ${isSelected ? 'selected' : ''}`}
                                    >
                                        <td className="col-type">
                                            <span
                                                className="type-badge"
                                                style={{
                                                    '--type-color': type?.color,
                                                    backgroundColor: type?.color
                                                } as React.CSSProperties}
                                            >
                                                {type?.name}
                                            </span>
                                        </td>
                                        <td className="col-title">
                                            <button
                                                className="title-link"
                                                onClick={() => handleOpen(obj)}
                                            >
                                                {obj.title}
                                            </button>
                                            {obj.driveFileId && (
                                                <span className="synced-badge" title="Sincronizado con Drive">☁</span>
                                            )}
                                        </td>
                                        <td className="col-date">
                                            {formatDate(obj.updatedAt)}
                                        </td>
                                        <td className="col-actions">
                                            <div className="action-buttons">
                                                <button
                                                    className="action-btn open"
                                                    onClick={() => handleOpen(obj)}
                                                    title="Abrir"
                                                >
                                                    📝
                                                </button>
                                                <button
                                                    className="action-btn drive"
                                                    onClick={() => handleViewInDrive(obj)}
                                                    title="Ver en Drive"
                                                    disabled={!obj.driveFileId}
                                                >
                                                    ☁️
                                                </button>
                                                <button
                                                    className="action-btn change-type"
                                                    onClick={() => setChangeTypeTarget(isChangingType ? null : obj.id)}
                                                    title="Cambiar tipo"
                                                >
                                                    🔄
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    onClick={() => handleDelete(obj)}
                                                    title="Eliminar"
                                                >
                                                    🗑️
                                                </button>
                                            </div>

                                            {/* Change Type Dropdown */}
                                            {isChangingType && (
                                                <div className="change-type-dropdown">
                                                    {objectTypes.filter(t => t.id !== obj.type).map(t => (
                                                        <button
                                                            key={t.id}
                                                            className="type-option"
                                                            onClick={() => handleChangeType(obj, t.id)}
                                                            style={{ '--type-color': t.color } as React.CSSProperties}
                                                        >
                                                            {t.icon} {t.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Eliminar objeto"
                message={`¿Estás seguro de que quieres eliminar "${deleteTarget?.title}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteTarget(null)}
                isLoading={isDeleting}
            />

            {/* Type Editor Modal */}
            <TypeEditorModal
                isOpen={isTypeModalOpen}
                onClose={() => setIsTypeModalOpen(false)}
                editingType={null}
            />
        </div>
    );
};

export default ObjectsList;
