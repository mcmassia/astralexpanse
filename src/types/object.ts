// Types for Astral Expanse objects

// Attachment for files stored in Google Drive
export interface Attachment {
  id: string;                      // Unique attachment ID
  fileId: string;                  // Google Drive file ID
  fileName: string;                // Original file name
  mimeType: string;                // MIME type
  size: number;                    // File size in bytes
  url: string;                     // Public URL for access
  uploadedAt: Date;                // Upload timestamp
}

export interface AstralObject {
  id: string;
  type: string;                    // "page", "person", "book", etc.
  title: string;
  content: string;                 // HTML from editor
  properties: Record<string, PropertyValue>;
  tags: string[];
  links: string[];                 // IDs of linked objects
  backlinks: string[];             // IDs linking to this object
  createdAt: Date;
  updatedAt: Date;
  driveFileId?: string;            // Google Drive file ID
  driveRevisionId?: string;        // For change detection
  attachments?: Attachment[];      // Attached files stored in Drive
  embedding?: number[];            // Vector embedding for semantic search
}

export type PropertyValue =
  | string
  | number
  | boolean
  | Date
  | string[]  // for multiselect/tags
  | { id: string; title: string }[];  // for relations

export interface ObjectType {
  id: string;
  name: string;
  namePlural: string;
  icon: string;
  color: string;
  properties: PropertyDefinition[];
  template?: string;               // Initial content
}

export type PropertyType =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'relation'
  | 'rating'
  | 'tags'
  | 'url'
  | 'email'
  | 'image';

export interface PropertyDefinition {
  id: string;
  name: string;
  type: PropertyType;
  required?: boolean;
  options?: string[];              // For select/multiselect
  relationTypeId?: string;         // For relation type filter
  defaultValue?: PropertyValue;
  // Two-way linked properties configuration
  twoWayLinked?: boolean;          // Enable two-way linking
  linkedTypeId?: string;           // Target object type ID for two-way link
  linkedPropertyId?: string;       // Property ID in target type that receives back-reference
  // Computed/derived property configuration
  computed?: boolean;              // Is this a computed/derived property?
  computedFrom?: {
    throughProperty: string;       // Property ID to traverse (e.g., "equipos")
    collectProperty: string;       // Property ID to collect from traversed objects (e.g., "personas")
  };
}

// Base properties that all object types should have
export const BASE_PROPERTIES: PropertyDefinition[] = [
  { id: 'seguimiento', name: 'Seguimiento', type: 'boolean', defaultValue: false },
  { id: 'favorito', name: 'Favorito', type: 'boolean', defaultValue: false },
  { id: 'relations', name: 'Relaciones', type: 'relation' },
];

// Default object types
export const DEFAULT_OBJECT_TYPES: ObjectType[] = [
  {
    id: 'page',
    name: 'Página',
    namePlural: 'Páginas',
    icon: '📄',
    color: '#6366f1',
    properties: []
  },
  {
    id: 'person',
    name: 'Persona',
    namePlural: 'Personas',
    icon: '👤',
    color: '#ec4899',
    properties: [
      { id: 'email', name: 'Email', type: 'text' },
      { id: 'phone', name: 'Teléfono', type: 'text' },
      { id: 'birthday', name: 'Cumpleaños', type: 'date' }
    ]
  },
  {
    id: 'book',
    name: 'Libro',
    namePlural: 'Libros',
    icon: '📚',
    color: '#f59e0b',
    properties: [
      { id: 'author', name: 'Autor', type: 'relation', relationTypeId: 'person' },
      { id: 'rating', name: 'Valoración', type: 'rating' },
      { id: 'status', name: 'Estado', type: 'select', options: ['Por leer', 'Leyendo', 'Leído'] }
    ]
  },
  {
    id: 'meeting',
    name: 'Reunión',
    namePlural: 'Reuniones',
    icon: '📅',
    color: '#10b981',
    properties: [
      { id: 'date', name: 'Fecha', type: 'date' },
      { id: 'attendees', name: 'Asistentes', type: 'relation', relationTypeId: 'person' }
    ]
  },
  {
    id: 'project',
    name: 'Proyecto',
    namePlural: 'Proyectos',
    icon: '🎯',
    color: '#8b5cf6',
    properties: [
      { id: 'status', name: 'Estado', type: 'select', options: ['Activo', 'En pausa', 'Completado', 'Cancelado'] },
      { id: 'deadline', name: 'Fecha límite', type: 'date' }
    ]
  },
  {
    id: 'idea',
    name: 'Idea',
    namePlural: 'Ideas',
    icon: '💡',
    color: '#eab308',
    properties: [
      { id: 'priority', name: 'Prioridad', type: 'select', options: ['Baja', 'Media', 'Alta'] }
    ]
  },
  {
    id: 'daily',
    name: 'Nota Diaria',
    namePlural: 'Notas Diarias',
    icon: '📓',
    color: '#22c55e',
    properties: [
      { id: 'date', name: 'Fecha', type: 'date', required: true }
    ]
  },
  {
    id: 'adjunto',
    name: 'Adjunto',
    namePlural: 'Adjuntos',
    icon: '📎',
    color: '#94a3b8',
    properties: [
      { id: 'tipoArchivo', name: 'Tipo de Archivo', type: 'select', options: ['PDF', 'Imagen', 'EPUB', 'Documento', 'Video', 'Audio', 'Presentación', 'Hoja de Cálculo', 'Archivo', 'Otro'] },
      { id: 'driveFileId', name: 'ID de Drive', type: 'text' },
      { id: 'driveUrl', name: 'URL de Drive', type: 'url' },
      { id: 'tamaño', name: 'Tamaño', type: 'text' },
      { id: 'mimeType', name: 'Tipo MIME', type: 'text' },
      { id: 'relacionado', name: 'Relacionado con', type: 'relation' }
    ]
  },
  {
    id: 'note',
    name: 'Nota',
    namePlural: 'Notas',
    icon: '📝',
    color: '#60a5fa',
    properties: []
  },
  {
    id: 'tarea',
    name: 'Tarea',
    namePlural: 'Tareas',
    icon: '✅',
    color: '#f87171',
    properties: [
      { id: 'status', name: 'Estado', type: 'select', options: ['Nueva', 'En progreso', 'Completada', 'Cancelada'] },
      { id: 'priority', name: 'Prioridad', type: 'select', options: ['Baja', 'Media', 'Alta'] },
      { id: 'dueDate', name: 'Fecha Vencimiento', type: 'date' }
    ]
  }
];

// Search result with match info for highlighting
export interface SearchMatch {
  objectId: string;
  field: 'title' | 'content' | 'property' | 'tag';
  matchStart: number;
  matchEnd: number;
  context: string; // Text snippet around match
  propertyName?: string; // For property matches
}

export interface SearchResult {
  object: AstralObject;
  matches: SearchMatch[];
  score: number; // Relevance score for ranking
}

// Saved query for reusable searches
export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  typeFilters: string[];
  tagFilters: string[];
  propertyFilters: Record<string, string>;
  showBlocksOnly: boolean;
  groupByType: boolean;
  createdAt: Date;
  updatedAt: Date;
  isPinned: boolean;
}

// Command palette action types
export interface CommandAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  category: 'navigation' | 'create' | 'settings' | 'help';
  action: () => void;
}
