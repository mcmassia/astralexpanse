// Drive sync state store
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type DriveConnectionStatus = 'connected' | 'disconnected' | 'syncing' | 'reconnecting' | 'error';

interface DriveStore {
    // State
    connectionStatus: DriveConnectionStatus;
    lastSyncAt: Date | null;
    pendingSyncIds: Set<string>;
    tokenExpiresAt: number | null;
    errorMessage: string | null;

    // Actions
    setConnectionStatus: (status: DriveConnectionStatus, error?: string) => void;
    setTokenExpiration: (expiresAt: number) => void;
    addPendingSync: (objectId: string) => void;
    removePendingSync: (objectId: string) => void;
    clearPendingSyncs: () => void;
    updateLastSync: () => void;
    checkTokenExpired: () => boolean;
    getTimeUntilExpiration: () => number | null;
}

// Token lifetime is ~1 hour, we'll consider it expired 5 minutes before
const TOKEN_EXPIRATION_BUFFER = 5 * 60 * 1000; // 5 minutes

export const useDriveStore = create<DriveStore>()(
    subscribeWithSelector((set, get) => ({
        connectionStatus: 'disconnected',
        lastSyncAt: null,
        pendingSyncIds: new Set(),
        tokenExpiresAt: null,
        errorMessage: null,

        setConnectionStatus: (status, error) => set({
            connectionStatus: status,
            errorMessage: error || null,
        }),

        setTokenExpiration: (expiresAt) => set({
            tokenExpiresAt: expiresAt,
            connectionStatus: 'connected',
            errorMessage: null,
        }),

        addPendingSync: (objectId) => set((state) => {
            const newSet = new Set(state.pendingSyncIds);
            newSet.add(objectId);
            return { pendingSyncIds: newSet };
        }),

        removePendingSync: (objectId) => set((state) => {
            const newSet = new Set(state.pendingSyncIds);
            newSet.delete(objectId);
            return { pendingSyncIds: newSet };
        }),

        clearPendingSyncs: () => set({ pendingSyncIds: new Set() }),

        updateLastSync: () => set({ lastSyncAt: new Date() }),

        checkTokenExpired: () => {
            const { tokenExpiresAt } = get();
            if (!tokenExpiresAt) return true;
            return Date.now() > (tokenExpiresAt - TOKEN_EXPIRATION_BUFFER);
        },

        getTimeUntilExpiration: () => {
            const { tokenExpiresAt } = get();
            if (!tokenExpiresAt) return null;
            const remaining = tokenExpiresAt - Date.now();
            return remaining > 0 ? remaining : 0;
        },
    }))
);

// Selector hooks
export const useDriveConnectionStatus = () => useDriveStore((s) => s.connectionStatus);
export const usePendingSyncCount = () => useDriveStore((s) => s.pendingSyncIds.size);
export const useHasPendingSyncs = () => useDriveStore((s) => s.pendingSyncIds.size > 0);
