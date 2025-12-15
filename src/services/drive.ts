// Google Drive service for file sync
import { getGoogleAccessToken, isGoogleAccessTokenExpired } from './firebase';
import type { AstralObject } from '../types/object';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const ASTRAL_FOLDER_NAME = 'Astral Expanse';

let rootFolderId: string | null = null;
const typeFolderCache: Record<string, string> = {};

// Custom error for authentication issues
export class DriveAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DriveAuthError';
    }
}

// Helper for authenticated fetch
const driveFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = getGoogleAccessToken();
    if (!token) {
        throw new DriveAuthError('No Google access token available. Please reconnect to Drive.');
    }

    // Check if token is expired before making request
    if (isGoogleAccessTokenExpired()) {
        throw new DriveAuthError('Google access token has expired. Please reconnect to Drive.');
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        },
    });

    // Handle authentication errors specifically
    if (response.status === 401 || response.status === 403) {
        const error = await response.json().catch(() => ({}));
        throw new DriveAuthError(error.error?.message || 'Authentication failed. Please reconnect to Drive.');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Drive API error: ${response.status}`);
    }

    return response;
};

// Check if Drive connection is valid
export const checkDriveConnection = async (): Promise<{ connected: boolean; error?: string }> => {
    const token = getGoogleAccessToken();
    if (!token) {
        return { connected: false, error: 'No token available' };
    }

    if (isGoogleAccessTokenExpired()) {
        return { connected: false, error: 'Token expired' };
    }

    try {
        // Make a lightweight API call to verify the token
        const response = await fetch(`${DRIVE_API_BASE}/about?fields=user`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
            return { connected: true };
        }

        if (response.status === 401 || response.status === 403) {
            return { connected: false, error: 'Token invalid or expired' };
        }

        return { connected: false, error: `API error: ${response.status}` };
    } catch (error) {
        return { connected: false, error: 'Network error' };
    }
};

// Get or create the root Astral Expanse folder
export const getOrCreateRootFolder = async (): Promise<string> => {
    if (rootFolderId) return rootFolderId;

    // Search for existing folder
    const searchUrl = `${DRIVE_API_BASE}/files?q=name='${ASTRAL_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`;
    const searchResponse = await driveFetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.files?.length > 0) {
        rootFolderId = searchData.files[0].id;
        return rootFolderId!;
    }

    // Create new folder
    const createResponse = await driveFetch(`${DRIVE_API_BASE}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: ASTRAL_FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder',
        }),
    });

    const createData = await createResponse.json();
    rootFolderId = createData.id;
    return rootFolderId!;
};

// Get or create a type-specific subfolder
export const getOrCreateTypeFolder = async (typeName: string): Promise<string> => {
    if (typeFolderCache[typeName]) return typeFolderCache[typeName];

    const parentId = await getOrCreateRootFolder();

    // Search for existing type folder
    const searchUrl = `${DRIVE_API_BASE}/files?q=name='${typeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`;
    const searchResponse = await driveFetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.files?.length > 0) {
        typeFolderCache[typeName] = searchData.files[0].id;
        return typeFolderCache[typeName];
    }

    // Create new type folder
    const createResponse = await driveFetch(`${DRIVE_API_BASE}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: typeName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        }),
    });

    const createData = await createResponse.json();
    typeFolderCache[typeName] = createData.id;
    return typeFolderCache[typeName];
};

// Convert object to Markdown with frontmatter
export const objectToMarkdown = (obj: AstralObject): string => {
    const frontmatter: Record<string, unknown> = {
        id: obj.id,
        type: obj.type,
        tags: obj.tags,
        links: obj.links,
        createdAt: obj.createdAt.toISOString(),
        updatedAt: obj.updatedAt.toISOString(),
        ...obj.properties,
    };

    // Include attachments if present
    if (obj.attachments && obj.attachments.length > 0) {
        frontmatter.attachments = obj.attachments.map(a => ({
            fileName: a.fileName,
            url: a.url,
            mimeType: a.mimeType,
            size: a.size,
        }));
    }

    // Simple HTML to Markdown conversion (basic)
    const content = obj.content
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<br\s*\/?>/gi, '\n')
        // Convert img tags to markdown image syntax
        .replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)')
        .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![$1]($2)')
        .replace(/<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![]($1)')
        .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
        .trim();

    const yamlLines = ['---'];
    for (const [key, value] of Object.entries(frontmatter)) {
        if (Array.isArray(value)) {
            yamlLines.push(`${key}:`);
            value.forEach(v => yamlLines.push(`  - ${v}`));
        } else if (value !== undefined && value !== null) {
            yamlLines.push(`${key}: ${JSON.stringify(value)}`);
        }
    }
    yamlLines.push('---', '');

    return `${yamlLines.join('\n')}# ${obj.title}\n\n${content}`;
};

// Sync object to Google Drive
export const syncObjectToDrive = async (obj: AstralObject, typeName: string): Promise<{ fileId: string; revisionId: string }> => {
    const folderId = await getOrCreateTypeFolder(typeName);
    const markdown = objectToMarkdown(obj);
    const fileName = `${obj.title.replace(/[/\\?%*:|"<>]/g, '-')}.md`;

    const metadata = {
        name: fileName,
        mimeType: 'text/markdown',
        parents: obj.driveFileId ? undefined : [folderId],
    };

    const blob = new Blob([markdown], { type: 'text/markdown' });

    if (obj.driveFileId) {
        // Update existing file
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify({ name: fileName })], { type: 'application/json' }));
        formData.append('file', blob);

        const response = await driveFetch(
            `${DRIVE_UPLOAD_BASE}/files/${obj.driveFileId}?uploadType=multipart&fields=id,headRevisionId`,
            { method: 'PATCH', body: formData }
        );
        const data = await response.json();
        return { fileId: data.id, revisionId: data.headRevisionId };
    } else {
        // Create new file
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', blob);

        const response = await driveFetch(
            `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,headRevisionId`,
            { method: 'POST', body: formData }
        );
        const data = await response.json();
        return { fileId: data.id, revisionId: data.headRevisionId };
    }
};

// Delete file from Drive
export const deleteFromDrive = async (fileId: string): Promise<void> => {
    await driveFetch(`${DRIVE_API_BASE}/files/${fileId}`, { method: 'DELETE' });
};

// Check if Drive token is present (basic check)
export const isDriveConnected = (): boolean => {
    return !!getGoogleAccessToken() && !isGoogleAccessTokenExpired();
};

// Images folder cache
let imagesFolderId: string | null = null;

// Get or create the Images folder inside Astral Expanse
export const getOrCreateImagesFolder = async (): Promise<string> => {
    if (imagesFolderId) return imagesFolderId;

    const parentId = await getOrCreateRootFolder();

    // Search for existing Images folder
    const searchUrl = `${DRIVE_API_BASE}/files?q=name='Imagenes' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`;
    const searchResponse = await driveFetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.files?.length > 0) {
        imagesFolderId = searchData.files[0].id;
        return imagesFolderId!;
    }

    // Create new Images folder
    const createResponse = await driveFetch(`${DRIVE_API_BASE}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Imagenes',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        }),
    });

    const createData = await createResponse.json();
    imagesFolderId = createData.id;
    return imagesFolderId!;
};

// Upload an image to Drive and return a base64 data URL for embedding
// Drive URLs don't work for direct embedding due to CORS, so we use base64
export const uploadImageToDrive = async (file: File): Promise<{ fileId: string; url: string }> => {
    const folderId = await getOrCreateImagesFolder();

    // Generate unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[/\\?%*:|"<>]/g, '-');
    const fileName = `${timestamp}-${safeName}`;

    const metadata = {
        name: fileName,
        mimeType: file.type,
        parents: [folderId],
    };

    // Upload the file to Drive for backup
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const uploadResponse = await driveFetch(
        `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id`,
        { method: 'POST', body: formData }
    );
    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;

    // Set file to be publicly readable (for backup access)
    await driveFetch(`${DRIVE_API_BASE}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            role: 'reader',
            type: 'anyone',
        }),
    });

    // Return a special internal URL that the ResizableImage component will recognize
    // and use to fetch the image content securely via the API
    const url = `drive://${fileId}`;
    return { fileId, url };
};

// Fetch a Drive file securely and return a Blob URL
export const getDriveFileUrl = async (fileId: string): Promise<string> => {
    const response = await driveFetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

// Delete an image from Drive by URL or fileId
export const deleteImageFromDrive = async (urlOrId: string): Promise<void> => {
    let fileId = urlOrId;

    // Check for internal drive protocol
    if (urlOrId.startsWith('drive://')) {
        fileId = urlOrId.replace('drive://', '');
    } else {
        // Extract fileId from Drive URL if needed
        const match = urlOrId.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match) {
            fileId = match[1];
        }
    }

    if (fileId) {
        await driveFetch(`${DRIVE_API_BASE}/files/${fileId}`, { method: 'DELETE' });
    }
};

// ==========================================
// ATTACHMENTS - Generic file upload support
// ==========================================

// Attachment interface
export interface DriveAttachment {
    id: string;           // Unique attachment ID (generated locally)
    fileId: string;       // Google Drive file ID
    fileName: string;     // Original file name
    mimeType: string;     // MIME type
    size: number;         // File size in bytes
    url: string;          // Public URL for access
    uploadedAt: Date;     // Upload timestamp
}

// Supported file types with icons and labels
export const ATTACHMENT_TYPE_INFO: Record<string, { icon: string; label: string }> = {
    // Documents
    'application/pdf': { icon: 'FileText', label: 'PDF' },
    'application/epub+zip': { icon: 'Book', label: 'EPUB' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: 'Presentation', label: 'PPTX' },
    'application/vnd.ms-powerpoint': { icon: 'Presentation', label: 'PPT' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'FileText', label: 'DOCX' },
    'application/msword': { icon: 'FileText', label: 'DOC' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: 'FileSpreadsheet', label: 'XLSX' },
    'application/vnd.ms-excel': { icon: 'FileSpreadsheet', label: 'XLS' },
    'text/plain': { icon: 'FileText', label: 'TXT' },
    'text/markdown': { icon: 'FileText', label: 'MD' },
    // Video
    'video/mp4': { icon: 'Video', label: 'Video' },
    'video/webm': { icon: 'Video', label: 'Video' },
    'video/quicktime': { icon: 'Video', label: 'Video' },
    'video/x-msvideo': { icon: 'Video', label: 'Video' },
    // Audio
    'audio/mpeg': { icon: 'Music', label: 'Audio' },
    'audio/wav': { icon: 'Music', label: 'Audio' },
    'audio/ogg': { icon: 'Music', label: 'Audio' },
    'audio/mp4': { icon: 'Music', label: 'Audio' },
    // Images (already handled by uploadImageToDrive but included for reference)
    'image/jpeg': { icon: 'Image', label: 'Imagen' },
    'image/png': { icon: 'Image', label: 'Imagen' },
    'image/gif': { icon: 'Image', label: 'Imagen' },
    'image/webp': { icon: 'Image', label: 'Imagen' },
    'image/svg+xml': { icon: 'Image', label: 'SVG' },
    // Archives
    'application/zip': { icon: 'FileArchive', label: 'ZIP' },
    'application/x-rar-compressed': { icon: 'FileArchive', label: 'RAR' },
    'application/x-7z-compressed': { icon: 'FileArchive', label: '7Z' },
    // Default
    'default': { icon: 'File', label: 'Archivo' },
};

// Get attachment type info (icon and label) for a MIME type
export const getAttachmentTypeInfo = (mimeType: string): { icon: string; label: string } => {
    return ATTACHMENT_TYPE_INFO[mimeType] || ATTACHMENT_TYPE_INFO['default'];
};

// Attachments folder cache
let attachmentsFolderId: string | null = null;

// Get or create the Attachments folder inside Astral Expanse
export const getOrCreateAttachmentsFolder = async (): Promise<string> => {
    if (attachmentsFolderId) return attachmentsFolderId;

    const parentId = await getOrCreateRootFolder();

    // Search for existing Attachments folder
    const searchUrl = `${DRIVE_API_BASE}/files?q=name='Adjuntos' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`;
    const searchResponse = await driveFetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.files?.length > 0) {
        attachmentsFolderId = searchData.files[0].id;
        return attachmentsFolderId!;
    }

    // Create new Attachments folder
    const createResponse = await driveFetch(`${DRIVE_API_BASE}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Adjuntos',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        }),
    });

    const createData = await createResponse.json();
    attachmentsFolderId = createData.id;
    return attachmentsFolderId!;
};

// Generate unique ID for attachments
const generateAttachmentId = (): string => {
    return `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Upload a file to Drive as an attachment
export const uploadFileToDrive = async (file: File): Promise<DriveAttachment> => {
    const folderId = await getOrCreateAttachmentsFolder();

    // Generate unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[/\\?%*:|"<>]/g, '-');
    const fileName = `${timestamp}-${safeName}`;

    const metadata = {
        name: fileName,
        mimeType: file.type || 'application/octet-stream',
        parents: [folderId],
    };

    // Upload the file
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    const uploadResponse = await driveFetch(
        `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size`,
        { method: 'POST', body: formData }
    );
    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;

    // Set file to be publicly readable (anyone with the link)
    await driveFetch(`${DRIVE_API_BASE}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            role: 'reader',
            type: 'anyone',
        }),
    });

    // Build the public URL
    const url = `https://drive.google.com/uc?id=${fileId}`;

    return {
        id: generateAttachmentId(),
        fileId,
        fileName: file.name, // Keep original name for display
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        url,
        uploadedAt: new Date(),
    };
};

// Delete an attachment from Drive
export const deleteAttachmentFromDrive = async (fileId: string): Promise<void> => {
    await driveFetch(`${DRIVE_API_BASE}/files/${fileId}`, { method: 'DELETE' });
};

// Get URL for viewing a file in Google Drive
export const getDriveViewUrl = (fileId: string): string => {
    return `https://drive.google.com/file/d/${fileId}/view`;
};

// Get URL for downloading a file from Google Drive
export const getDriveDownloadUrl = (fileId: string): string => {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

// Format file size for display
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

