// Week View Component - Seven day columns
import { useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { getWeekDays } from './utils';
import { DayPanel } from './DayPanel';
import './Calendar.css';

export const WeekView = () => {
    const { selectedDate } = useUIStore();

    const days = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

    return (
        <div className="week-view">
            {days.map((date) => (
                <DayPanel
                    key={date.toISOString()}
                    date={date}
                    compact
                />
            ))}
        </div>
    );
};

export default WeekView;
