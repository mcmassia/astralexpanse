// Sidebar component with navigation and object list
import { useMemo, useState } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { TypeEditorModal } from '../TypeEditor';
import { useToast } from '../common';
import type { ObjectType } from '../../types/object';
import './Sidebar.css';

export const Sidebar = () => {
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const selectedObjectId = useObjectStore(s => s.selectedObjectId);
    const selectObject = useObjectStore(s => s.selectObject);
    const createObject = useObjectStore(s => s.createObject);

    const { sidebarOpen, sidebarWidth, searchQuery, setSearchQuery, currentSection, setCurrentSection, setCalendarView, goToToday } = useUIStore();
    const { user, signOut } = useAuthStore();
    const toast = useToast();

    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['page']));
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<ObjectType | null>(null);

    // Group and filter objects by type
    const groupedObjects = useMemo(() => {
        const lowerQuery = searchQuery.toLowerCase();
        const filtered = searchQuery
            ? objects.filter(o => o.title.toLowerCase().includes(lowerQuery))
            : objects;

        const groups: Record<string, typeof objects> = {};
        for (const obj of filtered) {
            if (!groups[obj.type]) groups[obj.type] = [];
            groups[obj.type].push(obj);
        }
        return groups;
    }, [objects, searchQuery]);

    const toggleType = (typeId: string) => {
        setExpandedTypes(prev => {
            const next = new Set(prev);
            if (next.has(typeId)) {
                next.delete(typeId);
            } else {
                next.add(typeId);
            }
            return next;
        });
    };

    const handleCreate = async (typeId: string) => {
        const type = objectTypes.find(t => t.id === typeId);
        try {
            const newObj = await createObject(typeId, `Nuevo ${type?.name || 'objeto'}`);
            toast.success(`${type?.name || 'Objeto'} creado`, `"${newObj.title}" ha sido creado correctamente.`);
        } catch (error) {
            toast.error('Error al crear', `No se pudo crear el ${type?.name?.toLowerCase() || 'objeto'}.`);
        }
    };

    const handleCalendarClick = () => {
        setCurrentSection('calendar');
        setCalendarView('day');
        goToToday();
    };

    const handleObjectsClick = () => {
        setCurrentSection('objects');
    };

    if (!sidebarOpen) return null;

    return (
        <aside className="sidebar" style={{ width: sidebarWidth }}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <span className="logo-icon">✦</span>
                    <span className="logo-text">Astral Expanse</span>
                </div>
            </div>

            <div className="sidebar-search">
                <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
            </div>

            {/* Section Tabs */}
            <div className="sidebar-tabs">
                <button
                    className={`sidebar-tab ${currentSection === 'objects' ? 'active' : ''}`}
                    onClick={handleObjectsClick}
                >
                    📄 Objetos
                </button>
                <button
                    className={`sidebar-tab ${currentSection === 'calendar' ? 'active' : ''}`}
                    onClick={handleCalendarClick}
                >
                    📅 Calendario
                </button>
            </div>

            <nav className="sidebar-nav">
                {/* Add New Type Button */}
                <button
                    className="add-type-btn"
                    onClick={() => {
                        setEditingType(null);
                        setIsTypeModalOpen(true);
                    }}
                >
                    + Nuevo tipo de objeto
                </button>

                {objectTypes.map(type => {
                    const typeObjects = groupedObjects[type.id] || [];
                    const isExpanded = expandedTypes.has(type.id);

                    return (
                        <div key={type.id} className="nav-section">
                            <div
                                className="nav-section-header"
                                onClick={() => toggleType(type.id)}
                            >
                                <span className="nav-section-icon">{isExpanded ? '▼' : '▶'}</span>
                                <span className="nav-section-emoji">{type.icon}</span>
                                <span className="nav-section-title">{type.namePlural}</span>
                                <span className="nav-section-count">{typeObjects.length}</span>
                                <button
                                    className="nav-section-edit"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingType(type);
                                        setIsTypeModalOpen(true);
                                    }}
                                    title="Editar tipo"
                                >
                                    ⚙️
                                </button>
                                <button
                                    className="nav-section-add"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCreate(type.id);
                                    }}
                                    title={`Crear ${type.name}`}
                                >
                                    +
                                </button>
                            </div>

                            {isExpanded && (
                                <div className="nav-section-items">
                                    {typeObjects.length === 0 ? (
                                        <div className="nav-item-empty">
                                            Sin {type.namePlural.toLowerCase()}
                                        </div>
                                    ) : (
                                        typeObjects.map(obj => (
                                            <div
                                                key={obj.id}
                                                className={`nav-item ${obj.id === selectedObjectId ? 'selected' : ''}`}
                                                onClick={() => selectObject(obj.id)}
                                                style={{ '--type-color': type.color } as React.CSSProperties}
                                            >
                                                <span className="nav-item-title">{obj.title}</span>
                                                {obj.driveFileId && (
                                                    <span className="nav-item-synced" title="Sincronizado con Drive">☁</span>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    {user?.photoURL && (
                        <img src={user.photoURL} alt="" className="user-avatar" />
                    )}
                    <span className="user-name">{user?.displayName || user?.email}</span>
                </div>
                <button
                    className="sidebar-footer-btn signout"
                    onClick={signOut}
                    title="Cerrar sesión"
                >
                    🚪
                </button>
            </div>

            <TypeEditorModal
                isOpen={isTypeModalOpen}
                onClose={() => {
                    setIsTypeModalOpen(false);
                    setEditingType(null);
                }}
                editingType={editingType}
            />
        </aside>
    );
};
