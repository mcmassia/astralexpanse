// Day Panel Component - Reusable day content for multi-day views
import { useMemo } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
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

    const dateStr = formatDateISO(date);
    const today = isToday(date);
    const dayOfWeek = (date.getDay() + 6) % 7; // Convert to Monday = 0

    // Format title as YYYY/MM/DD to match daily note title format
    const dailyNoteTitle = useMemo(() => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    }, [date]);

    // Get daily note for this date
    const dailyNote = useMemo(() => {
        return objects.find(obj =>
            obj.type === 'daily' &&
            (obj.properties.date === dateStr || obj.title === dailyNoteTitle || obj.title === dateStr)
        );
    }, [objects, dateStr, dailyNoteTitle]);

    // Get objects with date property matching this date (NOT created on this date)
    const dateReferences = useMemo(() => {
        return objects
            .filter(obj => {
                if (obj.type === 'daily') return false;
                const dateValue = obj.properties.date || obj.properties.fecha;
                return typeof dateValue === 'string' && dateValue === dateStr;
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
                                <span className="object-icon">{type?.icon}</span>
                                <span className="object-title">{obj.title}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Tags Preview */}
            {dailyNote && dailyNote.tags.length > 0 && !compact && (
                <div className="day-panel-tags">
                    🏷️ Etiquetas
                </div>
            )}
        </div>
    );
};

export default DayPanel;
