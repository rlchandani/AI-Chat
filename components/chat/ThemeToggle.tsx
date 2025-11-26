'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getSetting, setSetting, applyTheme } from '@/utils/settingsStorage';
import { motion } from 'framer-motion';

export function ThemeToggle() {
    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Initialize theme state
    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            const currentTheme = getSetting('theme');
            // Check if dark class is present or if theme is dark
            const isDarkMode = document.documentElement.classList.contains('dark') || 
                             currentTheme === 'dark' ||
                             (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            setIsDark(isDarkMode);
        }
    }, []);

    // Listen for theme changes
    useEffect(() => {
        if (!mounted) return;

        const checkTheme = () => {
            const isDarkMode = document.documentElement.classList.contains('dark');
            setIsDark(isDarkMode);
        };

        // Check on mount and when settings update
        checkTheme();
        
        const handleSettingsUpdate = () => {
            checkTheme();
        };

        const handleClassChange = () => {
            checkTheme();
        };

        window.addEventListener('settingsUpdated', handleSettingsUpdate);
        
        // Watch for class changes on documentElement
        const observer = new MutationObserver(handleClassChange);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => {
            window.removeEventListener('settingsUpdated', handleSettingsUpdate);
            observer.disconnect();
        };
    }, [mounted]);

    const toggleTheme = () => {
        if (!mounted) return;

        const newTheme = isDark ? 'light' : 'dark';
        setSetting('theme', newTheme);
        applyTheme(newTheme);
        setIsDark(!isDark);
        
        // Dispatch event to notify other components
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('settingsUpdated'));
        }
    };

    if (!mounted) {
        // Return a placeholder with the same size to prevent layout shift
        return (
            <button
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Toggle theme"
                disabled
            >
                <Sun size={18} className="opacity-0" />
            </button>
        );
    }

    return (
        <motion.button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-accent transition-colors relative"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            <motion.div
                initial={false}
                animate={{ rotate: isDark ? 180 : 0 }}
                transition={{ duration: 0.3 }}
            >
                {isDark ? (
                    <Moon size={18} className="text-foreground" />
                ) : (
                    <Sun size={18} className="text-foreground" />
                )}
            </motion.div>
        </motion.button>
    );
}

