// Inbox Widget - Shows unprocessed objects (no tags AND no relations)
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface InboxWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

export const InboxWidget = ({ objects, objectTypes, onObjectClick }: InboxWidgetProps) => {
    // Filter objects that have no tags AND no relations defined
    const unprocessedObjects = objects.filter(obj => {
        const hasNoTags = !obj.tags || obj.tags.length === 0;

        // Check if any property is a relation with values
        const type = objectTypes.find(t => t.id === obj.type);
        const relationProps = type?.properties.filter(p => p.type === 'relation') || [];

        const hasNoRelations = relationProps.every(prop => {
            const value = obj.properties[prop.id];
            if (!value) return true;
            if (Array.isArray(value)) return value.length === 0;
            return true;
        });

        return hasNoTags && hasNoRelations;
    });

    // Sort by most recent first
    const sortedObjects = [...unprocessedObjects]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);

    const getTypeInfo = (typeId: string) => objectTypes.find(t => t.id === typeId);

    const formatRelativeTime = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - new Date(date).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'ahora';
        if (diffMins < 60) return `hace ${diffMins}m`;
        if (diffHours < 24) return `hace ${diffHours}h`;
        if (diffDays < 7) return `hace ${diffDays}d`;
        return new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    return (
        <div className="dashboard-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">📬</span>
                    Bandeja de Entrada
                </h3>
                {unprocessedObjects.length > 0 && (
                    <span className="dashboard-widget-count dashboard-widget-count--warning">
                        {unprocessedObjects.length}
                    </span>
                )}
            </div>

            {sortedObjects.length === 0 ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">✨</span>
                    <span className="dashboard-widget-empty-text">
                        ¡Todo clasificado!
                    </span>
                </div>
            ) : (
                <>
                    <div className="dashboard-widget-list">
                        {sortedObjects.map(obj => {
                            const type = getTypeInfo(obj.type);
                            return (
                                <div
                                    key={obj.id}
                                    className="dashboard-widget-item"
                                    onClick={() => onObjectClick(obj.id)}
                                >
                                    <span className="dashboard-widget-item-icon">
                                        <LucideIcon name={type?.icon || 'FileText'} size={16} color={type?.color} />
                                    </span>
                                    <div className="dashboard-widget-item-content">
                                        <div className="dashboard-widget-item-title">
                                            {obj.title || 'Sin título'}
                                        </div>
                                        <div className="dashboard-widget-item-meta">
                                            {type?.name} • {formatRelativeTime(obj.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {unprocessedObjects.length > 8 && (
                        <div className="dashboard-widget-more">
                            +{unprocessedObjects.length - 8} más sin clasificar
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
