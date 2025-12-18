import React from 'react';
import { X } from 'lucide-react';
import { AISettings } from './AISettings';
import './SettingsModal.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="settings-modal-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={e => e.stopPropagation()}>
                <button className="settings-close-btn" onClick={onClose}>
                    <X size={24} />
                </button>
                <div className="settings-scroll-area">
                    <AISettings />
                </div>
            </div>
        </div>
    );
};
