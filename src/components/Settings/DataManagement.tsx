import React, { useState } from 'react';
import { useObjectStore } from '../../stores/objectStore';
import { objectToMarkdown } from '../../services/drive';
import JSZip from 'jszip';
import { Database, Download, FileJson, FileText, Loader2 } from 'lucide-react';
import './DataManagement.css';

export const DataManagement: React.FC = () => {
    const { objects, objectTypes } = useObjectStore();
    const [isExportingJson, setIsExportingJson] = useState(false);
    const [isExportingMd, setIsExportingMd] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const downloadFile = (content: string | Blob, fileName: string, contentType: string) => {
        const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportJson = async () => {
        setIsExportingJson(true);
        setStatus('Preparando JSON...');
        
        try {
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                objectTypes,
                objects
            };
            
            const jsonString = JSON.stringify(exportData, null, 2);
            downloadFile(jsonString, `astral_expanse_export_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
            setStatus('¡Exportación JSON completada!');
            setTimeout(() => setStatus(null), 3000);
        } catch (error) {
            console.error('Export failed:', error);
            setStatus('Error en la exportación');
        } finally {
            setIsExportingJson(false);
        }
    };

    const handleExportMarkdown = async () => {
        setIsExportingMd(true);
        setStatus('Generando archivos Markdown...');
        
        try {
            const zip = new JSZip();
            
            // Create folders for each type
            for (const obj of objects) {
                const typeInfo = objectTypes.find(t => t.id === obj.type);
                const folderName = typeInfo?.namePlural || obj.type;
                
                const markdown = objectToMarkdown(obj);
                const fileName = `${obj.title.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
                
                // Add to zip in appropriate folder
                zip.file(`${folderName}/${fileName}`, markdown);
            }
            
            setStatus('Comprimiendo archivo ZIP...');
            const content = await zip.generateAsync({ type: 'blob' });
            downloadFile(content, `astral_expanse_markdown_${new Date().toISOString().split('T')[0]}.zip`, 'application/zip');
            
            setStatus('¡Exportación Markdown completada!');
            setTimeout(() => setStatus(null), 3000);
        } catch (error) {
            console.error('Export failed:', error);
            setStatus('Error en la exportación');
        } finally {
            setIsExportingMd(false);
        }
    };

    return (
        <div className="data-management">
            <div className="data-management-header">
                <div className="header-title">
                    <Database className="icon-main" />
                    <h2>Gestión de Datos</h2>
                </div>
            </div>

            <div className="export-grid">
                {/* JSON Export */}
                <div className="export-card">
                    <h3><FileJson size={20} /> Exportar a JSON</h3>
                    <p>
                        Obtén una copia completa de toda tu información en formato JSON. 
                        Ideal para copias de seguridad técnicas o para importar en otras herramientas compatibles.
                    </p>
                    <button 
                        className="btn-export" 
                        onClick={handleExportJson}
                        disabled={isExportingJson || isExportingMd}
                    >
                        {isExportingJson ? <Loader2 className="animate-spin" /> : <Download size={18} />}
                        Exportar JSON
                    </button>
                </div>

                {/* Markdown Export */}
                <div className="export-card">
                    <h3><FileText size={20} /> Exportar Markdown (ZIP)</h3>
                    <p>
                        Exporta todas tus notas como archivos .md individuales. 
                        Los archivos se organizarán en carpetas por tipo y mantendrán su frontmatter YAML.
                    </p>
                    <button 
                        className="btn-export" 
                        onClick={handleExportMarkdown}
                        disabled={isExportingJson || isExportingMd}
                    >
                        {isExportingMd ? <Loader2 className="animate-spin" /> : <Download size={18} />}
                        Exportar ZIP
                    </button>
                </div>
            </div>

            {status && (
                <div className="export-status">
                    {status}
                </div>
            )}
        </div>
    );
};
