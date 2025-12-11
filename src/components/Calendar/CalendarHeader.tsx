// Calendar Header Component - View tabs and navigation
import { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { CalendarSettings } from '../CalendarSettings';
import { formatDayHeader, MONTH_NAMES, getWeekNumber } from './utils';
import './Calendar.css';

type CalendarView = 'day' | 'threeDays' | 'week' | 'month';

interface ViewTab {
    id: CalendarView;
    label: string;
}

const VIEW_TABS: ViewTab[] = [
    { id: 'month', label: 'Mes' },
    { id: 'week', label: 'Semana' },
    { id: 'threeDays', label: 'Tres días' },
    { id: 'day', label: 'Día' },
];

export const CalendarHeader = () => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const {
        calendarView,
        selectedDate,
        setCalendarView,
        goToToday,
        goToPreviousDay,
        goToNextDay,
        goToPreviousWeek,
        goToNextWeek,
        goToPreviousMonth,
        goToNextMonth,
    } = useUIStore();

    // Navigation handlers based on current view
    const handlePrevious = () => {
        switch (calendarView) {
            case 'day':
                goToPreviousDay();
                break;
            case 'threeDays':
                goToPreviousDay();
                break;
            case 'week':
                goToPreviousWeek();
                break;
            case 'month':
                goToPreviousMonth();
                break;
        }
    };

    const handleNext = () => {
        switch (calendarView) {
            case 'day':
                goToNextDay();
                break;
            case 'threeDays':
                goToNextDay();
                break;
            case 'week':
                goToNextWeek();
                break;
            case 'month':
                goToNextMonth();
                break;
        }
    };

    // Format the date display based on view
    const getDateDisplay = () => {
        switch (calendarView) {
            case 'day': {
                const { dayName, fullDate, weekNumber } = formatDayHeader(selectedDate);
                return (
                    <div className="calendar-date-display day-view">
                        <span className="calendar-day-name">{dayName}</span>
                        <span className="calendar-full-date">{fullDate}</span>
                        <span className="calendar-week-number">Semana {weekNumber}</span>
                    </div>
                );
            }
            case 'threeDays':
            case 'week': {
                const weekNum = getWeekNumber(selectedDate);
                const month = MONTH_NAMES[selectedDate.getMonth()];
                const year = selectedDate.getFullYear();
                return (
                    <div className="calendar-date-display">
                        <span className="calendar-period">{month} {year}</span>
                        <span className="calendar-week-number">Semana {weekNum}</span>
                    </div>
                );
            }
            case 'month': {
                const month = MONTH_NAMES[selectedDate.getMonth()];
                const year = selectedDate.getFullYear();
                return (
                    <div className="calendar-date-display month-view">
                        <span className="calendar-period">{month} {year}</span>
                    </div>
                );
            }
        }
    };

    return (
        <header className="calendar-header">
            <div className="calendar-header-left">
                {getDateDisplay()}
            </div>

            <div className="calendar-header-center">
                <div className="calendar-view-tabs">
                    {VIEW_TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`calendar-view-tab ${calendarView === tab.id ? 'active' : ''}`}
                            onClick={() => setCalendarView(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="calendar-header-right">
                <button
                    className="calendar-settings-btn"
                    onClick={() => setIsSettingsOpen(true)}
                    title="Configurar calendarios de Google"
                >
                    ⚙️
                </button>
                <div className="calendar-nav">
                    <button className="calendar-nav-btn" onClick={handlePrevious}>
                        ‹
                    </button>
                    <button className="calendar-today-btn" onClick={goToToday}>
                        Hoy
                    </button>
                    <button className="calendar-nav-btn" onClick={handleNext}>
                        ›
                    </button>
                </div>
            </div>

            <CalendarSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </header>
    );
};

export default CalendarHeader;

