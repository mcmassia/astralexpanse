// Calendar date utility functions

/**
 * Get the start of the week (Monday) for a given date
 */
export const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

/**
 * Get the end of the week (Sunday) for a given date
 */
export const getWeekEnd = (date: Date): Date => {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
};

/**
 * Get the ISO week number for a date
 */
export const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

/**
 * Get array of dates for a week
 */
export const getWeekDays = (date: Date): Date[] => {
    const start = getWeekStart(date);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        days.push(day);
    }
    return days;
};

/**
 * Get array of dates for "three days" view (yesterday, today, tomorrow)
 */
export const getThreeDays = (date: Date): Date[] => {
    const yesterday = new Date(date);
    yesterday.setDate(date.getDate() - 1);
    const tomorrow = new Date(date);
    tomorrow.setDate(date.getDate() + 1);
    return [yesterday, new Date(date), tomorrow];
};

/**
 * Get all dates in a month grid (including padding days from prev/next months)
 */
export const getMonthGrid = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Monday of the first week
    const start = getWeekStart(firstDay);

    // End on the Sunday of the last week
    const end = getWeekEnd(lastDay);

    const dates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    return dates;
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
};

/**
 * Check if a date is today
 */
export const isToday = (date: Date): boolean => {
    return isSameDay(date, new Date());
};

/**
 * Format date as "YYYY-MM-DD" for daily note titles
 */
export const formatDateISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Format date in Spanish locale
 */
export const formatDateLong = (date: Date): string => {
    return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

/**
 * Format date header for day view
 */
export const formatDayHeader = (date: Date): { dayName: string; fullDate: string; weekNumber: number } => {
    const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
    const fullDate = date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const weekNumber = getWeekNumber(date);

    return {
        dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        fullDate: fullDate.charAt(0).toUpperCase() + fullDate.slice(1),
        weekNumber
    };
};

/**
 * Get month names in Spanish
 */
export const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const MONTH_NAMES_SHORT = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

export const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
