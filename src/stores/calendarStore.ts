// Calendar sync store for managing Google Calendar integration
import { create } from 'zustand';
import type {
    GoogleCalendarAccount,
    GoogleCalendar,
    CalendarEvent,
    CalendarSyncConfig,
} from '../types/calendar';
import * as calendarService from '../services/calendar';
import * as db from '../services/db';
import {
    getGoogleAccessToken,
    getGoogleAccessTokenExpiration,
    addSecondaryGoogleAccount,
    refreshGoogleAccessToken,
    isGoogleAccessTokenExpired
} from '../services/firebase';
import { getFirebaseAuth } from '../services/firebase';

interface CalendarStore {
    // State
    accounts: GoogleCalendarAccount[];
    calendars: Record<string, GoogleCalendar[]>; // keyed by accountEmail
    events: CalendarEvent[];
    syncConfig: CalendarSyncConfig;
    isSyncing: boolean;
    isLoadingCalendars: boolean;
    error: string | null;
    initialized: boolean;
    needsTokenRefresh: boolean; // Flag to indicate token needs refresh

    // Actions
    initialize: () => Promise<void>;
    addPrimaryAccount: () => void;
    addSecondaryAccount: () => Promise<void>;
    removeAccount: (email: string) => Promise<void>;
    fetchCalendars: (accountEmail: string) => Promise<void>;
    toggleCalendar: (accountEmail: string, calendarId: string) => Promise<void>;
    syncEvents: (startDate: Date, endDate: Date) => Promise<void>;
    getEventsForDate: (date: Date) => CalendarEvent[];
    getEventsForDateRange: (startDate: Date, endDate: Date) => CalendarEvent[];
    refreshPrimaryToken: () => Promise<boolean>;
}

export const useCalendarStore = create<CalendarStore>()((set, get) => ({
    accounts: [],
    calendars: {},
    events: [],
    syncConfig: { selectedCalendars: {} },
    isSyncing: false,
    isLoadingCalendars: false,
    error: null,
    initialized: false,
    needsTokenRefresh: false,

    initialize: async () => {
        if (get().initialized) return;

        console.log('[CalendarStore] Initializing...');

        try {
            // Load saved config from Firestore
            const config = await db.getCalendarConfig();
            if (config) {
                set({ syncConfig: config });
            }

            // Add primary account if logged in
            get().addPrimaryAccount();

            set({ initialized: true });
            console.log('[CalendarStore] Initialized');
        } catch (error) {
            console.error('[CalendarStore] Init error:', error);
            set({ error: (error as Error).message });
        }
    },

    addPrimaryAccount: () => {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        const accessToken = getGoogleAccessToken();
        const expiresAt = getGoogleAccessTokenExpiration();

        if (!user || !accessToken) {
            console.log('[CalendarStore] No user or token for primary account');
            return;
        }

        const primaryAccount: GoogleCalendarAccount = {
            email: user.email || 'primary',
            name: user.displayName || user.email || 'Primary Account',
            photoUrl: user.photoURL || undefined,
            accessToken,
            tokenExpiresAt: expiresAt || Date.now() + 3600000,
            isPrimary: true,
            connectedAt: new Date(),
        };

        set((state) => {
            // Check if primary already exists
            const exists = state.accounts.some((a) => a.email === primaryAccount.email);
            if (exists) {
                // Update token
                return {
                    accounts: state.accounts.map((a) =>
                        a.email === primaryAccount.email ? { ...a, accessToken, tokenExpiresAt: expiresAt || a.tokenExpiresAt } : a
                    ),
                };
            }
            return { accounts: [...state.accounts, primaryAccount] };
        });
    },

    addSecondaryAccount: async () => {
        console.log('[CalendarStore] Adding secondary account...');
        set({ error: null });

        try {
            const result = await addSecondaryGoogleAccount();

            if (!result) {
                set({ error: 'No se pudo conectar la cuenta' });
                return;
            }

            // Check if account already exists
            const exists = get().accounts.some((a) => a.email === result.email);
            if (exists) {
                set({ error: 'Esta cuenta ya está conectada' });
                return;
            }

            const newAccount: GoogleCalendarAccount = {
                email: result.email,
                name: result.name,
                photoUrl: result.photoUrl,
                accessToken: result.accessToken,
                tokenExpiresAt: result.expiresAt,
                isPrimary: false,
                connectedAt: new Date(),
            };

            set((state) => ({
                accounts: [...state.accounts, newAccount],
            }));

            // Automatically fetch calendars for new account
            await get().fetchCalendars(result.email);

            console.log('[CalendarStore] Secondary account added:', result.email);
        } catch (error) {
            console.error('[CalendarStore] Error adding secondary account:', error);
            set({ error: (error as Error).message });
        }
    },

    removeAccount: async (email: string) => {
        const account = get().accounts.find((a) => a.email === email);
        if (!account) return;

        // Don't allow removing primary account
        if (account.isPrimary) {
            set({ error: 'No se puede eliminar la cuenta principal' });
            return;
        }

        // Remove from state
        set((state) => ({
            accounts: state.accounts.filter((a) => a.email !== email),
            calendars: Object.fromEntries(
                Object.entries(state.calendars).filter(([key]) => key !== email)
            ),
        }));

        // Update sync config
        const newConfig = { ...get().syncConfig };
        delete newConfig.selectedCalendars[email];
        await db.saveCalendarConfig(newConfig);
        set({ syncConfig: newConfig });
    },

    fetchCalendars: async (accountEmail: string) => {
        const account = get().accounts.find((a) => a.email === accountEmail);
        if (!account) {
            console.error('[CalendarStore] Account not found:', accountEmail);
            return;
        }

        set({ isLoadingCalendars: true, error: null });

        try {
            const calendars = await calendarService.fetchCalendarList(
                account.accessToken,
                accountEmail
            );

            // Mark selected calendars from config
            const selectedIds = get().syncConfig.selectedCalendars[accountEmail] || [];
            const calendarsWithSelection = calendars.map((cal) => ({
                ...cal,
                selected: selectedIds.includes(cal.id),
            }));

            set((state) => ({
                calendars: {
                    ...state.calendars,
                    [accountEmail]: calendarsWithSelection,
                },
                isLoadingCalendars: false,
            }));
        } catch (error) {
            console.error('[CalendarStore] Error fetching calendars:', error);
            set({ error: (error as Error).message, isLoadingCalendars: false });
        }
    },

    toggleCalendar: async (accountEmail: string, calendarId: string) => {
        const calendars = get().calendars[accountEmail];
        if (!calendars) return;

        // Update local state
        const updatedCalendars = calendars.map((cal) =>
            cal.id === calendarId ? { ...cal, selected: !cal.selected } : cal
        );

        set((state) => ({
            calendars: {
                ...state.calendars,
                [accountEmail]: updatedCalendars,
            },
        }));

        // Update sync config
        const selectedIds = updatedCalendars.filter((c) => c.selected).map((c) => c.id);
        const newConfig: CalendarSyncConfig = {
            ...get().syncConfig,
            selectedCalendars: {
                ...get().syncConfig.selectedCalendars,
                [accountEmail]: selectedIds,
            },
        };

        await db.saveCalendarConfig(newConfig);
        set({ syncConfig: newConfig });
    },

    syncEvents: async (startDate: Date, endDate: Date) => {
        console.log('[CalendarStore] Syncing events for range:', startDate, '-', endDate);
        set({ isSyncing: true, error: null });

        const allEvents: CalendarEvent[] = [];

        try {
            for (const account of get().accounts) {
                const selectedCalendarIds = get().syncConfig.selectedCalendars[account.email] || [];
                const calendars = get().calendars[account.email] || [];

                for (const calendarId of selectedCalendarIds) {
                    const calendar = calendars.find((c) => c.id === calendarId);
                    if (!calendar) continue;

                    try {
                        const events = await calendarService.fetchEvents(
                            account.accessToken,
                            calendarId,
                            account.email,
                            calendar.name,
                            calendar.color,
                            startDate,
                            endDate
                        );
                        allEvents.push(...events);
                    } catch (error) {
                        console.error('[CalendarStore] Error fetching events for calendar:', calendarId, error);
                    }
                }
            }

            set({
                events: allEvents,
                isSyncing: false,
                syncConfig: { ...get().syncConfig, lastSyncAt: new Date() },
            });

            console.log('[CalendarStore] Synced', allEvents.length, 'events');
        } catch (error) {
            console.error('[CalendarStore] Sync error:', error);
            set({ error: (error as Error).message, isSyncing: false });
        }
    },

    getEventsForDate: (date: Date) => {
        // Create date-only boundaries (no time component)
        const targetYear = date.getFullYear();
        const targetMonth = date.getMonth();
        const targetDay = date.getDate();

        return get().events.filter((event) => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);

            // For all-day events, check if target date falls within the event range
            if (event.isAllDay) {
                // All-day events: check if target date is between start and end dates (inclusive)
                const startDate = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
                // For all-day events, end is often exclusive (next day at 00:00), so subtract 1 day
                const endDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
                const targetDate = new Date(targetYear, targetMonth, targetDay);

                // End date for all-day events is exclusive, so compare < endDate or <= endDate-1day
                return targetDate >= startDate && targetDate < endDate;
            }

            // For timed events, check if the event starts on this specific date
            const eventStartYear = eventStart.getFullYear();
            const eventStartMonth = eventStart.getMonth();
            const eventStartDay = eventStart.getDate();

            return eventStartYear === targetYear &&
                eventStartMonth === targetMonth &&
                eventStartDay === targetDay;
        });
    },

    getEventsForDateRange: (startDate: Date, endDate: Date) => {
        return get().events.filter((event) => {
            const eventStart = new Date(event.start);
            const eventEnd = new Date(event.end);

            return eventStart <= endDate && eventEnd >= startDate;
        });
    },

    refreshPrimaryToken: async () => {
        console.log('[CalendarStore] Refreshing primary account token...');
        set({ error: null, needsTokenRefresh: false });

        try {
            // Check if token is really expired
            if (!isGoogleAccessTokenExpired() && getGoogleAccessToken()) {
                console.log('[CalendarStore] Token is still valid, updating account');
                get().addPrimaryAccount();
                return true;
            }

            // Try to refresh via popup
            const result = await refreshGoogleAccessToken();

            if (result.success) {
                console.log('[CalendarStore] Token refreshed successfully');
                // Update primary account with new token
                get().addPrimaryAccount();

                // Re-fetch calendars for primary account
                const auth = getFirebaseAuth();
                const user = auth.currentUser;
                if (user?.email) {
                    await get().fetchCalendars(user.email);
                }

                return true;
            } else {
                set({
                    error: 'No se pudo refrescar el token. Por favor, cierra sesión y vuelve a iniciar.',
                    needsTokenRefresh: true
                });
                return false;
            }
        } catch (error) {
            console.error('[CalendarStore] Error refreshing token:', error);
            set({
                error: (error as Error).message,
                needsTokenRefresh: true
            });
            return false;
        }
    },
}));
