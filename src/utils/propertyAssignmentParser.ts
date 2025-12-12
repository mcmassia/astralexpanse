// Property assignment parser for @type/name > prop = value syntax
// Uses > for new objects with properties, >> for updating existing objects
import type { ObjectType, PropertyDefinition, PropertyValue, AstralObject } from '../types/object';

export interface ParsedObjectCommand {
    type: ObjectType | null;         // null if updating existing object by name only
    name: string;                    // Object name (without type prefix or properties)
    properties: Record<string, string>;  // Raw string values before type conversion
    isUpdate: boolean;               // true if using >> syntax (updating existing)
    existingObject?: AstralObject;   // The found existing object if isUpdate
}

export interface ConvertedProperties {
    properties: Record<string, PropertyValue>;
    errors: string[];                // Validation errors (e.g., invalid select option)
    warnings: string[];              // Non-fatal issues (e.g., unknown property)
}

/**
 * Normalize text for comparison (remove accents, lowercase)
 */
function normalizeText(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Parse date strings including Spanish natural language
 */
function parseSpanishDate(value: string): Date | null {
    const normalized = normalizeText(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const naturalDates: Record<string, () => Date> = {
        'hoy': () => today,
        'manana': () => {
            const d = new Date(today);
            d.setDate(d.getDate() + 1);
            return d;
        },
        'ayer': () => {
            const d = new Date(today);
            d.setDate(d.getDate() - 1);
            return d;
        },
    };

    if (naturalDates[normalized]) {
        return naturalDates[normalized]();
    }

    // Try ISO format (YYYY-MM-DD)
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
        if (!isNaN(d.getTime())) return d;
    }

    // Try Spanish format (DD/MM/YYYY)
    const esMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (esMatch) {
        const d = new Date(parseInt(esMatch[3]), parseInt(esMatch[2]) - 1, parseInt(esMatch[1]));
        if (!isNaN(d.getTime())) return d;
    }

    const parsed = Date.parse(value);
    return isNaN(parsed) ? null : new Date(parsed);
}

/**
 * Parse @type/name > prop = value OR @name >> prop = value
 * - Single > = create new object with properties
 * - Double >> = update existing object
 */
export function parseObjectCommand(
    input: string,
    objectTypes: ObjectType[],
    existingObjects: AstralObject[]
): ParsedObjectCommand | null {
    const trimmed = input.trim();

    // Handle input with or without @ prefix
    const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

    // Check for >> (update) vs > (create with props)
    const doubleArrowIndex = withoutAt.indexOf('>>');
    const singleArrowIndex = withoutAt.indexOf('>');

    // Determine if this is an update (>>) or create (>)
    const isUpdate = doubleArrowIndex !== -1;
    const arrowIndex = isUpdate ? doubleArrowIndex : singleArrowIndex;
    const arrowLength = isUpdate ? 2 : 1;

    // If no arrow, this is a regular @type/name without properties
    if (arrowIndex === -1) {
        // Check for @type/name syntax (creation without props)
        const slashIndex = withoutAt.indexOf('/');
        if (slashIndex > 0) {
            const typePart = withoutAt.slice(0, slashIndex).trim();
            const namePart = withoutAt.slice(slashIndex + 1).trim();

            if (!namePart) return null;

            const normalizedType = normalizeText(typePart);
            const matchedType = objectTypes.find(t =>
                normalizeText(t.id) === normalizedType ||
                normalizeText(t.name) === normalizedType ||
                normalizeText(t.namePlural) === normalizedType
            );

            if (matchedType) {
                return {
                    type: matchedType,
                    name: namePart,
                    properties: {},
                    isUpdate: false,
                };
            }
        }
        return null;
    }

    // Has arrow - parse base and properties
    const basePart = withoutAt.slice(0, arrowIndex).trim();
    const propsPart = withoutAt.slice(arrowIndex + arrowLength).trim();

    // Parse properties
    const properties: Record<string, string> = {};
    if (propsPart) {
        Object.assign(properties, parsePropertyAssignments(propsPart));
    }

    // For update (>>), find existing object by name (partial match)
    if (isUpdate) {
        const normalizedName = normalizeText(basePart);

        // Try exact match first
        let existingObject = existingObjects.find(o =>
            normalizeText(o.title) === normalizedName
        );

        // If no exact match, try partial match (title contains search term)
        if (!existingObject) {
            existingObject = existingObjects.find(o =>
                normalizeText(o.title).includes(normalizedName) ||
                normalizedName.includes(normalizeText(o.title))
            );
        }

        if (existingObject) {
            const objType = objectTypes.find(t => t.id === existingObject.type) || null;
            return {
                type: objType,
                name: existingObject.title, // Use actual object title
                properties,
                isUpdate: true,
                existingObject,
            };
        }
        // No existing object found for update
        return null;
    }

    // For create (>), must have @type/name format
    const slashIndex = basePart.indexOf('/');
    if (slashIndex <= 0) return null;

    const typePart = basePart.slice(0, slashIndex).trim();
    const namePart = basePart.slice(slashIndex + 1).trim();

    if (!namePart) return null;

    const normalizedType = normalizeText(typePart);
    const matchedType = objectTypes.find(t =>
        normalizeText(t.id) === normalizedType ||
        normalizeText(t.name) === normalizedType ||
        normalizeText(t.namePlural) === normalizedType
    );

    if (!matchedType) return null;

    return {
        type: matchedType,
        name: namePart,
        properties,
        isUpdate: false,
    };
}

/**
 * Parse "prop1 = value1, prop2 = value2" into a Record
 */
export function parsePropertyAssignments(propsString: string): Record<string, string> {
    const result: Record<string, string> = {};

    if (!propsString.trim()) return result;

    // Split by comma, handling brackets
    const assignments: string[] = [];
    let current = '';
    let bracketDepth = 0;

    for (const char of propsString) {
        if (char === '[') bracketDepth++;
        else if (char === ']') bracketDepth--;

        if (char === ',' && bracketDepth === 0) {
            assignments.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) {
        assignments.push(current.trim());
    }

    for (const assignment of assignments) {
        const eqIndex = assignment.indexOf('=');
        if (eqIndex > 0) {
            const propName = assignment.slice(0, eqIndex).trim();
            let propValue = assignment.slice(eqIndex + 1).trim();

            // Remove quotes
            if ((propValue.startsWith('"') && propValue.endsWith('"')) ||
                (propValue.startsWith("'") && propValue.endsWith("'"))) {
                propValue = propValue.slice(1, -1);
            }

            result[propName] = propValue;
        }
    }

    return result;
}

/**
 * Convert raw string property values to typed PropertyValue
 */
export function convertPropertyValues(
    rawProperties: Record<string, string>,
    objectType: ObjectType | null,
    existingObjects: AstralObject[]
): ConvertedProperties {
    const converted: Record<string, PropertyValue> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!objectType) {
        for (const [key, value] of Object.entries(rawProperties)) {
            converted[key] = value;
        }
        return { properties: converted, errors, warnings };
    }

    for (const [propName, rawValue] of Object.entries(rawProperties)) {
        const normalizedName = normalizeText(propName);

        // Try exact match first
        let propDef = objectType.properties.find(p =>
            normalizeText(p.id) === normalizedName ||
            normalizeText(p.name) === normalizedName
        );

        // Try partial/fuzzy match if no exact match
        if (!propDef) {
            propDef = objectType.properties.find(p => {
                const normalizedId = normalizeText(p.id);
                const normalizedPropName = normalizeText(p.name);
                // Check if either contains the other (handles organizacion/organizaciones)
                return normalizedId.includes(normalizedName) ||
                    normalizedName.includes(normalizedId) ||
                    normalizedPropName.includes(normalizedName) ||
                    normalizedName.includes(normalizedPropName);
            });
        }

        if (!propDef) {
            warnings.push(`Propiedad desconocida: "${propName}"`);

            // Check if value is an @reference - auto-detect relation
            if (rawValue.trim().startsWith('@')) {
                const refName = rawValue.trim().slice(1); // Remove @
                const normalizedRef = normalizeText(refName);

                // Try to find the referenced object
                let found = existingObjects.find(o => normalizeText(o.title) === normalizedRef);
                if (!found) {
                    found = existingObjects.find(o =>
                        normalizeText(o.title).includes(normalizedRef) ||
                        normalizedRef.includes(normalizeText(o.title))
                    );
                }

                if (found) {
                    converted[propName.toLowerCase().replace(/\s+/g, '_')] = [{ id: found.id, title: found.title }];
                    continue;
                }
            }

            converted[propName.toLowerCase().replace(/\s+/g, '_')] = rawValue;
            continue;
        }

        const convertedValue = coercePropertyValue(rawValue, propDef, existingObjects);

        if (convertedValue.error) {
            errors.push(`${propDef.name}: ${convertedValue.error}`);
        } else if (convertedValue.value !== undefined) {
            converted[propDef.id] = convertedValue.value;
        }
    }

    return { properties: converted, errors, warnings };
}

function coercePropertyValue(
    value: string,
    propDef: PropertyDefinition,
    existingObjects: AstralObject[]
): { value?: PropertyValue; error?: string } {
    const trimmed = value.trim();

    switch (propDef.type) {
        case 'text':
        case 'url':
        case 'email':
            return { value: trimmed };

        case 'number':
        case 'rating': {
            const num = parseFloat(trimmed);
            if (isNaN(num)) {
                return { error: `"${trimmed}" no es un número válido` };
            }
            return { value: num };
        }

        case 'date':
        case 'datetime': {
            const date = parseSpanishDate(trimmed);
            if (!date) {
                return { error: `"${trimmed}" no es una fecha válida` };
            }
            return { value: date };
        }

        case 'boolean': {
            const normalized = normalizeText(trimmed);
            if (['true', 'si', 'sí', 'yes', '1'].includes(normalized)) {
                return { value: true };
            } else if (['false', 'no', '0'].includes(normalized)) {
                return { value: false };
            }
            return { error: `"${trimmed}" no es un valor booleano válido` };
        }

        case 'select': {
            if (!propDef.options?.length) return { value: trimmed };
            const normalizedValue = normalizeText(trimmed);
            const matched = propDef.options.find(opt => normalizeText(opt) === normalizedValue);
            if (matched) return { value: matched };
            return { error: `"${trimmed}" no es una opción válida` };
        }

        case 'multiselect':
        case 'tags': {
            let values: string[];
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                values = trimmed.slice(1, -1).split(',').map(v => v.trim()).filter(v => v);
            } else {
                values = trimmed.split(',').map(v => v.trim()).filter(v => v);
            }
            return { value: values };
        }

        case 'relation': {
            let names: string[];
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                names = trimmed.slice(1, -1).split(',').map(v => v.trim()).filter(v => v);
            } else {
                names = [trimmed];
            }

            const relations: { id: string; title: string }[] = [];
            for (let name of names) {
                // Support @objectName syntax - strip the @ prefix
                if (name.startsWith('@')) {
                    name = name.slice(1);
                }

                const normalizedName = normalizeText(name);

                // First try with type filter
                let candidates = existingObjects;
                if (propDef.relationTypeId) {
                    candidates = candidates.filter(o => o.type === propDef.relationTypeId);
                }

                // Try exact match first
                let found = candidates.find(o => normalizeText(o.title) === normalizedName);

                // If no exact match, try partial match
                if (!found) {
                    found = candidates.find(o =>
                        normalizeText(o.title).includes(normalizedName) ||
                        normalizedName.includes(normalizeText(o.title))
                    );
                }

                // FALLBACK: If still not found and we had a type filter, search ALL objects
                if (!found && propDef.relationTypeId) {
                    found = existingObjects.find(o => normalizeText(o.title) === normalizedName);
                    if (!found) {
                        found = existingObjects.find(o =>
                            normalizeText(o.title).includes(normalizedName) ||
                            normalizedName.includes(normalizeText(o.title))
                        );
                    }
                }

                if (found) {
                    relations.push({ id: found.id, title: found.title });
                }
            }
            return { value: relations };
        }

        default:
            return { value: trimmed };
    }
}

/**
 * Format properties preview for UI
 */
export function formatPropertiesPreview(
    properties: Record<string, string>,
    objectType: ObjectType | null
): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(properties)) {
        let displayName = key;
        if (objectType) {
            const propDef = objectType.properties.find(p =>
                normalizeText(p.id) === normalizeText(key) ||
                normalizeText(p.name) === normalizeText(key)
            );
            if (propDef) displayName = propDef.name;
        }
        const displayValue = value.length > 15 ? value.slice(0, 12) + '...' : value;
        parts.push(`${displayName}=${displayValue}`);
    }

    return parts.join(', ');
}

/**
 * Check if input has > (create with props) or >> (update) syntax
 */
export function hasPropertyAssignment(input: string): boolean {
    return input.includes('>');
}

/**
 * Get the name part only (before > or >>)
 */
export function extractNameFromCommand(input: string): string {
    const withoutAt = input.startsWith('@') ? input.slice(1) : input;

    // Check for >> first
    let arrowIndex = withoutAt.indexOf('>>');
    if (arrowIndex === -1) {
        arrowIndex = withoutAt.indexOf('>');
    }

    const basePart = arrowIndex !== -1 ? withoutAt.slice(0, arrowIndex).trim() : withoutAt.trim();

    // If contains slash, return part after slash
    const slashIndex = basePart.indexOf('/');
    if (slashIndex > 0) {
        return basePart.slice(slashIndex + 1).trim();
    }

    return basePart;
}

export interface RelationSuggestion {
    id: string;
    title: string;
    type: string;
    typeColor?: string;
    typeName?: string;
}

export interface RelationSuggestionContext {
    suggestions: RelationSuggestion[];
    propertyName: string;
    partialValue: string;
    insertPosition: number; // Position after = where value starts
}

/**
 * Get relation suggestions for autocomplete when typing property values
 * Returns suggestions if currently typing after = in a property assignment
 */
export function getRelationSuggestions(
    input: string,
    objectTypes: ObjectType[],
    existingObjects: AstralObject[],
    limit: number = 8
): RelationSuggestionContext | null {
    // Must have > or >> and = to be in property value context
    if (!input.includes('>') || !input.includes('=')) {
        return null;
    }

    const equalsIndex = input.lastIndexOf('=');

    // Extract what's after the last =
    const partialValue = input.slice(equalsIndex + 1).trim();

    // Extract property name from between > and =
    const arrowIndex = input.indexOf('>');
    const afterArrow = input.slice(arrowIndex + (input[arrowIndex + 1] === '>' ? 2 : 1));
    const propsPart = afterArrow.slice(0, afterArrow.indexOf('='));
    const propertyName = propsPart.trim();

    // Filter objects based on partial value
    const normalizedPartial = normalizeText(partialValue);
    let candidates = existingObjects;

    // Filter by partial match if there's text
    if (normalizedPartial) {
        candidates = candidates.filter(o =>
            normalizeText(o.title).includes(normalizedPartial)
        );
    }

    // Get type info for each candidate
    const suggestions: RelationSuggestion[] = candidates.slice(0, limit).map(obj => {
        const objType = objectTypes.find(t => t.id === obj.type);
        return {
            id: obj.id,
            title: obj.title,
            type: obj.type,
            typeColor: objType?.color,
            typeName: objType?.name,
        };
    });

    return {
        suggestions,
        propertyName,
        partialValue,
        insertPosition: equalsIndex + 1,
    };
}
