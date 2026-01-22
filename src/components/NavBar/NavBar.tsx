// NavBar - Global top navigation bar
import { useUIStore } from '../../stores/uiStore';
import { useObjectStore } from '../../stores/objectStore';
import { useAuthStore } from '../../stores/authStore';
import { useEffect, useRef, useMemo, useState } from 'react';
import { Search, Plus, LogOut, ChevronLeft, ChevronRight, ChevronDown, Sparkles, Settings } from 'lucide-react';
import { LucideIcon } from '../common';
import { DriveStatus } from '../DriveStatus';
import { MagicConstructorModal } from '../MagicConstructor/MagicConstructorModal';
import './NavBar.css';

// Spanish Catholic Saints Calendar (major feast days)
const SAINTS_CALENDAR: Record<string, string> = {
    '01-01': 'Santa María, Madre de Dios',
    '01-06': 'Epifanía del Señor (Reyes Magos)',
    '01-17': 'San Antonio Abad',
    '02-02': 'La Candelaria',
    '02-14': 'San Valentín',
    '03-19': 'San José',
    '04-23': 'San Jorge',
    '05-01': 'San José Obrero',
    '05-15': 'San Isidro Labrador',
    '06-13': 'San Antonio de Padua',
    '06-24': 'San Juan Bautista',
    '06-29': 'San Pedro y San Pablo',
    '07-25': 'Santiago Apóstol',
    '08-15': 'Asunción de la Virgen',
    '09-08': 'Natividad de la Virgen',
    '10-12': 'Nuestra Señora del Pilar',
    '11-01': 'Todos los Santos',
    '11-09': 'Almudena (Madrid)',
    '12-06': 'San Nicolás',
    '12-08': 'Inmaculada Concepción',
    '12-12': 'Nuestra Señora de Guadalupe',
    '12-25': 'Natividad del Señor',
    '12-28': 'Santos Inocentes',
};

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const NavBar = () => {
    const navHistory = useUIStore(s => s.navHistory);
    const navHistoryIndex = useUIStore(s => s.navHistoryIndex);
    const goNavBack = useUIStore(s => s.goNavBack);
    const goNavForward = useUIStore(s => s.goNavForward);
    const pushNavHistory = useUIStore(s => s.pushNavHistory);
    const currentSection = useUIStore(s => s.currentSection);
    const setCurrentSection = useUIStore(s => s.setCurrentSection);
    const openCommandPalette = useUIStore(s => s.openCommandPalette);

    const selectedObjectId = useObjectStore(s => s.selectedObjectId);
    const selectObject = useObjectStore(s => s.selectObject);
    const createObject = useObjectStore(s => s.createObject);
    const objectTypes = useObjectStore(s => s.objectTypes);

    const { user, signOut } = useAuthStore();

    const isNavigatingRef = useRef(false);
    const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
    const [showMagicModal, setShowMagicModal] = useState(false);
    const createDropdownRef = useRef<HTMLDivElement>(null);

    const canGoBack = navHistoryIndex > 0;
    const canGoForward = navHistoryIndex < navHistory.length - 1;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (createDropdownRef.current && !createDropdownRef.current.contains(event.target as Node)) {
                setCreateDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Get current date info and saint
    const dateInfo = useMemo(() => {
        const now = new Date();
        const dayName = DAY_NAMES[now.getDay()];
        const day = now.getDate();
        const month = MONTH_NAMES[now.getMonth()];
        const monthKey = String(now.getMonth() + 1).padStart(2, '0');
        const dayKey = String(day).padStart(2, '0');
        const saintKey = `${monthKey}-${dayKey}`;
        const saint = SAINTS_CALENDAR[saintKey];

        return {
            formatted: `${dayName}, ${day} de ${month}`,
            saint: saint || null,
        };
    }, []);

    // Push to history when section or object changes (but not during back/forward navigation)
    useEffect(() => {
        if (isNavigatingRef.current) {
            isNavigatingRef.current = false;
            return;
        }
        pushNavHistory(currentSection, selectedObjectId);
    }, [currentSection, selectedObjectId, pushNavHistory]);

    const handleBack = () => {
        if (!canGoBack) return;
        isNavigatingRef.current = true;
        const prevItem = navHistory[navHistoryIndex - 1];
        goNavBack();
        if (prevItem.objectId !== selectedObjectId) {
            selectObject(prevItem.objectId);
        }
    };

    const handleForward = () => {
        if (!canGoForward) return;
        isNavigatingRef.current = true;
        const nextItem = navHistory[navHistoryIndex + 1];
        goNavForward();
        if (nextItem.objectId !== selectedObjectId) {
            selectObject(nextItem.objectId);
        }
    };

    const handleSearch = () => {
        openCommandPalette('quick');
    };

    const handleCreateObject = async (typeId: string) => {
        const type = objectTypes.find(t => t.id === typeId);
        await createObject(typeId, `Nuevo ${type?.name || 'Objeto'}`);
        setCurrentSection('objects');
        setCreateDropdownOpen(false);
    };

    const handleSignOut = () => {
        signOut();
    };

    return (
        <header className="nav-bar">
            {/* Left section: App name and navigation */}
            <div className="nav-bar-left">
                <div
                    className="nav-bar-logo nav-bar-logo-clickable"
                    onClick={() => { selectObject(null); setCurrentSection('dashboard'); }}
                    title="Ir a Inicio"
                >
                    <span className="nav-bar-logo-icon">✦</span>
                    <span className="nav-bar-logo-text">OOPKM</span>
                </div>

                <div className="nav-bar-nav-buttons">
                    <button
                        className="nav-bar-btn"
                        onClick={handleBack}
                        disabled={!canGoBack}
                        title="Atrás"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        className="nav-bar-btn"
                        onClick={handleForward}
                        disabled={!canGoForward}
                        title="Adelante"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                <div className="nav-bar-date">
                    <span className="nav-bar-date-text">{dateInfo.formatted}</span>
                    {dateInfo.saint && (
                        <span className="nav-bar-saint">{dateInfo.saint}</span>
                    )}
                </div>
            </div>

            {/* Right section: Actions and user */}
            <div className="nav-bar-right">
                <button
                    className="nav-bar-btn nav-bar-search"
                    onClick={handleSearch}
                    title="Buscar (⌘K)"
                >
                    <Search size={18} />
                </button>

                {/* Create Object Dropdown */}
                <button
                    className="nav-bar-btn nav-bar-magic"
                    onClick={() => setShowMagicModal(true)}
                    title="Constructor Mágico AI"
                    style={{ color: '#a855f7', marginRight: '0.5rem' }}
                >
                    <Sparkles size={18} />
                </button>

                <div className="nav-bar-create-wrapper" ref={createDropdownRef}>
                    <button
                        className="nav-bar-btn nav-bar-new-object"
                        onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                        title="Nuevo objeto"
                    >
                        <Plus size={16} />
                        <span>Nuevo</span>
                        <ChevronDown size={14} />
                    </button>

                    {createDropdownOpen && (
                        <div className="nav-bar-create-dropdown">
                            <div className="nav-bar-create-header">CREAR NUEVO</div>
                            {objectTypes.map(type => (
                                <button
                                    key={type.id}
                                    className="nav-bar-create-item"
                                    onClick={() => handleCreateObject(type.id)}
                                >
                                    <LucideIcon name={type.icon || 'FileText'} size={16} color={type.color} />
                                    <span>{type.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {user && (
                    <div className="nav-bar-user">
                        <img
                            src={user.photoURL || '/default-avatar.png'}
                            alt={user.displayName || 'Usuario'}
                            className="nav-bar-avatar"
                        />
                        <span className="nav-bar-username">{user.displayName?.split(' ')[0]}</span>
                    </div>
                )}

                <DriveStatus />

                <button
                    className="nav-bar-btn nav-bar-settings"
                    onClick={useUIStore.getState().openSettings}
                    title="Configuración AI"
                >
                    <Settings size={18} />
                </button>

                <button
                    className="nav-bar-btn nav-bar-signout"
                    onClick={handleSignOut}
                    title="Cerrar sesión"
                >
                    <LogOut size={18} />
                </button>
            </div>

            {showMagicModal && (
                <MagicConstructorModal
                    onClose={() => setShowMagicModal(false)}
                    onSuccess={(newId) => {
                        setShowMagicModal(false);
                        selectObject(newId);
                        setCurrentSection('objects');
                    }}
                />
            )}
        </header>
    );
};
