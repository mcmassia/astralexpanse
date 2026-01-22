// Panel showing pending sync documents
import { useObjectStore } from '../../stores/objectStore';
import { usePendingSyncIds } from '../../stores/driveStore';
import './PendingSyncPanel.css';

interface PendingSyncPanelProps {
    onClose: () => void;
    onSelectObject: (id: string) => void;
}

export const PendingSyncPanel = ({ onClose, onSelectObject }: PendingSyncPanelProps) => {
    const pendingIds = usePendingSyncIds();
    const objects = useObjectStore((s) => s.objects);
    const objectTypes = useObjectStore((s) => s.objectTypes);

    // Get pending objects with their details
    const pendingObjects = pendingIds
        .map((id) => objects.find((o) => o.id === id))
        .filter((obj): obj is NonNullable<typeof obj> => obj !== undefined);

    const getObjectTypeIcon = (typeId: string) => {
        const type = objectTypes.find((t) => t.id === typeId);
        return type?.icon || '📄';
    };

    const getObjectTypeName = (typeId: string) => {
        const type = objectTypes.find((t) => t.id === typeId);
        return type?.name || typeId;
    };

    const handleItemClick = (id: string) => {
        onSelectObject(id);
        onClose();
    };

    return (
        <>
            {/* Click-outside overlay */}
            <div className="pending-sync-overlay" onClick={onClose} />

            <div className="pending-sync-panel">
                <div className="pending-sync-panel-header">
                    <h4>📤 Pendientes de sincronizar</h4>
                    <button className="pending-sync-panel-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="pending-sync-panel-list">
                    {pendingObjects.length === 0 ? (
                        <div className="pending-sync-panel-empty">
                            No hay documentos pendientes
                        </div>
                    ) : (
                        pendingObjects.map((obj) => (
                            <div
                                key={obj.id}
                                className="pending-sync-item"
                                onClick={() => handleItemClick(obj.id)}
                            >
                                <span className="pending-sync-item-icon">
                                    {getObjectTypeIcon(obj.type)}
                                </span>
                                <div className="pending-sync-item-info">
                                    <div className="pending-sync-item-title">
                                        {obj.title || 'Sin título'}
                                    </div>
                                    <div className="pending-sync-item-type">
                                        {getObjectTypeName(obj.type)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};
