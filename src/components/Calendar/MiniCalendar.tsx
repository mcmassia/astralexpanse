// Mini Calendar Widget - Collapsible side panel calendar with events
import { useMemo } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { getMonthGrid, isSameDay, isToday, formatDateISO, DAY_NAMES, MONTH_NAMES } from './utils';
import './Calendar.css';

interface MiniCalendarProps {
    collapsed?: boolean;
    onToggle?: () => void;
}

export const MiniCalendar = ({ collapsed = false, onToggle }: MiniCalendarProps) => {
    const { selectedDate, setSelectedDate, setCurrentSection } = useUIStore();
    const { objects, objectTypes, selectObject } = useObjectStore();

    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();

    // Get all dates in month grid
    const monthDates = useMemo(() => getMonthGrid(selectedDate), [selectedDate]);

    // Get dates with daily notes
    const datesWithNotes = useMemo(() => {
        const dates = new Set<string>();
        objects.forEach(obj => {
            if (obj.type === 'daily') {
                const dateStr = obj.properties.date as string;
                if (dateStr) dates.add(dateStr);
                // Also check title format YYYY/MM/DD
                if (obj.title && /^\d{4}\/\d{2}\/\d{2}$/.test(obj.title)) {
                    const isoDate = obj.title.replace(/\//g, '-');
                    dates.add(isoDate);
                }
            }
        });
        return dates;
    }, [objects]);

    // Get dates with objects that have date properties
    const datesWithObjects = useMemo(() => {
        const dates = new Set<string>();
        objects.forEach(obj => {
            if (obj.type === 'daily') return;
            const dateValue = obj.properties.date || obj.properties.fecha;
            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                dates.add(dateValue);
            }
        });
        return dates;
    }, [objects]);

    // Get objects with date property matching selected date
    const dateEvents = useMemo(() => {
        const selectedStr = formatDateISO(selectedDate);
        return objects.filter(obj => {
            if (obj.type === 'daily') return false;
            const dateValue = obj.properties.date || obj.properties.fecha;
            return typeof dateValue === 'string' && dateValue === selectedStr;
        });
    }, [objects, selectedDate]);

    // Get daily note for selected date
    const dailyNote = useMemo(() => {
        const dateStr = formatDateISO(selectedDate);
        const titleFormat = `${selectedDate.getFullYear()}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${String(selectedDate.getDate()).padStart(2, '0')}`;
        return objects.find(obj =>
            obj.type === 'daily' &&
            (obj.properties.date === dateStr || obj.title === titleFormat || obj.title === dateStr)
        );
    }, [objects, selectedDate]);

    // Navigation
    const goToPrevMonth = () => {
        const prev = new Date(currentYear, currentMonth - 1, 1);
        setSelectedDate(prev);
    };

    const goToNextMonth = () => {
        const next = new Date(currentYear, currentMonth + 1, 1);
        setSelectedDate(next);
    };

    // Open object
    const handleOpenObject = (objectId: string) => {
        selectObject(objectId);
        setCurrentSection('objects');
    };

    // Get type info
    const getTypeInfo = (typeId: string) => {
        return objectTypes.find(t => t.id === typeId);
    };

    // Format date for display
    const formatSelectedDate = () => {
        return selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
    };

    if (collapsed) {
        return (
            <div className="mini-calendar collapsed" onClick={onToggle}>
                <div className="mini-calendar-collapsed-icon">📅</div>
                <div className="mini-calendar-collapsed-text">Calendario</div>
            </div>
        );
    }

    return (
        <div className="mini-calendar">
            {/* Collapse Toggle */}
            {onToggle && (
                <button className="mini-calendar-collapse-btn" onClick={onToggle} title="Colapsar">
                    ›
                </button>
            )}

            {/* Month Header */}
            <div className="mini-calendar-header">
                <button className="mini-nav-btn" onClick={goToPrevMonth}>‹</button>
                <div className="mini-calendar-title">
                    <span className="mini-month">{MONTH_NAMES[currentMonth]} {currentYear}</span>
                </div>
                <button className="mini-nav-btn" onClick={goToNextMonth}>›</button>
            </div>

            {/* Day Headers */}
            <div className="mini-calendar-days">
                {DAY_NAMES.map(day => (
                    <div key={day} className="mini-day-header">{day.slice(0, 1)}</div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="mini-calendar-grid">
                {monthDates.map(date => {
                    const dateStr = formatDateISO(date);
                    const isCurrentMonth = date.getMonth() === currentMonth;
                    const isSelected = isSameDay(date, selectedDate);
                    const hasNote = datesWithNotes.has(dateStr);
                    const hasObjects = datesWithObjects.has(dateStr);

                    return (
                        <button
                            key={dateStr}
                            className={`mini-day ${!isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isToday(date) ? 'today' : ''} ${hasNote ? 'has-note' : ''} ${hasObjects ? 'has-objects' : ''}`}
                            onClick={() => setSelectedDate(date)}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>

            {/* Events for Selected Date */}
            <div className="mini-calendar-events">
                <h4>EVENTOS PARA {formatSelectedDate()}</h4>

                {/* Daily Note */}
                {dailyNote && (
                    <div className="mini-event-section">
                        <div className="mini-event-section-label">DAILYNOTE</div>
                        <div
                            className="mini-event dailynote"
                            onClick={() => handleOpenObject(dailyNote.id)}
                        >
                            <span className="mini-event-dot" style={{ background: '#22c55e' }} />
                            <span className="mini-event-title">{dailyNote.title}</span>
                        </div>
                    </div>
                )}

                {/* Objects with date property */}
                {dateEvents.length > 0 && dateEvents.map(obj => {
                    const type = getTypeInfo(obj.type);
                    return (
                        <div key={obj.id} className="mini-event-section">
                            <div className="mini-event-section-label">{type?.name?.toUpperCase()}</div>
                            <div
                                className="mini-event"
                                onClick={() => handleOpenObject(obj.id)}
                                style={{ '--event-color': type?.color } as React.CSSProperties}
                            >
                                <span className="mini-event-dot" style={{ background: type?.color }} />
                                <span className="mini-event-title">{obj.title}</span>
                            </div>
                        </div>
                    );
                })}

                {!dailyNote && dateEvents.length === 0 && (
                    <div className="mini-events-empty">
                        Sin eventos para este día
                    </div>
                )}
            </div>
        </div>
    );
};

export default MiniCalendar;
