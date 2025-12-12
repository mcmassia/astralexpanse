// Orphans Widget - Shows objects with no backlinks and no tags
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface OrphansWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

export const OrphansWidget = ({ objects, objectTypes, onObjectClick }: OrphansWidgetProps) => {
    // Find orphan objects: no backlinks AND no tags
    const orphanObjects = objects.filter(obj => {
        const hasNoBacklinks = !obj.backlinks || obj.backlinks.length === 0;
        const hasNoTags = !obj.tags || obj.tags.length === 0;

        // Exclude daily notes (they're often standalone)
        const type = objectTypes.find(t => t.id === obj.type);
        const isDailyNote = type?.id === 'daily' || type?.name.toLowerCase() === 'nota diaria';

        return hasNoBacklinks && hasNoTags && !isDailyNote;
    });

    // Sort by oldest first (most likely to be forgotten)
    const sortedOrphans = [...orphanObjects]
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, 6);

    const getTypeInfo = (typeId: string) => objectTypes.find(t => t.id === typeId);

    const formatAge = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - new Date(date).getTime();
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffDays < 1) return 'Hoy';
        if (diffDays === 1) return 'Ayer';
        if (diffDays < 7) return `Hace ${diffDays} días`;
        if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
        return `Hace ${Math.floor(diffDays / 30)} meses`;
    };

    return (
        <div className="dashboard-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">🔗</span>
                    Huérfanos
                </h3>
                {orphanObjects.length > 0 && (
                    <span className="dashboard-widget-count dashboard-widget-count--warning">
                        {orphanObjects.length}
                    </span>
                )}
            </div>

            {sortedOrphans.length === 0 ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">🌐</span>
                    <span className="dashboard-widget-empty-text">
                        Todo conectado
                    </span>
                </div>
            ) : (
                <>
                    <div className="dashboard-widget-list">
                        {sortedOrphans.map(obj => {
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
                                            {type?.name} • {formatAge(obj.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {orphanObjects.length > 6 && (
                        <div className="dashboard-widget-more">
                            +{orphanObjects.length - 6} más sin conectar
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
