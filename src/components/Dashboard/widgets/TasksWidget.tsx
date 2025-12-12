// Tasks Widget - Shows tasks grouped by due date
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface TasksWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

interface TaskGroup {
    label: string;
    tasks: AstralObject[];
    isOverdue?: boolean;
}

export const TasksWidget = ({ objects, objectTypes, onObjectClick }: TasksWidgetProps) => {
    // Find task type (by name 'tarea' or id 'task')
    const taskType = objectTypes.find(t =>
        t.name.toLowerCase() === 'tarea' || t.id === 'task'
    );

    if (!taskType) {
        return (
            <div className="dashboard-widget">
                <div className="dashboard-widget-header">
                    <h3 className="dashboard-widget-title">
                        <span className="dashboard-widget-icon">✅</span>
                        Tareas
                    </h3>
                </div>
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">⚠️</span>
                    <span className="dashboard-widget-empty-text">
                        Tipo "Tarea" no configurado
                    </span>
                </div>
            </div>
        );
    }

    // Get all tasks
    const allTasks = objects.filter(obj => obj.type === taskType.id);

    // Filter out completed tasks
    const pendingTasks = allTasks.filter(task => {
        const status = task.properties.status as string | undefined;
        return status !== 'Completada' && status !== 'Completado';
    });

    // Get today's date bounds
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const in5Days = new Date(today);
    in5Days.setDate(in5Days.getDate() + 5);

    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Categorize tasks
    const groups: TaskGroup[] = [];

    const overdue: AstralObject[] = [];
    const todayTasks: AstralObject[] = [];
    const upcoming: AstralObject[] = [];

    pendingTasks.forEach(task => {
        const dueDateValue = task.properties.dueDate || task.properties.fecha || task.properties.date;
        if (!dueDateValue) {
            // Tasks without due date go to today
            todayTasks.push(task);
            return;
        }

        const dueDate = new Date(dueDateValue as string | Date);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate < today && dueDate >= oneWeekAgo) {
            overdue.push(task);
        } else if (dueDate.getTime() === today.getTime()) {
            todayTasks.push(task);
        } else if (dueDate > today && dueDate <= in5Days) {
            upcoming.push(task);
        }
    });

    if (overdue.length > 0) {
        overdue.sort((a, b) => {
            const dateA = new Date(a.properties.dueDate || a.properties.fecha || a.properties.date as string);
            const dateB = new Date(b.properties.dueDate || b.properties.fecha || b.properties.date as string);
            return dateA.getTime() - dateB.getTime();
        });
        groups.push({ label: 'Vencidas', tasks: overdue, isOverdue: true });
    }

    if (todayTasks.length > 0) {
        groups.push({ label: 'Hoy', tasks: todayTasks });
    }

    if (upcoming.length > 0) {
        upcoming.sort((a, b) => {
            const dateA = new Date(a.properties.dueDate || a.properties.fecha || a.properties.date as string);
            const dateB = new Date(b.properties.dueDate || b.properties.fecha || b.properties.date as string);
            return dateA.getTime() - dateB.getTime();
        });
        groups.push({ label: 'Próximos 5 días', tasks: upcoming });
    }

    const totalTasks = overdue.length + todayTasks.length + upcoming.length;

    const formatDueDate = (task: AstralObject) => {
        const dueDateValue = task.properties.dueDate || task.properties.fecha || task.properties.date;
        if (!dueDateValue) return '';

        const date = new Date(dueDateValue as string | Date);
        return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    };

    return (
        <div className="dashboard-widget">
            <div className="dashboard-widget-header">
                <h3 className="dashboard-widget-title">
                    <span className="dashboard-widget-icon">
                        <LucideIcon name={taskType.icon || 'CheckCircle'} size={16} color={taskType.color} />
                    </span>
                    Tareas
                </h3>
                {totalTasks > 0 && (
                    <span className={`dashboard-widget-count ${overdue.length > 0 ? 'dashboard-widget-count--error' : ''}`}>
                        {totalTasks}
                    </span>
                )}
            </div>

            {groups.length === 0 ? (
                <div className="dashboard-widget-empty">
                    <span className="dashboard-widget-empty-icon">🎉</span>
                    <span className="dashboard-widget-empty-text">
                        ¡Sin tareas pendientes!
                    </span>
                </div>
            ) : (
                <div className="dashboard-widget-list">
                    {groups.map(group => (
                        <div key={group.label} className="dashboard-task-group">
                            <div className={`dashboard-task-group-title ${group.isOverdue ? 'dashboard-task-group-title--overdue' : ''}`}>
                                {group.isOverdue && '⚠️'} {group.label}
                                <span className="dashboard-widget-count" style={{ marginLeft: 'auto', fontSize: '0.65rem', minWidth: 'unset', padding: '0 0.25rem', height: '1.25rem' }}>
                                    {group.tasks.length}
                                </span>
                            </div>
                            {group.tasks.slice(0, 5).map(task => (
                                <div
                                    key={task.id}
                                    className="dashboard-widget-item"
                                    onClick={() => onObjectClick(task.id)}
                                >
                                    <div className="dashboard-task-checkbox" />
                                    <div className="dashboard-widget-item-content">
                                        <div className="dashboard-widget-item-title">
                                            {task.title}
                                        </div>
                                        <div className="dashboard-widget-item-meta">
                                            {formatDueDate(task)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {group.tasks.length > 5 && (
                                <div className="dashboard-widget-more" style={{ marginTop: '0.25rem' }}>
                                    +{group.tasks.length - 5} más
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
