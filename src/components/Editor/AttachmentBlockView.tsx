// AttachmentBlockView - React component for rendering attachment blocks in the editor
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
    FileText,
    Book,
    Presentation,
    Video,
    Music,
    Image,
    FileArchive,
    FileSpreadsheet,
    File,
    ExternalLink,
    Download,
    Trash2,
} from 'lucide-react';
import { getAttachmentTypeInfo, formatFileSize, getDriveViewUrl, getDriveDownloadUrl } from '../../services/drive';
import './AttachmentBlockView.css';

// Icon component mapping
const iconComponents: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
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

export function AttachmentBlockView({ node, deleteNode, selected }: NodeViewProps) {
    const { fileId, fileName, mimeType, size } = node.attrs;

    const { icon, label } = getAttachmentTypeInfo(mimeType);
    const IconComponent = iconComponents[icon] || File;

    const handleOpenInDrive = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const url = getDriveViewUrl(fileId);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const url = getDriveDownloadUrl(fileId);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        deleteNode();
    };

    return (
        <NodeViewWrapper className={`attachment-block ${selected ? 'selected' : ''}`} contentEditable={false}>
            <div className="attachment-block-content">
                <div className="attachment-block-icon">
                    <IconComponent size={24} />
                </div>
                <div className="attachment-block-info">
                    <div className="attachment-block-name" title={fileName}>
                        {fileName}
                    </div>
                    <div className="attachment-block-meta">
                        <span className="attachment-block-type">{label}</span>
                        <span className="attachment-block-separator">•</span>
                        <span className="attachment-block-size">{formatFileSize(size)}</span>
                    </div>
                </div>
                <div className="attachment-block-actions">
                    <button
                        className="attachment-block-btn"
                        onClick={handleOpenInDrive}
                        title="Abrir en Drive"
                    >
                        <ExternalLink size={14} />
                    </button>
                    <button
                        className="attachment-block-btn"
                        onClick={handleDownload}
                        title="Descargar"
                    >
                        <Download size={14} />
                    </button>
                    <button
                        className="attachment-block-btn delete"
                        onClick={handleDelete}
                        title="Eliminar del contenido"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </NodeViewWrapper>
    );
}
