// Firestore database service for CRUD operations
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore';
import type { QueryConstraint, Unsubscribe } from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import type { AstralObject, ObjectType, SavedQuery } from '../types/object';

const OBJECTS_COLLECTION = 'objects';
const TYPES_COLLECTION = 'objectTypes';
const QUERIES_COLLECTION = 'savedQueries';

// Helper to convert Firestore timestamps
const convertTimestamps = (data: Record<string, unknown>): AstralObject => {
    return {
        ...data,
        createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : new Date(data.createdAt as string),
        updatedAt: data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate()
            : new Date(data.updatedAt as string),
    } as AstralObject;
};

// ============ OBJECTS ============

export const createObject = async (obj: Omit<AstralObject, 'id' | 'createdAt' | 'updatedAt'>): Promise<AstralObject> => {
    const db = getFirestoreDb();
    const docRef = doc(collection(db, OBJECTS_COLLECTION));

    const now = new Date();
    const newObject: AstralObject = {
        ...obj,
        id: docRef.id,
        createdAt: now,
        updatedAt: now,
        links: obj.links || [],
        backlinks: obj.backlinks || [],
        tags: obj.tags || [],
        properties: obj.properties || {},
    };

    await setDoc(docRef, {
        ...newObject,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
    });

    return newObject;
};

export const getObject = async (id: string): Promise<AstralObject | null> => {
    const db = getFirestoreDb();
    const docRef = doc(db, OBJECTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    return convertTimestamps(docSnap.data() as Record<string, unknown>);
};

export const updateObject = async (id: string, updates: Partial<AstralObject>): Promise<void> => {
    const db = getFirestoreDb();
    const docRef = doc(db, OBJECTS_COLLECTION, id);

    await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
    });
};

export const deleteObject = async (id: string): Promise<void> => {
    const db = getFirestoreDb();
    await deleteDoc(doc(db, OBJECTS_COLLECTION, id));
};

export const getAllObjects = async (): Promise<AstralObject[]> => {
    const db = getFirestoreDb();
    const q = query(collection(db, OBJECTS_COLLECTION), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => convertTimestamps(doc.data() as Record<string, unknown>));
};

export const getObjectsByType = async (type: string): Promise<AstralObject[]> => {
    const db = getFirestoreDb();
    const q = query(
        collection(db, OBJECTS_COLLECTION),
        where('type', '==', type),
        orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => convertTimestamps(doc.data() as Record<string, unknown>));
};

export const searchObjects = async (searchTerm: string): Promise<AstralObject[]> => {
    // Note: Firestore doesn't support full-text search natively
    // This is a simple client-side filter - for production, consider Algolia or Typesense
    const allObjects = await getAllObjects();
    const lowerSearch = searchTerm.toLowerCase();

    return allObjects.filter(obj =>
        obj.title.toLowerCase().includes(lowerSearch) ||
        obj.content.toLowerCase().includes(lowerSearch)
    );
};

// Real-time subscription to all objects
export const subscribeToObjects = (
    callback: (objects: AstralObject[]) => void,
    constraints: QueryConstraint[] = []
): Unsubscribe => {
    const db = getFirestoreDb();
    const q = query(collection(db, OBJECTS_COLLECTION), ...constraints, orderBy('updatedAt', 'desc'));

    return onSnapshot(q,
        (snapshot) => {
            const objects = snapshot.docs.map(doc => convertTimestamps(doc.data() as Record<string, unknown>));
            callback(objects);
        },
        (error) => {
            console.error('[Firestore] Error in objects subscription:', error);
            // If permission denied, the user might need to re-authenticate
            if (error.code === 'permission-denied') {
                console.error('[Firestore] Permission denied - user may need to re-login');
            }
        }
    );
};

// ============ OBJECT TYPES ============

export const saveObjectType = async (type: ObjectType): Promise<void> => {
    const db = getFirestoreDb();
    await setDoc(doc(db, TYPES_COLLECTION, type.id), type);
};

export const getObjectTypes = async (): Promise<ObjectType[]> => {
    const db = getFirestoreDb();
    const snapshot = await getDocs(collection(db, TYPES_COLLECTION));
    return snapshot.docs.map(doc => doc.data() as ObjectType);
};

export const subscribeToObjectTypes = (
    callback: (types: ObjectType[]) => void
): Unsubscribe => {
    const db = getFirestoreDb();

    return onSnapshot(
        collection(db, TYPES_COLLECTION),
        (snapshot) => {
            const types = snapshot.docs.map(doc => doc.data() as ObjectType);
            callback(types);
        },
        (error) => {
            console.error('[Firestore] Error in types subscription:', error);
        }
    );
};

export const deleteObjectType = async (id: string): Promise<void> => {
    const db = getFirestoreDb();
    await deleteDoc(doc(db, TYPES_COLLECTION, id));
};

// ============ BACKLINKS ============

export const updateBacklinks = async (objectId: string, newLinks: string[], oldLinks: string[]): Promise<void> => {
    const db = getFirestoreDb();

    // Find added and removed links
    const addedLinks = newLinks.filter(l => !oldLinks.includes(l));
    const removedLinks = oldLinks.filter(l => !newLinks.includes(l));

    // Add backlink to newly linked objects
    for (const linkedId of addedLinks) {
        const linkedObj = await getObject(linkedId);
        if (linkedObj) {
            const backlinks = [...new Set([...linkedObj.backlinks, objectId])];
            await updateDoc(doc(db, OBJECTS_COLLECTION, linkedId), { backlinks });
        }
    }

    // Remove backlink from unlinked objects
    for (const unlinkedId of removedLinks) {
        const unlinkedObj = await getObject(unlinkedId);
        if (unlinkedObj) {
            const backlinks = unlinkedObj.backlinks.filter(id => id !== objectId);
            await updateDoc(doc(db, OBJECTS_COLLECTION, unlinkedId), { backlinks });
        }
    }
};

// ============ SAVED QUERIES ============

// Helper to convert SavedQuery timestamps
const convertQueryTimestamps = (data: Record<string, unknown>): SavedQuery => {
    return {
        ...data,
        createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : new Date(data.createdAt as string),
        updatedAt: data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate()
            : new Date(data.updatedAt as string),
    } as SavedQuery;
};

export const createSavedQuery = async (queryData: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedQuery> => {
    const db = getFirestoreDb();
    const docRef = doc(collection(db, QUERIES_COLLECTION));

    const now = new Date();
    const newQuery: SavedQuery = {
        ...queryData,
        id: docRef.id,
        createdAt: now,
        updatedAt: now,
    };

    await setDoc(docRef, {
        ...newQuery,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
    });

    return newQuery;
};

export const getSavedQueries = async (): Promise<SavedQuery[]> => {
    const db = getFirestoreDb();
    const q = query(collection(db, QUERIES_COLLECTION), orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => convertQueryTimestamps(doc.data() as Record<string, unknown>));
};

export const updateSavedQuery = async (id: string, updates: Partial<SavedQuery>): Promise<void> => {
    const db = getFirestoreDb();
    const docRef = doc(db, QUERIES_COLLECTION, id);

    await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
    });
};

export const deleteSavedQuery = async (id: string): Promise<void> => {
    const db = getFirestoreDb();
    await deleteDoc(doc(db, QUERIES_COLLECTION, id));
};

export const subscribeToSavedQueries = (
    callback: (queries: SavedQuery[]) => void
): Unsubscribe => {
    const db = getFirestoreDb();
    const q = query(collection(db, QUERIES_COLLECTION), orderBy('updatedAt', 'desc'));

    return onSnapshot(q,
        (snapshot) => {
            const queries = snapshot.docs.map(doc => convertQueryTimestamps(doc.data() as Record<string, unknown>));
            callback(queries);
        },
        (error) => {
            console.error('[Firestore] Error in queries subscription:', error);
        }
    );
};

