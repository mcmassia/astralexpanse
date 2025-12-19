// Dashboard Panel Types
import type { PropertyValue } from './object';

// Query filter operators
export type FilterOperator =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'is_empty'
    | 'not_empty'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte';

export interface PropertyFilter {
    propertyId: string;
    operator: FilterOperator;
    value?: PropertyValue;
}

// Special predefined filters
export type SpecialFilter =
    | 'orphans'           // no backlinks AND no tags
    | 'inbox'             // no tags AND no relations
    | 'recently_modified' // sorted by updatedAt
    | 'favorites';        // isFavorite = true

export interface DashboardPanelQuery {
    types?: string[];                    // Filter by object type(s)
    propertyFilters?: PropertyFilter[];  // AND logic between filters
    specialFilter?: SpecialFilter;
    sortBy?: 'createdAt' | 'updatedAt' | 'title' | string; // string = property ID
    sortDirection?: 'asc' | 'desc';
    dateRange?: {
        field: string;
        start?: Date;
        end?: Date;
    };
}

// Panel display modes
export type PanelDisplayMode = 'list' | 'chart';

// Chart types
export type ChartType = 'pie' | 'bar' | 'progress' | 'timeline' | 'count';

// Chart configuration
export interface ChartConfig {
    type: ChartType;

    // For pie/bar: group objects by this property
    groupByProperty?: string;

    // For progress: property that determines completion
    progressProperty?: string;
    progressCompletedValue?: string;

    // For timeline: date property to plot
    timelineProperty?: string;
    timelineGroupBy?: 'day' | 'week' | 'month';

    // Visual options
    showLabels?: boolean;
    showLegend?: boolean;
    colors?: string[];
}

// Dashboard section identifiers
export type DashboardSection = 'capture' | 'action' | 'gardening' | 'custom';

// Main panel interface
export interface DashboardPanel {
    id: string;
    name: string;
    icon: string;                        // Lucide icon name
    color?: string;                      // Accent color
    query: DashboardPanelQuery;
    displayMode: PanelDisplayMode;
    chartConfig?: ChartConfig;           // Only when displayMode = 'chart'
    maxItems: number;                    // Items to show in list mode
    order: number;                       // Position within section
    section: DashboardSection;
    createdAt: Date;
    updatedAt: Date;
}

// Chart data point for rendering
export interface ChartDataPoint {
    name: string;
    value: number;
    color?: string;
}

// Timeline data point
export interface TimelineDataPoint {
    date: string;
    count: number;
}
