// RelationAutocomplete - Autocomplete input for relation properties
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { AstralObject, ObjectType, PropertyDefinition } from '../../types/object';
import { useObjectStore } from '../../stores/objectStore';

interface RelationAutocompleteProps {
    definition: PropertyDefinition;
    currentRelations: { id: string; title: string }[];
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onChange: (relations: { id: string; title: string }[]) => void;
    onRelationClick?: (objectId: string) => void;
}

interface Suggestion {
    id: string;
    title: string;
    type: string;
    typeColor?: string;
    typeIcon?: string;
    typeName?: string;
}

interface CreateSuggestion {
    isCreate: true;
    title: string;
    typeId?: string;
    typeName?: string;
    typeColor?: string;
    typeIcon?: string;
}

type SuggestionItem = Suggestion | CreateSuggestion;

export const RelationAutocomplete = ({
    definition,
    currentRelations,
    objects,
    objectTypes,
    onChange,
    onRelationClick,
}: RelationAutocompleteProps) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const createObject = useObjectStore(s => s.createObject);

    // Get allowed relation types
    const relationTypeIds = useMemo(() => {
        if (!definition.relationTypeId) return [];
        return definition.relationTypeId.split(',').map(s => s.trim());
    }, [definition.relationTypeId]);

    const allowAnyType = relationTypeIds.length === 0 || relationTypeIds.includes('any');

    // Filter available objects
    const availableObjects = useMemo(() => {
        const selectedIds = new Set(currentRelations.map(r => r.id));
        let filtered = objects.filter(o => !selectedIds.has(o.id));

        if (!allowAnyType) {
            filtered = filtered.filter(o => relationTypeIds.includes(o.type));
        }

        return filtered;
    }, [objects, currentRelations, allowAnyType, relationTypeIds]);

    // Parse @type/name syntax
    const parseCreateSyntax = useCallback((query: string): { typeId?: string; title: string } | null => {
        const match = query.match(/^@([^/]+)\/(.+)$/);
        if (match) {
            const [, typePart, titlePart] = match;
            const normalizedType = typePart.toLowerCase().trim();

            // Find matching type by name or id
            const matchedType = objectTypes.find(t =>
                t.name.toLowerCase() === normalizedType ||
                t.id.toLowerCase() === normalizedType ||
                t.namePlural.toLowerCase() === normalizedType
            );

            return {
                typeId: matchedType?.id,
                title: titlePart.trim()
            };
        }
        return null;
    }, [objectTypes]);

    // Generate suggestions
    const suggestions = useMemo((): SuggestionItem[] => {
        const query = searchQuery.toLowerCase().trim();
        const items: SuggestionItem[] = [];

        // Check for @type/name syntax
        const createParsed = parseCreateSyntax(searchQuery);

        if (createParsed) {
            // Only show create option for @type/name syntax
            if (createParsed.typeId && createParsed.title) {
                const typeInfo = objectTypes.find(t => t.id === createParsed.typeId);
                items.push({
                    isCreate: true,
                    title: createParsed.title,
                    typeId: createParsed.typeId,
                    typeName: typeInfo?.name,
                    typeColor: typeInfo?.color,
                    typeIcon: typeInfo?.icon,
                });
            }
            return items;
        }

        // Filter objects by search query
        const filtered = query
            ? availableObjects.filter(o =>
                o.title.toLowerCase().includes(query)
            )
            : availableObjects;

        // Convert to suggestions with type info
        for (const obj of filtered.slice(0, 50)) {
            const typeInfo = objectTypes.find(t => t.id === obj.type);
            items.push({
                id: obj.id,
                title: obj.title,
                type: obj.type,
                typeColor: typeInfo?.color,
                typeIcon: typeInfo?.icon,
                typeName: typeInfo?.name,
            });
        }

        // Add create option if there's a query and no exact match
        if (query && query.length >= 2) {
            const exactMatch = filtered.some(o => o.title.toLowerCase() === query);
            if (!exactMatch) {
                // Determine which type to create
                const defaultTypeId = allowAnyType
                    ? (objectTypes[0]?.id || 'pagina')
                    : relationTypeIds[0];
                const typeInfo = objectTypes.find(t => t.id === defaultTypeId);

                items.push({
                    isCreate: true,
                    title: searchQuery.trim(),
                    typeId: defaultTypeId,
                    typeName: typeInfo?.name,
                    typeColor: typeInfo?.color,
                    typeIcon: typeInfo?.icon,
                });
            }
        }

        return items;
    }, [searchQuery, availableObjects, objectTypes, parseCreateSyntax, allowAnyType, relationTypeIds]);

    // Group suggestions by type
    const groupedSuggestions = useMemo(() => {
        const groups: Record<string, Suggestion[]> = {};
        const createItems: CreateSuggestion[] = [];

        for (const item of suggestions) {
            if ('isCreate' in item) {
                createItems.push(item);
            } else {
                if (!groups[item.type]) groups[item.type] = [];
                groups[item.type].push(item);
            }
        }

        return { groups, createItems };
    }, [suggestions]);

    // Handle selection
    const handleSelect = useCallback(async (item: SuggestionItem) => {
        if ('isCreate' in item) {
            // Create new object
            if (item.typeId && item.title) {
                try {
                    const newObject = await createObject(item.typeId, item.title, '', false);
                    onChange([...currentRelations, { id: newObject.id, title: newObject.title }]);
                } catch (error) {
                    console.error('Error creating object:', error);
                }
            }
        } else {
            // Add existing object
            onChange([...currentRelations, { id: item.id, title: item.title }]);
        }

        setSearchQuery('');
        setIsOpen(false);
        setSelectedIndex(0);
    }, [createObject, currentRelations, onChange]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (suggestions[selectedIndex]) {
                    handleSelect(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setSearchQuery('');
                break;
        }
    }, [isOpen, suggestions, selectedIndex, handleSelect]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Scroll selected item into view
    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const selectedEl = dropdownRef.current.querySelector('.selected');
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, isOpen]);

    // Remove a relation
    const handleRemove = useCallback((id: string) => {
        onChange(currentRelations.filter(r => r.id !== id));
    }, [currentRelations, onChange]);

    // Get flat index for keyboard navigation
    const getFlatIndex = (typeIndex: number, itemIndex: number, groups: Record<string, Suggestion[]>): number => {
        let index = 0;
        const typeIds = Object.keys(groups);
        for (let t = 0; t < typeIndex; t++) {
            index += groups[typeIds[t]].length;
        }
        return index + itemIndex;
    };

    return (
        <div className="prop-relation">
            {/* Autocomplete Input */}
            <div className="relation-autocomplete">
                <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsOpen(true);
                        setSelectedIndex(0);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar o crear relación..."
                    className="relation-autocomplete-input"
                    autoComplete="off"
                />

                {/* Suggestions Dropdown */}
                {isOpen && suggestions.length > 0 && (
                    <div className="relation-suggestions" ref={dropdownRef}>
                        {/* Grouped object suggestions */}
                        {Object.entries(groupedSuggestions.groups).map(([typeId, items], typeIndex) => {
                            const typeInfo = objectTypes.find(t => t.id === typeId);
                            return (
                                <div key={typeId} className="relation-suggestion-group">
                                    <div
                                        className="relation-suggestion-header"
                                        style={{ '--type-color': typeInfo?.color || '#6366f1' } as React.CSSProperties}
                                    >
                                        <span className="suggestion-type-icon">{typeInfo?.icon || '📄'}</span>
                                        <span>{typeInfo?.namePlural || typeId}</span>
                                    </div>
                                    {items.map((item, itemIndex) => {
                                        const flatIdx = getFlatIndex(typeIndex, itemIndex, groupedSuggestions.groups);
                                        return (
                                            <div
                                                key={item.id}
                                                className={`relation-suggestion-item ${selectedIndex === flatIdx ? 'selected' : ''}`}
                                                onClick={() => handleSelect(item)}
                                                onMouseEnter={() => setSelectedIndex(flatIdx)}
                                            >
                                                <span
                                                    className="suggestion-type-dot"
                                                    style={{ background: item.typeColor || '#6366f1' }}
                                                />
                                                <span className="suggestion-title">{item.title}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* Create new option */}
                        {groupedSuggestions.createItems.map((item, idx) => {
                            const createIdx = suggestions.length - groupedSuggestions.createItems.length + idx;
                            return (
                                <div
                                    key={`create-${item.title}`}
                                    className={`relation-suggestion-item relation-create-option ${selectedIndex === createIdx ? 'selected' : ''}`}
                                    onClick={() => handleSelect(item)}
                                    onMouseEnter={() => setSelectedIndex(createIdx)}
                                >
                                    <span className="create-icon">+</span>
                                    <span className="create-text">
                                        Crear <strong>"{item.title}"</strong>
                                        {item.typeName && (
                                            <span
                                                className="create-type-badge"
                                                style={{ '--type-color': item.typeColor || '#6366f1' } as React.CSSProperties}
                                            >
                                                {item.typeIcon} {item.typeName}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* No results message */}
                {isOpen && searchQuery && suggestions.length === 0 && (
                    <div className="relation-suggestions" ref={dropdownRef}>
                        <div className="relation-no-results">
                            <span>Escribe <code>@tipo/nombre</code> para crear un nuevo objeto</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Current Relations Tags */}
            {currentRelations.length > 0 && (
                <div className="relation-tags">
                    {currentRelations.map(rel => {
                        const relObj = objects.find(o => o.id === rel.id);
                        const relType = relObj ? objectTypes.find(t => t.id === relObj.type) : null;
                        return (
                            <span
                                key={rel.id}
                                className={`relation-tag ${onRelationClick ? 'clickable' : ''}`}
                                style={{ '--type-color': relType?.color || '#6366f1' } as React.CSSProperties}
                                onClick={() => onRelationClick?.(rel.id)}
                                role={onRelationClick ? 'button' : undefined}
                                tabIndex={onRelationClick ? 0 : undefined}
                                onKeyDown={(e) => {
                                    if (onRelationClick && (e.key === 'Enter' || e.key === ' ')) {
                                        e.preventDefault();
                                        onRelationClick(rel.id);
                                    }
                                }}
                            >
                                {rel.title}
                                <button
                                    className="relation-remove"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove(rel.id);
                                    }}
                                >
                                    ✕
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
