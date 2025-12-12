// Stats Widget - Shows statistics and distribution
import { useMemo } from 'react';
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface StatsWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
}

export const StatsWidget = ({ objects, objectTypes }: StatsWidgetProps) => {
    const stats = useMemo(() => {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        // Objects created this week
        const createdThisWeek = objects.filter(obj =>
            new Date(obj.createdAt) >= weekAgo
        ).length;

        // Objects modified this week
        const modifiedThisWeek = objects.filter(obj =>
            new Date(obj.updatedAt) >= weekAgo
        ).length;

        // Objects created this month
        const createdThisMonth = objects.filter(obj =>
            new Date(obj.createdAt) >= monthAgo
        ).length;

        // Distribution by type
        const typeCounts: Record<string, number> = {};
        objects.forEach(obj => {
            typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
        });

        // Sort by count descending
        const typeDistribution = Object.entries(typeCounts)
            .map(([typeId, count]) => ({
                type: objectTypes.find(t => t.id === typeId),
                count
            }))
            .filter(item => item.type)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const maxCount = Math.max(...typeDistribution.map(t => t.count), 1);

        // Total tags
        const allTags = new Set<string>();
        objects.forEach(obj => {
            obj.tags?.forEach(tag => allTags.add(tag));
        });

        // Average connections
        const totalConnections = objects.reduce((sum, obj) => {
            return sum + (obj.backlinks?.length || 0) + (obj.links?.length || 0);
        }, 0);
        const avgConnections = objects.length > 0 ? (totalConnections / objects.length).toFixed(1) : '0';

        return {
            total: objects.length,
            createdThisWeek,
            modifiedThisWeek,
            createdThisMonth,
            typeDistribution,
            maxCount,
            totalTags: allTags.size,
            avgConnections
        };
    }, [objects, objectTypes]);

    return (
        <div className="dashboard-widget dashboard-stats-widget-expanded">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">📊</span>
                    Resumen
                </h3>
            </div>

            <div className="dashboard-stats-cards">
                <div className="dashboard-stat-card">
                    <span className="dashboard-stat-value">{stats.total}</span>
                    <span className="dashboard-stat-label">Total objetos</span>
                </div>
                <div className="dashboard-stat-card">
                    <span className="dashboard-stat-value">{stats.createdThisWeek}</span>
                    <span className="dashboard-stat-label">Nuevos esta semana</span>
                </div>
                <div className="dashboard-stat-card">
                    <span className="dashboard-stat-value">{stats.modifiedThisWeek}</span>
                    <span className="dashboard-stat-label">Editados esta semana</span>
                </div>
                <div className="dashboard-stat-card">
                    <span className="dashboard-stat-value">{stats.totalTags}</span>
                    <span className="dashboard-stat-label">Etiquetas únicas</span>
                </div>
                <div className="dashboard-stat-card">
                    <span className="dashboard-stat-value">{stats.avgConnections}</span>
                    <span className="dashboard-stat-label">Conexiones promedio</span>
                </div>
                <div className="dashboard-stat-card">
                    <span className="dashboard-stat-value">{stats.createdThisMonth}</span>
                    <span className="dashboard-stat-label">Nuevos este mes</span>
                </div>
            </div>

            {stats.typeDistribution.length > 0 && (
                <div className="dashboard-type-distribution-expanded">
                    <div className="dashboard-type-distribution-title">
                        Distribución por tipo
                    </div>
                    <div className="dashboard-type-distribution-grid">
                        {stats.typeDistribution.map(({ type, count }) => (
                            <div key={type!.id} className="dashboard-type-bar-expanded">
                                <div className="dashboard-type-bar-header">
                                    <span className="dashboard-type-bar-icon">
                                        <LucideIcon name={type!.icon || 'FileText'} size={14} color={type!.color} />
                                    </span>
                                    <span className="dashboard-type-bar-name">{type!.name}</span>
                                    <span className="dashboard-type-bar-count">{count}</span>
                                </div>
                                <div className="dashboard-type-bar-track">
                                    <div
                                        className="dashboard-type-bar-fill"
                                        style={{
                                            width: `${(count / stats.maxCount) * 100}%`,
                                            background: type!.color
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
