// Panel showing documents not synced with Drive
import { createPortal } from 'react-dom';
import { useObjectStore } from '../../stores/objectStore';
import './PendingSyncPanel.css';

interface PendingSyncPanelProps {
    onClose: () => void;
    onSelectObject: (id: string) => void;
}

export const PendingSyncPanel = ({ onClose, onSelectObject }: PendingSyncPanelProps) => {
    const objects = useObjectStore((s) => s.objects);
    const objectTypes = useObjectStore((s) => s.objectTypes);

    // Get objects that don't have a driveFileId (not synced to Drive)
    const unsyncedObjects = objects.filter((obj) => !obj.driveFileId);

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

    const panelContent = (
        <>
            {/* Click-outside overlay */}
            <div className="pending-sync-overlay" onClick={onClose} />

            <div className="pending-sync-panel">
                <div className="pending-sync-panel-header">
                    <h4>📤 Sin sincronizar ({unsyncedObjects.length})</h4>
                    <button className="pending-sync-panel-close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="pending-sync-panel-list">
                    {unsyncedObjects.length === 0 ? (
                        <div className="pending-sync-panel-empty">
                            ✅ Todos los documentos están sincronizados
                        </div>
                    ) : (
                        unsyncedObjects.map((obj) => (
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

    // Use portal to render at document body level to avoid z-index issues
    return createPortal(panelContent, document.body);
};
