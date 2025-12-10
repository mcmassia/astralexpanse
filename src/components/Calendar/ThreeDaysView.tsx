// Three Days View Component - Yesterday, Today, Tomorrow columns
import { useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { getThreeDays } from './utils';
import { DayPanel } from './DayPanel';
import './Calendar.css';

export const ThreeDaysView = () => {
    const { selectedDate } = useUIStore();

    const days = useMemo(() => getThreeDays(selectedDate), [selectedDate]);

    return (
        <div className="three-days-view">
            {days.map((date, index) => (
                <DayPanel
                    key={date.toISOString()}
                    date={date}
                    isCenter={index === 1}
                />
            ))}
        </div>
    );
};

export default ThreeDaysView;
