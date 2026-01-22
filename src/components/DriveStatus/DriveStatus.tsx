// Drive connection status indicator component
import { useState, useEffect, useCallback } from 'react';
import { useDriveStore, useDriveConnectionStatus, usePendingSyncCount } from '../../stores/driveStore';
import { useObjectStore } from '../../stores/objectStore';
import { refreshGoogleAccessToken, getGoogleAccessTokenExpiration } from '../../services/firebase';
import { checkDriveConnection } from '../../services/drive';
import { PendingSyncPanel } from './PendingSyncPanel';
import './DriveStatus.css';


// Token lifetime is ~55 minutes (stored in firebase.ts)
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;

export const DriveStatus = () => {
    const connectionStatus = useDriveConnectionStatus();
    const pendingSyncCount = usePendingSyncCount();
    const setConnectionStatus = useDriveStore((s) => s.setConnectionStatus);
    const setTokenExpiration = useDriveStore((s) => s.setTokenExpiration);

    const [isReconnecting, setIsReconnecting] = useState(false);
    const [tokenPercentage, setTokenPercentage] = useState<number | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const selectObject = useObjectStore((s) => s.selectObject);

    // Check connection periodically
    useEffect(() => {
        const checkConnection = async () => {
            const result = await checkDriveConnection();
            if (result.connected) {
                const expiresAt = getGoogleAccessTokenExpiration();
                if (expiresAt) {
                    setTokenExpiration(expiresAt);
                }
            } else {
                setConnectionStatus('disconnected', result.error);
            }
        };

        // Check immediately
        checkConnection();

        // Check every 5 minutes
        const interval = setInterval(checkConnection, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [setConnectionStatus, setTokenExpiration]);

    // Update token percentage
    useEffect(() => {
        const updatePercentage = () => {
            const expiresAt = getGoogleAccessTokenExpiration();
            if (!expiresAt) {
                setTokenPercentage(null);
                return;
            }

            const remaining = expiresAt - Date.now();
            if (remaining <= 0) {
                setTokenPercentage(0);
                setConnectionStatus('disconnected', 'Token expired');
                return;
            }

            // Calculate percentage of time remaining
            const percentage = Math.round((remaining / TOKEN_LIFETIME_MS) * 100);
            setTokenPercentage(Math.min(100, Math.max(0, percentage)));
        };

        updatePercentage();
        // Update every 30 seconds for smooth progress
        const interval = setInterval(updatePercentage, 30000);
        return () => clearInterval(interval);
    }, [connectionStatus, setConnectionStatus]);

    const handleReconnect = useCallback(async () => {
        setIsReconnecting(true);
        setConnectionStatus('reconnecting');

        try {
            const result = await refreshGoogleAccessToken();
            if (result.success && result.expiresAt) {
                setTokenExpiration(result.expiresAt);
            } else {
                setConnectionStatus('error', 'No se pudo reconectar');
            }
        } catch (error) {
            setConnectionStatus('error', 'Error al reconectar');
        } finally {
            setIsReconnecting(false);
        }
    }, [setConnectionStatus, setTokenExpiration]);

    const getPercentageColor = () => {
        if (tokenPercentage === null) return 'var(--text-tertiary)';
        if (tokenPercentage > 50) return 'var(--success)';
        if (tokenPercentage > 20) return 'var(--warning)';
        return 'var(--error)';
    };

    const isDisconnected = connectionStatus === 'disconnected' || connectionStatus === 'error';
    const isSyncing = connectionStatus === 'syncing' || connectionStatus === 'reconnecting';

    return (
        <div
            className={`drive-status ${connectionStatus}`}
            title={isDisconnected ? 'Desconectado de Drive' : `Token válido: ${tokenPercentage ?? 0}%`}
        >
            {/* Show percentage or status */}
            {isSyncing ? (
                <span className="drive-status-syncing">🔄</span>
            ) : isDisconnected ? (
                <button
                    className="drive-reconnect-btn"
                    onClick={handleReconnect}
                    disabled={isReconnecting}
                >
                    {isReconnecting ? '...' : '⚠️ Reconectar'}
                </button>
            ) : (
                <span
                    className="drive-status-percentage"
                    style={{ color: getPercentageColor() }}
                >
                    ☁️ {tokenPercentage ?? '--'}%
                </span>
            )}

            {/* Pending sync badge - clickable */}
            {pendingSyncCount > 0 && !isDisconnected && (
                <button
                    className="drive-status-badge"
                    title={`${pendingSyncCount} pendiente(s) - Click para ver`}
                    onClick={() => setIsPanelOpen(true)}
                >
                    {pendingSyncCount}
                </button>
            )}

            {/* Pending sync panel */}
            {isPanelOpen && (
                <PendingSyncPanel
                    onClose={() => setIsPanelOpen(false)}
                    onSelectObject={selectObject}
                />
            )}
        </div>
    );
};

