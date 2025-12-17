// Command Palette component - Main search and command interface
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useCalendarStore } from '../../stores/calendarStore';
import { searchObjects, groupResultsByType, getAllTags } from '../../services/searchEngine';
import { EventModal } from '../Calendar/EventModal';
import { LucideIcon } from '../common';
import type { CommandAction, SearchResult, PropertyValue, ObjectType } from '../../types/object';
import type { CalendarEvent } from '../../types/calendar';
import {
    parseObjectCommand,
    convertPropertyValues,
    formatPropertiesPreview,
    getRelationSuggestions,
    type RelationSuggestion,
} from '../../utils/propertyAssignmentParser';
import './CommandPalette.css';

interface ResultItem {
    type: 'action' | 'create' | 'result' | 'quickCreate' | 'event';
    id: string;
    action?: CommandAction;
    result?: SearchResult;
    createType?: string;
    quickCreateName?: string; // For @tipo/nombre syntax
    quickCreateProperties?: Record<string, PropertyValue>; // For > prop = value syntax
    quickCreatePropertiesPreview?: string; // Formatted preview string
    isUpdate?: boolean; // True if updating existing object
    existingObjectId?: string; // ID of existing object to update
    event?: CalendarEvent; // For calendar events
}

interface CommandPaletteProps {
    onOpenImport?: () => void;
}

export const CommandPalette = ({ onOpenImport }: CommandPaletteProps) => {
    const {
        commandPaletteOpen,
        commandPaletteMode,
        commandPaletteQuery,
        extendedSearchFilters,
        closeCommandPalette,
        setCommandPaletteQuery,
        openSettings,
        toggleTypeFilter,
        toggleTagFilter,
        setExtendedSearchFilters,
        setTheme,
    } = useUIStore();

    const { signOut } = useAuthStore();

    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const selectObject = useObjectStore(s => s.selectObject);
    const createObject = useObjectStore(s => s.createObject);
    const updateObject = useObjectStore(s => s.updateObject);

    const calendarEvents = useCalendarStore(s => s.events);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [localQuery, setLocalQuery] = useState(''); // Local copy for suggestions
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Define available commands
    const commands = useMemo((): CommandAction[] => [
        {
            id: 'goto-today',
            label: 'Ir a hoy',
            icon: '📅',
            category: 'navigation',
            shortcut: '⌘ T',
            action: () => {
                const { setCurrentSection, goToToday, setCalendarView } = useUIStore.getState();
                setCurrentSection('calendar');
                setCalendarView('day');
                goToToday();
                closeCommandPalette();
            },
        },
        {
            id: 'view-month',
            label: 'Ver Mes',
            icon: '📆',
            category: 'navigation',
            action: () => {
                const { setCurrentSection, setCalendarView } = useUIStore.getState();
                setCurrentSection('calendar');
                setCalendarView('month');
                closeCommandPalette();
            },
        },
        {
            id: 'view-week',
            label: 'Ver Semana',
            icon: '🗓️',
            category: 'navigation',
            action: () => {
                const { setCurrentSection, setCalendarView } = useUIStore.getState();
                setCurrentSection('calendar');
                setCalendarView('week');
                closeCommandPalette();
            },
        },
        {
            id: 'open-settings',
            label: 'Abrir configuración',
            icon: '⚙️',
            category: 'settings',
            shortcut: '⌘ ,',
            action: () => {
                closeCommandPalette();
                openSettings();
            },
        },
        {
            id: 'dark-mode',
            label: 'Modo Oscuro',
            icon: '🌙',
            category: 'settings',
            action: () => {
                setTheme('dark');
                closeCommandPalette();
            },
        },
        {
            id: 'light-mode',
            label: 'Modo Claro',
            icon: '☀️',
            category: 'settings',
            action: () => {
                setTheme('light');
                closeCommandPalette();
            },
        },
        {
            id: 'sign-out',
            label: 'Cerrar sesión',
            icon: '🚪',
            category: 'settings',
            action: () => {
                closeCommandPalette();
                signOut();
            },
        },
        {
            id: 'import-capacities',
            label: 'Importar desde Capacities',
            icon: '📥',
            category: 'settings',
            action: () => {
                closeCommandPalette();
                onOpenImport?.();
            },
        },
        {
            id: 'go-home',
            label: 'Ir al inicio',
            icon: '🏠',
            category: 'navigation',
            shortcut: '⌘ H',
            action: () => {
                const { setCurrentSection } = useUIStore.getState();
                setCurrentSection('dashboard');
                closeCommandPalette();
            },
        },
        {
            id: 'focus-mode',
            label: 'Enfocar',
            icon: '🎯',
            category: 'navigation',
            shortcut: '⌘ .',
            action: () => {
                const { toggleFocusMode, focusMode } = useUIStore.getState();
                if (!focusMode) toggleFocusMode();
                closeCommandPalette();
            },
        },
        {
            id: 'unfocus-mode',
            label: 'Desenfocar',
            icon: '👀',
            category: 'navigation',
            action: () => {
                const { exitFocusMode, focusMode } = useUIStore.getState();
                if (focusMode) exitFocusMode();
                closeCommandPalette();
            },
        },
    ], [closeCommandPalette, openSettings, setTheme, signOut, onOpenImport]);

    // Create actions for each object type
    const createActions = useMemo((): ResultItem[] => {
        return objectTypes.map(type => ({
            type: 'create' as const,
            id: `create-${type.id}`,
            createType: type.id,
        }));
    }, [objectTypes]);

    // Parse @tipo/nombre > prop = value syntax for quick object creation with properties

    let quickCreateMatch: {
        type: ObjectType | null;
        name: string;
        properties: Record<string, PropertyValue>;
        rawProperties: Record<string, string>;
        isUpdate: boolean;
        existingObjectId?: string;
    } | null = null;

    const parsed = parseObjectCommand(commandPaletteQuery, objectTypes, objects);
    if (parsed) {
        const { properties } = convertPropertyValues(
            parsed.properties,
            parsed.type,
            objects
        );

        quickCreateMatch = {
            type: parsed.type,
            name: parsed.name,
            properties,
            rawProperties: parsed.properties,
            isUpdate: parsed.isUpdate,
            existingObjectId: parsed.existingObject?.id,
        };
    }

    // Get relation suggestions for autocomplete (uses local state for reliability)
    const { relationContext, relationSuggestions } = useMemo(() => {
        const context = getRelationSuggestions(localQuery, objectTypes, objects);
        return {
            relationContext: context,
            relationSuggestions: context?.suggestions ?? []
        };
    }, [localQuery, objectTypes, objects]);

    // Search results
    const searchResults = useMemo(() => {
        // Don't search if using @tipo/nombre syntax
        if (quickCreateMatch) return [];

        const { typeFilters, tagFilters, showBlocksOnly, resultLimit } = extendedSearchFilters;

        return searchObjects(objects, objectTypes, {
            query: commandPaletteQuery,
            typeFilters: commandPaletteMode === 'extended' ? typeFilters : [],
            tagFilters: commandPaletteMode === 'extended' ? tagFilters : [],
            showBlocksOnly: commandPaletteMode === 'extended' ? showBlocksOnly : false,
            limit: commandPaletteMode === 'extended' ? resultLimit : 10,
        });
    }, [objects, objectTypes, commandPaletteQuery, commandPaletteMode, extendedSearchFilters, quickCreateMatch]);

    // Filter calendar events by query
    const filteredCalendarEvents = useMemo(() => {
        if (quickCreateMatch) return [];
        const query = commandPaletteQuery.toLowerCase().trim();
        if (!query) return []; // Only show events when searching

        return calendarEvents.filter(event =>
            event.summary.toLowerCase().includes(query) ||
            event.description?.toLowerCase().includes(query) ||
            event.location?.toLowerCase().includes(query) ||
            event.calendarName.toLowerCase().includes(query)
        ).slice(0, 50); // Limit to 50 calendar events
    }, [calendarEvents, commandPaletteQuery, quickCreateMatch]);

    // Build unified list of items
    const items = useMemo((): ResultItem[] => {
        const result: ResultItem[] = [];
        const query = commandPaletteQuery.toLowerCase();

        // If @tipo/nombre syntax detected, show quick create option first
        if (quickCreateMatch) {
            const propsPreview = Object.keys(quickCreateMatch.rawProperties).length > 0
                ? formatPropertiesPreview(quickCreateMatch.rawProperties, quickCreateMatch.type)
                : undefined;

            result.push({
                type: 'quickCreate',
                id: 'quick-create',
                createType: quickCreateMatch.type?.id,
                quickCreateName: quickCreateMatch.name,
                quickCreateProperties: quickCreateMatch.properties,
                quickCreatePropertiesPreview: propsPreview,
                isUpdate: quickCreateMatch.isUpdate,
                existingObjectId: quickCreateMatch.existingObjectId,
            });
            return result;
        }

        // Filter commands by query
        const matchingCommands = commands.filter(cmd =>
            !query || cmd.label.toLowerCase().includes(query)
        );

        // Add commands section (only in quick mode or when query matches)
        if (commandPaletteMode === 'quick' || query) {
            for (const cmd of matchingCommands.slice(0, 10)) {
                result.push({
                    type: 'action',
                    id: cmd.id,
                    action: cmd,
                });
            }
        }

        // Add create actions when typing "crear" or "nuevo" or query is empty
        const showCreate = !query || query.includes('crear') || query.includes('nuevo') || query.includes('new');
        if (showCreate && commandPaletteMode === 'quick') {
            for (const createAction of createActions.slice(0, 8)) {
                result.push(createAction);
            }
        }

        // Add search results from objects
        for (const sr of searchResults) {
            result.push({
                type: 'result',
                id: sr.object.id,
                result: sr,
            });
        }

        // Add calendar events
        for (const event of filteredCalendarEvents) {
            result.push({
                type: 'event',
                id: `event-${event.id}`,
                event: event,
            });
        }

        return result;
    }, [commands, createActions, searchResults, filteredCalendarEvents, commandPaletteQuery, commandPaletteMode, quickCreateMatch]);

    // Grouped results for extended mode
    const groupedResults = useMemo(() => {
        if (commandPaletteMode !== 'extended' || !extendedSearchFilters.groupByType) {
            return null;
        }
        return groupResultsByType(searchResults, objectTypes);
    }, [commandPaletteMode, extendedSearchFilters.groupByType, searchResults, objectTypes]);

    // All tags for filter panel
    const allTags = useMemo(() => getAllTags(objects), [objects]);

    // Reset selection when items change
    useEffect(() => {
        setSelectedIndex(0);
    }, [items.length, commandPaletteQuery]);

    // Focus input when opened
    useEffect(() => {
        if (commandPaletteOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [commandPaletteOpen]);

    // Handle selecting a relation suggestion (insert into input)
    const handleSelectSuggestion = useCallback((suggestion: RelationSuggestion) => {
        if (!relationContext) return;

        // Replace partial value with the selected object title
        const beforeEquals = commandPaletteQuery.slice(0, relationContext.insertPosition);
        const newQuery = beforeEquals + ' ' + suggestion.title;
        setCommandPaletteQuery(newQuery);
        setSuggestionIndex(0);
    }, [relationContext, commandPaletteQuery, setCommandPaletteQuery]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // If we have relation suggestions, prioritize them
        if (relationSuggestions.length > 0) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSuggestionIndex(i => Math.min(i + 1, relationSuggestions.length - 1));
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    setSuggestionIndex(i => Math.max(i - 1, 0));
                    return;
                case 'Tab':
                case 'Enter':
                    e.preventDefault();
                    const suggestion = relationSuggestions[suggestionIndex];
                    if (suggestion) handleSelectSuggestion(suggestion);
                    return;
                case 'Escape':
                    e.preventDefault();
                    closeCommandPalette();
                    return;
            }
        }

        // Normal navigation for command palette items
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, items.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                const selected = items[selectedIndex];
                if (selected) handleSelectItem(selected);
                break;
            case 'Escape':
                e.preventDefault();
                closeCommandPalette();
                break;
        }
    }, [items, selectedIndex, closeCommandPalette, relationSuggestions, suggestionIndex, handleSelectSuggestion]);

    // Handle item selection
    const handleSelectItem = async (item: ResultItem) => {
        switch (item.type) {
            case 'action':
                item.action?.action();
                break;
            case 'create':
                if (item.createType) {
                    const type = objectTypes.find(t => t.id === item.createType);
                    await createObject(item.createType, `Nuevo ${type?.name || 'objeto'}`);
                    closeCommandPalette();
                }
                break;
            case 'quickCreate':
                if (item.isUpdate && item.existingObjectId && item.quickCreateProperties) {
                    // Update existing object
                    await updateObject(item.existingObjectId, {
                        properties: {
                            ...objects.find(o => o.id === item.existingObjectId)?.properties,
                            ...item.quickCreateProperties,
                        },
                    });
                    // Don't auto-select/navigate, just close
                    closeCommandPalette();
                } else if (item.createType && item.quickCreateName) {
                    // Create new object with optional properties
                    // DON'T auto-select (false) - stay on current view
                    await createObject(
                        item.createType,
                        item.quickCreateName,
                        '',
                        false,  // Don't auto-select
                        item.quickCreateProperties || {}
                    );
                    closeCommandPalette();
                }
                break;
            case 'result':
                if (item.result) {
                    selectObject(item.result.object.id);
                    const { setCurrentSection } = useUIStore.getState();
                    setCurrentSection('objects');
                    closeCommandPalette();
                }
                break;
            case 'event':
                if (item.event) {
                    setSelectedEvent(item.event);
                }
                break;
        }
    };

    // Scroll selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selectedEl = listRef.current.querySelector('.command-item.selected');
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    if (!commandPaletteOpen) return null;

    const isExtended = commandPaletteMode === 'extended';

    return (
        <div className="command-palette-overlay" onClick={closeCommandPalette}>
            <div
                className={`command-palette ${isExtended ? 'extended' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="command-search">
                    <span className="command-search-icon">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="command-input"
                        placeholder={isExtended ? "Buscar en todos los objetos..." : "Buscar o ejecutar comando..."}
                        value={commandPaletteQuery}
                        onChange={e => {
                            const val = e.target.value;
                            setCommandPaletteQuery(val);
                            setLocalQuery(val);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    {commandPaletteQuery && (
                        <button
                            className="command-clear"
                            onClick={() => {
                                setCommandPaletteQuery('');
                                setLocalQuery('');
                            }}
                        >
                            ✕
                        </button>
                    )}

                    {/* Relation suggestions dropdown */}
                    {relationSuggestions.length > 0 && (
                        <div className="relation-suggestions">
                            <div className="relation-suggestions-header">
                                Selecciona un objeto:
                            </div>
                            {relationSuggestions.map((suggestion, index) => (
                                <div
                                    key={suggestion.id}
                                    className={`relation-suggestion-item ${index === suggestionIndex ? 'selected' : ''}`}
                                    onClick={() => handleSelectSuggestion(suggestion)}
                                    onMouseEnter={() => setSuggestionIndex(index)}
                                >
                                    {suggestion.typeColor && (
                                        <span
                                            className="suggestion-type-dot"
                                            style={{ backgroundColor: suggestion.typeColor }}
                                        />
                                    )}
                                    <span className="suggestion-title">{suggestion.title}</span>
                                    {suggestion.typeName && (
                                        <span className="suggestion-type-name">{suggestion.typeName}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Extended mode filters */}
                {isExtended && (
                    <div className="command-filters">
                        <div className="filter-section">
                            <div className="filter-label">Tipos</div>
                            <div className="filter-chips">
                                {objectTypes.map(type => (
                                    <button
                                        key={type.id}
                                        className={`filter-chip ${extendedSearchFilters.typeFilters.includes(type.id) ? 'active' : ''}`}
                                        onClick={() => toggleTypeFilter(type.id)}
                                        style={{ '--chip-color': type.color } as React.CSSProperties}
                                    >
                                        <LucideIcon name={type.icon} size={14} color={type.color} />
                                        {type.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {allTags.length > 0 && (
                            <div className="filter-section">
                                <div className="filter-label">Etiquetas</div>
                                <div className="filter-chips">
                                    {allTags.slice(0, 10).map(tag => (
                                        <button
                                            key={tag}
                                            className={`filter-chip tag ${extendedSearchFilters.tagFilters.includes(tag) ? 'active' : ''}`}
                                            onClick={() => toggleTagFilter(tag)}
                                        >
                                            #{tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="filter-toggles">
                            <label className="filter-toggle">
                                <input
                                    type="checkbox"
                                    checked={extendedSearchFilters.showBlocksOnly}
                                    onChange={e => setExtendedSearchFilters({ showBlocksOnly: e.target.checked })}
                                />
                                Solo bloques de contenido
                            </label>
                            <label className="filter-toggle">
                                <input
                                    type="checkbox"
                                    checked={extendedSearchFilters.groupByType}
                                    onChange={e => setExtendedSearchFilters({ groupByType: e.target.checked })}
                                />
                                Agrupar por tipo
                            </label>
                        </div>
                    </div>
                )}

                {/* Results List */}
                <div className="command-results" ref={listRef}>
                    {items.length === 0 ? (
                        <div className="command-empty">
                            {commandPaletteQuery ? 'Sin resultados' : 'Escribe para buscar...'}
                        </div>
                    ) : isExtended && groupedResults ? (
                        // Grouped view for extended mode
                        Array.from(groupedResults.entries()).map(([typeId, results]) => {
                            const type = objectTypes.find(t => t.id === typeId);
                            return (
                                <div key={typeId} className="command-group">
                                    <div className="command-group-header">
                                        <LucideIcon name={type?.icon || 'FileText'} size={16} color={type?.color} />
                                        {type?.namePlural || typeId}
                                        <span className="command-group-count">{results.length}</span>
                                    </div>
                                    {results.map(sr => (
                                        <ResultItemComponent
                                            key={sr.object.id}
                                            result={sr}
                                            objectTypes={objectTypes}
                                            isSelected={items[selectedIndex]?.id === sr.object.id}
                                            onClick={() => handleSelectItem({ type: 'result', id: sr.object.id, result: sr })}
                                        />
                                    ))}
                                </div>
                            );
                        })
                    ) : (
                        // Flat list (quick mode or no grouping)
                        items.map((item, index) => (
                            <CommandItem
                                key={item.id}
                                item={item}
                                objectTypes={objectTypes}
                                isSelected={index === selectedIndex}
                                onClick={() => handleSelectItem(item)}
                            />
                        ))
                    )}
                </div>

                {/* Footer with keyboard hints */}
                <div className="command-footer">
                    <span className="command-hint">
                        <kbd>↑↓</kbd> navegar
                    </span>
                    <span className="command-hint">
                        <kbd>↵</kbd> seleccionar
                    </span>
                    <span className="command-hint">
                        <kbd>Esc</kbd> cerrar
                    </span>
                    {!isExtended && (
                        <span className="command-hint">
                            <kbd>⌘⇧P</kbd> búsqueda extendida
                        </span>
                    )}
                </div>
            </div>

            {/* Event Modal for calendar events */}
            {selectedEvent && (
                <EventModal
                    event={selectedEvent}
                    onClose={() => {
                        setSelectedEvent(null);
                        closeCommandPalette();
                    }}
                />
            )}
        </div>
    );
};

// Individual command/result item
const CommandItem = ({
    item,
    objectTypes,
    isSelected,
    onClick,
}: {
    item: ResultItem;
    objectTypes: typeof import('../../types/object').DEFAULT_OBJECT_TYPES;
    isSelected: boolean;
    onClick: () => void;
}) => {
    if (item.type === 'action' && item.action) {
        return (
            <div
                className={`command-item action ${isSelected ? 'selected' : ''}`}
                onClick={onClick}
            >
                <span className="command-item-icon">{item.action.icon}</span>
                <span className="command-item-label">{item.action.label}</span>
                {item.action.shortcut && (
                    <span className="command-item-shortcut">{item.action.shortcut}</span>
                )}
            </div>
        );
    }

    if (item.type === 'create' && item.createType) {
        const type = objectTypes.find(t => t.id === item.createType);
        return (
            <div
                className={`command-item create ${isSelected ? 'selected' : ''}`}
                onClick={onClick}
                style={{ '--type-color': type?.color } as React.CSSProperties}
            >
                <span className="command-item-icon">
                    <LucideIcon name={type?.icon || 'FileText'} size={16} color={type?.color} />
                </span>
                <span className="command-item-label">Crear nuevo "{type?.name}"</span>
            </div>
        );
    }

    if (item.type === 'result' && item.result) {
        return (
            <ResultItemComponent
                result={item.result}
                objectTypes={objectTypes}
                isSelected={isSelected}
                onClick={onClick}
            />
        );
    }

    if (item.type === 'quickCreate' && item.quickCreateName) {
        const type = item.createType ? objectTypes.find(t => t.id === item.createType) : null;
        const isUpdate = item.isUpdate;
        const hasProps = item.quickCreatePropertiesPreview;

        return (
            <div
                className={`command-item quick-create ${isSelected ? 'selected' : ''} ${isUpdate ? 'update' : ''}`}
                onClick={onClick}
                style={{ '--type-color': type?.color || '#6366f1' } as React.CSSProperties}
            >
                <span className="command-item-icon">
                    <LucideIcon name={isUpdate ? 'Pencil' : (type?.icon || 'FileText')} size={16} color={type?.color || '#6366f1'} />
                </span>
                <div className="command-item-content">
                    <span className="command-item-label">
                        {isUpdate ? (
                            <>Actualizar <strong>{item.quickCreateName}</strong></>
                        ) : (
                            <>Crear <strong>{type?.name || 'objeto'}</strong>: "{item.quickCreateName}"</>
                        )}
                    </span>
                    {hasProps && (
                        <span className="command-item-props">
                            {item.quickCreatePropertiesPreview}
                        </span>
                    )}
                </div>
                <span
                    className="command-item-badge"
                    style={{ backgroundColor: type?.color || '#6366f1' }}
                >
                    {isUpdate ? '✎ Editar' : '+ Nuevo'}
                </span>
            </div>
        );
    }

    if (item.type === 'event' && item.event) {
        const event = item.event;
        const eventDate = new Date(event.start);
        const formatEventTime = () => {
            if (event.isAllDay) return 'Todo el día';
            return eventDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        };
        const formatEventDate = () => {
            return eventDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        };

        return (
            <div
                className={`command-item event ${isSelected ? 'selected' : ''}`}
                onClick={onClick}
                style={{ '--type-color': event.calendarColor } as React.CSSProperties}
            >
                <span className="command-item-icon">📅</span>
                <div className="command-item-content">
                    <div className="command-item-title">{event.summary}</div>
                    <div className="command-item-context">
                        {formatEventDate()} • {formatEventTime()} • {event.calendarName}
                    </div>
                </div>
                <span
                    className="command-item-badge"
                    style={{ backgroundColor: event.calendarColor }}
                >
                    Evento
                </span>
            </div>
        );
    }

    return null;
};

// Search result item with match highlighting
const ResultItemComponent = ({
    result,
    objectTypes,
    isSelected,
    onClick,
}: {
    result: SearchResult;
    objectTypes: typeof import('../../types/object').DEFAULT_OBJECT_TYPES;
    isSelected: boolean;
    onClick: () => void;
}) => {
    const type = objectTypes.find(t => t.id === result.object.type);
    const contentMatch = result.matches.find(m => m.field === 'content');

    return (
        <div
            className={`command-item result ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
            style={{ '--type-color': type?.color } as React.CSSProperties}
        >
            <span className="command-item-icon">
                <LucideIcon name={type?.icon || 'FileText'} size={16} color={type?.color} />
            </span>
            <div className="command-item-content">
                <div className="command-item-title">{result.object.title}</div>
                {contentMatch && (
                    <div className="command-item-context">{contentMatch.context}</div>
                )}
                {result.object.tags.length > 0 && (
                    <div className="command-item-tags">
                        {result.object.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="command-item-tag">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>
            <span
                className="command-item-badge"
                style={{ backgroundColor: type?.color }}
            >
                {type?.name}
            </span>
        </div>
    );
};

export default CommandPalette;
