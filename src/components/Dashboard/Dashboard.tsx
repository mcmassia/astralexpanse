// Dashboard - Main landing page with OOPKM widgets
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { QuoteWidget } from './widgets/QuoteWidget';
import { FavoritesWidget } from './widgets/FavoritesWidget';
import { InboxWidget } from './widgets/InboxWidget';
import { DailyNoteWidget } from './widgets/DailyNoteWidget';
import { TasksWidget } from './widgets/TasksWidget';
import { ProjectsWidget } from './widgets/ProjectsWidget';
import { RecentlyModifiedWidget } from './widgets/RecentlyModifiedWidget';
import { ActiveLibraryWidget } from './widgets/ActiveLibraryWidget';
import { OrphansWidget } from './widgets/OrphansWidget';
import { StatsWidget } from './widgets/StatsWidget';
import { MostConnectedWidget } from './widgets/MostConnectedWidget';
import './Dashboard.css';

export const Dashboard = () => {
    const objects = useObjectStore(s => s.objects);
    const objectTypes = useObjectStore(s => s.objectTypes);
    const selectObject = useObjectStore(s => s.selectObject);
    const { setCurrentSection } = useUIStore();

    const handleObjectClick = (objectId: string) => {
        selectObject(objectId);
        setCurrentSection('objects');
    };

    return (
        <div className="dashboard">
            {/* Hero Section - Quote & Favorites */}
            <section className="dashboard-hero">
                <QuoteWidget />
                <FavoritesWidget
                    objects={objects}
                    objectTypes={objectTypes}
                    onObjectClick={handleObjectClick}
                />
            </section>

            {/* Main Grid */}
            <div className="dashboard-grid">
                {/* Input Mode Section */}
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
                        <InboxWidget
                            objects={objects}
                            objectTypes={objectTypes}
                            onObjectClick={handleObjectClick}
                        />
                    </div>
                </section>

                {/* Doing Mode Section */}
                <section className="dashboard-section dashboard-section--doing">
                    <h2 className="dashboard-section-title">
                        <span className="dashboard-section-icon">🎯</span>
                        Acción
                    </h2>
                    <div className="dashboard-section-widgets">
                        <TasksWidget
                            objects={objects}
                            objectTypes={objectTypes}
                            onObjectClick={handleObjectClick}
                        />
                        <ProjectsWidget
                            objects={objects}
                            objectTypes={objectTypes}
                            onObjectClick={handleObjectClick}
                        />
                        <RecentlyModifiedWidget
                            objects={objects}
                            objectTypes={objectTypes}
                            onObjectClick={handleObjectClick}
                        />
                    </div>
                </section>

                {/* Gardening Mode Section */}
                <section className="dashboard-section dashboard-section--gardening">
                    <h2 className="dashboard-section-title">
                        <span className="dashboard-section-icon">🌱</span>
                        Mantenimiento
                    </h2>
                    <div className="dashboard-section-widgets">
                        <ActiveLibraryWidget
                            objects={objects}
                            objectTypes={objectTypes}
                            onObjectClick={handleObjectClick}
                        />
                        <OrphansWidget
                            objects={objects}
                            objectTypes={objectTypes}
                            onObjectClick={handleObjectClick}
                        />
                    </div>
                </section>
            </div>

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
        </div>
    );
};
