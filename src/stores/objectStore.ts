// Global state store for objects using Zustand
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AstralObject, ObjectType, PropertyValue } from '../types/object';
import { DEFAULT_OBJECT_TYPES, BASE_PROPERTIES } from '../types/object';
import * as db from '../services/db';
import * as drive from '../services/drive';
import { DriveAuthError } from '../services/drive';
import { useDriveStore } from './driveStore';
import { aiService } from '../services/ai';
import { useAIStore } from './aiStore';

interface ObjectStore {
    // State
    objects: AstralObject[];
    objectTypes: ObjectType[];
    selectedObjectId: string | null;
    isLoading: boolean;
    error: string | null;

    // Navigation history
    navigationHistory: string[];
    historyIndex: number;

    // Actions
    setObjects: (objects: AstralObject[]) => void;
    setObjectTypes: (types: ObjectType[]) => void;
    selectObject: (id: string | null) => void;

    // Navigation
    goBack: () => void;
    goForward: () => void;
    canGoBack: () => boolean;
    canGoForward: () => boolean;

    // Object CRUD Operations
    createObject: (type: string, title: string, content?: string, autoSelect?: boolean, initialProperties?: Record<string, PropertyValue>) => Promise<AstralObject>;
    updateObject: (id: string, updates: Partial<AstralObject>) => Promise<void>;
    deleteObject: (id: string) => Promise<void>;

    // ObjectType CRUD Operations
    createObjectType: (type: Omit<ObjectType, 'id'>) => Promise<ObjectType>;
    updateObjectType: (id: string, updates: Partial<ObjectType>) => Promise<void>;
    deleteObjectType: (id: string) => Promise<void>;

    // Drive sync
    syncObjectToDrive: (idOrObject: string | AstralObject) => Promise<void>;

    // Initialize and cleanup
    initialize: () => Promise<void>;
    cleanup: () => void;
}

// Helper: Shadow Chunking Implementation with enhanced parsing and retry logic
// This simulates the planned Cloud Function by running on the client (for now)
// to enable granular search capabilities immediately.
import { parse } from 'node-html-parser';
import { collection, doc, writeBatch, getDocs, Timestamp } from 'firebase/firestore';
import { getFirestoreDb } from '../services/firebase'; // Direct import from firebase config

const generateSearchChunks = async (objectId: string, objectTitle: string, htmlContent: string) => {
    if (!htmlContent) return;

    console.log(`[ShadowChunking] Processing object: ${objectTitle} (${objectId})`);

    // Get the firestore instance
    const firestore = getFirestoreDb();

    try {
        const root = parse(htmlContent);

        // Split content into semantic blocks (paragraphs, lists, blockquotes)
        // Adjust selectors based on TipTap output structure
        const blocks = root.querySelectorAll('p, li, blockquote, h1, h2, h3');

        // Reference to the subcollection
        const chunksCollectionRef = collection(firestore, `objects/${objectId}/search_chunks`);

        // 1. DELETE OLD CHUNKS (Cleanup before update)
        // In a real cloud function we'd use a batched delete, here we do it simply
        const oldChunksSnapshot = await getDocs(chunksCollectionRef);
        const deleteBatch = writeBatch(firestore);
        oldChunksSnapshot.docs.forEach(doc => {
            deleteBatch.delete(doc.ref);
        });
        await deleteBatch.commit();

        // 2. CREATE NEW CHUNKS
        const createBatch = writeBatch(firestore);
        let validChunksCount = 0;

        blocks.forEach((block, index) => {
            const rawText = block.text.trim();
            if (rawText.length < 5) return; // Skip empty/tiny blocks

            // DEBUG: Log the raw HTML of the block to see exactly what we are parsing
            console.log(`[ShadowChunking] Block HTML: ${block.toString()}`);

            // Extract inline tags / relations
            // We need to support multiple formats:
            // 1. Standard links: <a href="object:ID">Title</a>
            // 2. Custom nodes (Mentions/Tags): <span data-type="tag" data-id="ID">Title</span>
            // 3. Hashtags: <span data-type="hashtag" data-hashtag-label="Label">#Label</span> (optional, maybe not treated as relation)

            const inlineTags: string[] = [];

            // 1. Check Anchors
            const links = block.querySelectorAll('a');
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('object:')) {
                    const tagTitle = link.text.trim();
                    if (tagTitle) {
                        inlineTags.push(tagTitle);
                        console.log(`[ShadowChunking] Found link relation: "${tagTitle}"`);
                    }
                }
            });

            // 2. Check Spans (Mentions, Tags, Tasks, Hashtags)
            const spans = block.querySelectorAll('span');
            spans.forEach(span => {
                const dataType = span.getAttribute('data-type');
                const dataId = span.getAttribute('data-id') || span.getAttribute('data-task-id');
                const classNames = span.getAttribute('class') || '';

                // Debug log for spans to see what we are missing - CRITICAL FOR DEBUGGING
                if (dataId || dataType) {
                    console.log(`[ShadowChunking] Inspecting span: type=${dataType}, id=${dataId}, text=${span.text.substring(0, 20)}`);
                }

                // Check for explicit data types or mention classes
                if (dataType === 'task-inline' || dataType === 'hashtag' || dataType === 'tag' || dataType === 'mention' || classNames.includes('mention')) {
                    // Try to get title from attributes first for accuracy
                    // Added data-mention-label support
                    let tagTitle = span.getAttribute('data-task-title') ||
                        span.getAttribute('data-hashtag-label') ||
                        span.getAttribute('data-mention-label') ||
                        span.text;

                    // Clean up "TAREA" badge text if parsing raw text
                    if (!tagTitle && dataType === 'task-inline') {
                        tagTitle = span.text.replace('TAREA', '').trim();
                    }

                    if (tagTitle) {
                        // AGGRESSIVE CLEANING: Replace non-breaking spaces and irregular whitespace with standard space
                        // This fixes issues where 'Realizado&nbsp;En&nbsp;Local' doesn't match 'Realizado En Local'
                        tagTitle = tagTitle.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();

                        inlineTags.push(tagTitle);
                        console.log(`[ShadowChunking] Found span relation (${dataType}): "${tagTitle}" [Length: ${tagTitle.length}]`);
                    }
                }
            });

            // ENRICH CONTEXT
            let enrichedContent = rawText;
            if (inlineTags.length > 0) {
                // Prepend tags/relations to the chunk text for strong semantic association
                // We use "RELATIONS" to indicate any object linked in this paragraph
                enrichedContent = `[RELATIONS: ${inlineTags.join(', ')}] ${rawText}`;
            }

            // Create chunk document
            const chunkRef = doc(chunksCollectionRef); // Auto-ID
            const chunkData = {
                parentId: objectId,
                parentTitle: objectTitle,
                content: enrichedContent, // The queryable text
                originalText: rawText,
                tagsInBlock: inlineTags, // We keep this field name for filter compatibility but it stores ANY linked object title
                blockIndex: index,
                createdAt: new Date().toISOString()
            };

            createBatch.set(chunkRef, chunkData);
            if (inlineTags.length > 0) {
                console.log(`[ShadowChunking] Queuing chunk with tags:`, inlineTags);
            }
            validChunksCount++;
        });

        if (validChunksCount > 0) {
            await createBatch.commit();
            console.log(`[ShadowChunking] Successfully committed ${validChunksCount} chunks for ${objectTitle}`);
        }

    } catch (error) {
        console.error('[ShadowChunking] Error generating chunks:', error);
    }
};

// Store unsubscribe functions outside of the store state
let unsubscribeObjects: (() => void) | null = null;
let unsubscribeTypes: (() => void) | null = null;

// Helper: Partial serialization for efficient embedding
// We don't need the full ID or links for semantic search, just the descriptive content
const serializeForEmbedding = (
    type: string,
    title: string,
    content: string = '',
    tags: string[] = [],
    properties: Record<string, PropertyValue> = {}
): string => {
    // Format complex properties (like relations or lists) into readable text
    const propsText = Object.entries(properties)
        .map(([key, value]) => {
            // Handle arrays (Tags, Multi-Select, Relations)
            if (Array.isArray(value)) {
                const values = value.map((v: any) => {
                    // Handle Relation objects { id, title }
                    if (typeof v === 'object' && v !== null && 'title' in v) return v.title;
                    return v;
                });
                return `${key}: ${values.join(', ')}`;
            }
            // Handle Dates
            if (value instanceof Date) return `${key}: ${value.toLocaleDateString()}`;
            // Handle Primitives
            return `${key}: ${value}`;
        })
        .join('\n');

    return `
Type: ${type}
Title: ${title}
Tags: ${tags.join(', ')}
Properties:
${propsText}
Content:
${content}
    `.trim();
};

export const useObjectStore = create<ObjectStore>()(
    subscribeWithSelector((set, get) => ({
        objects: [],
        objectTypes: DEFAULT_OBJECT_TYPES,
        selectedObjectId: null,
        isLoading: false,
        error: null,

        // Navigation history
        navigationHistory: [],
        historyIndex: -1,

        setObjects: (objects) => set({ objects }),
        setObjectTypes: (types) => set({ objectTypes: types }),
        selectObject: (id) => {
            if (id === null) {
                set({ selectedObjectId: null });
                return;
            }
            // Add to navigation history (only if different from current)
            const state = get();
            if (id !== state.selectedObjectId) {
                // Truncate forward history if navigating to new object
                const newHistory = state.navigationHistory.slice(0, state.historyIndex + 1);
                newHistory.push(id);
                // Keep max 50 items in history
                if (newHistory.length > 50) newHistory.shift();
                set({
                    selectedObjectId: id,
                    navigationHistory: newHistory,
                    historyIndex: newHistory.length - 1,
                });
            }
        },

        goBack: () => {
            const state = get();
            if (state.historyIndex > 0) {
                const newIndex = state.historyIndex - 1;
                const objectId = state.navigationHistory[newIndex];
                set({
                    selectedObjectId: objectId,
                    historyIndex: newIndex,
                });
            }
        },

        goForward: () => {
            const state = get();
            if (state.historyIndex < state.navigationHistory.length - 1) {
                const newIndex = state.historyIndex + 1;
                const objectId = state.navigationHistory[newIndex];
                set({
                    selectedObjectId: objectId,
                    historyIndex: newIndex,
                });
            }
        },

        canGoBack: () => get().historyIndex > 0,
        canGoForward: () => get().historyIndex < get().navigationHistory.length - 1,

        createObject: async (type, title, content = '', autoSelect = true, initialProperties = {}) => {
            set({ isLoading: true, error: null });
            try {
                const newObject = await db.createObject({
                    type,
                    title,
                    content,
                    properties: initialProperties,
                    tags: [],
                    links: [],
                    backlinks: [],
                });

                // Don't add to local state - the Firestore subscription will handle it
                // This prevents duplicates
                set((state) => ({
                    // Only select if autoSelect is true
                    selectedObjectId: autoSelect ? newObject.id : state.selectedObjectId,
                    isLoading: false,
                }));

                // TRIGGER SHADOW CHUNKING (Client-side simulation)
                // We do this asynchronously so it doesn't block the UI
                generateSearchChunks(newObject.id, newObject.title, newObject.content || '').catch(console.error);

                // Sync to Drive in background - pass the object directly since it's not in state yet
                get().syncObjectToDrive(newObject);

                // GENAI: Generate embedding in background
                const aiState = useAIStore.getState();
                if (aiState.isEnabled && aiState.apiKey) {
                    const textToEmbed = serializeForEmbedding(type, title, content, [], initialProperties);
                    aiService.getEmbeddings(textToEmbed)
                        .then(embedding => db.updateObject(newObject.id, { embedding }))
                        .catch(err => console.error('[AI] Embedding generation failed:', err));
                }

                return newObject;
            } catch (error) {
                set({ error: (error as Error).message, isLoading: false });
                throw error;
            }
        },

        updateObject: async (id, updates) => {
            const currentObject = get().objects.find(o => o.id === id);
            if (!currentObject) return;

            try {
                // Extract links from content if content is being updated
                let newLinks = updates.links;
                if (updates.content) {
                    const linkRegex = /data-mention-id="([^"]+)"/g;
                    const matches = [...updates.content.matchAll(linkRegex)];
                    newLinks = matches.map(m => m[1]);
                }

                // Update backlinks if links changed
                if (newLinks && JSON.stringify(newLinks) !== JSON.stringify(currentObject.links)) {
                    await db.updateBacklinks(id, newLinks, currentObject.links);
                    updates.links = newLinks;
                }

                // HANDLE TITLE RENAME PROPAGATION
                if (updates.title && updates.title !== currentObject.title) {
                    const newTitle = updates.title;
                    const batch = writeBatch(getFirestoreDb());
                    const objects = get().objects;
                    // Removed unused objectTypes
                    let batchCount = 0;
                    const updatedObjects: AstralObject[] = [];

                    console.log(`[RenamePropagation] START: "${currentObject.title}" -> "${newTitle}" (ID: ${id})`);
                    console.log(`[RenamePropagation] Scanning ${objects.length} objects for references...`);

                    for (const obj of objects) {
                        let hasChanges = false;
                        const objUpdates: any = {};
                        const objProperties = { ...obj.properties };

                        // 1. Check Relations (Scan ALL properties for relation-like structures)
                        // Heuristic approach: Check if any property value is an array of objects with { id, title }
                        // and one of them matches the renamed object ID.
                        for (const [key, value] of Object.entries(objProperties)) {
                            if (Array.isArray(value)) {
                                // DEBUG: Inspect first item to see structure
                                if (value.length > 0) {
                                    const first = value[0];
                                    if (typeof first === 'object' && first !== null) {
                                        // Log the first item of ANY array property to see what we are dealing with.
                                        // Limit logging to avoid spamming: only log if it HAS an 'id' but failed the match, or generally for the first few objects.
                                        // For now, let's log any array that LOOKS like a relation (has id/title) but didn't match, to see the ID.
                                        if ('id' in first) {
                                            console.log(`[RenamePropagation] Inspecting potential relation "${key}" in "${obj.title}":`, JSON.stringify(first));
                                            console.log(`[RenamePropagation] Comparing item.id "${first.id}" with target "${id}"`);
                                            // Check for type mismatch or whitespace
                                            if (String(first.id).trim() === String(id).trim() && first.id !== id) {
                                                console.warn(`[RenamePropagation] ID MISMATCH DUE TO TYPE OR WHITESPACE! '${first.id}' vs '${id}'`);
                                            }
                                        }
                                    }
                                }

                                // Handle standard Relations (Array of {id, title})
                                let propChanged = false;
                                const newValue = (value as any[]).map((item: any) => {
                                    // Check if it looks like a relation (has 'id')
                                    if (typeof item === 'object' && item !== null && 'id' in item) {
                                        // Use loose comparison or trim to be safe
                                        const itemId = String(item.id).trim();
                                        const targetId = String(id).trim();

                                        if (itemId === targetId) {
                                            console.log(`[RenamePropagation] MATCH found in object "${obj.title}" (${obj.id}), property "${key}"`);
                                            console.log(`[RenamePropagation] Updating relation title from "${item.title}" to "${newTitle}"`);
                                            propChanged = true;
                                            return { ...item, title: newTitle };
                                        }
                                    }
                                    // Check if it is a simple string (e.g. Tags, Multiselect) that matches the OLD title
                                    else if (typeof item === 'string') {
                                        if (item === currentObject.title) {
                                            console.log(`[RenamePropagation] MATCH found in string array property "${key}" in "${obj.title}"`);
                                            console.log(`[RenamePropagation] Updating string value from "${item}" to "${newTitle}"`);
                                            propChanged = true;
                                            return newTitle;
                                        }
                                    }
                                    return item;
                                });

                                if (propChanged) {
                                    objProperties[key] = newValue;
                                    hasChanges = true;
                                }
                            }
                        }

                        // 3. Check 'tags' array field (if it stores names)
                        if (obj.tags && Array.isArray(obj.tags)) {
                            let tagsChanged = false;
                            const newTags = obj.tags.map(tag => {
                                if (tag === currentObject.title) {
                                    console.log(`[RenamePropagation] MATCH found in 'tags' of "${obj.title}"`);
                                    console.log(`[RenamePropagation] Updating tag from "${tag}" to "${newTitle}"`);
                                    tagsChanged = true;
                                    return newTitle;
                                }
                                return tag;
                            });

                            if (tagsChanged) {
                                objUpdates.tags = newTags;
                                hasChanges = true;
                            }
                        }

                        // Set properties update if any changes detected
                        if (hasChanges) {
                            objUpdates.properties = objProperties;
                        }

                        // 2. Check Content: Mentions, Anchors, and Hashtags
                        // We need to update user-visible text in content for these reference types
                        if (obj.content && (
                            obj.content.includes(`data-mention-id="${id}"`) ||
                            obj.content.includes(`href="object:${id}"`) ||
                            obj.content.includes(`data-hashtag-id="${id}"`)
                        )) {
                            let newContent = obj.content;
                            let contentModified = false;
                            console.log(`[RenamePropagation] Checking content of "${obj.title}" for mentions/hashtags...`);

                            // Update Mentions: <span ... data-mention-id="ID" ...>OLD TITLE</span>
                            // Replaces the text content inside a span that has data-mention-id="ID"
                            const mentionRegex = new RegExp(`(<span[^>]*data-mention-id="${id}"[^>]*>)([^<]*)(</span>)`, 'g');
                            if (mentionRegex.test(newContent)) {
                                console.log(`[RenamePropagation] Updating mention in "${obj.title}"`);
                                newContent = newContent.replace(new RegExp(`(<span[^>]*data-mention-id="${id}"[^>]*>)([^<]*)(</span>)`, 'g'), `$1@${newTitle}$3`);
                                contentModified = true;
                            }

                            // Update Anchors: <a ... href="object:ID" ...>OLD TITLE</a>
                            const anchorRegex = new RegExp(`(<a[^>]*href="object:${id}"[^>]*>)([^<]*)(</a>)`, 'g');
                            if (anchorRegex.test(newContent)) {
                                console.log(`[RenamePropagation] Updating anchor in "${obj.title}"`);
                                newContent = newContent.replace(new RegExp(`(<a[^>]*href="object:${id}"[^>]*>)([^<]*)(</a>)`, 'g'), `$1${newTitle}$3`);
                                contentModified = true;
                            }

                            // Update Hashtags: <span ... data-hashtag-id="ID" data-hashtag-label="OLD LABEL" ...>#OLD LABEL</span>
                            // Need to update both the data-hashtag-label attribute AND the text content
                            if (obj.content.includes(`data-hashtag-id="${id}"`)) {
                                console.log(`[RenamePropagation] Updating hashtag in "${obj.title}"`);
                                // Update the label attribute
                                newContent = newContent.replace(
                                    new RegExp(`(data-hashtag-id="${id}"[^>]*data-hashtag-label=")([^"]*)(")`, 'g'),
                                    `$1${newTitle}$3`
                                );
                                // Also handle reverse order (label before id)
                                newContent = newContent.replace(
                                    new RegExp(`(data-hashtag-label=")([^"]*)("[^>]*data-hashtag-id="${id}")`, 'g'),
                                    `$1${newTitle}$3`
                                );
                                // Update the text content (#label)
                                newContent = newContent.replace(
                                    new RegExp(`(<span[^>]*data-hashtag-id="${id}"[^>]*>)(#[^<]*)(</span>)`, 'g'),
                                    `$1#${newTitle}$3`
                                );
                                contentModified = true;
                            }

                            if (contentModified && newContent !== obj.content) {
                                objUpdates.content = newContent;
                                hasChanges = true;
                            }
                        }

                        if (hasChanges) {
                            // Add to batch
                            const objRef = doc(getFirestoreDb(), 'objects', obj.id);
                            batch.update(objRef, {
                                ...objUpdates,
                                updatedAt: Timestamp.fromDate(new Date())
                            });
                            batchCount++;

                            // Track for local update
                            updatedObjects.push({
                                ...obj,
                                ...objUpdates,
                                updatedAt: new Date()
                            });
                        }
                    }

                    if (batchCount > 0) {
                        console.log(`[RenamePropagation] Committing batch update for ${batchCount} objects...`);
                        await batch.commit();
                        console.log(`[RenamePropagation] Batch commit successful.`);

                        // Optimistic update of ALL affected objects in store
                        set((state) => ({
                            objects: state.objects.map(o => {
                                const updated = updatedObjects.find(uo => uo.id === o.id);
                                return updated || o;
                            })
                        }));
                    } else {
                        console.log(`[RenamePropagation] No references found to update.`);
                    }
                }

                // Handle two-way linked properties sync
                if (updates.properties) {
                    const objectType = get().objectTypes.find(t => t.id === currentObject.type);
                    if (objectType) {
                        for (const prop of objectType.properties) {
                            if (prop.type === 'relation' && prop.twoWayLinked && prop.linkedTypeId && prop.linkedPropertyId) {
                                const oldRelations = (currentObject.properties[prop.id] as { id: string; title: string }[]) || [];
                                const newRelations = (updates.properties[prop.id] as { id: string; title: string }[]) || [];

                                const oldIds = oldRelations.map(r => r.id);
                                const newIds = newRelations.map(r => r.id);

                                // Find added and removed relations
                                const addedIds = newIds.filter(rid => !oldIds.includes(rid));
                                const removedIds = oldIds.filter(rid => !newIds.includes(rid));

                                // Add back-reference to newly linked objects
                                for (const linkedId of addedIds) {
                                    const linkedObj = get().objects.find(o => o.id === linkedId);
                                    if (linkedObj && linkedObj.type === prop.linkedTypeId) {
                                        const linkedPropValue = (linkedObj.properties[prop.linkedPropertyId] as { id: string; title: string }[]) || [];
                                        const alreadyLinked = linkedPropValue.some(r => r.id === id);
                                        if (!alreadyLinked) {
                                            // Use current title (or new title if just renamed)
                                            const titleToUse = updates.title || currentObject.title;
                                            const updatedLinkedProp = [...linkedPropValue, { id, title: titleToUse }];
                                            // Update directly in DB to avoid recursive updates
                                            await db.updateObject(linkedId, {
                                                properties: {
                                                    ...linkedObj.properties,
                                                    [prop.linkedPropertyId]: updatedLinkedProp
                                                }
                                            });
                                            // Update local state
                                            set((state) => ({
                                                objects: state.objects.map(o =>
                                                    o.id === linkedId
                                                        ? {
                                                            ...o,
                                                            properties: {
                                                                ...o.properties,
                                                                [prop.linkedPropertyId!]: updatedLinkedProp
                                                            },
                                                            updatedAt: new Date()
                                                        }
                                                        : o
                                                ),
                                            }));
                                        }
                                    }
                                }

                                // Remove back-reference from unlinked objects
                                for (const unlinkedId of removedIds) {
                                    const unlinkedObj = get().objects.find(o => o.id === unlinkedId);
                                    if (unlinkedObj && unlinkedObj.type === prop.linkedTypeId) {
                                        const unlinkedPropValue = (unlinkedObj.properties[prop.linkedPropertyId] as { id: string; title: string }[]) || [];
                                        const updatedUnlinkedProp = unlinkedPropValue.filter(r => r.id !== id);
                                        // Update directly in DB to avoid recursive updates
                                        await db.updateObject(unlinkedId, {
                                            properties: {
                                                ...unlinkedObj.properties,
                                                [prop.linkedPropertyId]: updatedUnlinkedProp
                                            }
                                        });
                                        // Update local state
                                        set((state) => ({
                                            objects: state.objects.map(o =>
                                                o.id === unlinkedId
                                                    ? {
                                                        ...o,
                                                        properties: {
                                                            ...o.properties,
                                                            [prop.linkedPropertyId!]: updatedUnlinkedProp
                                                        },
                                                        updatedAt: new Date()
                                                    }
                                                    : o
                                            ),
                                        }));
                                    }
                                }
                            }
                        }
                    }
                }

                await db.updateObject(id, updates);

                // TRIGGER SHADOW CHUNKING (Client-side simulation)
                // Check if content or title changed to avoid unnecessary processing
                if (currentObject && (updates.content !== undefined || updates.title !== undefined)) {
                    const newTitle = updates.title || currentObject.title;
                    const newContent = updates.content !== undefined ? updates.content : currentObject.content;
                    generateSearchChunks(id, newTitle, newContent || '').catch(console.error);
                }

                set((state) => ({
                    objects: state.objects.map(o =>
                        o.id === id ? { ...o, ...updates, updatedAt: new Date() } : o
                    ),
                }));

                // Sync to Drive in background (debounced by caller)
                get().syncObjectToDrive(id);

                // GENAI: Update embedding if relevant fields changed
                // Use the merged object (current + updates) for serialization
                if (updates.title || updates.content || updates.tags || updates.properties) {
                    const aiState = useAIStore.getState();
                    if (aiState.isEnabled && aiState.apiKey) {
                        const updatedObj = { ...currentObject, ...updates };
                        const textToEmbed = serializeForEmbedding(
                            updatedObj.type,
                            updatedObj.title,
                            updatedObj.content,
                            updatedObj.tags,
                            updatedObj.properties
                        );

                        aiService.getEmbeddings(textToEmbed)
                            .then(embedding => db.updateObject(id, { embedding }))
                            .catch(err => console.error('[AI] Embedding update failed:', err));
                    }
                }
            } catch (error) {
                set({ error: (error as Error).message });
                throw error;
            }
        },

        deleteObject: async (id) => {
            const obj = get().objects.find(o => o.id === id);
            if (!obj) return;

            try {
                // Delete from Drive if synced
                if (obj.driveFileId) {
                    await drive.deleteFromDrive(obj.driveFileId);
                }

                await db.deleteObject(id);

                set((state) => ({
                    objects: state.objects.filter(o => o.id !== id),
                    selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
                }));
            } catch (error) {
                set({ error: (error as Error).message });
                throw error;
            }
        },

        // ObjectType CRUD
        createObjectType: async (typeData) => {
            try {
                const id = typeData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

                // Ensure base properties are included
                const existingPropIds = typeData.properties.map(p => p.id);
                const missingBaseProps = BASE_PROPERTIES.filter(bp => !existingPropIds.includes(bp.id));

                const newType: ObjectType = {
                    ...typeData,
                    id,
                    properties: [...typeData.properties, ...missingBaseProps],
                };
                await db.saveObjectType(newType);
                // The Firestore subscription will update the store
                return newType;
            } catch (error) {
                set({ error: (error as Error).message });
                throw error;
            }
        },

        updateObjectType: async (id, updates) => {
            const currentType = get().objectTypes.find(t => t.id === id);
            if (!currentType) return;

            try {
                const updatedType = { ...currentType, ...updates };
                await db.saveObjectType(updatedType);
                // The Firestore subscription will update the store
            } catch (error) {
                set({ error: (error as Error).message });
                throw error;
            }
        },

        deleteObjectType: async (id) => {
            // Don't allow deleting types that have objects
            const hasObjects = get().objects.some(o => o.type === id);
            if (hasObjects) {
                throw new Error('No se puede eliminar un tipo que tiene objetos. Elimina primero los objetos.');
            }

            try {
                await db.deleteObjectType(id);
                // The Firestore subscription will update the store
            } catch (error) {
                set({ error: (error as Error).message });
                throw error;
            }
        },

        syncObjectToDrive: async (idOrObject) => {
            const connected = drive.isDriveConnected();
            const driveStore = useDriveStore.getState();

            // Accept either an id or a full object
            let obj: AstralObject | undefined;
            let id: string;

            if (typeof idOrObject === 'string') {
                id = idOrObject;
                obj = get().objects.find(o => o.id === id);
            } else {
                obj = idOrObject;
                id = idOrObject.id;
            }

            console.log('[Drive Sync] Starting sync for:', id, 'Connected:', connected);

            if (!connected) {
                console.log('[Drive Sync] Not connected to Drive, adding to pending');
                driveStore.addPendingSync(id);
                driveStore.setConnectionStatus('disconnected', 'Token expired or not available');
                return;
            }

            if (!obj) {
                console.log('[Drive Sync] Object not found:', id);
                return;
            }

            const objectType = get().objectTypes.find(t => t.id === obj.type);
            const typeName = objectType?.namePlural || obj.type;
            console.log('[Drive Sync] Syncing:', obj.title, 'Type:', typeName);

            // Mark as syncing
            driveStore.addPendingSync(id);
            driveStore.setConnectionStatus('syncing');

            try {
                const { fileId, revisionId } = await drive.syncObjectToDrive(obj, typeName);
                console.log('[Drive Sync] Success! FileId:', fileId, 'RevisionId:', revisionId);

                // Remove from pending
                driveStore.removePendingSync(id);
                driveStore.setConnectionStatus('connected');
                driveStore.updateLastSync();

                // Update with Drive info if changed
                if (fileId !== obj.driveFileId || revisionId !== obj.driveRevisionId) {
                    await db.updateObject(id, { driveFileId: fileId, driveRevisionId: revisionId });

                    set((state) => ({
                        objects: state.objects.map(o =>
                            o.id === id ? { ...o, driveFileId: fileId, driveRevisionId: revisionId } : o
                        ),
                    }));
                }
            } catch (error) {
                console.error('[Drive Sync] Error:', error);

                // Handle authentication errors specially
                if (error instanceof DriveAuthError) {
                    console.warn('[Drive Sync] Auth error - marking as disconnected');
                    driveStore.setConnectionStatus('disconnected', error.message);
                    // Keep pending sync so it can be retried after reconnection
                } else {
                    // For other errors, remove from pending but mark as error
                    driveStore.removePendingSync(id);
                    driveStore.setConnectionStatus('error', (error as Error).message);
                }
            }
        },

        initialize: async () => {
            // Cleanup any existing subscriptions first
            if (unsubscribeObjects) {
                unsubscribeObjects();
                unsubscribeObjects = null;
            }
            if (unsubscribeTypes) {
                unsubscribeTypes();
                unsubscribeTypes = null;
            }

            set({ isLoading: true, error: null });
            try {
                // Load object types from Firestore or use defaults
                let types = await db.getObjectTypes();
                if (types.length === 0) {
                    // Initialize with default types, adding base properties
                    const typesWithBaseProps = DEFAULT_OBJECT_TYPES.map(type => ({
                        ...type,
                        properties: [...type.properties, ...BASE_PROPERTIES],
                    }));
                    for (const type of typesWithBaseProps) {
                        await db.saveObjectType(type);
                    }
                    set({ objectTypes: typesWithBaseProps });
                } else {
                    // Migration 1: ensure all types have base properties
                    let needsUpdate = false;
                    types = types.map(type => {
                        const existingPropIds = type.properties.map(p => p.id);
                        const missingBaseProps = BASE_PROPERTIES.filter(bp => !existingPropIds.includes(bp.id));
                        if (missingBaseProps.length > 0) {
                            needsUpdate = true;
                            return {
                                ...type,
                                properties: [...type.properties, ...missingBaseProps],
                            };
                        }
                        return type;
                    });

                    // Save updated types if needed
                    if (needsUpdate) {
                        for (const type of types) {
                            await db.saveObjectType(type);
                        }
                    }

                    // Migration 2: Add new default types that don't exist in Firestore
                    const existingTypeIds = types.map(t => t.id);
                    const newDefaultTypes = DEFAULT_OBJECT_TYPES.filter(dt => !existingTypeIds.includes(dt.id));

                    if (newDefaultTypes.length > 0) {
                        console.log('[ObjectStore] Adding new default types:', newDefaultTypes.map(t => t.id));
                        for (const newType of newDefaultTypes) {
                            const typeWithBaseProps = {
                                ...newType,
                                properties: [...newType.properties, ...BASE_PROPERTIES],
                            };
                            await db.saveObjectType(typeWithBaseProps);
                            types.push(typeWithBaseProps);
                        }
                    }

                    set({ objectTypes: types });
                }

                // Subscribe to real-time updates and store refs
                unsubscribeObjects = db.subscribeToObjects((objects) => {
                    set({ objects });
                });

                unsubscribeTypes = db.subscribeToObjectTypes((types) => {
                    set({ objectTypes: types });
                });

                set({ isLoading: false });
            } catch (error) {
                set({ error: (error as Error).message, isLoading: false });
            }
        },

        cleanup: () => {
            if (unsubscribeObjects) {
                unsubscribeObjects();
                unsubscribeObjects = null;
            }
            if (unsubscribeTypes) {
                unsubscribeTypes();
                unsubscribeTypes = null;
            }
            set({ objects: [], selectedObjectId: null });
        },
    }))
);

// Selectors
export const useSelectedObject = () => {
    const objects = useObjectStore(s => s.objects);
    const selectedId = useObjectStore(s => s.selectedObjectId);
    return objects.find(o => o.id === selectedId) || null;
};

export const useObjectsByType = (type: string) => {
    return useObjectStore(s => s.objects.filter(o => o.type === type));
};
