// AttachmentsPanel - Display and manage object attachments
import { useState, useRef, useCallback } from 'react';
import {
    ChevronRight,
    Paperclip,
    Upload,
    ExternalLink,
    Download,
    Trash2,
    FileText,
    Book,
    Presentation,
    Video,
    Music,
    Image,
    FileArchive,
    File,
    FileSpreadsheet,
    AlertCircle,
} from 'lucide-react';
import type { AstralObject, Attachment } from '../../types/object';
import {
    uploadFileToDrive,
    deleteAttachmentFromDrive,
    getAttachmentTypeInfo,
    formatFileSize,
    isDriveConnected,
    getDriveViewUrl,
    getDriveDownloadUrl,
} from '../../services/drive';
import './AttachmentsPanel.css';

interface AttachmentsPanelProps {
    object: AstralObject;
    onUpdate: (updates: Partial<AstralObject>) => void;
}

// Icon component mapping
const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
    FileText,
    Book,
    Presentation,
    Video,
    Music,
    Image,
    FileArchive,
    FileSpreadsheet,
    File,
};

export function AttachmentsPanel({ object, onUpdate }: AttachmentsPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const attachments = object.attachments || [];

    const handleFileSelect = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        if (!isDriveConnected()) {
            setError('Debes conectar Google Drive para subir archivos');
            return;
        }

        setError(null);
        setIsUploading(true);

        try {
            const newAttachments: Attachment[] = [];

            for (const file of Array.from(files)) {
                const driveAttachment = await uploadFileToDrive(file);
                newAttachments.push({
                    id: driveAttachment.id,
                    fileId: driveAttachment.fileId,
                    fileName: driveAttachment.fileName,
                    mimeType: driveAttachment.mimeType,
                    size: driveAttachment.size,
                    url: driveAttachment.url,
                    uploadedAt: driveAttachment.uploadedAt,
                });
            }

            onUpdate({
                attachments: [...attachments, ...newAttachments],
            });
        } catch (err) {
            console.error('Error uploading file:', err);
            setError(err instanceof Error ? err.message : 'Error al subir el archivo');
        } finally {
            setIsUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [attachments, onUpdate]);

    const handleDelete = useCallback(async (attachmentToDelete: Attachment) => {
        try {
            // Delete from Drive
            await deleteAttachmentFromDrive(attachmentToDelete.fileId);

            // Remove from attachments list
            onUpdate({
                attachments: attachments.filter(a => a.id !== attachmentToDelete.id),
            });
        } catch (err) {
            console.error('Error deleting attachment:', err);
            setError(err instanceof Error ? err.message : 'Error al eliminar el archivo');
        }
    }, [attachments, onUpdate]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    }, [handleFileSelect]);

    const openInDrive = useCallback((fileId: string) => {
        const url = getDriveViewUrl(fileId);
        window.open(url, '_blank', 'noopener,noreferrer');
    }, []);

    const downloadFile = useCallback((fileId: string) => {
        const url = getDriveDownloadUrl(fileId);
        window.open(url, '_blank', 'noopener,noreferrer');
    }, []);

    const getIconComponent = (mimeType: string) => {
        const { icon } = getAttachmentTypeInfo(mimeType);
        return iconComponents[icon] || File;
    };

    return (
        <div className={`attachments-panel ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="attachments-title" onClick={() => setIsCollapsed(!isCollapsed)}>
                <span className={`attachments-chevron ${!isCollapsed ? 'expanded' : ''}`}>
                    <ChevronRight size={10} />
                </span>
                <Paperclip size={12} />
                <span>Adjuntos</span>
                <span className="attachments-count">{attachments.length}</span>
            </div>

            {!isCollapsed && (
                <div className="attachments-content">
                    {error && (
                        <div className="attachment-error">
                            <AlertCircle />
                            <span>{error}</span>
                        </div>
                    )}

                    {attachments.length > 0 && (
                        <div className="attachments-list">
                            {attachments.map(attachment => {
                                const IconComponent = getIconComponent(attachment.mimeType);
                                const { label } = getAttachmentTypeInfo(attachment.mimeType);

                                return (
                                    <div key={attachment.id} className="attachment-item">
                                        <div className="attachment-icon">
                                            <IconComponent />
                                        </div>
                                        <div className="attachment-info">
                                            <div className="attachment-name" title={attachment.fileName}>
                                                {attachment.fileName}
                                            </div>
                                            <div className="attachment-meta">
                                                <span>{label}</span>
                                                <span>•</span>
                                                <span>{formatFileSize(attachment.size)}</span>
                                            </div>
                                        </div>
                                        <div className="attachment-actions">
                                            <button
                                                className="attachment-action-btn"
                                                onClick={() => openInDrive(attachment.fileId)}
                                                title="Abrir en Drive"
                                            >
                                                <ExternalLink />
                                            </button>
                                            <button
                                                className="attachment-action-btn"
                                                onClick={() => downloadFile(attachment.fileId)}
                                                title="Descargar"
                                            >
                                                <Download />
                                            </button>
                                            <button
                                                className="attachment-action-btn delete"
                                                onClick={() => handleDelete(attachment)}
                                                title="Eliminar"
                                            >
                                                <Trash2 />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div
                        className={`attachment-dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="dropzone-input"
                            onChange={(e) => handleFileSelect(e.target.files)}
                            onClick={(e) => e.stopPropagation()}
                            multiple
                        />
                        {isUploading ? (
                            <div className="upload-progress">
                                <div className="upload-spinner" />
                                <span className="upload-text">Subiendo archivo...</span>
                            </div>
                        ) : (
                            <div className="dropzone-content">
                                <Upload className="dropzone-icon" />
                                <span className="dropzone-text">
                                    Arrastra archivos aquí o haz clic para seleccionar
                                </span>
                                <span className="dropzone-hint">
                                    PDF, imágenes, videos, documentos y más
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
