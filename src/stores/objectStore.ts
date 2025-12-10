// Global state store for objects using Zustand
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AstralObject, ObjectType } from '../types/object';
import { DEFAULT_OBJECT_TYPES } from '../types/object';
import * as db from '../services/db';
import * as drive from '../services/drive';
import { DriveAuthError } from '../services/drive';
import { useDriveStore } from './driveStore';

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
                                            const updatedLinkedProp = [...linkedPropValue, { id, title: currentObject.title }];
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
