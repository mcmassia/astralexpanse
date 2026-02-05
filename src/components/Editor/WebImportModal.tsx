import { useState, useRef, useEffect } from 'react';
import './LinkModal.css'; // Reusing existing styles

interface WebImportModalProps {
    isOpen: boolean;
    onConfirm: (url: string) => void;
    onCancel: () => void;
    isProcessing?: boolean;
}

export function WebImportModal({ isOpen, onConfirm, onCancel, isProcessing = false }: WebImportModalProps) {
    const [url, setUrl] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setUrl('');
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            onConfirm(url.trim());
        }
    };

    if (!isOpen) return null;

    return (
        <div className="link-modal-overlay" onClick={onCancel}>
            <div className="link-modal" onClick={e => e.stopPropagation()}>
                <div className="link-modal__header">
                    <span className="link-modal__icon">🌐</span>
                    <h3 className="link-modal__title">Importar desde Web</h3>
                </div>

                <form className="link-modal__form" onSubmit={handleSubmit}>
                    <div className="link-modal__field">
                        <label htmlFor="web-url">URL de la página</label>
                        <input
                            id="web-url"
                            ref={inputRef}
                            type="url"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            placeholder="https://ejemplo.com/articulo"
                            disabled={isProcessing}
                            required
                        />
                    </div>

                    <div className="link-modal__actions">
                        <button
                            type="button"
                            className="link-modal__btn link-modal__btn--cancel"
                            onClick={onCancel}
                            disabled={isProcessing}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="link-modal__btn link-modal__btn--confirm"
                            disabled={!url.trim() || isProcessing}
                        >
                            {isProcessing ? 'Procesando...' : 'Importar'}
                        </button>
                    </div>
                </form>

                <div className="link-modal__shortcut">
                    La IA resumirá el contenido y añadirá un enlace.
                </div>
            </div>
        </div>
    );
}
