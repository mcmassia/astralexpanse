// Global state store for objects using Zustand
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AstralObject, ObjectType } from '../types/object';
import { DEFAULT_OBJECT_TYPES } from '../types/object';
import * as db from '../services/db';
import * as drive from '../services/drive';

interface ObjectStore {
    // State
    objects: AstralObject[];
    objectTypes: ObjectType[];
    selectedObjectId: string | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    setObjects: (objects: AstralObject[]) => void;
    setObjectTypes: (types: ObjectType[]) => void;
    selectObject: (id: string | null) => void;

    // Object CRUD Operations
    createObject: (type: string, title: string, content?: string, autoSelect?: boolean) => Promise<AstralObject>;
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

// Store unsubscribe functions outside of the store state
let unsubscribeObjects: (() => void) | null = null;
let unsubscribeTypes: (() => void) | null = null;

export const useObjectStore = create<ObjectStore>()(
    subscribeWithSelector((set, get) => ({
        objects: [],
        objectTypes: DEFAULT_OBJECT_TYPES,
        selectedObjectId: null,
        isLoading: false,
        error: null,

        setObjects: (objects) => set({ objects }),
        setObjectTypes: (types) => set({ objectTypes: types }),
        selectObject: (id) => set({ selectedObjectId: id }),

        createObject: async (type, title, content = '', autoSelect = true) => {
            set({ isLoading: true, error: null });
            try {
                const newObject = await db.createObject({
                    type,
                    title,
                    content,
                    properties: {},
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

                // Sync to Drive in background - pass the object directly since it's not in state yet
                get().syncObjectToDrive(newObject);

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

                await db.updateObject(id, updates);

                set((state) => ({
                    objects: state.objects.map(o =>
                        o.id === id ? { ...o, ...updates, updatedAt: new Date() } : o
                    ),
                }));

                // Sync to Drive in background (debounced by caller)
                get().syncObjectToDrive(id);
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
                const newType: ObjectType = {
                    ...typeData,
                    id,
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
                console.log('[Drive Sync] Not connected to Drive, skipping');
                return;
            }

            if (!obj) {
                console.log('[Drive Sync] Object not found:', id);
                return;
            }

            const objectType = get().objectTypes.find(t => t.id === obj.type);
            const typeName = objectType?.namePlural || obj.type;
            console.log('[Drive Sync] Syncing:', obj.title, 'Type:', typeName);

            try {
                const { fileId, revisionId } = await drive.syncObjectToDrive(obj, typeName);
                console.log('[Drive Sync] Success! FileId:', fileId, 'RevisionId:', revisionId);

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
                // Don't throw - Drive sync is non-critical
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
                const types = await db.getObjectTypes();
                if (types.length === 0) {
                    // Initialize with default types
                    for (const type of DEFAULT_OBJECT_TYPES) {
                        await db.saveObjectType(type);
                    }
                    set({ objectTypes: DEFAULT_OBJECT_TYPES });
                } else {
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
