import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { initializeFirebase } from '../services/firebase';
import type { ChatMessage, AIModelConfig, ContextCacheEntry } from '../types/ai';

export const DEFAULT_MODELS: AIModelConfig = {
    smartConstructor: 'gemini-2.5-flash',
    entityExtraction: 'gemini-2.5-flash',
    chat: 'gemini-2.5-pro',
    embeddings: 'text-embedding-004',
};

const WELCOME_MESSAGE: ChatMessage = {
    id: 'welcome',
    role: 'model',
    content: 'Hola 👋, soy tu cerebro digital. Pregúntame sobre tus notas, tareas o cualquier cosa que hayas guardado.',
    timestamp: Date.now()
};

// Simple hash function for query caching
const hashQuery = (query: string): string => {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
};

interface AIState {
    apiKey: string;
    isEnabled: boolean;
    models: AIModelConfig;

    // Chat History Persistence
    chatHistory: ChatMessage[];
    contextCache: ContextCacheEntry[];

    setApiKey: (key: string) => void;
    setEnabled: (enabled: boolean) => void;
    setModel: (feature: keyof AIModelConfig, modelId: string) => void;

    // Chat Actions
    addChatMessage: (message: ChatMessage) => void;
    clearChat: () => void;
    resetDefaults: () => void;

    // Firestore Actions
    loadChatFromFirestore: (userId: string) => Promise<void>;
    saveChatToFirestore: (userId: string) => Promise<void>;
    subscribeToFirestore: (userId: string) => () => void;

    // Cache Actions
    addContextCacheEntry: (queryHash: string, objectIds: string[]) => void;
    getContextFromCache: (query: string) => string[] | null;
}

export const useAIStore = create<AIState>()(
    persist(
        (set, get) => ({
            apiKey: '',
            isEnabled: false,
            models: DEFAULT_MODELS,
            chatHistory: [WELCOME_MESSAGE],
            contextCache: [],

            setApiKey: (apiKey) => set({ apiKey }),
            setEnabled: (isEnabled) => set({ isEnabled }),
            setModel: (feature, modelId) =>
                set((state) => ({
                    models: { ...state.models, [feature]: modelId }
                })),

            addChatMessage: (message) => set((state) => ({
                chatHistory: [...state.chatHistory, message]
            })),
            clearChat: () => set({
                chatHistory: [WELCOME_MESSAGE],
                contextCache: []
            }),
            resetDefaults: () => set({ models: DEFAULT_MODELS }),

            // Firestore: Load chat history
            loadChatFromFirestore: async (userId: string) => {
                try {
                    const { db } = initializeFirebase();
                    const docRef = doc(db, 'chatHistories', `${userId}_brain`);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        set({
                            chatHistory: data.messages || [WELCOME_MESSAGE],
                            contextCache: data.contextCache || []
                        });
                        console.log('[AIStore] Loaded chat from Firestore');
                    }
                } catch (error) {
                    console.error('[AIStore] Failed to load chat from Firestore:', error);
                }
            },

            // Firestore: Save chat history
            saveChatToFirestore: async (userId: string) => {
                try {
                    const { db } = initializeFirebase();
                    const docRef = doc(db, 'chatHistories', `${userId}_brain`);
                    const state = get();

                    await setDoc(docRef, {
                        messages: state.chatHistory,
                        contextCache: state.contextCache,
                        updatedAt: Date.now()
                    }, { merge: true });

                    console.log('[AIStore] Saved chat to Firestore');
                } catch (error) {
                    console.error('[AIStore] Failed to save chat to Firestore:', error);
                }
            },

            // Firestore: Subscribe to real-time updates
            subscribeToFirestore: (userId: string) => {
                const { db } = initializeFirebase();
                const docRef = doc(db, 'chatHistories', `${userId}_brain`);

                const unsubscribe = onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        // Only update if the remote has more messages (avoid overwrite loops)
                        const currentLength = get().chatHistory.length;
                        if (data.messages && data.messages.length > currentLength) {
                            set({
                                chatHistory: data.messages,
                                contextCache: data.contextCache || []
                            });
                            console.log('[AIStore] Synced updates from Firestore');
                        }
                    }
                });

                return unsubscribe;
            },

            // Cache: Add entry
            addContextCacheEntry: (query: string, objectIds: string[]) => {
                const queryHash = hashQuery(query);
                set((state) => ({
                    contextCache: [
                        ...state.contextCache.filter(e => e.queryHash !== queryHash),
                        { queryHash, objectIds, timestamp: Date.now() }
                    ].slice(-50) // Keep only last 50 entries
                }));
            },

            // Cache: Get entry (if valid, <30 min old)
            getContextFromCache: (query: string) => {
                const queryHash = hashQuery(query);
                const entry = get().contextCache.find(e => e.queryHash === queryHash);
                if (entry && (Date.now() - entry.timestamp) < 30 * 60 * 1000) {
                    return entry.objectIds;
                }
                return null;
            }
        }),
        {
            name: 'astral-ai-storage',
            partialize: (state) => ({
                apiKey: state.apiKey,
                isEnabled: state.isEnabled,
                models: state.models,
                // Note: chatHistory is persisted to Firestore, not localStorage
            }),
        }
    )
);
