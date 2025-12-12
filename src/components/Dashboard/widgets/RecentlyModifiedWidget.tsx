// Recently Modified Widget - Shows recently edited objects
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface RecentlyModifiedWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

export const RecentlyModifiedWidget = ({ objects, objectTypes, onObjectClick }: RecentlyModifiedWidgetProps) => {
    // Sort by updatedAt descending
    const recentObjects = [...objects]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10);

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
                    <span className="dashboard-widget-icon">🕐</span>
                    Recientes
                </h3>
            </div>

            {recentObjects.length === 0 ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">📝</span>
                    <span className="dashboard-widget-empty-text">
                        Sin actividad reciente
                    </span>
                </div>
            ) : (
                <div className="dashboard-widget-list">
                    {recentObjects.map(obj => {
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
                                        {type?.name} • {formatRelativeTime(obj.updatedAt)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
