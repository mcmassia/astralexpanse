// Day View Component - Single day display
import { useMemo } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { formatDayHeader, formatDateISO, isSameDay } from './utils';
import { QuickCreateBar } from './QuickCreateBar';
import './Calendar.css';

export const DayView = () => {
    const { selectedDate, setCurrentSection } = useUIStore();
    const { objects, objectTypes, selectObject, createObject } = useObjectStore();

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

    // Create daily note handler
    const handleCreateDailyNote = async () => {
        // Create with YYYY/MM/DD title and set date property
        await createObject('daily', dailyNoteTitle, '', true);
        // Note: createObject should set properties.date = dateStr for daily type
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

    const { dayName, fullDate, weekNumber } = formatDayHeader(selectedDate);

    return (
        <div className="day-view">
            {/* Date Header */}
            <div className="day-view-header">
                <div className="day-view-day-name">{dayName}</div>
                <div className="day-view-date">
                    {fullDate}
                    <span className="day-view-week">Semana {weekNumber}</span>
                </div>
            </div>

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
                                __html: dailyNote.content?.slice(0, 300) || '<em>Sin contenido</em>'
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
        </div>
    );
};

export default DayView;
