// Sidebar component with navigation menu
import { useState, useMemo } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { TypeEditorModal } from '../TypeEditor';
import { DriveStatus } from '../DriveStatus';
import { useToast, LucideIcon } from '../common';
import type { ObjectType } from '../../types/object';
import './Sidebar.css';

export const Sidebar = () => {
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const selectedObjectId = useObjectStore(s => s.selectedObjectId);
    const selectObject = useObjectStore(s => s.selectObject);
    const createObject = useObjectStore(s => s.createObject);

    const { sidebarOpen, sidebarWidth, currentSection, setCurrentSection, setCalendarView, goToToday, toggleSidebar } = useUIStore();
    const { user, signOut } = useAuthStore();
    const toast = useToast();

    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['page']));
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<ObjectType | null>(null);

    // Group objects by type
    const groupedObjects = useMemo(() => {
        const groups: Record<string, typeof objects> = {};
        for (const obj of objects) {
            if (!groups[obj.type]) groups[obj.type] = [];
            groups[obj.type].push(obj);
        }
        return groups;
    }, [objects]);

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
        // Clear selection to show ObjectsList
        selectObject(null);
        setCurrentSection('objects');
    };

    if (!sidebarOpen) {
        // Collapsed sidebar - show only toggle and icons
        return (
            <aside className="sidebar collapsed">
                <button
                    className="sidebar-collapse-btn"
                    onClick={toggleSidebar}
                    title="Expandir barra lateral"
                >
                    ›
                </button>
                <div className="sidebar-collapsed-content">
                    <div className="sidebar-logo collapsed">
                        <span className="logo-icon">✦</span>
                    </div>
                    <div className="sidebar-collapsed-menu">
                        <button
                            className={`sidebar-collapsed-item ${currentSection === 'calendar' ? 'active' : ''}`}
                            onClick={handleCalendarClick}
                            title="Calendario"
                        >
                            📅
                        </button>
                        <button
                            className={`sidebar-collapsed-item ${currentSection === 'objects' ? 'active' : ''}`}
                            onClick={handleObjectsClick}
                            title="Objetos"
                        >
                            📚
                        </button>
                    </div>
                    <div className="sidebar-collapsed-types">
                        {objectTypes.slice(0, 8).map(type => (
                            <button
                                key={type.id}
                                className="sidebar-collapsed-type"
                                onClick={() => {
                                    setExpandedTypes(prev => new Set([...prev, type.id]));
                                    toggleSidebar();
                                }}
                                title={type.namePlural}
                            >
                                {type.icon}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="sidebar-footer collapsed">
                    {user?.photoURL && (
                        <img src={user.photoURL} alt="" className="user-avatar" />
                    )}
                </div>
            </aside>
        );
    }

    return (
        <aside className="sidebar" style={{ width: sidebarWidth }}>
            <button
                className="sidebar-collapse-btn"
                onClick={toggleSidebar}
                title="Colapsar barra lateral"
            >
                ‹
            </button>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <span className="logo-icon">✦</span>
                    <span className="logo-text">Astral Expanse</span>
                </div>
            </div>

            {/* Stacked Menu */}
            <nav className="sidebar-menu">
                <button
                    className={`sidebar-menu-item ${currentSection === 'calendar' ? 'active' : ''}`}
                    onClick={handleCalendarClick}
                >
                    <span className="menu-icon">📅</span>
                    <span className="menu-label">Calendario</span>
                </button>
                <button
                    className={`sidebar-menu-item ${currentSection === 'objects' && !selectedObjectId ? 'active' : ''}`}
                    onClick={handleObjectsClick}
                >
                    <span className="menu-icon">📚</span>
                    <span className="menu-label">Objetos</span>
                    <span className="menu-count">{objects.length}</span>
                </button>
            </nav>

            {/* Object Types Listing */}
            <nav className="sidebar-nav">
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
                                <LucideIcon name={type.icon} size={16} color={type.color} />
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
                                                onClick={() => {
                                                    selectObject(obj.id);
                                                    setCurrentSection('objects');
                                                }}
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
                    <DriveStatus />
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
