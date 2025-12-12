// Active Library Widget - Shows items being read/watched/followed
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface ActiveLibraryWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

// Status values that indicate active consumption
const ACTIVE_STATUS_VALUES = [
    'leyendo', 'viendo', 'siguiendo', 'en progreso', 'en curso',
    'reading', 'watching', 'following', 'in progress'
];

export const ActiveLibraryWidget = ({ objects, objectTypes, onObjectClick }: ActiveLibraryWidgetProps) => {
    // Find types that have status-like properties with "reading" type states
    // Primary: Libro (book)
    const bookType = objectTypes.find(t =>
        t.id === 'book' || t.name.toLowerCase() === 'libro'
    );

    // Find all objects with active consumption status
    const activeItems = objects.filter(obj => {
        const type = objectTypes.find(t => t.id === obj.type);
        if (!type) return false;

        // Check if any property that looks like a status has an active value
        const statusProps = type.properties.filter(p =>
            p.type === 'select' &&
            (p.name.toLowerCase().includes('estado') || p.name.toLowerCase() === 'status')
        );

        return statusProps.some(prop => {
            const value = obj.properties[prop.id];
            if (typeof value !== 'string') return false;
            return ACTIVE_STATUS_VALUES.some(status =>
                value.toLowerCase().includes(status)
            );
        });
    });

    // Sort: books first, then by updatedAt
    const sortedItems = [...activeItems].sort((a, b) => {
        const isABook = a.type === bookType?.id;
        const isBBook = b.type === bookType?.id;
        if (isABook && !isBBook) return -1;
        if (!isABook && isBBook) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }).slice(0, 6);

    const getTypeInfo = (typeId: string) => objectTypes.find(t => t.id === typeId);

    const getStatus = (obj: AstralObject) => {
        const type = objectTypes.find(t => t.id === obj.type);
        if (!type) return null;

        const statusProp = type.properties.find(p =>
            p.type === 'select' &&
            (p.name.toLowerCase().includes('estado') || p.name.toLowerCase() === 'status')
        );

        if (statusProp) {
            return obj.properties[statusProp.id] as string | undefined;
        }
        return null;
    };

    return (
        <div className="dashboard-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">📚</span>
                    Biblioteca Activa
                </h3>
                {activeItems.length > 0 && (
                    <span className="dashboard-widget-count">
                        {activeItems.length}
                    </span>
                )}
            </div>

            {sortedItems.length === 0 ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">📖</span>
                    <span className="dashboard-widget-empty-text">
                        Nada en curso
                    </span>
                </div>
            ) : (
                <div className="dashboard-widget-list">
                    {sortedItems.map(obj => {
                        const type = getTypeInfo(obj.type);
                        const status = getStatus(obj);

                        return (
                            <div
                                key={obj.id}
                                className="dashboard-widget-item"
                                onClick={() => onObjectClick(obj.id)}
                            >
                                <span className="dashboard-widget-item-icon">
                                    <LucideIcon name={type?.icon || 'Book'} size={16} color={type?.color} />
                                </span>
                                <div className="dashboard-widget-item-content">
                                    <div className="dashboard-widget-item-title">
                                        {obj.title || 'Sin título'}
                                    </div>
                                    <div className="dashboard-widget-item-meta">
                                        {type?.name}
                                    </div>
                                </div>
                                {status && (
                                    <span
                                        className="dashboard-widget-item-badge"
                                        style={{
                                            background: `color-mix(in srgb, ${type?.color || 'var(--accent-primary)'} 20%, transparent)`,
                                            color: type?.color || 'var(--accent-primary)'
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
