// UI state store
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SidebarTab = 'objects' | 'types' | 'search';
type Theme = 'light' | 'dark' | 'system';
type CommandPaletteMode = 'quick' | 'extended';
type CalendarView = 'day' | 'threeDays' | 'week' | 'month';
type AppSection = 'dashboard' | 'objects' | 'calendar';

// Navigation history item - tracks where user has been
export interface NavHistoryItem {
    section: AppSection;
    objectId: string | null; // null means ObjectsList/Calendar view
    timestamp: number;
}

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

    // Properties Panel
    propertiesPanelOpen: boolean;

    // Focus Mode
    focusMode: boolean;
    preFocusState: {
        sidebarOpen: boolean;
        calendarSidebarOpen: boolean;
        propertiesPanelOpen: boolean;
    } | null;

    // Global Navigation History
    navHistory: NavHistoryItem[];
    navHistoryIndex: number;

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

    // Properties Panel actions
    togglePropertiesPanel: () => void;

    // Focus Mode actions
    toggleFocusMode: () => void;
    exitFocusMode: () => void;

    // Global Navigation actions
    pushNavHistory: (section: AppSection, objectId: string | null) => void;
    goNavBack: () => void;
    goNavForward: () => void;
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
            currentSection: 'dashboard',
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

            // Properties Panel default
            propertiesPanelOpen: true,

            // Focus Mode defaults
            focusMode: false,
            preFocusState: null,

            // Navigation History defaults
            navHistory: [{ section: 'dashboard', objectId: null, timestamp: Date.now() }],
            navHistoryIndex: 0,

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

            // Properties Panel
            togglePropertiesPanel: () => set((s) => ({ propertiesPanelOpen: !s.propertiesPanelOpen })),

            // Focus Mode
            toggleFocusMode: () => set((s) => {
                if (s.focusMode) {
                    // Exit focus mode - restore previous state
                    return {
                        focusMode: false,
                        sidebarOpen: s.preFocusState?.sidebarOpen ?? true,
                        calendarSidebarOpen: s.preFocusState?.calendarSidebarOpen ?? true,
                        propertiesPanelOpen: s.preFocusState?.propertiesPanelOpen ?? true,
                        preFocusState: null,
                    };
                } else {
                    // Enter focus mode - save current state and collapse all
                    return {
                        focusMode: true,
                        preFocusState: {
                            sidebarOpen: s.sidebarOpen,
                            calendarSidebarOpen: s.calendarSidebarOpen,
                            propertiesPanelOpen: s.propertiesPanelOpen,
                        },
                        sidebarOpen: false,
                        calendarSidebarOpen: false,
                        propertiesPanelOpen: false,
                    };
                }
            }),
            exitFocusMode: () => set((s) => {
                if (!s.focusMode) return {};
                return {
                    focusMode: false,
                    sidebarOpen: s.preFocusState?.sidebarOpen ?? true,
                    calendarSidebarOpen: s.preFocusState?.calendarSidebarOpen ?? true,
                    propertiesPanelOpen: s.preFocusState?.propertiesPanelOpen ?? true,
                    preFocusState: null,
                };
            }),

            // Navigation History actions
            pushNavHistory: (section, objectId) => set((s) => {
                // Don't push if same as current
                const current = s.navHistory[s.navHistoryIndex];
                if (current && current.section === section && current.objectId === objectId) {
                    return {};
                }
                // Truncate forward history
                const newHistory = s.navHistory.slice(0, s.navHistoryIndex + 1);
                newHistory.push({ section, objectId, timestamp: Date.now() });
                // Keep max 50 items
                if (newHistory.length > 50) newHistory.shift();
                return {
                    currentSection: section,
                    navHistory: newHistory,
                    navHistoryIndex: newHistory.length - 1,
                };
            }),

            goNavBack: () => set((s) => {
                if (s.navHistoryIndex <= 0) return {};
                const newIndex = s.navHistoryIndex - 1;
                const item = s.navHistory[newIndex];
                return {
                    currentSection: item.section,
                    navHistoryIndex: newIndex,
                };
            }),

            goNavForward: () => set((s) => {
                if (s.navHistoryIndex >= s.navHistory.length - 1) return {};
                const newIndex = s.navHistoryIndex + 1;
                const item = s.navHistory[newIndex];
                return {
                    currentSection: item.section,
                    navHistoryIndex: newIndex,
                };
            }),
        }),
        {
            name: 'astral-ui-store',
            partialize: (state) => ({
                sidebarOpen: state.sidebarOpen,
                sidebarWidth: state.sidebarWidth,
                theme: state.theme,
                calendarView: state.calendarView,
                calendarSidebarOpen: state.calendarSidebarOpen,
                propertiesPanelOpen: state.propertiesPanelOpen,
            }),
        }
    )
);

