// Google Drive service for file sync
import { getGoogleAccessToken } from './firebase';
import type { AstralObject } from '../types/object';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const ASTRAL_FOLDER_NAME = 'Astral Expanse';

let rootFolderId: string | null = null;
const typeFolderCache: Record<string, string> = {};

// Helper for authenticated fetch
const driveFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = getGoogleAccessToken();
    if (!token) {
        throw new Error('No Google access token available. Please sign in again.');
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Drive API error: ${response.status}`);
    }

    return response;
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

    // Simple HTML to Markdown conversion (basic)
    const content = obj.content
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<br\s*\/?>/gi, '\n')
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

// Check if Drive token is valid
export const isDriveConnected = (): boolean => {
    return !!getGoogleAccessToken();
};
