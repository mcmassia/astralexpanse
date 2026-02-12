import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, GripHorizontal } from 'lucide-react';
import './DraggableModal.css';

interface DraggableModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    initialPosition?: { x: number; y: number };
    width?: number | string;
    height?: number | string;
}

export const DraggableModal: React.FC<DraggableModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    initialPosition = { x: 100, y: 100 },
    width = 600,
    height = 500,
}) => {
    const [position, setPosition] = useState(initialPosition);
    const [size] = useState({ width, height });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset position if needed, or keep last?
            // For now, let's just ensure it's on screen
        }
    }, [isOpen]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (modalRef.current) {
            setIsDragging(true);
            setDragOffset({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y,
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={modalRef}
            className="draggable-modal"
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
            }}
        >
            <div className="draggable-modal-header" onMouseDown={handleMouseDown}>
                <div className="draggable-handle">
                    <GripHorizontal size={16} />
                    <span className="draggable-title">{title}</span>
                </div>
                <button className="draggable-close" onClick={onClose}>
                    <X size={16} />
                </button>
            </div>
            <div className="draggable-modal-content">
                {children}
            </div>
            {/* Resize handle could be added here */}
        </div>,
        document.body
    );
};
