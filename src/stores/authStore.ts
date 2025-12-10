// Auth state store
import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signOutUser } from '../services/firebase';
import { useObjectStore } from './objectStore';

interface AuthStore {
    user: User | null;
    isLoading: boolean;
    error: string | null;

    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    initialize: () => () => void;  // Returns unsubscribe function
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    isLoading: true,
    error: null,

    signIn: async () => {
        set({ isLoading: true, error: null });
        try {
            await signInWithGoogle();
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    signOut: async () => {
        try {
            // Cleanup object store subscriptions first
            useObjectStore.getState().cleanup();
            await signOutUser();
            set({ user: null });
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    initialize: () => {
        return onAuthChange((user) => {
            set({ user, isLoading: false });
        });
    },
}));
