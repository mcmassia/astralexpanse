// Search engine for full-text search with filter syntax parsing
import type { AstralObject, ObjectType, SearchMatch, SearchResult } from '../types/object';

export interface SearchOptions {
    query: string;
    typeFilters?: string[];
    tagFilters?: string[];
    propertyFilters?: Record<string, string>;
    showBlocksOnly?: boolean;
    limit?: number;
}

interface ParsedQuery {
    textQuery: string;
    typeFilters: string[];
    tagFilters: string[];
    propertyFilters: Record<string, string>;
}

// Parse query syntax: /TypeName, #tag, Property: value
export function parseQuerySyntax(query: string): ParsedQuery {
    const result: ParsedQuery = {
        textQuery: '',
        typeFilters: [],
        tagFilters: [],
        propertyFilters: {},
    };

    // Split by spaces but preserve quoted strings
    const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const textParts: string[] = [];

    for (const token of tokens) {
        // Type filter: /typename
        if (token.startsWith('/')) {
            const typeName = token.slice(1).toLowerCase();
            if (typeName) {
                result.typeFilters.push(typeName);
            }
            continue;
        }

        // Tag filter: #tag
        if (token.startsWith('#')) {
            const tag = token.slice(1);
            if (tag) {
                result.tagFilters.push(tag);
            }
            continue;
        }

        // Property filter: Property: value or Property:"quoted value"
        const propertyMatch = token.match(/^([^:]+):(.+)$/);
        if (propertyMatch) {
            const propName = propertyMatch[1].toLowerCase();
            let propValue = propertyMatch[2];
            // Remove quotes if present
            if (propValue.startsWith('"') && propValue.endsWith('"')) {
                propValue = propValue.slice(1, -1);
            }
            result.propertyFilters[propName] = propValue;
            continue;
        }

        // Regular text search
        textParts.push(token);
    }

    result.textQuery = textParts.join(' ').toLowerCase();
    return result;
}

// Strip HTML tags for text search
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Find match positions in text
function findMatches(
    text: string,
    searchTerm: string,
    field: SearchMatch['field'],
    objectId: string,
    propertyName?: string
): SearchMatch[] {
    if (!searchTerm || !text) return [];

    const matches: SearchMatch[] = [];
    const lowerText = text.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    let startIndex = 0;

    while (true) {
        const index = lowerText.indexOf(lowerSearch, startIndex);
        if (index === -1) break;

        // Create context snippet (50 chars before and after)
        const contextStart = Math.max(0, index - 50);
        const contextEnd = Math.min(text.length, index + lowerSearch.length + 50);
        let context = text.slice(contextStart, contextEnd);
        if (contextStart > 0) context = '...' + context;
        if (contextEnd < text.length) context = context + '...';

        matches.push({
            objectId,
            field,
            matchStart: index,
            matchEnd: index + searchTerm.length,
            context,
            propertyName,
        });

        startIndex = index + 1;
    }

    return matches;
}

// Calculate relevance score
function calculateScore(matches: SearchMatch[], titleMatch: boolean): number {
    let score = 0;

    // Title matches are most important
    if (titleMatch) score += 100;

    // Add points per match by type
    for (const match of matches) {
        switch (match.field) {
            case 'title': score += 50; break;
            case 'tag': score += 30; break;
            case 'property': score += 20; break;
            case 'content': score += 10; break;
        }
    }

    return score;
}

// Main search function
export function searchObjects(
    objects: AstralObject[],
    objectTypes: ObjectType[],
    options: SearchOptions
): SearchResult[] {
    const { query, typeFilters = [], tagFilters = [], propertyFilters = {}, showBlocksOnly = false, limit = 50 } = options;

    // Parse query syntax
    const parsed = parseQuerySyntax(query);

    // Merge explicit filters with parsed filters
    const allTypeFilters = [...new Set([...typeFilters, ...parsed.typeFilters])];
    const allTagFilters = [...new Set([...tagFilters, ...parsed.tagFilters])];
    const allPropertyFilters = { ...propertyFilters, ...parsed.propertyFilters };

    const results: SearchResult[] = [];

    for (const obj of objects) {
        // Apply type filters
        if (allTypeFilters.length > 0) {
            const objType = objectTypes.find(t => t.id === obj.type);
            const typeNames = [obj.type, objType?.name?.toLowerCase(), objType?.namePlural?.toLowerCase()].filter(Boolean);
            const matchesType = allTypeFilters.some(f =>
                typeNames.some(tn => tn?.includes(f))
            );
            if (!matchesType) continue;
        }

        // Apply tag filters
        if (allTagFilters.length > 0) {
            const hasAllTags = allTagFilters.every(tag =>
                obj.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
            );
            if (!hasAllTags) continue;
        }

        // Apply property filters
        const propertyFilterKeys = Object.keys(allPropertyFilters);
        if (propertyFilterKeys.length > 0) {
            const matchesAllProps = propertyFilterKeys.every(propKey => {
                const expectedValue = allPropertyFilters[propKey].toLowerCase();
                // Find property by name (case insensitive)
                for (const [key, value] of Object.entries(obj.properties)) {
                    const propDef = objectTypes
                        .find(t => t.id === obj.type)
                        ?.properties.find(p => p.id === key);
                    const propName = propDef?.name?.toLowerCase() || key.toLowerCase();

                    if (propName.includes(propKey)) {
                        const strValue = String(value).toLowerCase();
                        if (strValue.includes(expectedValue)) return true;
                    }
                }
                return false;
            });
            if (!matchesAllProps) continue;
        }

        // If no text query and we passed filters, include the object
        const matches: SearchMatch[] = [];

        if (parsed.textQuery) {
            // Search in title
            const titleMatches = findMatches(obj.title, parsed.textQuery, 'title', obj.id);
            matches.push(...titleMatches);

            // Search in content (stripped of HTML)
            const plainContent = stripHtml(obj.content);
            const contentMatches = findMatches(plainContent, parsed.textQuery, 'content', obj.id);
            matches.push(...contentMatches);

            // Search in tags
            for (const tag of obj.tags) {
                const tagMatches = findMatches(tag, parsed.textQuery, 'tag', obj.id);
                matches.push(...tagMatches);
            }

            // Search in properties
            for (const [key, value] of Object.entries(obj.properties)) {
                const strValue = String(value);
                const propMatches = findMatches(strValue, parsed.textQuery, 'property', obj.id, key);
                matches.push(...propMatches);
            }

            // Only include if we have matches (when there's a text query)
            if (matches.length === 0) continue;
        }

        // If showBlocksOnly, only include results with content matches
        if (showBlocksOnly && !matches.some(m => m.field === 'content')) {
            continue;
        }

        const titleMatch = matches.some(m => m.field === 'title');
        const score = parsed.textQuery ? calculateScore(matches, titleMatch) : 50;

        results.push({
            object: obj,
            matches,
            score,
        });
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    return results.slice(0, limit);
}

// Group results by object type
export function groupResultsByType(
    results: SearchResult[],
    objectTypes: ObjectType[]
): Map<string, SearchResult[]> {
    const groups = new Map<string, SearchResult[]>();

    for (const result of results) {
        const typeId = result.object.type;
        if (!groups.has(typeId)) {
            groups.set(typeId, []);
        }
        groups.get(typeId)!.push(result);
    }

    // Sort groups by type name
    const sortedGroups = new Map<string, SearchResult[]>();
    const sortedTypes = [...groups.keys()].sort((a, b) => {
        const typeA = objectTypes.find(t => t.id === a)?.name || a;
        const typeB = objectTypes.find(t => t.id === b)?.name || b;
        return typeA.localeCompare(typeB);
    });

    for (const typeId of sortedTypes) {
        sortedGroups.set(typeId, groups.get(typeId)!);
    }

    return sortedGroups;
}

// Get all unique tags from objects
export function getAllTags(objects: AstralObject[]): string[] {
    const tagSet = new Set<string>();
    for (const obj of objects) {
        for (const tag of obj.tags) {
            tagSet.add(tag);
        }
    }
    return [...tagSet].sort();
}
