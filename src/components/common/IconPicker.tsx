// IconPicker - Select icons from Lucide library
import { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import './IconPicker.css';

type LucideIconComponent = React.ComponentType<LucideProps>;

// Predefined list of useful icons (avoiding runtime enumeration issues with tree-shaking)
const AVAILABLE_ICONS = [
    // Documents & Files
    'FileText', 'File', 'Folder', 'FolderOpen', 'Archive', 'Paperclip', 'ClipboardList',
    // People
    'User', 'Users', 'UserPlus', 'UserCheck', 'Contact',
    // Communication  
    'Mail', 'MessageSquare', 'MessageCircle', 'Phone', 'Bell', 'Send', 'AtSign',
    // Business
    'Briefcase', 'Building', 'Building2', 'Landmark', 'Store', 'Wallet', 'CreditCard', 'DollarSign', 'Banknote',
    // Time & Calendar
    'Calendar', 'CalendarDays', 'Clock', 'Timer', 'Hourglass', 'AlarmClock',
    // Location
    'MapPin', 'Map', 'Globe', 'Compass', 'Navigation', 'Home', 'Plane', 'Car', 'Train',
    // Media
    'Image', 'Camera', 'Video', 'Film', 'Music', 'Mic', 'Headphones', 'Monitor', 'Tv',
    // Education
    'Book', 'BookOpen', 'GraduationCap', 'Library', 'Notebook', 'ScrollText', 'PenTool',
    // Ideas & Creativity
    'Lightbulb', 'Sparkles', 'Wand2', 'Palette', 'Brush', 'Pencil',
    // Goals & Tasks
    'Target', 'Flag', 'Trophy', 'Award', 'Medal', 'CheckCircle', 'ListTodo', 'ListChecks',
    // Organization
    'Tag', 'Tags', 'Bookmark', 'Star', 'Heart', 'Pin', 'Hash',
    // Data & Charts
    'BarChart', 'BarChart2', 'PieChart', 'LineChart', 'TrendingUp', 'Activity',
    // Technology
    'Laptop', 'Smartphone', 'Tablet', 'Server', 'Database', 'HardDrive', 'Cpu', 'Wifi', 'Bluetooth',
    // Tools & Settings
    'Settings', 'Wrench', 'Hammer', 'Cog', 'SlidersHorizontal',
    // Actions
    'Search', 'Edit', 'Trash2', 'Download', 'Upload', 'Share', 'Link', 'ExternalLink',
    'Plus', 'Minus', 'X', 'Check', 'RefreshCw', 'RotateCw', 'Copy', 'Clipboard',
    // Arrows
    'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ChevronRight', 'ChevronLeft', 'ChevronUp', 'ChevronDown',
    // Nature
    'Sun', 'Moon', 'Cloud', 'CloudRain', 'Snowflake', 'Flame', 'Zap', 'Leaf',
    // Shapes & Misc
    'Circle', 'Square', 'Triangle', 'Hexagon', 'Box', 'Package', 'Gift', 'ShoppingCart', 'ShoppingBag',
    // Security
    'Lock', 'Unlock', 'Key', 'Shield', 'Eye', 'EyeOff',
    // Health
    'HeartPulse', 'Pill', 'Stethoscope',
    // Sports & Leisure
    'Dumbbell', 'Bike', 'Gamepad2',
    // Food
    'Coffee', 'Utensils', 'Pizza',
    // Animals
    'Cat', 'Dog', 'Bird', 'Fish', 'Bug',
];

interface IconPickerProps {
    selectedIcon: string;
    color: string;
    onSelect: (iconName: string) => void;
}

export const IconPicker = ({ selectedIcon, color, onSelect }: IconPickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredIcons = useMemo(() => {
        if (!searchQuery.trim()) {
            return AVAILABLE_ICONS;
        }
        const query = searchQuery.toLowerCase();
        return AVAILABLE_ICONS.filter(name =>
            name.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    // Render an icon by name
    const renderIcon = (iconName: string, size = 18, iconColor = color) => {
        const IconComponent = (LucideIcons as unknown as Record<string, LucideIconComponent>)[iconName];
        if (!IconComponent) return null;
        return <IconComponent size={size} color={iconColor} />;
    };

    // Get the current selected icon component
    const SelectedIconComponent = (LucideIcons as unknown as Record<string, LucideIconComponent>)[selectedIcon];

    return (
        <div className="icon-picker">
            <button
                className="icon-picker-trigger"
                onClick={() => setIsOpen(!isOpen)}
                style={{ borderColor: color }}
                type="button"
            >
                {SelectedIconComponent ? <SelectedIconComponent size={24} color={color} /> : (
                    <LucideIcons.FileText size={24} color={color} />
                )}
            </button>

            {isOpen && (
                <div className="icon-picker-dropdown">
                    <div className="icon-picker-search">
                        <input
                            type="text"
                            placeholder="Buscar iconos..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="icon-picker-grid">
                        {filteredIcons.map(iconName => (
                            <button
                                key={iconName}
                                className={`icon-option ${selectedIcon === iconName ? 'selected' : ''}`}
                                onClick={() => {
                                    onSelect(iconName);
                                    setIsOpen(false);
                                    setSearchQuery('');
                                }}
                                title={iconName}
                                type="button"
                            >
                                {renderIcon(iconName, 18, 'var(--text-secondary)')}
                            </button>
                        ))}
                    </div>
                    {filteredIcons.length === 0 && (
                        <div className="icon-picker-empty">
                            No se encontraron iconos
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Helper component to render a Lucide icon by name
export const LucideIcon = ({
    name,
    size = 18,
    color = 'currentColor',
    className = ''
}: {
    name: string;
    size?: number;
    color?: string;
    className?: string;
}) => {
    const IconComponent = (LucideIcons as unknown as Record<string, LucideIconComponent>)[name];
    if (!IconComponent) {
        // Fallback: always show FileText icon with the specified color
        // This handles legacy emoji icons in the database
        return <LucideIcons.FileText size={size} color={color} className={className} />;
    }
    return <IconComponent size={size} color={color} className={className} />;
};
