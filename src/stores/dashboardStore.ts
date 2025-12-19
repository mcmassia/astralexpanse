// Dashboard Store - Manages configurable dashboard panels
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy
} from 'firebase/firestore';
import { getFirestoreDb, getFirebaseAuth } from '../services/firebase';
import type {
    DashboardPanel,
    DashboardPanelQuery,
    ChartDataPoint,
    TimelineDataPoint,
    PropertyFilter
} from '../types/dashboard';
import type { AstralObject, ObjectType } from '../types/object';

interface DashboardStore {
    panels: DashboardPanel[];
    isLoading: boolean;
    error: string | null;

    // CRUD
    createPanel: (panel: Omit<DashboardPanel, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
    updatePanel: (id: string, updates: Partial<DashboardPanel>) => Promise<void>;
    deletePanel: (id: string) => Promise<void>;
    reorderPanels: (orderedIds: string[]) => void;

    // Query execution
    executeQuery: (query: DashboardPanelQuery, objects: AstralObject[], types: ObjectType[]) => AstralObject[];

    // Chart data generation
    generateChartData: (panel: DashboardPanel, objects: AstralObject[], types: ObjectType[]) => ChartDataPoint[];
    generateTimelineData: (panel: DashboardPanel, objects: AstralObject[]) => TimelineDataPoint[];

    // Initialization
    initialize: () => Promise<void>;
    cleanup: () => void;
}

// Store unsubscribe function outside state
let unsubscribePanels: (() => void) | null = null;

// Generate unique ID
const generateId = () => `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Collection name
const PANELS_COLLECTION = 'dashboardPanels';

// Default panels matching current widgets
const DEFAULT_PANELS: Omit<DashboardPanel, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
        name: 'Bandeja de Entrada',
        icon: 'Inbox',
        color: '#f59e0b',
        query: { specialFilter: 'inbox', sortBy: 'createdAt', sortDirection: 'desc' },
        displayMode: 'list',
        maxItems: 8,
        order: 0,
        section: 'capture'
    },
    {
        name: 'Tareas Pendientes',
        icon: 'CheckCircle',
        color: '#f87171',
        query: {
            types: ['tarea'],
            propertyFilters: [
                { propertyId: 'status', operator: 'not_equals', value: 'Completada' },
                { propertyId: 'status', operator: 'not_equals', value: 'Cancelada' }
            ],
            sortBy: 'dueDate',
            sortDirection: 'asc'
        },
        displayMode: 'list',
        maxItems: 8,
        order: 0,
        section: 'action'
    },
    {
        name: 'Proyectos Activos',
        icon: 'Target',
        color: '#8b5cf6',
        query: {
            types: ['project'],
            propertyFilters: [
                { propertyId: 'status', operator: 'equals', value: 'Activo' }
            ],
            sortBy: 'updatedAt',
            sortDirection: 'desc'
        },
        displayMode: 'list',
        maxItems: 5,
        order: 1,
        section: 'action'
    },
    {
        name: 'Seguimiento',
        icon: 'Eye',
        color: '#10b981',
        query: {
            propertyFilters: [
                { propertyId: 'seguimiento', operator: 'equals', value: true }
            ],
            sortBy: 'updatedAt',
            sortDirection: 'desc'
        },
        displayMode: 'list',
        maxItems: 5,
        order: 2,
        section: 'action'
    },
    {
        name: 'Huérfanos',
        icon: 'Unlink',
        color: '#94a3b8',
        query: { specialFilter: 'orphans', sortBy: 'createdAt', sortDirection: 'asc' },
        displayMode: 'list',
        maxItems: 6,
        order: 0,
        section: 'gardening'
    },
    {
        name: 'Estadísticas por Tipo',
        icon: 'PieChart',
        color: '#6366f1',
        query: {},
        displayMode: 'chart',
        chartConfig: {
            type: 'pie',
            groupByProperty: 'type',
            showLabels: true,
            showLegend: true
        },
        maxItems: 10,
        order: 1,
        section: 'gardening'
    }
];

// Helper: Resolve semantic date values like @hoy, @ayer, @mañana
function resolveSemanticDate(value: unknown): Date | null {
    if (typeof value !== 'string' || !value.startsWith('@')) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (value.toLowerCase()) {
        case '@hoy':
            return today;
        case '@ayer': {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday;
        }
        case '@mañana': {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }
        case '@esta_semana': {
            const weekStart = new Date(today);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            return weekStart;
        }
        case '@semana_pasada': {
            const lastWeekStart = new Date(today);
            lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7);
            return lastWeekStart;
        }
        case '@este_mes': {
            return new Date(today.getFullYear(), today.getMonth(), 1);
        }
        case '@mes_pasado': {
            return new Date(today.getFullYear(), today.getMonth() - 1, 1);
        }
        default:
            return null;
    }
}

// Helper: Get end of period for range comparisons
function getSemanticDateEnd(value: string): Date | null {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    switch (value.toLowerCase()) {
        case '@hoy':
            return today;
        case '@ayer': {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday;
        }
        case '@mañana': {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }
        case '@esta_semana': {
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));
            return weekEnd;
        }
        case '@semana_pasada': {
            const lastWeekEnd = new Date(today);
            lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay() - 1);
            return lastWeekEnd;
        }
        case '@este_mes': {
            return new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        }
        case '@mes_pasado': {
            return new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
        }
        default:
            return null;
    }
}

// Helper: Check if a filter matches an object
function matchesFilter(obj: AstralObject, filter: PropertyFilter, _types: ObjectType[]): boolean {
    // Get property value - support built-in properties
    let value: unknown;
    if (filter.propertyId === 'createdAt') {
        value = obj.createdAt;
    } else if (filter.propertyId === 'updatedAt') {
        value = obj.updatedAt;
    } else if (filter.propertyId === 'title') {
        value = obj.title;
    } else if (filter.propertyId === 'type') {
        value = obj.type;
    } else if (filter.propertyId === 'isFavorite') {
        value = obj.properties.favorito || false;
    } else {
        value = obj.properties[filter.propertyId];
    }

    // Resolve semantic dates if the filter value is a semantic date marker
    const semanticStart = typeof filter.value === 'string' ? resolveSemanticDate(filter.value) : null;
    const semanticEnd = typeof filter.value === 'string' ? getSemanticDateEnd(filter.value) : null;

    switch (filter.operator) {
        case 'equals':
            // For semantic dates, check if the value falls within the date range
            if (semanticStart && semanticEnd) {
                const objDate = value instanceof Date ? value :
                    typeof value === 'string' ? new Date(value) : null;
                if (objDate) {
                    return objDate >= semanticStart && objDate <= semanticEnd;
                }
            }
            return value === filter.value;
        case 'not_equals':
            if (semanticStart && semanticEnd) {
                const objDate = value instanceof Date ? value :
                    typeof value === 'string' ? new Date(value) : null;
                if (objDate) {
                    return objDate < semanticStart || objDate > semanticEnd;
                }
            }
            return value !== filter.value;
        case 'contains':
            if (typeof value === 'string' && typeof filter.value === 'string') {
                return value.toLowerCase().includes(filter.value.toLowerCase());
            }
            if (Array.isArray(value)) {
                return value.some(v =>
                    (typeof v === 'string' && typeof filter.value === 'string' && v.toLowerCase().includes(filter.value.toLowerCase())) ||
                    (typeof v === 'object' && 'title' in v && typeof filter.value === 'string' && v.title.toLowerCase().includes(filter.value.toLowerCase()))
                );
            }
            return false;
        case 'is_empty':
            return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
        case 'not_empty':
            return value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
        case 'gt': {
            const compareDate = semanticStart;
            if (compareDate) {
                const objDate = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
                return objDate !== null && objDate > semanticEnd!;
            }
            if (typeof value === 'number' && typeof filter.value === 'number') return value > filter.value;
            if (value instanceof Date && filter.value instanceof Date) return value > filter.value;
            return false;
        }
        case 'lt': {
            const compareDate = semanticStart;
            if (compareDate) {
                const objDate = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
                return objDate !== null && objDate < semanticStart;
            }
            if (typeof value === 'number' && typeof filter.value === 'number') return value < filter.value;
            if (value instanceof Date && filter.value instanceof Date) return value < filter.value;
            return false;
        }
        case 'gte':
            if (typeof value === 'number' && typeof filter.value === 'number') return value >= filter.value;
            if (value instanceof Date && filter.value instanceof Date) return value >= filter.value;
            return false;
        case 'lte':
            if (typeof value === 'number' && typeof filter.value === 'number') return value <= filter.value;
            if (value instanceof Date && filter.value instanceof Date) return value <= filter.value;
            return false;
        default:
            return true;
    }
}

// Helper: Apply special filter
function applySpecialFilter(objects: AstralObject[], filter: string, types: ObjectType[]): AstralObject[] {
    switch (filter) {
        case 'orphans':
            return objects.filter(obj => {
                const hasNoBacklinks = !obj.backlinks || obj.backlinks.length === 0;
                const hasNoTags = !obj.tags || obj.tags.length === 0;
                const type = types.find(t => t.id === obj.type);
                const isDailyNote = type?.id === 'daily' || type?.name.toLowerCase() === 'nota diaria';
                return hasNoBacklinks && hasNoTags && !isDailyNote;
            });

        case 'inbox':
            return objects.filter(obj => {
                const hasNoTags = !obj.tags || obj.tags.length === 0;
                const type = types.find(t => t.id === obj.type);
                const relationProps = type?.properties.filter(p => p.type === 'relation') || [];
                const hasNoRelations = relationProps.every(prop => {
                    const value = obj.properties[prop.id];
                    if (!value) return true;
                    if (Array.isArray(value)) return value.length === 0;
                    return true;
                });
                return hasNoTags && hasNoRelations;
            });

        case 'favorites':
            return objects.filter(obj => obj.properties.favorito === true);

        case 'recently_modified':
            return [...objects].sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );

        default:
            return objects;
    }
}

// Helper: Get property value for sorting
function getSortValue(obj: AstralObject, sortBy: string): number | string {
    if (sortBy === 'createdAt') return new Date(obj.createdAt).getTime();
    if (sortBy === 'updatedAt') return new Date(obj.updatedAt).getTime();
    if (sortBy === 'title') return obj.title.toLowerCase();

    const value = obj.properties[sortBy];
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return value.toLowerCase();
    return 0;
}

// Serialize panel for Firestore - removes undefined values
function serializePanel(panel: DashboardPanel): Record<string, unknown> {
    const serialized: Record<string, unknown> = {
        id: panel.id,
        name: panel.name,
        icon: panel.icon,
        displayMode: panel.displayMode,
        maxItems: panel.maxItems,
        order: panel.order,
        section: panel.section,
        createdAt: panel.createdAt instanceof Date ? panel.createdAt.toISOString() : panel.createdAt,
        updatedAt: panel.updatedAt instanceof Date ? panel.updatedAt.toISOString() : panel.updatedAt,
    };

    // Optional fields - only include if defined
    if (panel.color) serialized.color = panel.color;
    if (panel.chartConfig) serialized.chartConfig = panel.chartConfig;

    // Serialize query - omit undefined fields
    const query: Record<string, unknown> = {};
    if (panel.query.types && panel.query.types.length > 0) {
        query.types = panel.query.types;
    }
    if (panel.query.propertyFilters && panel.query.propertyFilters.length > 0) {
        query.propertyFilters = panel.query.propertyFilters;
    }
    if (panel.query.specialFilter) {
        query.specialFilter = panel.query.specialFilter;
    }
    if (panel.query.sortBy) {
        query.sortBy = panel.query.sortBy;
    }
    if (panel.query.sortDirection) {
        query.sortDirection = panel.query.sortDirection;
    }
    if (panel.query.dateRange) {
        query.dateRange = {
            field: panel.query.dateRange.field,
            ...(panel.query.dateRange.start && {
                start: panel.query.dateRange.start instanceof Date
                    ? panel.query.dateRange.start.toISOString()
                    : panel.query.dateRange.start
            }),
            ...(panel.query.dateRange.end && {
                end: panel.query.dateRange.end instanceof Date
                    ? panel.query.dateRange.end.toISOString()
                    : panel.query.dateRange.end
            }),
        };
    }

    serialized.query = query;
    return serialized;
}

// Deserialize panel from Firestore
function deserializePanel(data: Record<string, unknown>): DashboardPanel {
    return {
        ...data,
        createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt,
        updatedAt: typeof data.updatedAt === 'string' ? new Date(data.updatedAt) : data.updatedAt,
        query: {
            ...(data.query as DashboardPanelQuery),
            dateRange: (data.query as DashboardPanelQuery)?.dateRange ? {
                ...(data.query as DashboardPanelQuery).dateRange,
                start: typeof (data.query as DashboardPanelQuery).dateRange?.start === 'string'
                    ? new Date((data.query as DashboardPanelQuery).dateRange!.start as unknown as string)
                    : (data.query as DashboardPanelQuery).dateRange?.start,
                end: typeof (data.query as DashboardPanelQuery).dateRange?.end === 'string'
                    ? new Date((data.query as DashboardPanelQuery).dateRange!.end as unknown as string)
                    : (data.query as DashboardPanelQuery).dateRange?.end
            } : undefined
        }
    } as DashboardPanel;
}

export const useDashboardStore = create<DashboardStore>()(
    subscribeWithSelector((set, get) => ({
        panels: [],
        isLoading: false,
        error: null,

        createPanel: async (panelData) => {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;
            if (!user) throw new Error('Not authenticated');

            const db = getFirestoreDb();
            const id = generateId();
            const now = new Date();

            const panel: DashboardPanel = {
                ...panelData,
                id,
                createdAt: now,
                updatedAt: now
            };

            await setDoc(doc(db, PANELS_COLLECTION, id), {
                ...serializePanel(panel),
                userId: user.uid
            });
            return id;
        },

        updatePanel: async (id, updates) => {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;
            if (!user) throw new Error('Not authenticated');

            const db = getFirestoreDb();
            const panel = get().panels.find(p => p.id === id);
            if (!panel) throw new Error('Panel not found');

            const updatedPanel: DashboardPanel = {
                ...panel,
                ...updates,
                updatedAt: new Date()
            };

            await setDoc(doc(db, PANELS_COLLECTION, id), {
                ...serializePanel(updatedPanel),
                userId: user.uid
            });
        },

        deletePanel: async (id) => {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;
            if (!user) throw new Error('Not authenticated');

            const db = getFirestoreDb();
            await deleteDoc(doc(db, PANELS_COLLECTION, id));
        },

        reorderPanels: (orderedIds) => {
            set(state => {
                const reordered = orderedIds.map((id, index) => {
                    const panel = state.panels.find(p => p.id === id);
                    if (panel) {
                        // Update order in Firestore (fire and forget)
                        const auth = getFirebaseAuth();
                        const user = auth.currentUser;
                        if (user) {
                            const db = getFirestoreDb();
                            setDoc(doc(db, PANELS_COLLECTION, id), {
                                ...serializePanel({ ...panel, order: index, updatedAt: new Date() }),
                                userId: user.uid
                            });
                        }
                        return { ...panel, order: index };
                    }
                    return null;
                }).filter(Boolean) as DashboardPanel[];

                return { panels: reordered };
            });
        },

        executeQuery: (panelQuery, objects, types) => {
            let result = [...objects];

            // Type filter
            if (panelQuery.types && panelQuery.types.length > 0) {
                result = result.filter(obj => panelQuery.types!.includes(obj.type));
            }

            // Property filters (AND logic)
            if (panelQuery.propertyFilters && panelQuery.propertyFilters.length > 0) {
                result = result.filter(obj =>
                    panelQuery.propertyFilters!.every(filter => matchesFilter(obj, filter, types))
                );
            }

            // Special filter
            if (panelQuery.specialFilter) {
                result = applySpecialFilter(result, panelQuery.specialFilter, types);
            }

            // Date range filter
            if (panelQuery.dateRange) {
                const { field, start, end } = panelQuery.dateRange;
                result = result.filter(obj => {
                    const value = field === 'createdAt' ? obj.createdAt :
                        field === 'updatedAt' ? obj.updatedAt :
                            obj.properties[field];
                    if (!(value instanceof Date)) return true;
                    if (start && value < start) return false;
                    if (end && value > end) return false;
                    return true;
                });
            }

            // Sorting
            const sortBy = panelQuery.sortBy || 'updatedAt';
            const sortDir = panelQuery.sortDirection || 'desc';

            result.sort((a, b) => {
                const aVal = getSortValue(a, sortBy);
                const bVal = getSortValue(b, sortBy);
                const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return sortDir === 'desc' ? -comparison : comparison;
            });

            return result;
        },

        generateChartData: (panel, objects, types) => {
            const filteredObjects = get().executeQuery(panel.query, objects, types);
            const config = panel.chartConfig;

            if (!config) return [];

            switch (config.type) {
                case 'count':
                    return [{ name: panel.name, value: filteredObjects.length }];

                case 'pie':
                case 'bar': {
                    const groupBy = config.groupByProperty || 'type';
                    const groups: Record<string, number> = {};

                    filteredObjects.forEach(obj => {
                        let key: string;
                        if (groupBy === 'type') {
                            const type = types.find(t => t.id === obj.type);
                            key = type?.name || obj.type;
                        } else {
                            const value = obj.properties[groupBy];
                            key = typeof value === 'string' ? value :
                                Array.isArray(value) ? value.join(', ') :
                                    String(value || 'Sin valor');
                        }
                        groups[key] = (groups[key] || 0) + 1;
                    });

                    return Object.entries(groups).map(([name, value], index) => ({
                        name,
                        value,
                        color: config.colors?.[index] || getDefaultColor(index)
                    }));
                }

                case 'progress': {
                    if (!config.progressProperty || !config.progressCompletedValue) {
                        return [{ name: 'Completado', value: 0 }, { name: 'Pendiente', value: 100 }];
                    }
                    const completed = filteredObjects.filter(obj =>
                        obj.properties[config.progressProperty!] === config.progressCompletedValue
                    ).length;
                    const total = filteredObjects.length;
                    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                    return [
                        { name: 'Completado', value: percentage, color: '#22c55e' },
                        { name: 'Pendiente', value: 100 - percentage, color: '#e5e7eb' }
                    ];
                }

                default:
                    return [];
            }
        },

        generateTimelineData: (panel, objects) => {
            const config = panel.chartConfig;
            if (!config || config.type !== 'timeline') return [];

            const dateProperty = config.timelineProperty || 'createdAt';
            const groupBy = config.timelineGroupBy || 'day';
            const groups: Record<string, number> = {};

            objects.forEach(obj => {
                const dateValue = dateProperty === 'createdAt' ? obj.createdAt :
                    dateProperty === 'updatedAt' ? obj.updatedAt :
                        obj.properties[dateProperty];

                if (!(dateValue instanceof Date)) return;

                let key: string;
                switch (groupBy) {
                    case 'day':
                        key = dateValue.toISOString().split('T')[0];
                        break;
                    case 'week':
                        const weekStart = new Date(dateValue);
                        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                        key = weekStart.toISOString().split('T')[0];
                        break;
                    case 'month':
                        key = `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}`;
                        break;
                    default:
                        key = dateValue.toISOString().split('T')[0];
                }

                groups[key] = (groups[key] || 0) + 1;
            });

            return Object.entries(groups)
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date));
        },

        initialize: async () => {
            const auth = getFirebaseAuth();
            const user = auth.currentUser;
            if (!user) return;

            set({ isLoading: true, error: null });

            try {
                const db = getFirestoreDb();
                const panelsRef = collection(db, PANELS_COLLECTION);
                const panelsQuery = query(
                    panelsRef,
                    where('userId', '==', user.uid),
                    orderBy('order')
                );

                // Subscribe to real-time updates
                unsubscribePanels = onSnapshot(panelsQuery, async (snapshot) => {
                    if (snapshot.empty) {
                        // Create default panels on first use
                        console.log('Creating default dashboard panels...');
                        const now = new Date();
                        for (const panelData of DEFAULT_PANELS) {
                            const id = generateId();
                            const panel: DashboardPanel = {
                                ...panelData,
                                id,
                                createdAt: now,
                                updatedAt: now
                            };
                            await setDoc(doc(db, PANELS_COLLECTION, id), {
                                ...serializePanel(panel),
                                userId: user.uid
                            });
                        }
                        return; // Will be called again with the new panels
                    }

                    const panels = snapshot.docs.map(doc => deserializePanel(doc.data()));
                    set({ panels, isLoading: false });
                }, (error) => {
                    console.error('Error subscribing to dashboard panels:', error);
                    set({ error: error.message, isLoading: false });
                });
            } catch (error) {
                console.error('Error initializing dashboard store:', error);
                set({ error: (error as Error).message, isLoading: false });
            }
        },

        cleanup: () => {
            if (unsubscribePanels) {
                unsubscribePanels();
                unsubscribePanels = null;
            }
            set({ panels: [], isLoading: false, error: null });
        }
    }))
);

// Default color palette for charts
function getDefaultColor(index: number): string {
    const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
        '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6'
    ];
    return colors[index % colors.length];
}
