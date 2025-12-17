// Day Panel Component - Reusable day content for multi-day views
import { useState, useMemo, useEffect } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { useCalendarStore } from '../../stores/calendarStore';
import { LucideIcon } from '../common';
import type { CalendarEvent } from '../../types/calendar';
import { EventModal } from './EventModal';
import { formatDateISO, isToday, DAY_NAMES } from './utils';
import './Calendar.css';

interface DayPanelProps {
    date: Date;
    isCenter?: boolean;
    compact?: boolean;
}

export const DayPanel = ({ date, isCenter = false, compact = false }: DayPanelProps) => {
    const { objects, objectTypes, selectObject, createObject } = useObjectStore();
    const { setSelectedDate, setCalendarView, setCurrentSection } = useUIStore();
    const { getEventsForDate, events, initialize, initialized } = useCalendarStore();
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    const dateStr = formatDateISO(date);
    const today = isToday(date);
    const dayOfWeek = (date.getDay() + 6) % 7; // Convert to Monday = 0

    // Initialize calendar store
    useEffect(() => {
        if (!initialized) {
            initialize();
        }
    }, [initialized, initialize]);

    // Format title as YYYY/MM/DD to match daily note title format
    const dailyNoteTitle = useMemo(() => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    }, [date]);

    // Get Google Calendar events for this date (no limit in any view)
    const googleCalendarEvents = useMemo(() => {
        return getEventsForDate(date);
    }, [date, events, getEventsForDate]);

    // Get daily note for this date
    const dailyNote = useMemo(() => {
        return objects.find(obj => {
            if (obj.type !== 'daily') return false;

            if (obj.title === dailyNoteTitle || obj.title === dateStr) return true;

            const pDate = obj.properties.date || obj.properties.fecha;
            if (!pDate) return false;

            if (typeof pDate === 'string') {
                if (pDate === dateStr) return true;
                const d = new Date(pDate);
                if (!isNaN(d.getTime()) && formatDateISO(d) === dateStr) {
                    return true;
                }
            } else if (pDate instanceof Date) {
                if (formatDateISO(pDate) === dateStr) return true;
            }
            return false;
        });
    }, [objects, dateStr, dailyNoteTitle]);

    // Get objects with date property matching this date (NOT created on this date)
    const dateReferences = useMemo(() => {
        return objects
            .filter(obj => {
                if (obj.type === 'daily') return false;
                const dateValue = obj.properties.date || obj.properties.fecha;

                if (typeof dateValue === 'string') {
                    if (dateValue === dateStr) return true;
                    const d = new Date(dateValue);
                    if (!isNaN(d.getTime()) && formatDateISO(d) === dateStr) {
                        return true;
                    }
                } else if (dateValue instanceof Date) {
                    if (formatDateISO(dateValue) === dateStr) return true;
                }
                return false;
            })
            .slice(0, compact ? 3 : 5);
    }, [objects, dateStr, compact]);

    // Handle click to navigate to day view
    const handleDayClick = () => {
        setSelectedDate(date);
        setCalendarView('day');
    };

    // Create daily note handler
    const handleCreateDailyNote = async (e: React.MouseEvent) => {
        e.stopPropagation();
        // Format title as YYYY/MM/DD to match DayView format
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const title = `${year}/${month}/${day}`;
        const formattedDate = formatDateISO(date);
        await createObject('daily', title, '', true, { date: formattedDate });
    };

    // Get type info
    const getTypeInfo = (typeId: string) => {
        return objectTypes.find(t => t.id === typeId);
    };

    return (
        <div
            className={`day-panel ${isCenter ? 'center' : ''} ${today ? 'today' : ''} ${compact ? 'compact' : ''}`}
            onClick={handleDayClick}
        >
            <div className="day-panel-header">
                <span className="day-panel-day-name">{DAY_NAMES[dayOfWeek]}</span>
                <span className={`day-panel-date ${today ? 'today' : ''}`}>
                    {date.getDate()}
                </span>
                <span className="day-panel-month">
                    {date.toLocaleDateString('es-ES', { month: 'short' })}
                </span>
            </div>

            {/* Daily Note Badge */}
            {dailyNote ? (
                <div
                    className="day-panel-note-badge active"
                    onClick={(e) => {
                        e.stopPropagation();
                        selectObject(dailyNote.id);
                        setCurrentSection('objects');
                    }}
                >
                    📓 Nota diaria
                </div>
            ) : (
                <div
                    className="day-panel-note-badge empty"
                    onClick={handleCreateDailyNote}
                >
                    + Nota diaria
                </div>
            )}

            {/* Daily Note Content Preview - always show */}
            {dailyNote && (
                <div
                    className="day-panel-note-preview"
                    dangerouslySetInnerHTML={{
                        __html: dailyNote.content?.slice(0, compact ? 50 : 100) || ''
                    }}
                />
            )}

            {/* Objects with date matching this day */}
            {dateReferences.length > 0 && (
                <div className="day-panel-objects">
                    {dateReferences.map(obj => {
                        const type = getTypeInfo(obj.type);
                        return (
                            <div
                                key={obj.id}
                                className="day-panel-object"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    selectObject(obj.id);
                                    setCurrentSection('objects');
                                }}
                                style={{ '--type-color': type?.color } as React.CSSProperties}
                            >
                                <LucideIcon name={type?.icon || 'FileText'} size={14} color={type?.color} />
                                <span className="object-title">{obj.title}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Google Calendar Events */}
            {googleCalendarEvents.length > 0 && (
                <div className="day-panel-events">
                    {googleCalendarEvents.map(event => (
                        <div
                            key={event.id}
                            className="day-panel-event"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(event);
                            }}
                            style={{ '--event-color': event.calendarColor } as React.CSSProperties}
                        >
                            <span className="event-dot" style={{ background: event.calendarColor }} />
                            <span className="event-title">{event.summary}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Tags Preview */}
            {dailyNote && dailyNote.tags.length > 0 && !compact && (
                <div className="day-panel-tags">
                    🏷️ Etiquetas
                </div>
            )}

            {/* Event Modal */}
            {selectedEvent && (
                <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            )}
        </div>
    );
};

export default DayPanel;
