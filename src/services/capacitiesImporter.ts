// Capacities import service
// Handles importing objects from Capacities ZIP exports

import JSZip from 'jszip';
import { load as parseYaml } from 'js-yaml';
import { marked } from 'marked';
import type { AstralObject, ObjectType, PropertyDefinition, PropertyValue } from '../types/object';
import * as db from './db';
import * as drive from './drive';

// Browser-compatible frontmatter parser (replaces gray-matter which needs Node.js Buffer)
function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
    // Check if content starts with frontmatter delimiter
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
        try {
            const yamlContent = match[1];
            const markdownContent = match[2];
            const data = parseYaml(yamlContent) as Record<string, unknown>;
            return { data: data || {}, content: markdownContent };
        } catch (error) {
            console.warn('[Capacities Import] Failed to parse YAML frontmatter:', error);
            return { data: {}, content };
        }
    }

    // No frontmatter found
    return { data: {}, content };
}

// Type mapping from Capacities folder names to existing types
const TYPE_MAPPING: Record<string, string> = {
    'personas': 'person',
    'person': 'person',
    'people': 'person',
    'libros': 'book',
    'books': 'book',
    'book': 'book',
    'proyectos': 'project',
    'projects': 'project',
    'project': 'project',
    'ideas': 'idea',
    'idea': 'idea',
    'dailynotes': 'daily',
    'dailynote': 'daily',
    'daily': 'daily',
    'notas diarias': 'daily',
    'reuniones': 'meeting',
    'meetings': 'meeting',
    'meeting': 'meeting',
    'pages': 'page',
    'page': 'page',
    'notas': 'page',
    'notes': 'page',
};

export interface ImportOptions {
    handleConflicts: 'skip' | 'merge' | 'duplicate' | 'overwrite';
    importMedia: boolean;
    convertHashtags: 'tags' | 'mentions' | 'plain';
}

export interface ImportProgress {
    phase: 'extracting' | 'parsing' | 'types' | 'objects' | 'links' | 'media' | 'complete';
    current: number;
    total: number;
    currentItem?: string;
}

export interface ImportResult {
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
    newTypes: ObjectType[];
    warnings: string[];
    skippedItems: Array<{ title: string; reason: string }>;
}

interface ParsedObject {
    folderName: string;
    fileName: string;
    frontmatter: Record<string, unknown>;
    content: string;
    htmlContent: string;
    links: { text: string; path: string }[];
}

// Extract and parse all markdown files from the ZIP
async function extractAndParse(
    zipFile: File,
    onProgress?: (progress: ImportProgress) => void
): Promise<{ objects: ParsedObject[]; mediaFiles: Map<string, Blob> }> {
    onProgress?.({ phase: 'extracting', current: 0, total: 1 });

    const zip = await JSZip.loadAsync(zipFile);
    const objects: ParsedObject[] = [];
    const mediaFiles = new Map<string, Blob>();

    const entries = Object.entries(zip.files);

    // Debug: Log all files in the ZIP
    console.log('[Capacities Import] ZIP contains', entries.length, 'entries');
    console.log('[Capacities Import] All paths:', entries.map(([p]) => p).slice(0, 20));

    // Filter markdown files - handle both .md and .markdown extensions
    const mdFiles = entries.filter(([path, file]) => {
        const isMarkdown = path.toLowerCase().endsWith('.md') || path.toLowerCase().endsWith('.markdown');
        const isNotDir = !file.dir;
        // Skip hidden files (starting with . or inside __MACOSX)
        const isNotHidden = !path.includes('__MACOSX') && !path.split('/').some(p => p.startsWith('.'));
        return isMarkdown && isNotDir && isNotHidden;
    });

    const mediaEntries = entries.filter(([path, file]) => {
        const isMedia = /\.(png|jpg|jpeg|gif|webp|svg|pdf)$/i.test(path);
        const isNotDir = !file.dir;
        const isNotHidden = !path.includes('__MACOSX') && !path.split('/').some(p => p.startsWith('.'));
        return isMedia && isNotDir && isNotHidden;
    });

    console.log('[Capacities Import] Found', mdFiles.length, 'markdown files');
    console.log('[Capacities Import] Found', mediaEntries.length, 'media files');

    if (mdFiles.length > 0) {
        console.log('[Capacities Import] Sample MD paths:', mdFiles.slice(0, 5).map(([p]) => p));
    }

    onProgress?.({ phase: 'parsing', current: 0, total: mdFiles.length });

    for (let i = 0; i < mdFiles.length; i++) {
        const [path, file] = mdFiles[i];

        try {
            const content = await file.async('string');
            const parsed = parseFrontmatter(content);

            // Extract folder name (type) from path
            // Handle paths like: "Export/Libros/TITULO.md" or "Libros/TITULO.md"
            const pathParts = path.split('/').filter(p => p.length > 0);

            // Find the type folder (skip common root folders like "Export")
            const skipFolders = ['export', 'content', 'data', 'markdown'];
            let folderName = 'page';
            let fileName = pathParts[pathParts.length - 1].replace(/\.md$/i, '').replace(/\.markdown$/i, '');

            // Work backwards to find the type folder
            if (pathParts.length >= 2) {
                const parentFolder = pathParts[pathParts.length - 2];
                if (!skipFolders.includes(parentFolder.toLowerCase())) {
                    folderName = parentFolder;
                } else if (pathParts.length >= 3) {
                    folderName = pathParts[pathParts.length - 3];
                }
            }

            // Extract links from content
            const links = extractLinks(parsed.content);

            // Convert markdown to HTML
            const htmlContent = await marked.parse(parsed.content);

            objects.push({
                folderName,
                fileName,
                frontmatter: parsed.data as Record<string, unknown>,
                content: parsed.content,
                htmlContent,
                links
            });

            onProgress?.({
                phase: 'parsing',
                current: i + 1,
                total: mdFiles.length,
                currentItem: fileName
            });
        } catch (error) {
            console.warn(`[Capacities Import] Error parsing ${path}:`, error);
        }
    }

    // Extract media files
    for (const [path, file] of mediaEntries) {
        try {
            const blob = await file.async('blob');
            mediaFiles.set(path, blob);
        } catch (error) {
            console.warn(`[Capacities Import] Error extracting media ${path}:`, error);
        }
    }

    console.log('[Capacities Import] Successfully parsed', objects.length, 'objects');

    return { objects, mediaFiles };
}

// Extract links from markdown content
function extractLinks(content: string): { text: string; path: string }[] {
    const links: { text: string; path: string }[] = [];

    // Match [text](path) format
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = mdLinkRegex.exec(content)) !== null) {
        const path = decodeURIComponent(match[2]);
        // Only include internal links (relative paths to .md files)
        if (path.endsWith('.md') && !path.startsWith('http')) {
            links.push({ text: match[1], path });
        }
    }

    // Match [[wikilink]] format
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
        links.push({ text: match[1], path: match[1] });
    }

    return links;
}

// Map folder name to existing type or create new type
function mapType(
    folderName: string,
    frontmatterType: string | undefined,
    existingTypes: ObjectType[]
): { typeId: string; isNew: boolean; newType?: ObjectType } {
    // Normalize for comparison: lowercase, remove accents, handle Spanish plurals
    const normalize = (s: string): string => {
        return s.toLowerCase()
            .trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/es$/, '') // Remove Spanish plural suffix -es
            .replace(/s$/, ''); // Remove -s plural suffix
    };

    // First check frontmatter type
    const typeToCheck = frontmatterType || folderName;
    const normalizedType = normalize(typeToCheck);

    // Check direct mapping first
    const mappedKey = Object.keys(TYPE_MAPPING).find(k =>
        normalize(k) === normalizedType || k.toLowerCase() === typeToCheck.toLowerCase()
    );
    if (mappedKey) {
        const targetId = TYPE_MAPPING[mappedKey];
        const existingType = existingTypes.find(t => t.id === targetId);
        if (existingType) {
            return { typeId: existingType.id, isNew: false };
        }
    }

    // Check if normalized match exists in existing types
    const normalizedMatch = existingTypes.find(t => {
        const normId = normalize(t.id);
        const normName = normalize(t.name);
        const normPlural = normalize(t.namePlural);
        return normId === normalizedType ||
            normName === normalizedType ||
            normPlural === normalizedType ||
            // Also check if the folder name matches
            normalize(folderName) === normId ||
            normalize(folderName) === normName ||
            normalize(folderName) === normPlural;
    });

    if (normalizedMatch) {
        console.log(`[Capacities Import] Mapped type "${typeToCheck}" → existing "${normalizedMatch.id}"`);
        return { typeId: normalizedMatch.id, isNew: false };
    }

    // Create new type only if no match found
    const id = typeToCheck.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    const newType: ObjectType = {
        id,
        name: capitalize(folderName),
        namePlural: capitalize(folderName),
        icon: '📄',
        color: generateColor(id),
        properties: []
    };

    console.log(`[Capacities Import] Creating new type: "${id}" from folder "${folderName}"`);
    return { typeId: id, isNew: true, newType };
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateColor(seed: string): string {
    // Generate a consistent color from string
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 65%, 55%)`;
}

// Extract properties from frontmatter
function extractProperties(
    frontmatter: Record<string, unknown>,
    existingType: ObjectType | undefined
): { properties: Record<string, PropertyValue>; newPropertyDefs: PropertyDefinition[] } {
    const properties: Record<string, PropertyValue> = {};
    const newPropertyDefs: PropertyDefinition[] = [];

    // Skip these standard fields
    const skipFields = ['type', 'title', 'tags', 'id'];

    for (const [key, value] of Object.entries(frontmatter)) {
        if (skipFields.includes(key.toLowerCase())) continue;
        if (value === undefined || value === null) continue;

        const propId = key.toLowerCase().replace(/\s+/g, '-');

        // Check if property exists in type
        const existingProp = existingType?.properties.find(p =>
            p.id === propId || p.name.toLowerCase() === key.toLowerCase()
        );

        if (!existingProp) {
            // Create new property definition
            const propType = inferPropertyType(value);
            newPropertyDefs.push({
                id: propId,
                name: key,
                type: propType
            });
        }

        // Convert value to appropriate type
        properties[existingProp?.id || propId] = convertPropertyValue(value);
    }

    return { properties, newPropertyDefs };
}

function inferPropertyType(value: unknown): PropertyDefinition['type'] {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string') {
        // Check if it's a date string
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
        // Check if it's a URL
        if (/^https?:\/\//.test(value)) return 'url';
        // Check if it's an email
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
    }
    if (Array.isArray(value)) return 'multiselect';
    return 'text';
}

function convertPropertyValue(value: unknown): PropertyValue {
    if (value instanceof Date) {
        // Only return Date if it's valid
        return isNaN(value.getTime()) ? String(value) : value;
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        // Try to parse as date, but validate it's actually valid
        try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date;
            }
        } catch {
            // Fall through to return as string
        }
        return value; // Return as string if date parsing fails
    }
    if (Array.isArray(value)) return value.map(v => String(v));
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return value as PropertyValue;
}

// Convert inline hashtags to tag mentions
function processHashtags(
    htmlContent: string,
    tagObjects: Map<string, string> // tagName -> objectId
): string {
    // Match #hashtag patterns (not inside HTML tags)
    const hashtagRegex = /#([a-zA-ZáéíóúñüÁÉÍÓÚÑÜ][a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ_-]*)/g;

    return htmlContent.replace(hashtagRegex, (match, tagName) => {
        const tagId = tagObjects.get(tagName.toLowerCase());
        if (tagId) {
            return `<span class="hashtag-pill" data-hashtag-id="${tagId}">#${tagName}</span>`;
        }
        return match;
    });
}

// Convert markdown links to mentions
function convertLinksToMentions(
    htmlContent: string,
    objectMap: Map<string, { id: string; title: string }> // path/name -> object info
): { html: string; unresolvedLinks: string[] } {
    const unresolvedLinks: string[] = [];

    // Helper to find object by various keys
    const findObject = (searchKeys: string[]): { id: string; title: string } | undefined => {
        for (const key of searchKeys) {
            if (!key) continue;
            // Try exact match
            const exact = objectMap.get(key);
            if (exact) return exact;

            // Try case-insensitive match
            const normalizedKey = key.toLowerCase().trim();
            for (const [mapKey, obj] of objectMap) {
                if (mapKey.toLowerCase().trim() === normalizedKey) {
                    return obj;
                }
                // Also try matching just the title
                if (obj.title.toLowerCase().trim() === normalizedKey) {
                    return obj;
                }
            }
        }
        return undefined;
    };

    // Convert markdown-style links that were converted to <a> tags
    let html = htmlContent.replace(
        /<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
        (_match, href, text) => {
            const decodedPath = decodeURIComponent(href);

            // Only process internal links (not http/https)
            if (href.startsWith('http://') || href.startsWith('https://')) {
                return _match; // Keep external links as-is
            }

            // Try various matching strategies
            const pathWithoutMd = decodedPath.replace(/\.md$/i, '');
            const fileName = pathWithoutMd.split('/').pop() || '';
            const searchKeys = [
                decodedPath,           // Full path
                pathWithoutMd,         // Path without .md
                fileName,              // Just filename
                text,                  // Link text
            ];

            const obj = findObject(searchKeys);

            if (obj) {
                return `<span class="mention" data-mention-id="${obj.id}">${text}</span>`;
            } else {
                unresolvedLinks.push(text);
                return `<span class="mention mention-broken" title="Enlace no encontrado: ${decodedPath}">${text}</span>`;
            }
        }
    );

    // Also handle any remaining wikilinks that might be in the HTML
    html = html.replace(
        /\[\[([^\]]+)\]\]/g,
        (_match, text) => {
            const obj = findObject([text, text.split('/').pop() || '']);
            if (obj) {
                return `<span class="mention" data-mention-id="${obj.id}">${text}</span>`;
            } else {
                unresolvedLinks.push(text);
                return `<span class="mention mention-broken" title="Enlace no encontrado">${text}</span>`;
            }
        }
    );

    return { html, unresolvedLinks };
}

// Main import function
export async function importFromCapacities(
    zipFile: File,
    existingTypes: ObjectType[],
    existingObjects: AstralObject[],
    options: ImportOptions,
    onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
    const result: ImportResult = {
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        newTypes: [],
        warnings: [],
        skippedItems: []
    };

    try {
        // Step 1: Extract and parse ZIP
        const { objects: parsedObjects, mediaFiles } = await extractAndParse(zipFile, onProgress);

        if (parsedObjects.length === 0) {
            result.errors.push('No se encontraron archivos .md en el ZIP');
            return result;
        }

        // Step 2: Process types
        onProgress?.({ phase: 'types', current: 0, total: parsedObjects.length });

        const typeCache = new Map<string, ObjectType>();
        const newTypesMap = new Map<string, ObjectType>();

        for (const obj of parsedObjects) {
            const frontmatterType = obj.frontmatter.type as string | undefined;
            const { typeId, isNew, newType } = mapType(obj.folderName, frontmatterType, existingTypes);

            if (isNew && newType && !newTypesMap.has(typeId)) {
                newTypesMap.set(typeId, newType);
                result.newTypes.push(newType);
            }

            if (!typeCache.has(typeId)) {
                typeCache.set(typeId, newType || existingTypes.find(t => t.id === typeId)!);
            }
        }

        // Save new types
        for (const newType of newTypesMap.values()) {
            await db.saveObjectType(newType);
        }

        // Combine existing and new types for property checking
        const allTypes = [...existingTypes, ...result.newTypes];

        // Step 3: First pass - create objects without link resolution
        onProgress?.({ phase: 'objects', current: 0, total: parsedObjects.length });

        const objectMap = new Map<string, { id: string; title: string }>();
        const createdObjects: AstralObject[] = [];
        const tagObjects = new Map<string, string>(); // tagName -> objectId

        // First, find or create tag objects if hashtag conversion is enabled
        if (options.convertHashtags === 'mentions') {
            const allHashtags = new Set<string>();
            for (const obj of parsedObjects) {
                const hashtagRegex = /#([a-zA-ZáéíóúñüÁÉÍÓÚÑÜ][a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ_-]*)/g;
                let match;
                while ((match = hashtagRegex.exec(obj.content)) !== null) {
                    allHashtags.add(match[1].toLowerCase());
                }
            }

            // Find existing tag objects or create new ones
            const tagType = allTypes.find(t => t.id === 'tag' || t.name.toLowerCase() === 'tag');
            for (const tagName of allHashtags) {
                const existingTag = existingObjects.find(o =>
                    o.type === 'tag' && o.title.toLowerCase() === tagName
                );
                if (existingTag) {
                    tagObjects.set(tagName, existingTag.id);
                } else if (tagType) {
                    // Create new tag object
                    const newTag = await db.createObject({
                        type: 'tag',
                        title: tagName,
                        content: '',
                        properties: {},
                        tags: [],
                        links: [],
                        backlinks: []
                    });
                    tagObjects.set(tagName, newTag.id);
                }
            }
        }

        // Create all objects
        for (let i = 0; i < parsedObjects.length; i++) {
            const parsed = parsedObjects[i];

            try {
                const frontmatterType = parsed.frontmatter.type as string | undefined;
                const { typeId } = mapType(parsed.folderName, frontmatterType, existingTypes);
                const objectType = allTypes.find(t => t.id === typeId);

                const title = (parsed.frontmatter.title as string) || parsed.fileName;
                const tags = (parsed.frontmatter.tags as string[]) || [];

                // Extract properties
                const { properties, newPropertyDefs } = extractProperties(parsed.frontmatter, objectType);

                // Add new properties to type if any
                if (newPropertyDefs.length > 0 && objectType) {
                    const updatedType = {
                        ...objectType,
                        properties: [...objectType.properties, ...newPropertyDefs]
                    };
                    await db.saveObjectType(updatedType);
                    // Update in allTypes array
                    const idx = allTypes.findIndex(t => t.id === typeId);
                    if (idx !== -1) allTypes[idx] = updatedType;
                }

                // Check for existing object to merge
                const existingObject = existingObjects.find(o =>
                    o.type === typeId && o.title.toLowerCase() === title.toLowerCase()
                );

                if (existingObject) {
                    if (options.handleConflicts === 'skip') {
                        result.skipped++;
                        result.skippedItems.push({ title, reason: 'Ya existe un objeto con el mismo título' });
                        objectMap.set(parsed.fileName, { id: existingObject.id, title: existingObject.title });
                        // Also map by path
                        const path = `${parsed.folderName}/${parsed.fileName}.md`;
                        objectMap.set(path, { id: existingObject.id, title: existingObject.title });
                        continue;
                    } else if (options.handleConflicts === 'merge') {
                        // Merge: keep existing properties and add new ones
                        await db.updateObject(existingObject.id, {
                            content: parsed.htmlContent,
                            properties: { ...existingObject.properties, ...properties },
                            tags: [...new Set([...existingObject.tags, ...tags])]
                        });
                        result.updated++;
                        objectMap.set(parsed.fileName, { id: existingObject.id, title: existingObject.title });
                        const path = `${parsed.folderName}/${parsed.fileName}.md`;
                        objectMap.set(path, { id: existingObject.id, title: existingObject.title });
                        createdObjects.push({ ...existingObject, content: parsed.htmlContent });
                        continue;
                    } else if (options.handleConflicts === 'overwrite') {
                        // Overwrite: replace content and properties completely
                        await db.updateObject(existingObject.id, {
                            content: parsed.htmlContent,
                            properties: properties, // Replace, not merge
                            tags: tags // Replace, not merge
                        });
                        result.updated++;
                        objectMap.set(parsed.fileName, { id: existingObject.id, title: existingObject.title });
                        const path = `${parsed.folderName}/${parsed.fileName}.md`;
                        objectMap.set(path, { id: existingObject.id, title: existingObject.title });
                        createdObjects.push({ ...existingObject, content: parsed.htmlContent });
                        continue;
                    }
                    // For 'duplicate', fall through to create new
                }

                // Create new object
                const newObject = await db.createObject({
                    type: typeId,
                    title: options.handleConflicts === 'duplicate' && existingObject
                        ? `${title} (importado)`
                        : title,
                    content: parsed.htmlContent,
                    properties,
                    tags,
                    links: [],
                    backlinks: []
                });

                result.imported++;
                createdObjects.push(newObject);

                // Map by filename and full path
                objectMap.set(parsed.fileName, { id: newObject.id, title: newObject.title });
                objectMap.set(title, { id: newObject.id, title: newObject.title });
                const path = `${parsed.folderName}/${parsed.fileName}.md`;
                objectMap.set(path, { id: newObject.id, title: newObject.title });

            } catch (error) {
                console.warn(`[Capacities Import] Error importing "${parsed.fileName}":`, error);
                result.warnings.push(`Error importando "${parsed.fileName}": ${(error as Error).message}`);
            }

            onProgress?.({
                phase: 'objects',
                current: i + 1,
                total: parsedObjects.length,
                currentItem: parsed.fileName
            });
        }

        // Step 4: Second pass - resolve links and update content
        onProgress?.({ phase: 'links', current: 0, total: createdObjects.length });

        for (let i = 0; i < createdObjects.length; i++) {
            const obj = createdObjects[i];
            let updatedContent = obj.content;

            // Process hashtags if enabled
            if (options.convertHashtags === 'mentions') {
                updatedContent = processHashtags(updatedContent, tagObjects);
            }

            // Convert links to mentions
            const { html, unresolvedLinks } = convertLinksToMentions(updatedContent, objectMap);
            updatedContent = html;

            if (unresolvedLinks.length > 0) {
                result.warnings.push(`${obj.title}: ${unresolvedLinks.length} enlaces no resueltos`);
            }

            // Extract mention IDs for links array
            const mentionRegex = /data-mention-id="([^"]+)"/g;
            const links: string[] = [];
            let match;
            while ((match = mentionRegex.exec(updatedContent)) !== null) {
                if (!links.includes(match[1])) {
                    links.push(match[1]);
                }
            }

            // Update object with resolved links
            if (updatedContent !== obj.content || links.length > 0) {
                await db.updateObject(obj.id, { content: updatedContent, links });
            }

            onProgress?.({
                phase: 'links',
                current: i + 1,
                total: createdObjects.length,
                currentItem: obj.title
            });
        }

        // Step 5: Import media if enabled
        if (options.importMedia && mediaFiles.size > 0) {
            onProgress?.({ phase: 'media', current: 0, total: mediaFiles.size });

            let mediaIndex = 0;
            for (const [path, _blob] of mediaFiles) {
                try {
                    // Upload to Drive
                    if (drive.isDriveConnected()) {
                        // TODO: Implement media upload to Drive
                        // For now, just count them
                    }
                    mediaIndex++;
                    onProgress?.({ phase: 'media', current: mediaIndex, total: mediaFiles.size, currentItem: path });
                } catch (error) {
                    result.warnings.push(`Error subiendo ${path}: ${(error as Error).message}`);
                }
            }
        }

        onProgress?.({ phase: 'complete', current: 1, total: 1 });

    } catch (error) {
        result.errors.push(`Error de importación: ${(error as Error).message}`);
    }

    return result;
}

// ============ CLEANUP FUNCTIONS ============

export interface CleanupResult {
    deletedObjects: number;
    deletedTypes: number;
    errors: string[];
}

/**
 * Delete all objects that haven't been synced to Drive (no driveFileId)
 * This effectively reverts an import since imported objects don't have driveFileId
 */
export async function deleteUnsyncedObjects(
    objects: AstralObject[],
    onProgress?: (current: number, total: number, item: string) => void
): Promise<CleanupResult> {
    const result: CleanupResult = {
        deletedObjects: 0,
        deletedTypes: 0,
        errors: []
    };

    // Find objects without driveFileId (imported, not synced)
    const unsyncedObjects = objects.filter(obj => !obj.driveFileId);

    console.log(`[Cleanup] Found ${unsyncedObjects.length} unsynced objects to delete`);

    for (let i = 0; i < unsyncedObjects.length; i++) {
        const obj = unsyncedObjects[i];
        try {
            await db.deleteObject(obj.id);
            result.deletedObjects++;
            onProgress?.(i + 1, unsyncedObjects.length, obj.title);
        } catch (error) {
            result.errors.push(`Error deleting "${obj.title}": ${(error as Error).message}`);
        }
    }

    return result;
}

/**
 * Delete types that have no objects associated with them
 */
export async function deleteOrphanTypes(
    objects: AstralObject[],
    types: ObjectType[],
    protectedTypeIds: string[] = ['page', 'daily', 'tag', 'task'] // Never delete these
): Promise<CleanupResult> {
    const result: CleanupResult = {
        deletedObjects: 0,
        deletedTypes: 0,
        errors: []
    };

    // Count objects per type
    const typeUsage = new Map<string, number>();
    for (const obj of objects) {
        typeUsage.set(obj.type, (typeUsage.get(obj.type) || 0) + 1);
    }

    // Find types with no objects
    const orphanTypes = types.filter(t =>
        !protectedTypeIds.includes(t.id) &&
        (typeUsage.get(t.id) || 0) === 0
    );

    console.log(`[Cleanup] Found ${orphanTypes.length} orphan types to delete`);

    for (const type of orphanTypes) {
        try {
            await db.deleteObjectType(type.id);
            result.deletedTypes++;
        } catch (error) {
            result.errors.push(`Error deleting type "${type.name}": ${(error as Error).message}`);
        }
    }

    return result;
}

/**
 * Full cleanup: delete unsynced objects then orphan types
 */
export async function revertImport(
    objects: AstralObject[],
    types: ObjectType[],
    onProgress?: (phase: string, current: number, total: number, item?: string) => void
): Promise<CleanupResult> {
    const result: CleanupResult = {
        deletedObjects: 0,
        deletedTypes: 0,
        errors: []
    };

    // Step 1: Delete unsynced objects
    const unsyncedObjects = objects.filter(obj => !obj.driveFileId);
    onProgress?.('objects', 0, unsyncedObjects.length);

    for (let i = 0; i < unsyncedObjects.length; i++) {
        const obj = unsyncedObjects[i];
        try {
            await db.deleteObject(obj.id);
            result.deletedObjects++;
        } catch (error) {
            result.errors.push(`Error: ${obj.title}`);
        }
        onProgress?.('objects', i + 1, unsyncedObjects.length, obj.title);
    }

    // Step 2: Refresh object list and delete orphan types
    const remainingObjects = objects.filter(obj => obj.driveFileId);
    const typeUsage = new Map<string, number>();
    for (const obj of remainingObjects) {
        typeUsage.set(obj.type, (typeUsage.get(obj.type) || 0) + 1);
    }

    const protectedTypes = ['page', 'daily', 'tag', 'task'];
    const orphanTypes = types.filter(t =>
        !protectedTypes.includes(t.id) &&
        (typeUsage.get(t.id) || 0) === 0
    );

    onProgress?.('types', 0, orphanTypes.length);

    for (let i = 0; i < orphanTypes.length; i++) {
        const type = orphanTypes[i];
        try {
            await db.deleteObjectType(type.id);
            result.deletedTypes++;
        } catch (error) {
            result.errors.push(`Error tipo: ${type.name}`);
        }
        onProgress?.('types', i + 1, orphanTypes.length, type.name);
    }

    console.log(`[Cleanup] Completed: ${result.deletedObjects} objects, ${result.deletedTypes} types deleted`);

    return result;
}
