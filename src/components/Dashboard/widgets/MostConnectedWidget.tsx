// Most Connected Widget - Shows objects with most backlinks (hubs)
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface MostConnectedWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

export const MostConnectedWidget = ({ objects, objectTypes, onObjectClick }: MostConnectedWidgetProps) => {
    // Sort by number of backlinks + outgoing links
    const sortedByConnections = [...objects]
        .map(obj => ({
            obj,
            connections: (obj.backlinks?.length || 0) + (obj.links?.length || 0),
            backlinks: obj.backlinks?.length || 0,
            outlinks: obj.links?.length || 0
        }))
        .filter(item => item.connections > 0)
        .sort((a, b) => b.connections - a.connections)
        .slice(0, 5);

    const getTypeInfo = (typeId: string) => objectTypes.find(t => t.id === typeId);

    const maxConnections = sortedByConnections[0]?.connections || 1;

    return (
        <div className="dashboard-widget dashboard-connected-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">🔗</span>
                    Más Conectados
                </h3>
            </div>

            {sortedByConnections.length === 0 ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">🌐</span>
                    <span className="dashboard-widget-empty-text">
                        Sin conexiones aún
                    </span>
                </div>
            ) : (
                <div className="dashboard-connected-list">
                    {sortedByConnections.map(({ obj, connections, backlinks, outlinks }) => {
                        const type = getTypeInfo(obj.type);
                        const percentage = (connections / maxConnections) * 100;

                        return (
                            <div
                                key={obj.id}
                                className="dashboard-connected-item"
                                onClick={() => onObjectClick(obj.id)}
                            >
                                <div className="dashboard-connected-item-header">
                                    <span className="dashboard-connected-item-icon">
                                        <LucideIcon name={type?.icon || 'FileText'} size={14} color={type?.color} />
                                    </span>
                                    <span className="dashboard-connected-item-title">
                                        {obj.title || 'Sin título'}
                                    </span>
                                    <span className="dashboard-connected-item-count">
                                        {connections}
                                    </span>
                                </div>
                                <div className="dashboard-connected-item-bar">
                                    <div
                                        className="dashboard-connected-item-bar-fill"
                                        style={{
                                            width: `${percentage}%`,
                                            background: type?.color || 'var(--accent-primary)'
                                        }}
                                    />
                                </div>
                                <div className="dashboard-connected-item-meta">
                                    <span>← {backlinks} entrantes</span>
                                    <span>{outlinks} salientes →</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
