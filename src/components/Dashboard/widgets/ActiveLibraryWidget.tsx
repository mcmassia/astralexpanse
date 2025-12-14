// Lecturas Widget - Shows books being read or to be read
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface ActiveLibraryWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

// Status values for books that should appear
const READING_STATUS_VALUES = ['leyendo', 'para leer', 'reading', 'to read'];

export const ActiveLibraryWidget = ({ objects, objectTypes, onObjectClick }: ActiveLibraryWidgetProps) => {
    // Find the book type
    const bookType = objectTypes.find(t =>
        t.id === 'book' || t.name.toLowerCase() === 'libro'
    );

    if (!bookType) {
        return (
            <div className="dashboard-widget">
                <div className="dashboard-widget-header">
                    <h3 className="dashboard-widget-title">
                        <span className="dashboard-widget-icon">📚</span>
                        Lecturas
                    </h3>
                </div>
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">⚠️</span>
                    <span className="dashboard-widget-empty-text">
                        Tipo "Libro" no configurado
                    </span>
                </div>
            </div>
        );
    }

    // Find the Estado property in book type
    const statusProp = bookType.properties.find(p =>
        p.name.toLowerCase() === 'estado' ||
        p.name.toLowerCase() === 'status' ||
        p.id.toLowerCase() === 'status'
    );

    // Filter books with Estado = Leyendo or Para leer
    const readingBooks = objects.filter(obj => {
        // Must be book type
        if (obj.type !== bookType.id) return false;

        if (!statusProp) return false;

        const statusValue = obj.properties[statusProp.id];
        if (!statusValue || typeof statusValue !== 'string') return false;

        const statusLower = statusValue.toLowerCase().trim();
        return READING_STATUS_VALUES.includes(statusLower);
    });

    // Sort: "Leyendo" first, then by updatedAt
    const sortedBooks = [...readingBooks].sort((a, b) => {
        const statusA = statusProp ? (a.properties[statusProp.id] as string)?.toLowerCase() : '';
        const statusB = statusProp ? (b.properties[statusProp.id] as string)?.toLowerCase() : '';

        const isAReading = statusA === 'leyendo' || statusA === 'reading';
        const isBReading = statusB === 'leyendo' || statusB === 'reading';

        if (isAReading && !isBReading) return -1;
        if (!isAReading && isBReading) return 1;

        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }).slice(0, 6);

    const getStatus = (obj: AstralObject) => {
        if (!statusProp) return null;
        return obj.properties[statusProp.id] as string | undefined;
    };

    return (
        <div className="dashboard-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">
                        <LucideIcon name={bookType.icon || 'Book'} size={16} color={bookType.color} />
                    </span>
                    Lecturas
                </h3>
                {readingBooks.length > 0 && (
                    <span className="dashboard-widget-count">
                        {readingBooks.length}
                    </span>
                )}
            </div>

            {sortedBooks.length === 0 ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">📖</span>
                    <span className="dashboard-widget-empty-text">
                        Sin libros en lectura
                    </span>
                </div>
            ) : (
                <div className="dashboard-widget-list">
                    {sortedBooks.map(obj => {
                        const status = getStatus(obj);

                        return (
                            <div
                                key={obj.id}
                                className="dashboard-widget-item"
                                onClick={() => onObjectClick(obj.id)}
                            >
                                <span className="dashboard-widget-item-icon">
                                    <LucideIcon name={bookType.icon || 'Book'} size={16} color={bookType.color} />
                                </span>
                                <div className="dashboard-widget-item-content">
                                    <div className="dashboard-widget-item-title">
                                        {obj.title || 'Sin título'}
                                    </div>
                                </div>
                                {status && (
                                    <span
                                        className="dashboard-widget-item-badge"
                                        style={{
                                            background: `color-mix(in srgb, ${bookType.color || 'var(--accent-primary)'} 20%, transparent)`,
                                            color: bookType.color || 'var(--accent-primary)'
                                        }}
                                    >
                                        {status}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
