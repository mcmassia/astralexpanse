// Favorites Widget - Shows objects marked as favorite
import type { AstralObject, ObjectType } from '../../../types/object';
import { LucideIcon } from '../../common';

interface FavoritesWidgetProps {
    objects: AstralObject[];
    objectTypes: ObjectType[];
    onObjectClick: (id: string) => void;
}

// Property names/IDs that indicate favorites
const FAVORITE_PROPERTY_NAMES = ['favorito', 'favorite', 'isfavorite', 'fav', 'starred', 'destacado'];
// Values that indicate true
const TRUE_VALUES = ['true', 'sí', 'si', 'yes', '1'];

export const FavoritesWidget = ({ objects, objectTypes, onObjectClick }: FavoritesWidgetProps) => {
    // Filter objects marked as favorites
    const favoriteObjects = objects.filter(obj => {
        const type = objectTypes.find(t => t.id === obj.type);
        if (!type) return false;

        // Find any property that looks like a "favorite" property
        const favoriteProps = type.properties.filter(p => {
            const propNameLower = p.name.toLowerCase();
            const propIdLower = p.id.toLowerCase();
            return FAVORITE_PROPERTY_NAMES.some(name =>
                propNameLower.includes(name) || propIdLower.includes(name)
            );
        });

        // Check if any favorite property is true
        return favoriteProps.some(prop => {
            const value = obj.properties[prop.id];

            // Check boolean
            if (typeof value === 'boolean') return value;

            // Check string
            if (typeof value === 'string') {
                return TRUE_VALUES.includes(value.toLowerCase());
            }

            return false;
        });
    });

    // Sort by most recently modified
    const sortedFavorites = [...favoriteObjects]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6);

    const getTypeInfo = (typeId: string) => objectTypes.find(t => t.id === typeId);

    if (sortedFavorites.length === 0) {
        return null; // Don't show widget if no favorites
    }

    return (
        <div className="dashboard-favorites-widget">
            <div className="dashboard-favorites-header">
                <span className="dashboard-favorites-icon">⭐</span>
                <span className="dashboard-favorites-title">Favoritos</span>
            </div>
            <div className="dashboard-favorites-list">
                {sortedFavorites.map(obj => {
                    const type = getTypeInfo(obj.type);
                    return (
                        <div
                            key={obj.id}
                            className="dashboard-favorites-item"
                            onClick={() => onObjectClick(obj.id)}
                        >
                            <span className="dashboard-favorites-item-icon">
                                <LucideIcon name={type?.icon || 'FileText'} size={16} color={type?.color} />
                            </span>
                            <span className="dashboard-favorites-item-title">
                                {obj.title || 'Sin título'}
                            </span>
                            <span
                                className="dashboard-favorites-item-type"
                                style={{ color: type?.color }}
                            >
                                {type?.name}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
