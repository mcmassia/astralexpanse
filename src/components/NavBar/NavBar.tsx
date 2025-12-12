// NavBar - Global navigation bar with back/forward buttons
import { useUIStore } from '../../stores/uiStore';
import { useObjectStore } from '../../stores/objectStore';
import { useEffect, useRef } from 'react';
import './NavBar.css';

export const NavBar = () => {
    const navHistory = useUIStore(s => s.navHistory);
    const navHistoryIndex = useUIStore(s => s.navHistoryIndex);
    const goNavBack = useUIStore(s => s.goNavBack);
    const goNavForward = useUIStore(s => s.goNavForward);
    const pushNavHistory = useUIStore(s => s.pushNavHistory);
    const currentSection = useUIStore(s => s.currentSection);

    const selectedObjectId = useObjectStore(s => s.selectedObjectId);
    const selectObject = useObjectStore(s => s.selectObject);

    const isNavigatingRef = useRef(false);

    const canGoBack = navHistoryIndex > 0;
    const canGoForward = navHistoryIndex < navHistory.length - 1;

    // Push to history when section or object changes (but not during back/forward navigation)
    useEffect(() => {
        if (isNavigatingRef.current) {
            isNavigatingRef.current = false;
            return;
        }
        pushNavHistory(currentSection, selectedObjectId);
    }, [currentSection, selectedObjectId, pushNavHistory]);

    const handleBack = () => {
        if (!canGoBack) return;
        isNavigatingRef.current = true;
        const prevItem = navHistory[navHistoryIndex - 1];
        // First call goNavBack to update the index
        goNavBack();
        // Then update object selection to match
        if (prevItem.objectId !== selectedObjectId) {
            selectObject(prevItem.objectId);
        }
    };

    const handleForward = () => {
        if (!canGoForward) return;
        isNavigatingRef.current = true;
        const nextItem = navHistory[navHistoryIndex + 1];
        // First call goNavForward to update the index
        goNavForward();
        // Then update object selection to match
        if (nextItem.objectId !== selectedObjectId) {
            selectObject(nextItem.objectId);
        }
    };

    return (
        <div className="nav-bar">
            <button
                className="nav-bar-btn"
                onClick={handleBack}
                disabled={!canGoBack}
                title="Atrás"
            >
                ←
            </button>
            <button
                className="nav-bar-btn"
                onClick={handleForward}
                disabled={!canGoForward}
                title="Adelante"
            >
                →
            </button>
        </div>
    );
};
