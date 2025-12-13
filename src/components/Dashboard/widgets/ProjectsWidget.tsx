// Projects Widget - Shows active projects with progress
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface ProjectsWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

interface ProjectWithProgress {
    project: AstralObject;
    progress: number;
    totalTasks: number;
    completedTasks: number;
}

export const ProjectsWidget = ({ objects, objectTypes, onObjectClick }: ProjectsWidgetProps) => {
    // Find project type
    const projectType = objectTypes.find(t =>
        t.id === 'project' || t.name.toLowerCase() === 'proyecto'
    );

    // Find task type for progress calculation
    const taskType = objectTypes.find(t =>
        t.name.toLowerCase() === 'tarea' || t.id === 'task'
    );

    if (!projectType) {
        return (
            <div className="dashboard-widget">
                <div className="dashboard-widget-header">
                    <h3 className="dashboard-widget-title">
                        <span className="dashboard-widget-icon">🎯</span>
                        Proyectos
                    </h3>
                </div>
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">⚠️</span>
                    <span className="dashboard-widget-empty-text">
                        Tipo "Proyecto" no configurado
                    </span>
                </div>
            </div>
        );
    }

    // Find the status property ID from type definition (could be "Estado", "status", etc.)
    const statusProp = projectType.properties.find(p =>
        p.name.toLowerCase() === 'estado' ||
        p.name.toLowerCase() === 'status' ||
        p.id.toLowerCase() === 'status'
    );

    // Find the deadline property ID from type definition
    const deadlineProp = projectType.properties.find(p =>
        p.name.toLowerCase().includes('fecha') && p.name.toLowerCase().includes('límite') ||
        p.name.toLowerCase() === 'deadline' ||
        p.id.toLowerCase().includes('fechalimite') ||
        p.id.toLowerCase() === 'deadline'
    );

    // Allowed status values for projects (case insensitive)
    const ACTIVE_STATUS_VALUES = ['activo', 'en pausa', 'active', 'paused', 'on hold'];

    // Get active/paused projects only
    const activeProjects = objects.filter(obj => {
        if (obj.type !== projectType.id) return false;

        if (!statusProp) return true; // If no status property, show all projects

        const statusValue = obj.properties[statusProp.id];
        // Show projects without status
        if (!statusValue || (typeof statusValue === 'string' && statusValue.trim() === '')) return true;

        // Check if status is in allowed values
        if (typeof statusValue === 'string') {
            return ACTIVE_STATUS_VALUES.includes(statusValue.toLowerCase().trim());
        }
        return false;
    });

    // Calculate progress for each project
    const projectsWithProgress: ProjectWithProgress[] = activeProjects.map(project => {
        if (!taskType) {
            return { project, progress: 0, totalTasks: 0, completedTasks: 0 };
        }

        // Find tasks linked to this project
        const linkedTasks = objects.filter(obj => {
            if (obj.type !== taskType.id) return false;

            // Check if task has a relation to this project
            const projectProp = obj.properties.project || obj.properties.proyecto;
            if (!projectProp) return false;

            if (Array.isArray(projectProp)) {
                return projectProp.some((rel) => {
                    // Handle both string IDs and relation objects {id, title}
                    if (typeof rel === 'string') return rel === project.id;
                    if (typeof rel === 'object' && rel !== null && 'id' in rel) {
                        return (rel as { id: string }).id === project.id;
                    }
                    return false;
                });
            }
            return false;
        });

        const completedTasks = linkedTasks.filter(task => {
            const status = task.properties.status as string | undefined;
            return status === 'Completada' || status === 'Completado';
        }).length;

        const totalTasks = linkedTasks.length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return { project, progress, totalTasks, completedTasks };
    });

    // Sort: active first, then by progress
    const sortedProjects = [...projectsWithProgress].sort((a, b) => {
        if (!statusProp) return b.progress - a.progress;

        const statusA = a.project.properties[statusProp.id] as string | undefined;
        const statusB = b.project.properties[statusProp.id] as string | undefined;

        const isActiveA = statusA?.toLowerCase() === 'activo';
        const isActiveB = statusB?.toLowerCase() === 'activo';

        if (isActiveA && !isActiveB) return -1;
        if (!isActiveA && isActiveB) return 1;

        return b.progress - a.progress;
    }).slice(0, 5);

    const formatDeadline = (project: AstralObject) => {
        if (!deadlineProp) return null;

        const deadline = project.properties[deadlineProp.id];
        if (!deadline) return null;
        if (typeof deadline !== 'string' && !(deadline instanceof Date)) return null;

        const date = new Date(deadline as string | Date);
        if (isNaN(date.getTime())) return null;

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);

        // Only show VENCIDO when fecha límite is in the past (< today)
        if (diffDays < 0) return { text: `Vencido hace ${Math.abs(diffDays)}d`, isOverdue: true };
        if (diffDays === 0) return { text: 'Hoy', isOverdue: false };
        if (diffDays <= 7) return { text: `En ${diffDays}d`, isOverdue: false };
        return { text: date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }), isOverdue: false };
    };

    return (
        <div className="dashboard-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">
                        <LucideIcon name={projectType.icon || 'Target'} size={16} color={projectType.color} />
                    </span>
                    Proyectos Activos
                </h3>
                {activeProjects.length > 0 && (
                    <span className="dashboard-widget-count">
                        {activeProjects.length}
                    </span>
                )}
            </div>

            {sortedProjects.length === 0 ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">🚀</span>
                    <span className="dashboard-widget-empty-text">
                        Sin proyectos activos
                    </span>
                </div>
            ) : (
                <div className="dashboard-widget-list">
                    {sortedProjects.map(({ project, progress, totalTasks, completedTasks }) => {
                        const deadline = formatDeadline(project);
                        const status = project.properties.status as string | undefined;
                        const isPaused = status === 'En pausa';

                        return (
                            <div
                                key={project.id}
                                className="dashboard-widget-item"
                                onClick={() => onObjectClick(project.id)}
                                style={{ opacity: isPaused ? 0.7 : 1 }}
                            >
                                <span className="dashboard-widget-item-icon">
                                    <LucideIcon name={projectType.icon || 'Target'} size={16} color={projectType.color} />
                                </span>
                                <div className="dashboard-widget-item-content">
                                    <div className="dashboard-widget-item-title">
                                        {project.title}
                                        {isPaused && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', opacity: 0.7 }}>⏸</span>}
                                    </div>
                                    {totalTasks > 0 && (
                                        <div className="dashboard-project-progress">
                                            <div className="dashboard-project-progress-bar">
                                                <div
                                                    className="dashboard-project-progress-fill"
                                                    style={{
                                                        width: `${progress}%`,
                                                        background: progress === 100 ? 'var(--success)' : projectType.color || 'var(--accent-primary)'
                                                    }}
                                                />
                                            </div>
                                            <span className="dashboard-project-progress-text">
                                                {completedTasks}/{totalTasks}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {deadline && (
                                    <span
                                        className="dashboard-widget-item-badge"
                                        style={{
                                            background: deadline.isOverdue ? 'var(--error)' : 'var(--bg-hover)',
                                            color: deadline.isOverdue ? 'white' : 'var(--text-secondary)'
                                        }}
                                    >
                                        {deadline.text}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
