import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, AIModelConfig } from '../types/ai';

export const DEFAULT_MODELS: AIModelConfig = {
    smartConstructor: 'gemini-2.5-flash',
    entityExtraction: 'gemini-2.5-flash',
    chat: 'gemini-2.5-pro',
    embeddings: 'text-embedding-004',
};

interface AIState {
    apiKey: string;
    isEnabled: boolean;
    models: AIModelConfig;

    // Chat History Persistence
    chatHistory: ChatMessage[];

    setApiKey: (key: string) => void;
    setEnabled: (enabled: boolean) => void;
    setModel: (feature: keyof AIModelConfig, modelId: string) => void;

    // Chat Actions
    addChatMessage: (message: ChatMessage) => void;
    clearChat: () => void;
    resetDefaults: () => void;
}

export const useAIStore = create<AIState>()(
    persist(
        (set) => ({
            apiKey: '',
            isEnabled: false,
            models: DEFAULT_MODELS,
            chatHistory: [{
                id: 'welcome',
                role: 'model',
                content: 'Hola 👋, soy tu cerebro digital. Pregúntame sobre tus notas, tareas o cualquier cosa que hayas guardado.',
                timestamp: Date.now()
            }],

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
                chatHistory: [{
                    id: 'welcome',
                    role: 'model',
                    content: 'Hola 👋, soy tu cerebro digital. Pregúntame sobre tus notas, tareas o cualquier cosa que hayas guardado.',
                    timestamp: Date.now()
                }]
            }),
            resetDefaults: () => set({ models: DEFAULT_MODELS }),
        }),
        {
            name: 'astral-ai-storage',
            partialize: (state) => ({
                apiKey: state.apiKey,
                isEnabled: state.isEnabled,
                models: state.models,
                chatHistory: state.chatHistory, // Persist chat
            }),
        }
    )
);
