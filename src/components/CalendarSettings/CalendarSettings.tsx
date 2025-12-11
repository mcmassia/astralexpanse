// Calendar Settings Modal - Manage Google Calendar accounts and sync
import { useEffect } from 'react';
import { useCalendarStore } from '../../stores/calendarStore';
import type { GoogleCalendarAccount, GoogleCalendar } from '../../types/calendar';
import './CalendarSettings.css';

interface CalendarSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CalendarSettings = ({ isOpen, onClose }: CalendarSettingsProps) => {
    const {
        accounts,
        calendars,
        isSyncing,
        isLoadingCalendars,
        syncConfig,
        error,
        initialize,
        fetchCalendars,
        toggleCalendar,
        removeAccount,
        addSecondaryAccount,
    } = useCalendarStore();

    // Initialize on mount
    useEffect(() => {
        if (isOpen) {
            initialize();
        }
    }, [isOpen, initialize]);

    // Fetch calendars when accounts change
    useEffect(() => {
        if (isOpen) {
            accounts.forEach((account) => {
                if (!calendars[account.email]) {
                    fetchCalendars(account.email);
                }
            });
        }
    }, [isOpen, accounts, calendars, fetchCalendars]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Handle overlay click
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Handle calendar toggle
    const handleToggleCalendar = (accountEmail: string, calendarId: string) => {
        toggleCalendar(accountEmail, calendarId);
    };

    // Handle remove account
    const handleRemoveAccount = async (email: string) => {
        if (confirm('¿Estás seguro de que quieres desconectar esta cuenta?')) {
            await removeAccount(email);
        }
    };

    // Get total selected calendars count
    const totalSelected = Object.values(syncConfig.selectedCalendars).reduce(
        (sum, ids) => sum + ids.length,
        0
    );

    return (
        <div className="calendar-settings-overlay" onClick={handleOverlayClick}>
            <div className="calendar-settings-modal">
                <div className="calendar-settings-header">
                    <h2>📅 Calendarios de Google</h2>
                    <button className="calendar-settings-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="calendar-settings-content">
                    {/* Sync Status */}
                    {isSyncing && (
                        <div className="sync-status syncing">
                            <div className="sync-spinner" />
                            Sincronizando eventos...
                        </div>
                    )}

                    {/* Accounts Section */}
                    <div className="calendar-settings-section">
                        <h3>Cuentas conectadas</h3>

                        {accounts.length === 0 ? (
                            <div className="calendar-settings-empty">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <p>No hay cuentas conectadas</p>
                            </div>
                        ) : (
                            accounts.map((account) => (
                                <AccountCard
                                    key={account.email}
                                    account={account}
                                    calendars={calendars[account.email] || []}
                                    isLoading={isLoadingCalendars}
                                    onToggleCalendar={handleToggleCalendar}
                                    onRemove={handleRemoveAccount}
                                />
                            ))
                        )}

                        {/* Note about adding accounts */}
                        <div className="sync-status" style={{ marginTop: '1rem' }}>
                            💡 La cuenta principal se conecta automáticamente al iniciar sesión
                        </div>

                        {/* Add Secondary Account Button */}
                        <button
                            className="add-account-btn"
                            onClick={addSecondaryAccount}
                        >
                            + Conectar otra cuenta de Google
                        </button>

                        {/* Error Display */}
                        {error && (
                            <div className="sync-status" style={{ color: 'var(--error)', marginTop: '0.5rem' }}>
                                ⚠️ {error}
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    {totalSelected > 0 && (
                        <div className="sync-status">
                            ✓ {totalSelected} calendario{totalSelected !== 1 ? 's' : ''} seleccionado
                            {totalSelected !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Account Card Component
interface AccountCardProps {
    account: GoogleCalendarAccount;
    calendars: GoogleCalendar[];
    isLoading: boolean;
    onToggleCalendar: (accountEmail: string, calendarId: string) => void;
    onRemove: (email: string) => void;
}

const AccountCard = ({
    account,
    calendars,
    isLoading,
    onToggleCalendar,
    onRemove,
}: AccountCardProps) => {
    return (
        <div className="account-card">
            <div className="account-card-header">
                {account.photoUrl ? (
                    <img src={account.photoUrl} alt="" className="account-photo" />
                ) : (
                    <div className="account-photo-placeholder">
                        {account.name.charAt(0).toUpperCase()}
                    </div>
                )}

                <div className="account-info">
                    <div className="account-name">{account.name}</div>
                    <div className="account-email">{account.email}</div>
                </div>

                {account.isPrimary && <span className="account-badge">Principal</span>}

                {!account.isPrimary && (
                    <button
                        className="account-remove-btn"
                        onClick={() => onRemove(account.email)}
                        title="Desconectar cuenta"
                    >
                        🗑️
                    </button>
                )}
            </div>

            <div className="calendar-list">
                {isLoading ? (
                    <div className="calendar-list-loading">
                        <div className="sync-spinner" />
                        Cargando calendarios...
                    </div>
                ) : calendars.length === 0 ? (
                    <div className="calendar-list-loading">No hay calendarios disponibles</div>
                ) : (
                    calendars.map((calendar) => (
                        <div
                            key={calendar.id}
                            className="calendar-item"
                            onClick={() => onToggleCalendar(account.email, calendar.id)}
                        >
                            <div className={`calendar-checkbox ${calendar.selected ? 'checked' : ''}`} />
                            <div
                                className="calendar-color"
                                style={{ backgroundColor: calendar.color }}
                            />
                            <span className="calendar-name">{calendar.name}</span>
                            {calendar.isPrimary && (
                                <span className="calendar-primary-badge">Primario</span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
