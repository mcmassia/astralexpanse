// Seguimiento Widget - Shows all objects with Seguimiento = true
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface SeguimientoWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

export const SeguimientoWidget = ({ objects, objectTypes, onObjectClick }: SeguimientoWidgetProps) => {
    // Filter objects with Seguimiento = true
    const trackedObjects = objects.filter(obj => {
        const seguimiento = obj.properties.seguimiento;
        return seguimiento === true;
    });

    // Sort by updatedAt (most recent first)
    const sortedObjects = [...trackedObjects].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ).slice(0, 8);

    const getTypeInfo = (typeId: string) => objectTypes.find(t => t.id === typeId);

    return (
        <div className="dashboard-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">👁️</span>
                    Seguimiento
                </h3>
                {trackedObjects.length > 0 && (
                    <span className="dashboard-widget-count">
                        {trackedObjects.length}
                    </span>
                )}
            </div>

            {sortedObjects.length === 0 ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">📌</span>
                    <span className="dashboard-widget-empty-text">
                        Nada en seguimiento
                    </span>
                    <span className="dashboard-widget-empty-hint">
                        Activa "Seguimiento" en cualquier objeto
                    </span>
                </div>
            ) : (
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
                                        {type?.name}
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
