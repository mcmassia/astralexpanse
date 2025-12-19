// Panel Chart Renderer - Renders different chart types using Recharts
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, Tooltip,
    LineChart, Line,
    ResponsiveContainer
} from 'recharts';
import type { DashboardPanel, ChartDataPoint, TimelineDataPoint } from '../../../types/dashboard';

interface PanelChartRendererProps {
    panel: DashboardPanel;
    data: ChartDataPoint[];
    timelineData?: TimelineDataPoint[];
    totalCount: number;
}

// Create chart-compatible data with index signature
type ChartData = ChartDataPoint & { [key: string]: unknown };

export const PanelChartRenderer = ({
    panel,
    data,
    timelineData,
    totalCount
}: PanelChartRendererProps) => {
    const config = panel.chartConfig;

    if (!config) return null;

    // Convert to chart-compatible format
    const chartData: ChartData[] = data.map(d => ({ ...d }));

    switch (config.type) {
        case 'count':
            return (
                <div className="panel-chart-count">
                    <span className="panel-chart-count-value">{totalCount}</span>
                    <span className="panel-chart-count-label">objetos</span>
                </div>
            );

        case 'pie':
            return (
                <div className="panel-chart-pie">
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={2}
                                dataKey="value"
                                nameKey="name"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || getDefaultColor(index)} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) => [`${value}`, '']}
                                contentStyle={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {config.showLegend && (
                        <div className="panel-chart-legend">
                            {data.slice(0, 5).map((item, index) => (
                                <div key={index} className="panel-chart-legend-item">
                                    <span
                                        className="panel-chart-legend-color"
                                        style={{ backgroundColor: item.color || getDefaultColor(index) }}
                                    />
                                    <span className="panel-chart-legend-label">{item.name}</span>
                                    <span className="panel-chart-legend-value">{item.value}</span>
                                </div>
                            ))}
                            {data.length > 5 && (
                                <div className="panel-chart-legend-more">+{data.length - 5} más</div>
                            )}
                        </div>
                    )}
                </div>
            );

        case 'bar':
            return (
                <div className="panel-chart-bar">
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={80}
                                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                formatter={(value) => [`${value}`, 'Total']}
                                contentStyle={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem'
                                }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || getDefaultColor(index)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case 'progress': {
            const completedData = data.find(d => d.name === 'Completado');
            const percentage = completedData?.value || 0;
            return (
                <div className="panel-chart-progress">
                    <div className="panel-chart-progress-bar">
                        <div
                            className="panel-chart-progress-fill"
                            style={{
                                width: `${percentage}%`,
                                backgroundColor: panel.color || '#22c55e'
                            }}
                        />
                    </div>
                    <div className="panel-chart-progress-label">
                        <span className="panel-chart-progress-value">{percentage}%</span>
                        <span className="panel-chart-progress-text">completado</span>
                    </div>
                </div>
            );
        }

        case 'timeline':
            if (!timelineData || timelineData.length === 0) {
                return <div className="panel-chart-empty">Sin datos de timeline</div>;
            }
            return (
                <div className="panel-chart-timeline">
                    <ResponsiveContainer width="100%" height={120}>
                        <LineChart data={timelineData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis hide />
                            <Tooltip
                                formatter={(value) => [`${value}`, 'Elementos']}
                                labelFormatter={(label) => formatTimelineLabel(String(label))}
                                contentStyle={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-primary)',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem'
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke={panel.color || '#6366f1'}
                                strokeWidth={2}
                                dot={{ r: 3, fill: panel.color || '#6366f1' }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            );

        default:
            return <div className="panel-chart-empty">Tipo de gráfico no soportado</div>;
    }
};

// Default color palette
function getDefaultColor(index: number): string {
    const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
        '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6'
    ];
    return colors[index % colors.length];
}

// Format timeline label
function formatTimelineLabel(label: string): string {
    const date = new Date(label);
    if (isNaN(date.getTime())) return label;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
