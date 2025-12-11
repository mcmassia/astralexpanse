// Import Modal component for Capacities import - Enhanced with History Panel
import { useState, useRef, useCallback, useEffect } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import {
    importFromCapacities,
    revertImport,
    type ImportOptions,
    type ImportProgress,
    type ImportResult,
    type CleanupResult
} from '../../services/capacitiesImporter';
import {
    saveImportHistory,
    getLastImportHistory,
    type ImportHistoryRecord
} from '../../services/db';
import './ImportModal.css';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ModalMode = 'import' | 'revert' | 'reverting';

export const ImportModal = ({ isOpen, onClose }: ImportModalProps) => {
    const [mode, setMode] = useState<ModalMode>('import');
    const [file, setFile] = useState<File | null>(null);
    const [options, setOptions] = useState<ImportOptions>({
        handleConflicts: 'merge',
        importMedia: true,
        convertHashtags: 'mentions'
    });
    const [progress, setProgress] = useState<ImportProgress | null>(null);
    const [revertProgress, setRevertProgress] = useState<{ phase: string; current: number; total: number; item?: string } | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [lastImport, setLastImport] = useState<ImportHistoryRecord | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const objectTypes = useObjectStore(s => s.objectTypes);
    const objects = useObjectStore(s => s.objects);
    const initialize = useObjectStore(s => s.initialize);

    // Count unsynced objects
    const unsyncedCount = objects.filter(o => !o.driveFileId).length;

    // Load last import history on mount
    useEffect(() => {
        if (isOpen) {
            getLastImportHistory().then(setLastImport).catch(console.error);
        }
    }, [isOpen]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.name.endsWith('.zip')) {
            setFile(selectedFile);
            setResult(null);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.name.endsWith('.zip')) {
            setFile(droppedFile);
            setResult(null);
        }
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleImport = async () => {
        if (!file) return;

        setIsImporting(true);
        setProgress({ phase: 'extracting', current: 0, total: 1 });

        try {
            const importResult = await importFromCapacities(
                file,
                objectTypes,
                objects,
                options,
                setProgress
            );
            setResult(importResult);

            // Save import history
            const historyRecord = await saveImportHistory({
                timestamp: new Date(),
                fileName: file.name,
                imported: importResult.imported,
                updated: importResult.updated,
                skipped: importResult.skipped,
                errors: importResult.errors,
                warnings: importResult.warnings,
                newTypes: importResult.newTypes.map(t => ({
                    id: t.id, name: t.name, icon: t.icon, color: t.color
                })),
                options
            });
            setLastImport(historyRecord);

            await initialize();
        } catch (error) {
            setResult({
                imported: 0,
                updated: 0,
                skipped: 0,
                errors: [(error as Error).message],
                newTypes: [],
                warnings: [],
                skippedItems: []
            });
        } finally {
            setIsImporting(false);
            setProgress(null);
        }
    };

    const handleRevert = async () => {
        setMode('reverting');
        setRevertProgress({ phase: 'objects', current: 0, total: unsyncedCount });

        try {
            const result = await revertImport(
                objects,
                objectTypes,
                (phase, current, total, item) => {
                    setRevertProgress({ phase, current, total, item });
                }
            );
            setCleanupResult(result);
            await initialize();
        } catch (error) {
            setCleanupResult({
                deletedObjects: 0,
                deletedTypes: 0,
                errors: [(error as Error).message]
            });
        }
    };

    const handleClose = () => {
        const canClose = !isImporting && (mode !== 'reverting' || cleanupResult !== null);
        if (canClose) {
            setMode('import');
            setFile(null);
            setResult(null);
            setCleanupResult(null);
            setProgress(null);
            setRevertProgress(null);
            onClose();
        }
    };

    const getPhaseLabel = (phase: string): string => {
        const labels: Record<string, string> = {
            extracting: 'Extrayendo ZIP...',
            parsing: 'Parseando archivos...',
            types: 'Procesando tipos...',
            objects: 'Procesando objetos...',
            links: 'Resolviendo enlaces...',
            media: 'Subiendo medios...',
            complete: 'Completado'
        };
        return labels[phase] || phase;
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('es-ES', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    };

    if (!isOpen) return null;

    return (
        <div className="import-modal-overlay" onClick={handleClose}>
            <div className="import-modal import-modal--wide" onClick={e => e.stopPropagation()}>
                <header className="import-modal-header">
                    <h2>📥 {mode === 'import' ? 'Importar desde Capacities' : 'Revertir Importación'}</h2>
                    <button className="close-btn" onClick={handleClose} disabled={isImporting || mode === 'reverting'}>×</button>
                </header>

                <div className="import-modal-body">
                    {/* Left Panel - Import Form */}
                    <div className="import-panel import-panel--main">
                        <div className="import-modal-content">
                            {/* Revert Mode */}
                            {mode === 'revert' && !cleanupResult && (
                                <div className="revert-confirm">
                                    <div className="revert-warning">
                                        <span className="warning-icon">⚠️</span>
                                        <h3>¿Revertir importación?</h3>
                                    </div>
                                    <p>
                                        Se eliminarán <strong>{unsyncedCount} objetos</strong> que no están sincronizados con Drive.
                                    </p>
                                    <p className="revert-note">
                                        También se eliminarán los tipos de objeto que queden vacíos.
                                    </p>
                                    <p className="revert-safe">
                                        ✅ Los objetos sincronizados con Drive están a salvo.
                                    </p>
                                </div>
                            )}

                            {/* Reverting Progress */}
                            {mode === 'reverting' && !cleanupResult && revertProgress && (
                                <div className="import-progress">
                                    <div className="progress-label">
                                        {revertProgress.phase === 'objects' ? 'Eliminando objetos...' : 'Limpiando tipos...'}
                                        {revertProgress.item && (
                                            <span className="progress-item">{revertProgress.item}</span>
                                        )}
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${(revertProgress.current / Math.max(revertProgress.total, 1)) * 100}%` }}
                                        />
                                    </div>
                                    <div className="progress-count">
                                        {revertProgress.current} / {revertProgress.total}
                                    </div>
                                </div>
                            )}

                            {/* Cleanup Result */}
                            {cleanupResult && (
                                <div className="import-results">
                                    <div className="results-summary">
                                        {cleanupResult.errors.length === 0 ? (
                                            <div className="result-success">
                                                <span className="result-icon">✅</span>
                                                <span>Limpieza completada</span>
                                            </div>
                                        ) : (
                                            <div className="result-error">
                                                <span className="result-icon">⚠️</span>
                                                <span>Limpieza con errores</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="results-stats">
                                        <div className="stat">
                                            <span className="stat-value">{cleanupResult.deletedObjects}</span>
                                            <span className="stat-label">Objetos eliminados</span>
                                        </div>
                                        <div className="stat">
                                            <span className="stat-value">{cleanupResult.deletedTypes}</span>
                                            <span className="stat-label">Tipos eliminados</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Import Mode */}
                            {mode === 'import' && !result && (
                                <>
                                    {/* Info about unsynced objects */}
                                    {unsyncedCount > 0 && (
                                        <div className="unsynced-warning">
                                            <span>⚠️ {unsyncedCount} objetos sin sincronizar</span>
                                            <button className="btn-link" onClick={() => setMode('revert')}>
                                                Revertir
                                            </button>
                                        </div>
                                    )}

                                    {/* File Drop Zone */}
                                    <div
                                        className={`drop-zone ${file ? 'has-file' : ''}`}
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".zip"
                                            onChange={handleFileSelect}
                                            style={{ display: 'none' }}
                                        />
                                        {file ? (
                                            <div className="file-info">
                                                <span className="file-icon">📦</span>
                                                <span className="file-name">{file.name}</span>
                                                <span className="file-size">
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="drop-prompt">
                                                <span className="drop-icon">📁</span>
                                                <span>Arrastra ZIP aquí</span>
                                                <span className="drop-hint">o clic para seleccionar</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Options */}
                                    <div className="import-options">
                                        <h3>Opciones</h3>

                                        <div className="option-group">
                                            <label>Conflictos:</label>
                                            <select
                                                value={options.handleConflicts}
                                                onChange={e => setOptions({ ...options, handleConflicts: e.target.value as ImportOptions['handleConflicts'] })}
                                            >
                                                <option value="merge">Fusionar (mantener + añadir)</option>
                                                <option value="overwrite">Sobreescribir (reemplazar todo)</option>
                                                <option value="skip">Omitir (mantener existente)</option>
                                                <option value="duplicate">Crear duplicado</option>
                                            </select>
                                        </div>

                                        <div className="option-group">
                                            <label>Hashtags:</label>
                                            <select
                                                value={options.convertHashtags}
                                                onChange={e => setOptions({ ...options, convertHashtags: e.target.value as ImportOptions['convertHashtags'] })}
                                            >
                                                <option value="mentions">Objetos tag</option>
                                                <option value="tags">Tags del objeto</option>
                                                <option value="plain">Texto plano</option>
                                            </select>
                                        </div>

                                        <div className="option-group checkbox">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={options.importMedia}
                                                    onChange={e => setOptions({ ...options, importMedia: e.target.checked })}
                                                />
                                                Importar medios
                                            </label>
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    {progress && (
                                        <div className="import-progress">
                                            <div className="progress-label">
                                                {getPhaseLabel(progress.phase)}
                                                {progress.currentItem && (
                                                    <span className="progress-item">{progress.currentItem}</span>
                                                )}
                                            </div>
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                                            </div>
                                            <div className="progress-count">{progress.current} / {progress.total}</div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Import Results */}
                            {mode === 'import' && result && (
                                <div className="import-results">
                                    <div className="results-summary">
                                        {result.errors.length === 0 ? (
                                            <div className="result-success">
                                                <span className="result-icon">✅</span>
                                                <span>Importación completada</span>
                                            </div>
                                        ) : (
                                            <div className="result-error">
                                                <span className="result-icon">❌</span>
                                                <span>Importación con errores</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="results-stats results-stats--compact">
                                        <div className="stat"><span className="stat-value">{result.imported}</span><span className="stat-label">Nuevos</span></div>
                                        <div className="stat"><span className="stat-value">{result.updated}</span><span className="stat-label">Actualizados</span></div>
                                        <div className="stat"><span className="stat-value">{result.skipped}</span><span className="stat-label">Omitidos</span></div>
                                        <div className="stat"><span className="stat-value">{result.newTypes.length}</span><span className="stat-label">Tipos</span></div>
                                    </div>

                                    {/* Skipped Items */}
                                    {result.skippedItems && result.skippedItems.length > 0 && (
                                        <div className="results-section skipped">
                                            <h4>⏭️ Omitidos ({result.skippedItems.length})</h4>
                                            <ul className="results-list results-list--scrollable">
                                                {result.skippedItems.map((item, i) => (
                                                    <li key={i}>
                                                        <strong>{item.title}</strong>
                                                        <span className="skip-reason">{item.reason}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Warnings - show all */}
                                    {result.warnings.length > 0 && (
                                        <div className="results-section warnings">
                                            <h4>⚠️ Advertencias ({result.warnings.length})</h4>
                                            <ul className="results-list results-list--scrollable">
                                                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Errors - show all */}
                                    {result.errors.length > 0 && (
                                        <div className="results-section errors">
                                            <h4>❌ Errores ({result.errors.length})</h4>
                                            <ul className="results-list results-list--scrollable">
                                                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <footer className="import-modal-footer">
                            {mode === 'import' && !result && (
                                <>
                                    <button className="btn-secondary" onClick={handleClose} disabled={isImporting}>Cancelar</button>
                                    <button className="btn-primary" onClick={handleImport} disabled={!file || isImporting}>
                                        {isImporting ? 'Importando...' : 'Importar'}
                                    </button>
                                </>
                            )}
                            {mode === 'import' && result && <button className="btn-primary" onClick={handleClose}>Cerrar</button>}
                            {mode === 'revert' && !cleanupResult && (
                                <>
                                    <button className="btn-secondary" onClick={() => setMode('import')}>Cancelar</button>
                                    <button className="btn-danger" onClick={handleRevert}>🗑️ Eliminar {unsyncedCount}</button>
                                </>
                            )}
                            {(mode === 'reverting' || cleanupResult) && (
                                <button className="btn-primary" onClick={handleClose} disabled={mode === 'reverting' && !cleanupResult}>Cerrar</button>
                            )}
                        </footer>
                    </div>

                    {/* Right Panel - History */}
                    <div className="import-panel import-panel--sidebar">
                        <div className="history-panel">
                            <h3>📋 Última importación</h3>

                            {lastImport ? (
                                <div className="history-content">
                                    <div className="history-meta">
                                        <span className="history-date">{formatDate(lastImport.timestamp)}</span>
                                        <span className="history-file">{lastImport.fileName}</span>
                                    </div>

                                    <div className="history-stats">
                                        <div className="history-stat">
                                            <span className="history-stat-value">{lastImport.imported}</span>
                                            <span className="history-stat-label">Importados</span>
                                        </div>
                                        <div className="history-stat">
                                            <span className="history-stat-value">{lastImport.updated}</span>
                                            <span className="history-stat-label">Actualizados</span>
                                        </div>
                                        <div className="history-stat">
                                            <span className="history-stat-value">{lastImport.skipped}</span>
                                            <span className="history-stat-label">Omitidos</span>
                                        </div>
                                    </div>

                                    {lastImport.newTypes.length > 0 && (
                                        <div className="history-section">
                                            <h4>Tipos creados</h4>
                                            <div className="history-types">
                                                {lastImport.newTypes.map(t => (
                                                    <span key={t.id} className="history-type-badge" style={{ background: t.color }}>
                                                        {t.icon} {t.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {lastImport.warnings.length > 0 && (
                                        <div className="history-section">
                                            <h4>⚠️ {lastImport.warnings.length} advertencias</h4>
                                            <ul className="history-list">
                                                {lastImport.warnings.slice(0, 3).map((w, i) => <li key={i}>{w}</li>)}
                                                {lastImport.warnings.length > 3 && <li className="more">...</li>}
                                            </ul>
                                        </div>
                                    )}

                                    {lastImport.errors.length > 0 && (
                                        <div className="history-section history-section--errors">
                                            <h4>❌ {lastImport.errors.length} errores</h4>
                                            <ul className="history-list">
                                                {lastImport.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="history-options">
                                        <h4>Opciones usadas</h4>
                                        <div className="history-option">
                                            <span>Conflictos:</span>
                                            <span>{lastImport.options.handleConflicts}</span>
                                        </div>
                                        <div className="history-option">
                                            <span>Hashtags:</span>
                                            <span>{lastImport.options.convertHashtags}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="history-empty">
                                    <span className="history-empty-icon">📭</span>
                                    <p>No hay importaciones previas</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};
