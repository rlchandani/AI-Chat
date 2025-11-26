export interface AppSettings {
    // Appearance
    theme: 'light' | 'dark' | 'system';
    
    // Chat preferences
    showTimestamps: boolean;
    autoScroll: boolean;
    markdownRendering: boolean;
    alwaysShowSidebar: boolean;
    
    // Model preferences
    defaultModel: string;
    
    // Advanced
    enableDebugLogs: boolean;
    maxHistoryItems: number;
}

const STORAGE_KEY = 'gemini-chat-settings';
const DEFAULT_SETTINGS: AppSettings = {
    theme: 'system',
    showTimestamps: false,
    autoScroll: true,
    markdownRendering: true,
    alwaysShowSidebar: false,
    defaultModel: 'gemini-2.5-flash',
    enableDebugLogs: false,
    maxHistoryItems: 100,
};

/**
 * Get all settings from localStorage
 */
export function getSettings(): AppSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with defaults to handle new settings
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    
    return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: Partial<AppSettings>): void {
    if (typeof window === 'undefined') return;
    
    try {
        const current = getSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        
        // Trigger storage event for other tabs/windows
        window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
        window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
        console.error('Failed to reset settings:', error);
    }
}

/**
 * Get a specific setting value
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    const settings = getSettings();
    return settings[key];
}

/**
 * Set a specific setting value
 */
export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    saveSettings({ [key]: value });
}

/**
 * Apply theme based on settings
 */
export function applyTheme(theme: 'light' | 'dark' | 'system'): void {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('dark', 'light');
    
    if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            root.classList.add('dark');
        }
        // For light system preference, we don't add a class - use default
    } else if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
    } else {
        // Light mode - ensure dark is removed
        root.classList.remove('dark');
        root.classList.add('light');
    }
}

/**
 * Initialize theme on page load
 */
export function initializeTheme(): void {
    if (typeof window === 'undefined') return;
    
    const settings = getSettings();
    applyTheme(settings.theme);
    
    // Listen for system theme changes
    if (settings.theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            document.documentElement.classList.toggle('dark', e.matches);
        };
        mediaQuery.addEventListener('change', handleChange);
    }
}

