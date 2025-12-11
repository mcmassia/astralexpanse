// Types for Google Calendar integration

/**
 * Represents a connected Google Calendar account
 */
export interface GoogleCalendarAccount {
    email: string;
    name: string;
    photoUrl?: string;
    accessToken: string;
    tokenExpiresAt: number;
    isPrimary: boolean; // true if this is the main logged-in account
    connectedAt: Date;
}

/**
 * Represents a calendar that can be synced
 */
export interface GoogleCalendar {
    id: string;
    accountEmail: string;
    name: string;
    description?: string;
    color: string;
    backgroundColor: string;
    foregroundColor: string;
    isPrimary: boolean;
    accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
    selected: boolean; // whether to sync this calendar
}

/**
 * Represents a synced calendar event
 */
export interface CalendarEvent {
    id: string;
    calendarId: string;
    accountEmail: string;
    calendarName: string;
    calendarColor: string;

    // Event details
    summary: string;
    description?: string;
    location?: string;

    // Time
    start: Date;
    end: Date;
    isAllDay: boolean;

    // Metadata
    status: 'confirmed' | 'tentative' | 'cancelled';
    htmlLink: string; // Link to open in Google Calendar

    // Recurrence
    recurringEventId?: string;

    // Attendees (optional)
    attendees?: {
        email: string;
        displayName?: string;
        responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
        self?: boolean;
    }[];

    // Organizer
    organizer?: {
        email: string;
        displayName?: string;
        self?: boolean;
    };

    // Visibility
    visibility?: 'default' | 'public' | 'private' | 'confidential';
}

/**
 * Calendar sync configuration stored in Firestore
 */
export interface CalendarSyncConfig {
    // Map of accountEmail -> array of selected calendar IDs
    selectedCalendars: Record<string, string[]>;
    lastSyncAt?: Date;
}

/**
 * Response from Google Calendar API for calendar list
 */
export interface GoogleCalendarListResponse {
    kind: string;
    etag: string;
    nextPageToken?: string;
    items: GoogleCalendarAPIItem[];
}

export interface GoogleCalendarAPIItem {
    kind: string;
    etag: string;
    id: string;
    summary: string;
    description?: string;
    timeZone?: string;
    colorId?: string;
    backgroundColor: string;
    foregroundColor: string;
    selected?: boolean;
    accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
    primary?: boolean;
}

/**
 * Response from Google Calendar API for events
 */
export interface GoogleEventsResponse {
    kind: string;
    etag: string;
    summary: string;
    updated: string;
    timeZone: string;
    accessRole: string;
    nextPageToken?: string;
    items: GoogleEventAPIItem[];
}

export interface GoogleEventAPIItem {
    kind: string;
    etag: string;
    id: string;
    status: 'confirmed' | 'tentative' | 'cancelled';
    htmlLink: string;
    summary?: string;
    description?: string;
    location?: string;
    creator?: {
        email: string;
        displayName?: string;
        self?: boolean;
    };
    organizer?: {
        email: string;
        displayName?: string;
        self?: boolean;
    };
    start: {
        date?: string; // For all-day events
        dateTime?: string; // For timed events
        timeZone?: string;
    };
    end: {
        date?: string;
        dateTime?: string;
        timeZone?: string;
    };
    recurringEventId?: string;
    attendees?: {
        email: string;
        displayName?: string;
        responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
        self?: boolean;
    }[];
    visibility?: 'default' | 'public' | 'private' | 'confidential';
}
