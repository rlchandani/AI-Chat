export interface AppSettings {
    // Appearance
    theme: 'light' | 'dark' | 'system';

    // Chat preferences
    showTimestamps: boolean;
    autoScroll: boolean;
    markdownRendering: boolean;
    autoHideSidebar: boolean;

    // Model preferences
    defaultModel: string;

    // API Keys (stored in browser localStorage only)
    geminiApiKey: string;
    openaiApiKey: string;

    // API Key Security
    apiKeysEncrypted: boolean;  // Whether keys are encrypted with PIN
    sessionOnlyKeys: boolean;   // Don't persist keys, require entry each session

    // Advanced
    enableDebugLogs: boolean;
    maxHistoryItems: number;
}

import {
    isEncrypted,
    decryptApiKey,
    getSessionKey,
    setSessionKey,
    encryptApiKey
} from './apiKeyEncryption';

const STORAGE_KEY = 'gemini-chat-settings';
const DEFAULT_SETTINGS: AppSettings = {
    theme: 'system',
    showTimestamps: false,
    autoScroll: true,
    markdownRendering: true,
    autoHideSidebar: true,
    defaultModel: 'gemini-2.5-flash',
    geminiApiKey: '',
    openaiApiKey: '',
    apiKeysEncrypted: false,
    sessionOnlyKeys: false,
    enableDebugLogs: false,
    maxHistoryItems: 100,
};

// Store the current PIN in memory (never persisted)
let currentPin: string | null = null;

export function setCurrentPin(pin: string | null): void {
    currentPin = pin;
}

export function getCurrentPin(): string | null {
    return currentPin;
}

export function isPinSet(): boolean {
    return currentPin !== null;
}

export function clearCurrentPin(): void {
    currentPin = null;
}

export type ApiKeyType = 'gemini' | 'openai';

/**
 * Check if an API key is available (either from settings or environment via API check)
 */
export function hasApiKey(keyType: ApiKeyType): boolean {
    const settings = getSettings();

    // Check session storage first (for session-only or decrypted keys)
    const sessionKey = getSessionKey(keyType);
    if (sessionKey) return true;

    // Check localStorage
    switch (keyType) {
        case 'gemini':
            return Boolean(settings.geminiApiKey);
        case 'openai':
            return Boolean(settings.openaiApiKey);
        default:
            return false;
    }
}

/**
 * Check if API keys need PIN to unlock
 */
export function apiKeysNeedUnlock(): boolean {
    const settings = getSettings();
    if (!settings.apiKeysEncrypted) return false;

    // Check if any key is encrypted
    const hasEncryptedKey =
        isEncrypted(settings.geminiApiKey) ||
        isEncrypted(settings.openaiApiKey);

    // Need unlock if keys are encrypted and PIN not yet provided
    return hasEncryptedKey && !isPinSet();
}

/**
 * Check if a specific API key is encrypted and locked (needs PIN)
 */
export function isApiKeyLocked(keyType: ApiKeyType): boolean {
    const settings = getSettings();
    const key = keyType === 'gemini' ? settings.geminiApiKey : settings.openaiApiKey;
    return isEncrypted(key) && !isPinSet();
}

/**
 * Get an API key from settings (handles encrypted keys)
 */
export function getApiKey(keyType: ApiKeyType): string {
    // First check session storage (for decrypted keys or session-only mode)
    const sessionKey = getSessionKey(keyType);
    if (sessionKey) return sessionKey;

    const settings = getSettings();
    let storedKey = '';

    switch (keyType) {
        case 'gemini':
            storedKey = settings.geminiApiKey || '';
            break;
        case 'openai':
            storedKey = settings.openaiApiKey || '';
            break;
    }

    // If key is encrypted but we don't have PIN, return empty
    if (isEncrypted(storedKey) && !currentPin) {
        return '';
    }

    // Return unencrypted key as-is
    if (!isEncrypted(storedKey)) {
        return storedKey;
    }

    // Key is encrypted - should have been decrypted to session storage
    // This shouldn't happen in normal flow, return empty
    return '';
}



/**
 * Save an API key (optionally encrypted)
 */
export async function saveApiKey(
    keyType: ApiKeyType,
    value: string,
    encrypt: boolean = false,
    pin?: string
): Promise<void> {
    let valueToStore = value;

    if (encrypt && pin && value) {
        valueToStore = await encryptApiKey(value, pin);
    }

    // Also store decrypted in session for immediate use
    if (value) {
        setSessionKey(keyType, value);
    }

    // Update the appropriate key
    switch (keyType) {
        case 'gemini':
            saveSettings({ geminiApiKey: valueToStore });
            break;
        case 'openai':
            saveSettings({ openaiApiKey: valueToStore });
            break;
    }
}

/**
 * Unlock encrypted API keys with PIN
 */
export async function unlockApiKeys(pin: string): Promise<boolean> {
    const settings = getSettings();

    try {
        // Try to decrypt each encrypted key
        const keys: { type: ApiKeyType; value: string }[] = [
            { type: 'gemini', value: settings.geminiApiKey },
            { type: 'openai', value: settings.openaiApiKey },
        ];

        for (const key of keys) {
            if (isEncrypted(key.value)) {
                const decrypted = await decryptApiKey(key.value, pin);
                setSessionKey(key.type, decrypted);
            } else if (key.value) {
                setSessionKey(key.type, key.value);
            }
        }

        // Store PIN in memory for this session
        setCurrentPin(pin);
        return true;
    } catch {
        return false;
    }
}

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

/**
 * Delete an API key
 */
export function deleteApiKey(keyType: ApiKeyType): void {
    // Clear from session storage
    setSessionKey(keyType, '');

    // Update settings to remove the key
    switch (keyType) {
        case 'gemini':
            saveSettings({ geminiApiKey: '' });
            break;
        case 'openai':
            saveSettings({ openaiApiKey: '' });
            break;
    }
}

