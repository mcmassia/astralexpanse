// Command Palette component - Main search and command interface
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { searchObjects, groupResultsByType, getAllTags } from '../../services/searchEngine';
import type { CommandAction, SearchResult } from '../../types/object';
import './CommandPalette.css';

interface ResultItem {
    type: 'action' | 'create' | 'result' | 'quickCreate';
    id: string;
    action?: CommandAction;
    result?: SearchResult;
    createType?: string;
    quickCreateName?: string; // For @tipo/nombre syntax
}

export const CommandPalette = () => {
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

    const [selectedIndex, setSelectedIndex] = useState(0);
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
                // TODO: Navigate to today's daily note when calendar is implemented
                closeCommandPalette();
            },
        },
        {
            id: 'view-month',
            label: 'Ver Mes',
            icon: '📆',
            category: 'navigation',
            action: () => {
                // TODO: Open month view when calendar is implemented
                closeCommandPalette();
            },
        },
        {
            id: 'view-week',
            label: 'Ver Semana',
            icon: '🗓️',
            category: 'navigation',
            action: () => {
                // TODO: Open week view when calendar is implemented
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
    ], [closeCommandPalette, openSettings, setTheme, signOut]);

    // Create actions for each object type
    const createActions = useMemo((): ResultItem[] => {
        return objectTypes.map(type => ({
            type: 'create' as const,
            id: `create-${type.id}`,
            createType: type.id,
        }));
    }, [objectTypes]);

    // Parse @tipo/nombre syntax for quick object creation
    const quickCreateMatch = useMemo(() => {
        const match = commandPaletteQuery.match(/^@([^/]+)\/(.+)$/);
        if (match) {
            const [, typeInput, name] = match;
            const typeLower = typeInput.toLowerCase();
            const matchedType = objectTypes.find(t =>
                t.id.toLowerCase() === typeLower ||
                t.name.toLowerCase() === typeLower ||
                t.namePlural.toLowerCase() === typeLower
            );
            if (matchedType && name.trim()) {
                return { type: matchedType, name: name.trim() };
            }
        }
        return null;
    }, [commandPaletteQuery, objectTypes]);

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

    // Build unified list of items
    const items = useMemo((): ResultItem[] => {
        const result: ResultItem[] = [];
        const query = commandPaletteQuery.toLowerCase();

        // If @tipo/nombre syntax detected, show quick create option first
        if (quickCreateMatch) {
            result.push({
                type: 'quickCreate',
                id: 'quick-create',
                createType: quickCreateMatch.type.id,
                quickCreateName: quickCreateMatch.name,
            });
            return result;
        }

        // Filter commands by query
        const matchingCommands = commands.filter(cmd =>
            !query || cmd.label.toLowerCase().includes(query)
        );

        // Add commands section (only in quick mode or when query matches)
        if (commandPaletteMode === 'quick' || query) {
            for (const cmd of matchingCommands.slice(0, 4)) {
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
            for (const createAction of createActions.slice(0, 3)) {
                result.push(createAction);
            }
        }

        // Add search results
        for (const sr of searchResults) {
            result.push({
                type: 'result',
                id: sr.object.id,
                result: sr,
            });
        }

        return result;
    }, [commands, createActions, searchResults, commandPaletteQuery, commandPaletteMode, quickCreateMatch]);

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

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
    }, [items, selectedIndex, closeCommandPalette]);

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
                if (item.createType && item.quickCreateName) {
                    await createObject(item.createType, item.quickCreateName);
                    closeCommandPalette();
                }
                break;
            case 'result':
                if (item.result) {
                    selectObject(item.result.object.id);
                    closeCommandPalette();
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
                        onChange={e => setCommandPaletteQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    {commandPaletteQuery && (
                        <button
                            className="command-clear"
                            onClick={() => setCommandPaletteQuery('')}
                        >
                            ✕
                        </button>
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
                                        {type.icon} {type.name}
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
                                        {type?.icon} {type?.namePlural || typeId}
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
                <span className="command-item-icon">{type?.icon || '📄'}</span>
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

    if (item.type === 'quickCreate' && item.createType && item.quickCreateName) {
        const type = objectTypes.find(t => t.id === item.createType);
        return (
            <div
                className={`command-item quick-create ${isSelected ? 'selected' : ''}`}
                onClick={onClick}
                style={{ '--type-color': type?.color } as React.CSSProperties}
            >
                <span className="command-item-icon">{type?.icon || '📄'}</span>
                <span className="command-item-label">
                    Crear <strong>{type?.name}</strong>: "{item.quickCreateName}"
                </span>
                <span
                    className="command-item-badge"
                    style={{ backgroundColor: type?.color }}
                >
                    + Nuevo
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
            <span className="command-item-icon">{type?.icon || '📄'}</span>
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
