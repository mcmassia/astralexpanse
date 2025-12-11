// Google Calendar API service for fetching calendars and events
import type {
    GoogleCalendar,
    CalendarEvent,
    GoogleCalendarListResponse,
    GoogleEventsResponse,
    GoogleEventAPIItem,
} from '../types/calendar';

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Helper to make authenticated requests to Google Calendar API
 */
const calendarFetch = async (
    url: string,
    accessToken: string,
    options: RequestInit = {}
): Promise<Response> => {
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (response.status === 401) {
        throw new CalendarAuthError('Google Calendar access token expired or invalid');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            `Calendar API error: ${response.status} - ${errorData.error?.message || response.statusText}`
        );
    }

    return response;
};

/**
 * Custom error for authentication issues
 */
export class CalendarAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CalendarAuthError';
    }
}

/**
 * Fetch list of calendars for an account
 */
export const fetchCalendarList = async (
    accessToken: string,
    accountEmail: string
): Promise<GoogleCalendar[]> => {
    console.log('[Calendar] Fetching calendar list for:', accountEmail);

    const url = `${CALENDAR_API_BASE}/users/me/calendarList`;
    const response = await calendarFetch(url, accessToken);
    const data: GoogleCalendarListResponse = await response.json();

    const calendars: GoogleCalendar[] = data.items.map((item) => ({
        id: item.id,
        accountEmail,
        name: item.summary,
        description: item.description,
        color: item.backgroundColor,
        backgroundColor: item.backgroundColor,
        foregroundColor: item.foregroundColor,
        isPrimary: item.primary || false,
        accessRole: item.accessRole,
        selected: false, // Will be updated from sync config
    }));

    console.log('[Calendar] Found', calendars.length, 'calendars');
    return calendars;
};

/**
 * Parse event date/time from Google API format
 */
const parseEventDateTime = (
    eventTime: { date?: string; dateTime?: string; timeZone?: string }
): { date: Date; isAllDay: boolean } => {
    if (eventTime.date) {
        // All-day event - date is in YYYY-MM-DD format
        return {
            date: new Date(eventTime.date + 'T00:00:00'),
            isAllDay: true,
        };
    }

    if (eventTime.dateTime) {
        return {
            date: new Date(eventTime.dateTime),
            isAllDay: false,
        };
    }

    // Fallback
    return { date: new Date(), isAllDay: false };
};

/**
 * Convert Google API event to our CalendarEvent type
 */
const convertEvent = (
    event: GoogleEventAPIItem,
    calendarId: string,
    accountEmail: string,
    calendarName: string,
    calendarColor: string
): CalendarEvent => {
    const start = parseEventDateTime(event.start);
    const end = parseEventDateTime(event.end);

    return {
        id: event.id,
        calendarId,
        accountEmail,
        calendarName,
        calendarColor,
        summary: event.summary || '(Sin título)',
        description: event.description,
        location: event.location,
        start: start.date,
        end: end.date,
        isAllDay: start.isAllDay,
        status: event.status,
        htmlLink: event.htmlLink,
        recurringEventId: event.recurringEventId,
        attendees: event.attendees,
        organizer: event.organizer,
        visibility: event.visibility,
    };
};

/**
 * Fetch events from a specific calendar within a time range
 */
export const fetchEvents = async (
    accessToken: string,
    calendarId: string,
    accountEmail: string,
    calendarName: string,
    calendarColor: string,
    timeMin: Date,
    timeMax: Date
): Promise<CalendarEvent[]> => {
    console.log('[Calendar] Fetching events from:', calendarName, 'for range:', timeMin, '-', timeMax);

    const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true', // Expand recurring events
        orderBy: 'startTime',
        maxResults: '250',
    });

    const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const response = await calendarFetch(url, accessToken);
    const data: GoogleEventsResponse = await response.json();

    const events = data.items
        .filter((event) => event.status !== 'cancelled')
        .map((event) => convertEvent(event, calendarId, accountEmail, calendarName, calendarColor));

    console.log('[Calendar] Found', events.length, 'events in', calendarName);
    return events;
};

/**
 * Fetch events for a specific date (helper for day view)
 */
export const fetchEventsForDate = async (
    accessToken: string,
    calendarId: string,
    accountEmail: string,
    calendarName: string,
    calendarColor: string,
    date: Date
): Promise<CalendarEvent[]> => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return fetchEvents(accessToken, calendarId, accountEmail, calendarName, calendarColor, start, end);
};

/**
 * Check if calendar token is valid by making a test request
 */
export const checkCalendarConnection = async (
    accessToken: string
): Promise<{ connected: boolean; error?: string }> => {
    try {
        const url = `${CALENDAR_API_BASE}/users/me/calendarList?maxResults=1`;
        await calendarFetch(url, accessToken);
        return { connected: true };
    } catch (error) {
        if (error instanceof CalendarAuthError) {
            return { connected: false, error: error.message };
        }
        return { connected: false, error: (error as Error).message };
    }
};
