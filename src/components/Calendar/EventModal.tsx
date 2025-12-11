// Event Modal Component - Displays event details with actions
import React, { useState } from 'react';
import type { CalendarEvent } from '../../types/calendar';
import type { PropertyValue } from '../../types/object';
import { useObjectStore } from '../../stores/objectStore';
import { useUIStore } from '../../stores/uiStore';
import './Calendar.css';

interface EventModalProps {
    event: CalendarEvent;
    onClose: () => void;
}

export const EventModal = ({ event, onClose }: EventModalProps) => {
    const { objectTypes, createObject, selectObject } = useObjectStore();
    const { setCurrentSection } = useUIStore();
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Format event time
    const formatEventTime = () => {
        if (event.isAllDay) return 'Todo el día';
        const start = new Date(event.start);
        const end = new Date(event.end);
        const formatTime = (d: Date) =>
            d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        // Include date if spans multiple days or for clarity
        const formatDate = (d: Date) =>
            d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

        const startDate = formatDate(start);
        const endDate = formatDate(end);

        if (startDate === endDate) {
            return `${startDate} • ${formatTime(start)} - ${formatTime(end)}`;
        }
        return `${startDate} ${formatTime(start)} - ${endDate} ${formatTime(end)}`;
    };

    // Create object from event
    const handleCreateObject = async (typeId: string) => {
        setIsCreating(true);
        try {
            // Build content from event data
            const contentParts: string[] = [];

            if (event.description) {
                contentParts.push(`<p>${event.description}</p>`);
            }

            contentParts.push(`<p><strong>📅 Calendario:</strong> ${event.calendarName}</p>`);
            contentParts.push(`<p><strong>🕐 Fecha/Hora:</strong> ${formatEventTime()}</p>`);

            if (event.location) {
                contentParts.push(`<p><strong>📍 Ubicación:</strong> ${event.location}</p>`);
            }

            contentParts.push(`<p><strong>🔗 Origen:</strong> <a href="${event.htmlLink}" target="_blank">Ver en Google Calendar</a></p>`);

            const content = contentParts.join('\n');

            // Set date property if the type has a date field
            const dateStr = new Date(event.start).toISOString().split('T')[0];
            const properties: Record<string, PropertyValue> = { date: dateStr };

            const newObject = await createObject(typeId, event.summary, content, true, properties);

            if (newObject && newObject.id) {
                selectObject(newObject.id);
                setCurrentSection('objects');
                onClose();
            }
        } catch (error) {
            console.error('Error creating object from event:', error);
        } finally {
            setIsCreating(false);
            setShowTypeSelector(false);
        }
    };

    // Filter types suitable for event creation (exclude system types)
    const availableTypes = objectTypes.filter(t =>
        t.id !== 'daily' && !t.id.startsWith('_')
    );

    return (
        <div className="event-modal-overlay" onClick={onClose}>
            <div className="event-modal" onClick={(e) => e.stopPropagation()}>
                <div className="event-modal-header">
                    <h2>{event.summary}</h2>
                    <button className="event-modal-close" onClick={onClose}>×</button>
                </div>
                <div className="event-modal-content">
                    <div className="event-modal-row">
                        <span className="event-modal-icon">🕐</span>
                        <span>{formatEventTime()}</span>
                    </div>
                    {event.location && (
                        <div className="event-modal-row">
                            <span className="event-modal-icon">📍</span>
                            <span>{event.location}</span>
                        </div>
                    )}
                    {event.description && (
                        <div className="event-modal-row description">
                            <span className="event-modal-icon">📝</span>
                            <p>{event.description}</p>
                        </div>
                    )}
                    <div className="event-modal-row">
                        <span className="event-modal-icon">📅</span>
                        <span
                            className="event-calendar-badge"
                            style={{ backgroundColor: event.calendarColor }}
                        >
                            {event.calendarName}
                        </span>
                    </div>
                    <div className="event-modal-row">
                        <span className="event-modal-icon">👤</span>
                        <span>{event.accountEmail}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="event-modal-actions">
                        <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="event-modal-btn secondary"
                        >
                            <span>🔗</span> Abrir en Google Calendar
                        </a>
                        <button
                            className="event-modal-btn primary"
                            onClick={() => setShowTypeSelector(true)}
                            disabled={isCreating}
                        >
                            <span>➕</span> Crear objeto
                        </button>
                    </div>

                    {/* Type Selector */}
                    {showTypeSelector && (
                        <div className="event-modal-type-selector">
                            <p className="type-selector-label">Seleccionar tipo:</p>
                            <div className="type-selector-grid">
                                {availableTypes.map(type => (
                                    <button
                                        key={type.id}
                                        className="type-selector-item"
                                        onClick={() => handleCreateObject(type.id)}
                                        disabled={isCreating}
                                        style={{ '--type-color': type.color } as React.CSSProperties}
                                    >
                                        <span className="type-icon">{type.icon}</span>
                                        <span className="type-name">{type.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EventModal;
