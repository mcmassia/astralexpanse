// Daily Note Widget - Shows today's daily note or creates one
import { useObjectStore } from '../../../stores/objectStore';
import { LucideIcon } from '../../common';
import type { AstralObject, ObjectType } from '../../../types/object';

interface DailyNoteWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

export const DailyNoteWidget = ({ objects, objectTypes, onObjectClick }: DailyNoteWidgetProps) => {
    const createObject = useObjectStore(s => s.createObject);

    // Find daily type
    const dailyType = objectTypes.find(t =>
        t.id === 'daily' || t.name.toLowerCase() === 'nota diaria'
    );

    // Get today's date in local timezone (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find today's daily note
    const todayNote = objects.find(obj => {
        if (obj.type !== dailyType?.id) return false;

        const dateValue = obj.properties.date;
        if (!dateValue) return false;

        const noteDate = new Date(dateValue as string | Date);
        noteDate.setHours(0, 0, 0, 0);

        return noteDate.getTime() === today.getTime();
    });

    const handleCreateDailyNote = async () => {
        if (!dailyType) return;

        const title = today.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        try {
            const newNote = await createObject(
                dailyType.id,
                title,
                '',
                true,
                { date: today.toISOString() }
            );
            onObjectClick(newNote.id);
        } catch (error) {
            console.error('Error creating daily note:', error);
        }
    };

    // Extract preview content (strip HTML)
    const getPreview = (content: string) => {
        const stripped = content.replace(/<[^>]+>/g, ' ').trim();
        return stripped.length > 150 ? stripped.slice(0, 150) + '...' : stripped;
    };

    return (
        <div className="dashboard-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">
                        {dailyType ? (
                            <LucideIcon name={dailyType.icon || 'Calendar'} size={16} color={dailyType.color} />
                        ) : '📓'}
                    </span>
                    Nota del Día
                </h3>
            </div>

            {!dailyType ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">⚠️</span>
                    <span className="dashboard-widget-empty-text">
                        Tipo "Nota Diaria" no configurado
                    </span>
                </div>
            ) : todayNote ? (
                <div
                    className="dashboard-daily-note-preview"
                    onClick={() => onObjectClick(todayNote.id)}
                >
                    <div className="dashboard-daily-note-preview-header">
                        <LucideIcon name={dailyType.icon || 'Calendar'} size={16} color={dailyType.color} />
                        <span className="dashboard-daily-note-preview-title">
                            {todayNote.title}
                        </span>
                    </div>
                    {todayNote.content ? (
                        <div className="dashboard-daily-note-preview-content">
                            {getPreview(todayNote.content)}
                        </div>
                    ) : (
                        <div className="dashboard-daily-note-preview-content" style={{ opacity: 0.6, fontStyle: 'italic' }}>
                            Sin contenido aún...
                        </div>
                    )}
                </div>
            ) : (
                <button
                    className="dashboard-daily-note-cta"
                    onClick={handleCreateDailyNote}
                >
                    <span>✨</span>
                    Crear nota de hoy
                </button>
            )}
        </div>
    );
};
