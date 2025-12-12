// TypeIcon - Flat document-style icon for object types
import './TypeIcon.css';

interface TypeIconProps {
    color?: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const TypeIcon = ({ color = 'var(--text-tertiary)', size = 'md', className = '' }: TypeIconProps) => {
    const sizeMap = {
        sm: 14,
        md: 18,
        lg: 22
    };
    const iconSize = sizeMap[size];

    return (
        <svg
            className={`type-icon ${className}`}
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            style={{ '--icon-color': color } as React.CSSProperties}
        >
            {/* Document with folded corner */}
            <path
                d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            <path
                d="M14 2V8H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

// Specialized icon variants
export const PersonIcon = ({ color = 'var(--text-tertiary)', size = 'md', className = '' }: TypeIconProps) => {
    const sizeMap = { sm: 14, md: 18, lg: 22 };
    const iconSize = sizeMap[size];

    return (
        <svg className={`type-icon ${className}`} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" style={{ '--icon-color': color } as React.CSSProperties}>
            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export const CalendarIcon = ({ color = 'var(--text-tertiary)', size = 'md', className = '' }: TypeIconProps) => {
    const sizeMap = { sm: 14, md: 18, lg: 22 };
    const iconSize = sizeMap[size];

    return (
        <svg className={`type-icon ${className}`} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" style={{ '--icon-color': color } as React.CSSProperties}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
};

export const BookIcon = ({ color = 'var(--text-tertiary)', size = 'md', className = '' }: TypeIconProps) => {
    const sizeMap = { sm: 14, md: 18, lg: 22 };
    const iconSize = sizeMap[size];

    return (
        <svg className={`type-icon ${className}`} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" style={{ '--icon-color': color } as React.CSSProperties}>
            <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export const IdeaIcon = ({ color = 'var(--text-tertiary)', size = 'md', className = '' }: TypeIconProps) => {
    const sizeMap = { sm: 14, md: 18, lg: 22 };
    const iconSize = sizeMap[size];

    return (
        <svg className={`type-icon ${className}`} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" style={{ '--icon-color': color } as React.CSSProperties}>
            <path d="M9 18H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 22H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 2C8.68629 2 6 4.68629 6 8C6 10.2208 7.20659 12.1599 9 13.1973V15C9 15.5523 9.44772 16 10 16H14C14.5523 16 15 15.5523 15 15V13.1973C16.7934 12.1599 18 10.2208 18 8C18 4.68629 15.3137 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export const ProjectIcon = ({ color = 'var(--text-tertiary)', size = 'md', className = '' }: TypeIconProps) => {
    const sizeMap = { sm: 14, md: 18, lg: 22 };
    const iconSize = sizeMap[size];

    return (
        <svg className={`type-icon ${className}`} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" style={{ '--icon-color': color } as React.CSSProperties}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
    );
};
