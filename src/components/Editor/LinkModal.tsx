// LinkModal - Modal for inserting/editing links in the editor
import { useState, useEffect, useCallback, useRef } from 'react';
import './LinkModal.css';

export interface LinkModalProps {
    isOpen: boolean;
    initialUrl?: string;
    initialText?: string;
    hasSelection?: boolean;
    onConfirm: (url: string, text?: string) => void;
    onRemove?: () => void;
    onCancel: () => void;
}

export function LinkModal({
    isOpen,
    initialUrl = '',
    initialText = '',
    hasSelection = false,
    onConfirm,
    onRemove,
    onCancel
}: LinkModalProps) {
    const [url, setUrl] = useState(initialUrl);
    const [text, setText] = useState(initialText);
    const inputRef = useRef<HTMLInputElement>(null);

    const isEditing = !!initialUrl;

    useEffect(() => {
        if (isOpen) {
            setUrl(initialUrl);
            setText(initialText);
            // Focus the URL input when modal opens
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, initialUrl, initialText]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
        } else if (e.key === 'Enter' && url.trim()) {
            e.preventDefault();
            onConfirm(url.trim(), text.trim() || undefined);
        }
    }, [onCancel, onConfirm, url, text]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            onConfirm(url.trim(), text.trim() || undefined);
        }
    };

    const isValidUrl = (urlString: string) => {
        try {
            // Allow relative URLs and common protocols
            if (urlString.startsWith('/') || urlString.startsWith('#') || urlString.startsWith('mailto:')) {
                return true;
            }
            new URL(urlString);
            return true;
        } catch {
            // Try adding https://
            try {
                new URL('https://' + urlString);
                return urlString.includes('.');
            } catch {
                return false;
            }
        }
    };

    const urlIsValid = !url.trim() || isValidUrl(url.trim());

    return (
        <div className="link-modal-overlay" onClick={handleOverlayClick}>
            <div className="link-modal">
                <div className="link-modal__header">
                    <span className="link-modal__icon">🔗</span>
                    <h3 className="link-modal__title">
                        {isEditing ? 'Editar enlace' : 'Insertar enlace'}
                    </h3>
                </div>

                <form onSubmit={handleSubmit} className="link-modal__form">
                    <div className="link-modal__field">
                        <label htmlFor="link-url">URL</label>
                        <input
                            ref={inputRef}
                            id="link-url"
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://ejemplo.com"
                            className={!urlIsValid ? 'invalid' : ''}
                            autoComplete="off"
                        />
                        {!urlIsValid && (
                            <span className="link-modal__error">URL no válida</span>
                        )}
                    </div>

                    {!hasSelection && (
                        <div className="link-modal__field">
                            <label htmlFor="link-text">Texto del enlace (opcional)</label>
                            <input
                                id="link-text"
                                type="text"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Texto a mostrar"
                                autoComplete="off"
                            />
                        </div>
                    )}

                    <div className="link-modal__actions">
                        {isEditing && onRemove && (
                            <button
                                type="button"
                                className="link-modal__btn link-modal__btn--remove"
                                onClick={onRemove}
                            >
                                Eliminar enlace
                            </button>
                        )}
                        <div className="link-modal__actions-right">
                            <button
                                type="button"
                                className="link-modal__btn link-modal__btn--cancel"
                                onClick={onCancel}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="link-modal__btn link-modal__btn--confirm"
                                disabled={!url.trim() || !urlIsValid}
                            >
                                {isEditing ? 'Guardar' : 'Insertar'}
                            </button>
                        </div>
                    </div>
                </form>

                <div className="link-modal__shortcut">
                    <kbd>⌘K</kbd> para insertar enlace rápido
                </div>
            </div>
        </div>
    );
}
