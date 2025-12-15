// ImageModal - Modal for inserting images by URL
import { useState, useEffect, useRef } from 'react';

interface ImageModalProps {
    isOpen: boolean;
    onConfirm: (url: string, alt?: string) => void;
    onCancel: () => void;
}

export const ImageModal = ({ isOpen, onConfirm, onCancel }: ImageModalProps) => {
    const [url, setUrl] = useState('');
    const [alt, setAlt] = useState('');
    const [previewError, setPreviewError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setUrl('');
            setAlt('');
            setPreviewError(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            onConfirm(url.trim(), alt.trim() || undefined);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancel} onKeyDown={handleKeyDown}>
            <div className="image-modal" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h3>Insertar imagen</h3>
                    <button className="modal-close" onClick={onCancel}>✕</button>
                </header>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label htmlFor="image-url">URL de la imagen</label>
                            <input
                                ref={inputRef}
                                id="image-url"
                                type="url"
                                value={url}
                                onChange={e => {
                                    setUrl(e.target.value);
                                    setPreviewError(false);
                                }}
                                placeholder="https://ejemplo.com/imagen.jpg"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="image-alt">Texto alternativo (opcional)</label>
                            <input
                                id="image-alt"
                                type="text"
                                value={alt}
                                onChange={e => setAlt(e.target.value)}
                                placeholder="Descripción de la imagen"
                            />
                        </div>

                        {/* Preview */}
                        {url && (
                            <div className="image-preview">
                                {previewError ? (
                                    <div className="preview-error">No se pudo cargar la imagen</div>
                                ) : (
                                    <img
                                        src={url}
                                        alt="Preview"
                                        onError={() => setPreviewError(true)}
                                        onLoad={() => setPreviewError(false)}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    <footer className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onCancel}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={!url.trim() || previewError}>
                            Insertar
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};
