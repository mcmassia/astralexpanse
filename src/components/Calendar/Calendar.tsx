// Calendar Main Container
import { useUIStore } from '../../stores/uiStore';
import { CalendarHeader } from './CalendarHeader';
import { DayView } from './DayView';
import { ThreeDaysView } from './ThreeDaysView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import './Calendar.css';

export const Calendar = () => {
    const { calendarView } = useUIStore();

    const renderView = () => {
        switch (calendarView) {
            case 'day':
                return <DayView />;
            case 'threeDays':
                return <ThreeDaysView />;
            case 'week':
                return <WeekView />;
            case 'month':
                return <MonthView />;
            default:
                return <DayView />;
        }
    };

    return (
        <div className="calendar">
            <CalendarHeader />
            <div className="calendar-content">
                <div className="calendar-main">
                    {renderView()}
                </div>
            </div>
        </div>
    );
};

export default Calendar;
