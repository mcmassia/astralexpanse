// UI state store
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SidebarTab = 'objects' | 'types' | 'search';
type Theme = 'light' | 'dark' | 'system';
type CommandPaletteMode = 'quick' | 'extended';
type CalendarView = 'day' | 'threeDays' | 'week' | 'month';
type AppSection = 'objects' | 'calendar';

interface ExtendedSearchFilters {
    typeFilters: string[];
    tagFilters: string[];
    showBlocksOnly: boolean;
    groupByType: boolean;
    resultLimit: number;
}

interface UIStore {
    // App section
    currentSection: AppSection;

    // Sidebar
    sidebarOpen: boolean;
    sidebarTab: SidebarTab;
    sidebarWidth: number;

    // Theme
    theme: Theme;

    // Modal states
    isCreateModalOpen: boolean;
    createModalType: string | null;

    // Search (legacy sidebar search)
    searchQuery: string;

    // Command Palette
    commandPaletteOpen: boolean;
    commandPaletteMode: CommandPaletteMode;
    commandPaletteQuery: string;
    extendedSearchFilters: ExtendedSearchFilters;

    // Settings modal
    settingsOpen: boolean;

    // Calendar
    calendarView: CalendarView;
    selectedDate: Date;
    calendarSidebarOpen: boolean;

    // Actions
    setCurrentSection: (section: AppSection) => void;
    toggleSidebar: () => void;
    setSidebarTab: (tab: SidebarTab) => void;
    setSidebarWidth: (width: number) => void;
    setTheme: (theme: Theme) => void;
    openCreateModal: (type?: string) => void;
    closeCreateModal: () => void;
    setSearchQuery: (query: string) => void;

    // Command Palette actions
    openCommandPalette: (mode?: CommandPaletteMode) => void;
    closeCommandPalette: () => void;
    setCommandPaletteQuery: (query: string) => void;
    setExtendedSearchFilters: (filters: Partial<ExtendedSearchFilters>) => void;
    toggleTypeFilter: (typeId: string) => void;
    toggleTagFilter: (tag: string) => void;

    // Settings
    openSettings: () => void;
    closeSettings: () => void;

    // Calendar actions
    setCalendarView: (view: CalendarView) => void;
    setSelectedDate: (date: Date) => void;
    goToToday: () => void;
    goToPreviousDay: () => void;
    goToNextDay: () => void;
    goToPreviousWeek: () => void;
    goToNextWeek: () => void;
    goToPreviousMonth: () => void;
    goToNextMonth: () => void;
    toggleCalendarSidebar: () => void;
}

const defaultExtendedFilters: ExtendedSearchFilters = {
    typeFilters: [],
    tagFilters: [],
    showBlocksOnly: false,
    groupByType: false,
    resultLimit: 50,
};

export const useUIStore = create<UIStore>()(
    persist(
        (set) => ({
            currentSection: 'objects',
            sidebarOpen: true,
            sidebarTab: 'objects',
            sidebarWidth: 280,
            theme: 'system',
            isCreateModalOpen: false,
            createModalType: null,
            searchQuery: '',

            // Command Palette defaults
            commandPaletteOpen: false,
            commandPaletteMode: 'quick',
            commandPaletteQuery: '',
            extendedSearchFilters: defaultExtendedFilters,

            // Settings
            settingsOpen: false,

            // Calendar defaults
            calendarView: 'day',
            selectedDate: new Date(),
            calendarSidebarOpen: true,

            setCurrentSection: (section) => set({ currentSection: section }),
            toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
            setSidebarTab: (tab) => set({ sidebarTab: tab }),
            setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),
            setTheme: (theme) => set({ theme }),
            openCreateModal: (type) => set({ isCreateModalOpen: true, createModalType: type || null }),
            closeCreateModal: () => set({ isCreateModalOpen: false, createModalType: null }),
            setSearchQuery: (query) => set({ searchQuery: query }),

            // Command Palette
            openCommandPalette: (mode = 'quick') => set({
                commandPaletteOpen: true,
                commandPaletteMode: mode,
                commandPaletteQuery: '',
            }),
            closeCommandPalette: () => set({
                commandPaletteOpen: false,
                commandPaletteQuery: '',
            }),
            setCommandPaletteQuery: (query) => set({ commandPaletteQuery: query }),
            setExtendedSearchFilters: (filters) => set((s) => ({
                extendedSearchFilters: { ...s.extendedSearchFilters, ...filters },
            })),
            toggleTypeFilter: (typeId) => set((s) => {
                const current = s.extendedSearchFilters.typeFilters;
                const newFilters = current.includes(typeId)
                    ? current.filter(t => t !== typeId)
                    : [...current, typeId];
                return {
                    extendedSearchFilters: { ...s.extendedSearchFilters, typeFilters: newFilters },
                };
            }),
            toggleTagFilter: (tag) => set((s) => {
                const current = s.extendedSearchFilters.tagFilters;
                const newFilters = current.includes(tag)
                    ? current.filter(t => t !== tag)
                    : [...current, tag];
                return {
                    extendedSearchFilters: { ...s.extendedSearchFilters, tagFilters: newFilters },
                };
            }),

            // Settings
            openSettings: () => set({ settingsOpen: true }),
            closeSettings: () => set({ settingsOpen: false }),

            // Calendar
            setCalendarView: (view) => set({ calendarView: view }),
            setSelectedDate: (date) => set({ selectedDate: date }),
            goToToday: () => set({ selectedDate: new Date() }),
            goToPreviousDay: () => set((s) => {
                const prev = new Date(s.selectedDate);
                prev.setDate(prev.getDate() - 1);
                return { selectedDate: prev };
            }),
            goToNextDay: () => set((s) => {
                const next = new Date(s.selectedDate);
                next.setDate(next.getDate() + 1);
                return { selectedDate: next };
            }),
            goToPreviousWeek: () => set((s) => {
                const prev = new Date(s.selectedDate);
                prev.setDate(prev.getDate() - 7);
                return { selectedDate: prev };
            }),
            goToNextWeek: () => set((s) => {
                const next = new Date(s.selectedDate);
                next.setDate(next.getDate() + 7);
                return { selectedDate: next };
            }),
            goToPreviousMonth: () => set((s) => {
                const prev = new Date(s.selectedDate);
                prev.setMonth(prev.getMonth() - 1);
                return { selectedDate: prev };
            }),
            goToNextMonth: () => set((s) => {
                const next = new Date(s.selectedDate);
                next.setMonth(next.getMonth() + 1);
                return { selectedDate: next };
            }),
            toggleCalendarSidebar: () => set((s) => ({ calendarSidebarOpen: !s.calendarSidebarOpen })),
        }),
        {
            name: 'astral-ui-store',
            partialize: (state) => ({
                sidebarOpen: state.sidebarOpen,
                sidebarWidth: state.sidebarWidth,
                theme: state.theme,
                calendarView: state.calendarView,
                calendarSidebarOpen: state.calendarSidebarOpen,
            }),
        }
    )
);

