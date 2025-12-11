// Day View Component - Single day display
import { useMemo, useEffect, useState } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { useCalendarStore } from '../../stores/calendarStore';
import { formatDateISO, isSameDay } from './utils';
import { QuickCreateBar } from './QuickCreateBar';
import { EventModal } from './EventModal';
import type { CalendarEvent } from '../../types/calendar';
import './Calendar.css';

export const DayView = () => {
    const { selectedDate, setCurrentSection } = useUIStore();
    const { objects, objectTypes, selectObject, createObject } = useObjectStore();
    const { events, syncEvents, getEventsForDate, syncConfig, initialize, initialized } = useCalendarStore();

    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    // Format date for daily note title: YYYY/MM/DD
    const dailyNoteTitle = useMemo(() => {
        const d = selectedDate;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    }, [selectedDate]);

    // Get daily note for selected date
    const dailyNote = useMemo(() => {
        const dateStr = formatDateISO(selectedDate);
        return objects.find(obj =>
            obj.type === 'daily' &&
            (obj.properties.date === dateStr || obj.title === dailyNoteTitle || obj.title === dateStr)
        );
    }, [objects, selectedDate, dailyNoteTitle]);

    // Get objects with date properties matching selected date (NOT created/modified on date)
    const dateReferences = useMemo(() => {
        const dateStr = formatDateISO(selectedDate);
        return objects.filter(obj => {
            if (obj.type === 'daily') return false;
            // Check if "date" or "fecha" property matches
            const dateValue = obj.properties.date || obj.properties.fecha;
            if (typeof dateValue === 'string' && dateValue === dateStr) {
                return true;
            }
            return false;
        });
    }, [objects, selectedDate]);

    // Get objects created on selected date (only for Day view)
    const createdOnDate = useMemo(() => {
        return objects.filter(obj =>
            obj.type !== 'daily' && isSameDay(new Date(obj.createdAt), selectedDate)
        );
    }, [objects, selectedDate]);

    // Get Google Calendar events for selected date
    const googleCalendarEvents = useMemo(() => {
        return getEventsForDate(selectedDate);
    }, [events, selectedDate, getEventsForDate]);

    // Initialize calendar store and sync events when date changes
    useEffect(() => {
        if (!initialized) {
            initialize();
        }
    }, [initialized, initialize]);

    // Sync events when date changes or calendars are selected
    useEffect(() => {
        const hasSelectedCalendars = Object.values(syncConfig.selectedCalendars).some(
            (ids) => ids.length > 0
        );
        if (hasSelectedCalendars) {
            // Sync for the month surrounding the selected date
            const startDate = new Date(selectedDate);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(selectedDate);
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);
            endDate.setHours(23, 59, 59, 999);

            syncEvents(startDate, endDate);
        }
    }, [selectedDate, syncConfig.selectedCalendars, syncEvents]);

    // Format event time
    const formatEventTime = (event: CalendarEvent) => {
        if (event.isAllDay) return 'Todo el día';
        const start = new Date(event.start);
        const end = new Date(event.end);
        const formatTime = (d: Date) =>
            d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        return `${formatTime(start)} - ${formatTime(end)}`;
    };

    // Handle event click
    const handleEventClick = (event: CalendarEvent) => {
        setSelectedEvent(event);
    };

    // Close event modal
    const closeEventModal = () => {
        setSelectedEvent(null);
    };

    // Create daily note handler
    const handleCreateDailyNote = async () => {
        // Create with YYYY/MM/DD title and set date property
        const dateStr = formatDateISO(selectedDate);
        await createObject('daily', dailyNoteTitle, '', true, { date: dateStr });
    };

    // Open object and switch to objects view
    const handleOpenObject = (objectId: string) => {
        selectObject(objectId);
        setCurrentSection('objects');
    };

    // Get type info
    const getTypeInfo = (typeId: string) => {
        return objectTypes.find(t => t.id === typeId);
    };

    return (
        <div className="day-view">
            {/* Quick Create Buttons */}
            <QuickCreateBar />

            {/* Daily Note Section */}
            <section className="day-view-section">
                <div className="day-view-section-header">
                    <h3>Nota diaria</h3>
                    {!dailyNote && (
                        <button
                            className="day-view-create-note-btn"
                            onClick={handleCreateDailyNote}
                        >
                            + Crear nota
                        </button>
                    )}
                </div>
                {dailyNote ? (
                    <div
                        className="day-view-daily-note"
                        onClick={() => handleOpenObject(dailyNote.id)}
                    >
                        <div className="daily-note-title">{dailyNote.title}</div>
                        {dailyNote.tags.length > 0 && (
                            <div className="daily-note-tags">
                                🏷️ {dailyNote.tags.join(', ')}
                            </div>
                        )}
                        <div
                            className="daily-note-content"
                            dangerouslySetInnerHTML={{
                                __html: dailyNote.content || '<em>Sin contenido</em>'
                            }}
                        />
                    </div>
                ) : (
                    <div className="day-view-empty-note">
                        <p>No hay nota diaria para este día</p>
                    </div>
                )}
            </section>

            {/* Date References Section - Objects with this date in their date field */}
            {dateReferences.length > 0 && (
                <section className="day-view-section">
                    <div className="day-view-section-header">
                        <h3>Referencias de fecha</h3>
                        <span className="day-view-count">{dateReferences.length}</span>
                    </div>
                    <div className="day-view-object-list">
                        {dateReferences.map(obj => {
                            const type = getTypeInfo(obj.type);
                            return (
                                <div
                                    key={obj.id}
                                    className="day-view-object-item"
                                    onClick={() => handleOpenObject(obj.id)}
                                >
                                    <span className="object-icon">{type?.icon || '📄'}</span>
                                    <span className="object-title">{obj.title}</span>
                                    <span
                                        className="object-type-badge"
                                        style={{ backgroundColor: type?.color }}
                                    >
                                        {type?.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Created on This Day Section - List format */}
            {createdOnDate.length > 0 && (
                <section className="day-view-section">
                    <div className="day-view-section-header">
                        <h3>Creado en Este Día</h3>
                        <span className="day-view-count">{createdOnDate.length}</span>
                    </div>
                    <div className="day-view-object-list">
                        {createdOnDate.map(obj => {
                            const type = getTypeInfo(obj.type);
                            return (
                                <div
                                    key={obj.id}
                                    className="day-view-object-item"
                                    onClick={() => handleOpenObject(obj.id)}
                                >
                                    <span className="object-icon">{type?.icon || '📄'}</span>
                                    <span className="object-title">{obj.title}</span>
                                    <span
                                        className="object-type-badge"
                                        style={{ backgroundColor: type?.color }}
                                    >
                                        {type?.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Google Calendar Events Section */}
            {googleCalendarEvents.length > 0 && (
                <section className="day-view-section google-events-section">
                    <div className="day-view-section-header">
                        <h3>📅 Eventos de Google Calendar</h3>
                        <span className="day-view-count">{googleCalendarEvents.length}</span>
                    </div>
                    <div className="day-view-events-list">
                        {googleCalendarEvents.map(event => (
                            <div
                                key={event.id}
                                className="day-view-event-item"
                                onClick={() => handleEventClick(event)}
                                style={{ borderLeftColor: event.calendarColor }}
                            >
                                <div className="event-time">
                                    {formatEventTime(event)}
                                </div>
                                <div className="event-details">
                                    <span className="event-title">{event.summary}</span>
                                    {event.location && (
                                        <span className="event-location">📍 {event.location}</span>
                                    )}
                                </div>
                                <div className="event-meta">
                                    <span
                                        className="event-calendar-badge"
                                        style={{ backgroundColor: event.calendarColor }}
                                    >
                                        {event.calendarName}
                                    </span>
                                    <span className="event-account">{event.accountEmail}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Event Detail Modal */}
            {selectedEvent && (
                <EventModal event={selectedEvent} onClose={closeEventModal} />
            )}
        </div>
    );
};

export default DayView;
