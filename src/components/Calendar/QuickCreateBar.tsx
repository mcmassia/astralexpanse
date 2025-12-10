// Quick Create Bar - Buttons for quick object creation
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import { useToast } from '../common';
import { formatDateISO } from './utils';
import './Calendar.css';

// Types that commonly have date properties
const QUICK_CREATE_TYPES = ['meeting', 'project', 'idea', 'page'];

export const QuickCreateBar = () => {
    const { objectTypes, createObject } = useObjectStore();
    const { selectedDate } = useUIStore();
    const toast = useToast();

    const handleQuickCreate = async (typeId: string) => {
        const type = objectTypes.find(t => t.id === typeId);
        if (!type) return;

        const dateStr = formatDateISO(selectedDate);
        const title = `Nueva ${type.name}`;

        // Create object with date property if the type has one
        const dateProperty = type.properties.find(p => p.type === 'date');
        const initialProperties = dateProperty
            ? { [dateProperty.id]: dateStr }
            : {};

        try {
            const newObj = await createObject(typeId, title, '', true);
            toast.success(`${type.name} creado`, `"${newObj.title}" ha sido creado.`);
        } catch (error) {
            toast.error('Error al crear', `No se pudo crear la ${type.name.toLowerCase()}.`);
        }
    };

    const typesToShow = objectTypes.filter(t =>
        QUICK_CREATE_TYPES.includes(t.id) || t.properties.some(p => p.type === 'date')
    );

    return (
        <div className="quick-create-bar">
            {typesToShow.slice(0, 5).map(type => (
                <button
                    key={type.id}
                    className="quick-create-btn"
                    onClick={() => handleQuickCreate(type.id)}
                    style={{ '--type-color': type.color } as React.CSSProperties}
                >
                    <span className="quick-create-icon">{type.icon}</span>
                    <span className="quick-create-label">{type.name}</span>
                </button>
            ))}
        </div>
    );
};

export default QuickCreateBar;
