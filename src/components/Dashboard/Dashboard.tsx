// Dashboard - Main landing page with configurable panels
import { useEffect, useMemo, useState } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { QuoteWidget } from './widgets/QuoteWidget';
import { FavoritesWidget } from './widgets/FavoritesWidget';
import { DailyNoteWidget } from './widgets/DailyNoteWidget';
import { DashboardPanelWidget } from './widgets/DashboardPanelWidget';
import { StatsWidget } from './widgets/StatsWidget';
import { MostConnectedWidget } from './widgets/MostConnectedWidget';
import { DashboardConfigModal } from './DashboardConfigModal';
import { LucideIcon } from '../common';
import type { DashboardSection } from '../../types/dashboard';
import './Dashboard.css';

export const Dashboard = () => {
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const selectObject = useObjectStore(s => s.selectObject);
    const { setCurrentSection } = useUIStore();

    // Dashboard store
    const panels = useDashboardStore(s => s.panels);
    const initialize = useDashboardStore(s => s.initialize);
    const isLoading = useDashboardStore(s => s.isLoading);

    // Modal state
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

    // Initialize dashboard panels on mount
    useEffect(() => {
        initialize();
    }, [initialize]);

    const handleObjectClick = (objectId: string) => {
        selectObject(objectId);
        setCurrentSection('objects');
    };

    // Group panels by section
    const panelsBySection = useMemo(() => {
        const grouped: Record<DashboardSection, typeof panels> = {
            capture: [],
            action: [],
            gardening: [],
            custom: []
        };

        panels
            .sort((a, b) => a.order - b.order)
            .forEach(panel => {
                if (grouped[panel.section]) {
                    grouped[panel.section].push(panel);
                }
            });

        return grouped;
    }, [panels]);

    const sectionConfig: Record<DashboardSection, { icon: string; title: string; emoji: string }> = {
        capture: { icon: 'Inbox', title: 'Captura', emoji: '📥' },
        action: { icon: 'Target', title: 'Acción', emoji: '🎯' },
        gardening: { icon: 'Sprout', title: 'Mantenimiento', emoji: '🌱' },
        custom: { icon: 'Layout', title: 'Mis Paneles', emoji: '📌' }
    };

    const renderSection = (section: DashboardSection, className: string) => {
        const sectionPanels = panelsBySection[section];
        const config = sectionConfig[section];

        if (sectionPanels.length === 0) return null;

        return (
            <section className={`dashboard-section ${className}`}>
                <h2 className="dashboard-section-title">
                    <span className="dashboard-section-icon">{config.emoji}</span>
                    {config.title}
                </h2>
                <div className="dashboard-section-widgets">
                    {sectionPanels.map(panel => (
                        <DashboardPanelWidget
                            key={panel.id}
                            panel={panel}
                            objects={objects}
                            objectTypes={objectTypes}
                            onObjectClick={handleObjectClick}
                        />
                    ))}
                </div>
            </section>
        );
    };

    if (isLoading) {
        return (
            <div className="dashboard">
                <div className="dashboard-loading">
                    <LucideIcon name="Loader2" size={24} />
                    <span>Cargando dashboard...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Hero Section - Quote & Favorites */}
            <section className="dashboard-hero">
                <div className="dashboard-hero-header">
                    <QuoteWidget />
                    <button
                        className="dashboard-config-button"
                        onClick={() => setIsConfigModalOpen(true)}
                        title="Configurar paneles"
                    >
                        <LucideIcon name="Settings" size={16} />
                        Configurar
                    </button>
                </div>
                <FavoritesWidget
                    objects={objects}
                    objectTypes={objectTypes}
                    onObjectClick={handleObjectClick}
                />
            </section>

            {/* Main Grid */}
            <div className="dashboard-grid">
                {/* Capture Section - Keep DailyNote + configurable panels */}
                <section className="dashboard-section dashboard-section--input">
                    <h2 className="dashboard-section-title">
                        <span className="dashboard-section-icon">📥</span>
                        Captura
                    </h2>
                    <div className="dashboard-section-widgets">
                        <DailyNoteWidget
                            objects={objects}
                            objectTypes={objectTypes}
                            onObjectClick={handleObjectClick}
                        />
                        {panelsBySection.capture.map(panel => (
                            <DashboardPanelWidget
                                key={panel.id}
                                panel={panel}
                                objects={objects}
                                objectTypes={objectTypes}
                                onObjectClick={handleObjectClick}
                            />
                        ))}
                    </div>
                </section>

                {/* Action Section - Configurable panels */}
                {renderSection('action', 'dashboard-section--doing')}

                {/* Gardening Section - Configurable panels */}
                {renderSection('gardening', 'dashboard-section--gardening')}
            </div>

            {/* Custom Panels Section */}
            {panelsBySection.custom.length > 0 && (
                <section className="dashboard-section">
                    <h2 className="dashboard-section-title">
                        <span className="dashboard-section-icon">📌</span>
                        Mis Paneles
                    </h2>
                    <div className="dashboard-section-widgets dashboard-panel-section">
                        {panelsBySection.custom.map(panel => (
                            <DashboardPanelWidget
                                key={panel.id}
                                panel={panel}
                                objects={objects}
                                objectTypes={objectTypes}
                                onObjectClick={handleObjectClick}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Stats Section - Full Width */}
            <section className="dashboard-stats-section">
                <h2 className="dashboard-section-title">
                    <span className="dashboard-section-icon">📊</span>
                    Estadísticas
                </h2>
                <div className="dashboard-stats-grid">
                    <StatsWidget
                        objects={objects}
                        objectTypes={objectTypes}
                    />
                    <MostConnectedWidget
                        objects={objects}
                        objectTypes={objectTypes}
                        onObjectClick={handleObjectClick}
                    />
                </div>
            </section>

            {/* Config Modal */}
            <DashboardConfigModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
            />
        </div>
    );
};
