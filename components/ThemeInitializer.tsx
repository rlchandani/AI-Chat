'use client';

import { useEffect } from 'react';
import { initializeTheme, getSettings } from '@/utils/settingsStorage';

export function ThemeInitializer() {
    useEffect(() => {
        // Apply theme immediately on mount
        const settings = getSettings();
        initializeTheme();
        
        // Also listen for settings updates
        const handleSettingsUpdate = () => {
            initializeTheme();
        };
        
        window.addEventListener('settingsUpdated', handleSettingsUpdate);
        
        return () => {
            window.removeEventListener('settingsUpdated', handleSettingsUpdate);
        };
    }, []);

    return null;
}

