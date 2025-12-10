// Types for Astral Expanse objects

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
  relationTypeId?: string;         // For relation type
  defaultValue?: PropertyValue;
}

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
