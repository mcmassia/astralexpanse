// Dashboard Panel Widget - Generic configurable panel for list and chart display
import { useMemo } from 'react';
import type { DashboardPanel, ChartDataPoint } from '../../../types/dashboard';
import type { AstralObject, ObjectType } from '../../../types/object';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { useUIStore } from '../../../stores/uiStore';
import { LucideIcon } from '../../common';
import { PanelChartRenderer } from './PanelChartRenderer';

interface DashboardPanelWidgetProps {
    panel: DashboardPanel;
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

export const DashboardPanelWidget = ({
    panel,
    objects,
    objectTypes,
    onObjectClick
}: DashboardPanelWidgetProps) => {
    const executeQuery = useDashboardStore(s => s.executeQuery);
    const generateChartData = useDashboardStore(s => s.generateChartData);
    const applyPanelFilter = useUIStore(s => s.applyPanelFilter);

    // Execute query to get filtered objects
    const filteredObjects = useMemo(() => {
        return executeQuery(panel.query, objects, objectTypes);
    }, [panel.query, objects, objectTypes, executeQuery]);

    // Generate chart data if in chart mode
    const chartData: ChartDataPoint[] = useMemo(() => {
        if (panel.displayMode !== 'chart') return [];
        return generateChartData(panel, objects, objectTypes);
    }, [panel, objects, objectTypes, generateChartData]);

    // Get items to display (limited by maxItems)
    const displayItems = filteredObjects.slice(0, panel.maxItems);
    const remainingCount = filteredObjects.length - displayItems.length;

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

    const handleSeeMore = () => {
        applyPanelFilter(panel.query, panel.name);
    };

    return (
        <div className="dashboard-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">
                        <LucideIcon name={panel.icon} size={16} color={panel.color} />
                    </span>
                    {panel.name}
                </h3>
                {filteredObjects.length > 0 && (
                    <span className="dashboard-widget-count">
                        {filteredObjects.length}
                    </span>
                )}
            </div>

            {panel.displayMode === 'chart' ? (
                // Chart mode
                <div className="dashboard-widget-chart">
                    <PanelChartRenderer
                        panel={panel}
                        data={chartData}
                        totalCount={filteredObjects.length}
                    />
                </div>
            ) : (
                // List mode
                <>
                    {displayItems.length === 0 ? (
                        <div className="dashboard-widget-empty">
                            <span className="dashboard-widget-empty-icon">✨</span>
                            <span className="dashboard-widget-empty-text">
                                Sin elementos
                            </span>
                        </div>
                    ) : (
                        <div className="dashboard-widget-list">
                            {displayItems.map(obj => {
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

                    {remainingCount > 0 && (
                        <button
                            className="dashboard-widget-more"
                            onClick={handleSeeMore}
                        >
                            +{remainingCount} más
                        </button>
                    )}
                </>
            )}
        </div>
    );
};
