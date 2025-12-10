// Month View Component - Card grid for entire month
import { useMemo } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { getMonthGrid, MONTH_NAMES_SHORT } from './utils';
import { DayPanel } from './DayPanel';
import './Calendar.css';

export const MonthView = () => {
    const { selectedDate, setSelectedDate } = useUIStore();

    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();

    // Get all dates in the month grid
    const monthDates = useMemo(() => getMonthGrid(selectedDate), [selectedDate]);

    // Group dates by week
    const weeks = useMemo(() => {
        const result: Date[][] = [];
        for (let i = 0; i < monthDates.length; i += 7) {
            result.push(monthDates.slice(i, i + 7));
        }
        return result;
    }, [monthDates]);

    return (
        <div className="month-view">
            {/* Month Navigation Tabs */}
            <div className="month-tabs">
                {MONTH_NAMES_SHORT.map((month, index) => (
                    <button
                        key={month}
                        className={`month-tab ${index === currentMonth ? 'active' : ''}`}
                        onClick={() => {
                            const newDate = new Date(currentYear, index, 1);
                            setSelectedDate(newDate);
                        }}
                    >
                        {month}
                    </button>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="month-grid">
                {/* Day Headers */}
                <div className="month-day-headers">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                        <div key={day} className="month-day-header">{day}</div>
                    ))}
                </div>

                {/* Weeks */}
                {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="month-week">
                        {week.map(date => (
                            <DayPanel
                                key={date.toISOString()}
                                date={date}
                                compact
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MonthView;
