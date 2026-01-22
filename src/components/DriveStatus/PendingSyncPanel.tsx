// Panel showing documents not synced with Drive
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useObjectStore } from '../../stores/objectStore';
import { LucideIcon } from '../common/IconPicker';
import { RefreshCw } from 'lucide-react';
import './PendingSyncPanel.css';

interface PendingSyncPanelProps {
    onClose: () => void;
    onSelectObject: (id: string) => void;
}

export const PendingSyncPanel = ({ onClose, onSelectObject }: PendingSyncPanelProps) => {
    const objects = useObjectStore((s) => s.objects);
    const objectTypes = useObjectStore((s) => s.objectTypes);
    const syncObjectToDrive = useObjectStore((s) => s.syncObjectToDrive);

    const [isSyncingAll, setIsSyncingAll] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

    // Get objects that don't have a driveFileId (not synced to Drive)
    const unsyncedObjects = objects.filter((obj) => !obj.driveFileId);

    const getObjectType = (typeId: string) => {
        return objectTypes.find((t) => t.id === typeId);
    };

    const handleItemClick = (id: string) => {
        onSelectObject(id);
        onClose();
    };

    const handleSyncAll = async () => {
        if (isSyncingAll || unsyncedObjects.length === 0) return;

        setIsSyncingAll(true);
        setSyncProgress({ current: 0, total: unsyncedObjects.length });

        try {
            for (let i = 0; i < unsyncedObjects.length; i++) {
                const obj = unsyncedObjects[i];
                setSyncProgress({ current: i + 1, total: unsyncedObjects.length });

                try {
                    await syncObjectToDrive(obj.id);
                } catch (error) {
                    console.error(`[Sync All] Error syncing ${obj.title}:`, error);
                    // Continue with next object even if one fails
                }
            }
        } finally {
            setIsSyncingAll(false);
            setSyncProgress({ current: 0, total: 0 });
        }
    };

    const panelContent = (
        <>
            {/* Click-outside overlay */}
            <div className="pending-sync-overlay" onClick={onClose} />

            <div className="pending-sync-panel">
                <div className="pending-sync-panel-header">
                    <h4>📤 Sin sincronizar ({unsyncedObjects.length})</h4>
                    <div className="pending-sync-header-actions">
                        {unsyncedObjects.length > 0 && (
                            <button
                                className="pending-sync-all-btn"
                                onClick={handleSyncAll}
                                disabled={isSyncingAll}
                                title="Sincronizar todos"
                            >
                                <RefreshCw size={14} className={isSyncingAll ? 'spinning' : ''} />
                                {isSyncingAll
                                    ? `${syncProgress.current}/${syncProgress.total}`
                                    : 'Sincronizar'
                                }
                            </button>
                        )}
                        <button className="pending-sync-panel-close" onClick={onClose}>
                            ✕
                        </button>
                    </div>
                </div>

                <div className="pending-sync-panel-list">
                    {unsyncedObjects.length === 0 ? (
                        <div className="pending-sync-panel-empty">
                            ✅ Todos los documentos están sincronizados
                        </div>
                    ) : (
                        unsyncedObjects.map((obj) => {
                            const objType = getObjectType(obj.type);
                            return (
                                <div
                                    key={obj.id}
                                    className="pending-sync-item"
                                    onClick={() => handleItemClick(obj.id)}
                                >
                                    <span
                                        className="pending-sync-item-icon"
                                        style={{ color: objType?.color || 'var(--text-tertiary)' }}
                                    >
                                        <LucideIcon
                                            name={objType?.icon || 'FileText'}
                                            size={16}
                                            color={objType?.color || 'var(--text-tertiary)'}
                                        />
                                    </span>
                                    <div className="pending-sync-item-info">
                                        <div className="pending-sync-item-title">
                                            {obj.title || 'Sin título'}
                                        </div>
                                        <div className="pending-sync-item-type">
                                            {objType?.name || obj.type}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );

    // Use portal to render at document body level to avoid z-index issues
    return createPortal(panelContent, document.body);
};
