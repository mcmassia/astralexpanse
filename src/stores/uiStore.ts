// UI state store
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SidebarTab = 'objects' | 'types' | 'search';
type Theme = 'light' | 'dark' | 'system';

interface UIStore {
    // Sidebar
    sidebarOpen: boolean;
    sidebarTab: SidebarTab;
    sidebarWidth: number;

    // Theme
    theme: Theme;

    // Modal states
    isCreateModalOpen: boolean;
    createModalType: string | null;

    // Search
    searchQuery: string;

    // Actions
    toggleSidebar: () => void;
    setSidebarTab: (tab: SidebarTab) => void;
    setSidebarWidth: (width: number) => void;
    setTheme: (theme: Theme) => void;
    openCreateModal: (type?: string) => void;
    closeCreateModal: () => void;
    setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            sidebarOpen: true,
            sidebarTab: 'objects',
            sidebarWidth: 280,
            theme: 'system',
            isCreateModalOpen: false,
            createModalType: null,
            searchQuery: '',

            toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
            setSidebarTab: (tab) => set({ sidebarTab: tab }),
            setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),
            setTheme: (theme) => set({ theme }),
            openCreateModal: (type) => set({ isCreateModalOpen: true, createModalType: type || null }),
            closeCreateModal: () => set({ isCreateModalOpen: false, createModalType: null }),
            setSearchQuery: (query) => set({ searchQuery: query }),
        }),
        {
            name: 'astral-ui-store',
            partialize: (state) => ({
                sidebarOpen: state.sidebarOpen,
                sidebarWidth: state.sidebarWidth,
                theme: state.theme,
            }),
        }
    )
);
