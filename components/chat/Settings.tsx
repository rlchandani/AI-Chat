'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Moon, Sun, Monitor, Clock, Scroll, Code, Brain, Bug, Database, RotateCcw, PanelLeft, Key, Shield, ExternalLink, Eye, EyeOff, HelpCircle, Lock, Unlock, AlertTriangle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getSettings,
    saveSettings,
    resetSettings,
    type AppSettings,
    applyTheme,
    saveApiKey,
    setCurrentPin,
    isPinSet,
    unlockApiKeys,
    deleteApiKey,
    getCurrentPin,
} from '@/utils/settingsStorage';
import { isEncrypted, encryptApiKey, clearSessionKeys } from '@/utils/apiKeyEncryption';
import { AVAILABLE_MODELS } from '@/utils/modelStorage';
import Link from 'next/link';
import { ConfirmationModal } from './ConfirmationModal';

export type HighlightApiKey = 'gemini' | 'openai' | null;

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
    highlightApiKey?: HighlightApiKey;
}

export function Settings({ isOpen, onClose, highlightApiKey }: SettingsProps) {
    const [settings, setSettings] = useState<AppSettings>(getSettings());
    const [savedSettings, setSavedSettings] = useState<AppSettings>(getSettings());
    const [hasChanges, setHasChanges] = useState(false);
    const [highlightedKey, setHighlightedKey] = useState<HighlightApiKey>(null);

    const contentRef = useRef<HTMLDivElement>(null);
    const geminiRef = useRef<HTMLDivElement>(null);
    const openaiRef = useRef<HTMLDivElement>(null);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'confirm' | 'alert';
        isDanger?: boolean;
        confirmText?: string;
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'confirm',
    });

    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    useEffect(() => {
        if (isOpen) {
            const currentSettings = getSettings();
            setSettings(currentSettings);
            setSavedSettings(currentSettings);
            setHasChanges(false);

            // Set highlighted key and scroll after a short delay to allow animation
            if (highlightApiKey) {
                setHighlightedKey(highlightApiKey);

                // Scroll to the highlighted field after panel animation completes
                setTimeout(() => {
                    const refMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
                        gemini: geminiRef,
                        openai: openaiRef,
                    };
                    const targetRef = refMap[highlightApiKey];
                    if (targetRef?.current && contentRef.current) {
                        targetRef.current.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });

                        // Focus the input inside
                        const input = targetRef.current.querySelector('input');
                        if (input) {
                            setTimeout(() => input.focus(), 300);
                        }
                    }
                }, 400);

                // Clear highlight after animation
                setTimeout(() => {
                    setHighlightedKey(null);
                }, 3000);
            }
        } else {
            setHighlightedKey(null);
        }
    }, [isOpen, highlightApiKey]);

    const handleSettingChange = <K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        const previousTheme = getSettings().theme;
        const settingsToSave: Partial<AppSettings> = { ...settings };

        // If keys are encrypted, we need to ensure any NEW keys are also encrypted
        if (settings.apiKeysEncrypted) {
            const currentPin = getCurrentPin();

            if (currentPin) {
                // We have a PIN (unlocked), so encrypt any unencrypted keys
                if (settings.geminiApiKey && !isEncrypted(settings.geminiApiKey)) {
                    await saveApiKey('gemini', settings.geminiApiKey, true, currentPin);
                    delete settingsToSave.geminiApiKey;
                }
                if (settings.openaiApiKey && !isEncrypted(settings.openaiApiKey)) {
                    await saveApiKey('openai', settings.openaiApiKey, true, currentPin);
                    delete settingsToSave.openaiApiKey;
                }
            } else {
                // No PIN (locked), check if we are trying to save unencrypted keys
                const hasUnencryptedKeys =
                    (settings.geminiApiKey && !isEncrypted(settings.geminiApiKey)) ||
                    (settings.openaiApiKey && !isEncrypted(settings.openaiApiKey));

                if (hasUnencryptedKeys) {
                    setModalConfig({
                        isOpen: true,
                        title: 'Unlock Required',
                        message: 'Please unlock your keys first to encrypt the new key.',
                        type: 'alert',
                        isDanger: false,
                    });
                    return;
                }
            }
        }

        saveSettings(settingsToSave);

        // Refresh from storage to get the final state (encrypted keys)
        const finalSettings = getSettings();
        setSettings(finalSettings);
        setSavedSettings(finalSettings);

        applyTheme(finalSettings.theme);
        setHasChanges(false);

        // Dispatch event to notify other components
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('settingsUpdated'));
        }

        // Only reload if theme actually changed
        if (finalSettings.theme !== previousTheme) {
            // Theme is already applied by applyTheme() above
        }
    };

    const handleReset = () => {
        setModalConfig({
            isOpen: true,
            title: 'Reset Settings',
            message: 'Are you sure you want to reset all settings to defaults? This action cannot be undone.',
            type: 'confirm',
            isDanger: true,
            confirmText: 'Reset',
            onConfirm: () => {
                resetSettings();
                const defaultSettings = getSettings();
                setSettings(defaultSettings);
                setSavedSettings(defaultSettings);
                applyTheme(defaultSettings.theme);
                setHasChanges(false);
            }
        });
    };

    const handleDeleteApiKey = (keyType: 'gemini' | 'openai') => {
        setModalConfig({
            isOpen: true,
            title: 'Delete API Key',
            message: 'Are you sure you want to delete this API key? You will need to re-enter it to use the API again.',
            type: 'confirm',
            isDanger: true,
            confirmText: 'Delete',
            onConfirm: () => {
                deleteApiKey(keyType);
                const newSettings = getSettings();
                setSettings(newSettings);
                setSavedSettings(newSettings);
                setHasChanges(false);
            }
        });
    };

    const themeOptions = [
        { value: 'light' as const, icon: Sun, label: 'Light' },
        { value: 'dark' as const, icon: Moon, label: 'Dark' },
        { value: 'system' as const, icon: Monitor, label: 'System' },
    ];

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const settingsContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
                    />

                    {/* Settings Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl z-[9999] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h2 className="text-2xl font-bold">Settings</h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-accent transition-colors"
                                aria-label="Close settings"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div ref={contentRef} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* Appearance */}
                            <section>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Monitor size={20} className="text-primary" />
                                    Appearance
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Theme
                                        </label>
                                        <div className="flex gap-2">
                                            {themeOptions.map((option) => {
                                                const Icon = option.icon;
                                                const isSelected = settings.theme === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        onClick={() => handleSettingChange('theme', option.value)}
                                                        className={`
                                                            flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                                                            ${isSelected
                                                                ? 'border-primary bg-primary/10'
                                                                : 'border-border hover:border-primary/50 hover:bg-accent/50'
                                                            }
                                                        `}
                                                    >
                                                        <Icon size={24} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                                                        <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                                            {option.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Chat Preferences */}
                            <section>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Clock size={20} className="text-primary" />
                                    Chat Preferences
                                </h3>
                                <div className="space-y-4">
                                    <SettingToggle
                                        icon={Clock}
                                        label="Show Timestamps"
                                        description="Display time for each message"
                                        value={settings.showTimestamps}
                                        onChange={(value) => handleSettingChange('showTimestamps', value)}
                                    />
                                    <SettingToggle
                                        icon={Scroll}
                                        label="Auto Scroll"
                                        description="Automatically scroll to new messages"
                                        value={settings.autoScroll}
                                        onChange={(value) => handleSettingChange('autoScroll', value)}
                                    />
                                    <SettingToggle
                                        icon={Code}
                                        label="Markdown Rendering"
                                        description="Render markdown in messages"
                                        value={settings.markdownRendering}
                                        onChange={(value) => handleSettingChange('markdownRendering', value)}
                                    />
                                    <SettingToggle
                                        icon={PanelLeft}
                                        label="Auto-Hide Sidebar"
                                        description="Automatically hide the sidebar when not in use"
                                        value={settings.autoHideSidebar}
                                        onChange={(value) => handleSettingChange('autoHideSidebar', value)}
                                    />
                                </div>
                            </section>

                            {/* Model Preferences */}
                            <section>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Brain size={20} className="text-primary" />
                                    Model Preferences
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Default Model
                                        </label>
                                        <select
                                            value={settings.defaultModel}
                                            onChange={(e) => handleSettingChange('defaultModel', e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                        >
                                            {AVAILABLE_MODELS.map((model) => (
                                                <option key={model.id} value={model.id}>
                                                    {model.name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Model to use when starting a new conversation
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* API Keys */}
                            <section>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Key size={20} className="text-primary" />
                                    API Keys
                                </h3>

                                {/* Security Notice */}
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 mb-4">
                                    <Shield size={20} className="text-primary shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-primary">Your keys are stored locally</p>
                                        <p className="text-xs text-muted-foreground">
                                            API keys are stored <strong>only in your browser's local storage</strong> and are never stored on any server or cloud.
                                            Keys are sent securely to your app's API routes (same server) to make AI/Maps requests.
                                        </p>
                                    </div>
                                </div>

                                {/* Encryption Controls */}
                                <APIKeySecurityControls
                                    settings={settings}
                                    onSettingChange={handleSettingChange}
                                    setHasChanges={setHasChanges}
                                    setSettings={setSettings}
                                    setSavedSettings={setSavedSettings}
                                    setModalConfig={setModalConfig}
                                />

                                <div className="space-y-4">
                                    <APIKeyInput
                                        ref={geminiRef}
                                        label="Google Gemini API Key"
                                        description="For Gemini AI models (Gemini 2.5 Flash, Pro, etc.)"
                                        value={settings.geminiApiKey}
                                        onChange={(value) => handleSettingChange('geminiApiKey', value)}
                                        placeholder="AIza..."
                                        helpSection="gemini"
                                        isHighlighted={highlightedKey === 'gemini'}
                                        onDelete={() => handleDeleteApiKey('gemini')}
                                        disabled={!!savedSettings.geminiApiKey}
                                    />
                                    <APIKeyInput
                                        ref={openaiRef}
                                        label="OpenAI API Key"
                                        description="For OpenAI models (GPT-4o, GPT-4o-mini, etc.)"
                                        value={settings.openaiApiKey}
                                        onChange={(value) => handleSettingChange('openaiApiKey', value)}
                                        placeholder="sk-..."
                                        helpSection="openai"
                                        isHighlighted={highlightedKey === 'openai'}
                                        onDelete={() => handleDeleteApiKey('openai')}
                                        disabled={!!savedSettings.openaiApiKey}
                                    />
                                </div>
                            </section>

                            {/* Advanced */}
                            <section>
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Database size={20} className="text-primary" />
                                    Advanced
                                </h3>
                                <div className="space-y-4">
                                    <SettingToggle
                                        icon={Bug}
                                        label="Debug Logs"
                                        description="Enable console logging for debugging"
                                        value={settings.enableDebugLogs}
                                        onChange={(value) => handleSettingChange('enableDebugLogs', value)}
                                    />
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">
                                            Max History Items
                                        </label>
                                        <input
                                            type="number"
                                            min="10"
                                            max="1000"
                                            value={settings.maxHistoryItems}
                                            onChange={(e) => handleSettingChange('maxHistoryItems', parseInt(e.target.value) || 100)}
                                            className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Maximum number of messages to keep in history (10-1000)
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-border p-6 flex items-center justify-between gap-4">
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
                            >
                                <RotateCcw size={16} />
                                Reset to Defaults
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2 rounded-lg border border-border hover:bg-accent transition-colors"
                                >
                                    {hasChanges ? 'Cancel' : 'Close'}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!hasChanges}
                                    className={`
                                        px-6 py-2 rounded-lg transition-colors
                                        ${hasChanges
                                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                                        }
                                    `}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(
        <>
            {settingsContent}
            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                isDanger={modalConfig.isDanger}
                confirmText={modalConfig.confirmText}
            />
        </>,
        document.body
    );
}

interface SettingToggleProps {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
}

function SettingToggle({ icon: Icon, label, description, value, onChange }: SettingToggleProps) {
    return (
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors">
            <div className="flex items-start gap-3 flex-1">
                <Icon size={20} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1">
                    <label className="text-sm font-medium cursor-pointer block mb-1">
                        {label}
                    </label>
                    <p className="text-xs text-muted-foreground">
                        {description}
                    </p>
                </div>
            </div>
            <button
                onClick={() => onChange(!value)}
                className={`
                    relative w-11 h-6 rounded-full transition-colors shrink-0
                    ${value ? 'bg-primary' : 'bg-muted'}
                `}
                role="switch"
                aria-checked={value}
            >
                <span
                    className={`
                        absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform
                        ${value ? 'translate-x-5' : 'translate-x-0'}
                    `}
                />
            </button>
        </div>
    );
}

interface APIKeyInputProps {
    label: string;
    description: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    helpSection: string;
    isHighlighted?: boolean;
    onDelete?: () => void;
    disabled?: boolean;
}

import { forwardRef } from 'react';

const APIKeyInput = forwardRef<HTMLDivElement, APIKeyInputProps>(
    function APIKeyInput({ label, description, value, onChange, placeholder, helpSection, isHighlighted, onDelete, disabled }, ref) {
        const [showKey, setShowKey] = useState(false);

        return (
            <div
                ref={ref}
                className={`
                    p-4 rounded-lg border transition-all duration-300
                    ${isHighlighted
                        ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20 animate-pulse'
                        : 'border-border hover:bg-accent/30'
                    }
                `}
            >
                <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <label className={`text-sm font-medium ${isHighlighted ? 'text-primary' : ''}`}>
                                {label}
                            </label>
                            {value && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 font-medium">
                                    Configured
                                </span>
                            )}
                            {isHighlighted && !value && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium animate-bounce">
                                    Required
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {description}
                        </p>
                    </div>
                    <Link
                        href={`/help/api-keys#${helpSection}`}
                        className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                        title="How to get this API key"
                    >
                        <HelpCircle size={18} />
                    </Link>
                </div>
                <div className="relative">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        disabled={disabled}
                        className={`
                            w-full px-4 py-2.5 pr-12 rounded-lg border bg-background font-mono text-sm
                            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                            ${isHighlighted ? 'border-primary' : 'border-border'}
                            ${disabled ? 'opacity-50 cursor-not-allowed bg-muted' : ''}
                        `}
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        title={showKey ? 'Hide key' : 'Show key'}
                    >
                        {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    {disabled && onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="absolute right-12 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                            title="Delete API Key"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>
        );
    }
);

interface APIKeySecurityControlsProps {
    settings: AppSettings;
    onSettingChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
    setHasChanges: (value: boolean) => void;
    setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    setSavedSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    setModalConfig: React.Dispatch<React.SetStateAction<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'confirm' | 'alert';
        isDanger?: boolean;
        confirmText?: string;
        onConfirm?: () => void;
    }>>;
}

function APIKeySecurityControls({ settings, onSettingChange, setHasChanges, setSettings, setSavedSettings, setModalConfig }: APIKeySecurityControlsProps) {
    const [showPinSetup, setShowPinSetup] = useState(false);
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [isEncrypting, setIsEncrypting] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [showUnlock, setShowUnlock] = useState(false);
    const [unlockPin, setUnlockPin] = useState('');
    const [unlockError, setUnlockError] = useState('');

    const hasAnyKey = settings.geminiApiKey || settings.openaiApiKey;
    const keysAreEncrypted = settings.apiKeysEncrypted && (
        isEncrypted(settings.geminiApiKey) ||
        isEncrypted(settings.openaiApiKey)
    );
    const isUnlocked = keysAreEncrypted && isPinSet();

    const handleUnlock = async () => {
        if (!unlockPin) return;

        const success = await unlockApiKeys(unlockPin);
        if (success) {
            setShowUnlock(false);
            setUnlockPin('');
            setUnlockError('');
            // Refresh settings to show any decrypted values if needed
            // (though usually we just want to enable editing)
        } else {
            setUnlockError('Incorrect PIN');
        }
    };

    const handleSetupEncryption = async () => {
        if (pin.length < 6) {
            setPinError('PIN must be at least 6 characters');
            return;
        }
        if (pin !== confirmPin) {
            setPinError('PINs do not match');
            return;
        }

        setIsEncrypting(true);
        setPinError('');

        try {
            // Encrypt each key that has a value
            if (settings.geminiApiKey && !isEncrypted(settings.geminiApiKey)) {
                await saveApiKey('gemini', settings.geminiApiKey, true, pin);
            }
            if (settings.openaiApiKey && !isEncrypted(settings.openaiApiKey)) {
                await saveApiKey('openai', settings.openaiApiKey, true, pin);
            }

            // Update settings to mark as encrypted
            onSettingChange('apiKeysEncrypted', true);
            setCurrentPin(pin);
            setShowPinSetup(false);
            setPin('');
            setConfirmPin('');

            // Get fresh settings from storage which now contain the encrypted key strings
            const freshSettings = getSettings();

            // Update local state to reflect encryption immediately
            setSettings(freshSettings);
            setSavedSettings(freshSettings);
        } catch (error) {
            setPinError('Failed to encrypt keys. Please try again.');
        } finally {
            setIsEncrypting(false);
        }
    };

    const handleRemoveEncryption = async () => {
        setModalConfig({
            isOpen: true,
            title: 'Remove Encryption',
            message: 'Are you sure you want to remove encryption? Your API keys will be stored in plain text and you will need to re-enter them.',
            type: 'confirm',
            isDanger: true,
            confirmText: 'Remove Encryption',
            onConfirm: () => {
                // Clear encryption flag and reload
                onSettingChange('apiKeysEncrypted', false);

                // Also clear the keys themselves as they are now invalid/encrypted strings
                // The user must re-enter them
                saveApiKey('gemini', '');
                saveApiKey('openai', '');

                clearSessionKeys();
                setCurrentPin(null);

                // Update local state
                setSettings(prev => ({
                    ...prev,
                    apiKeysEncrypted: false,
                    geminiApiKey: '',
                    openaiApiKey: ''
                }));
                setSavedSettings(prev => ({
                    ...prev,
                    apiKeysEncrypted: false,
                    geminiApiKey: '',
                    openaiApiKey: ''
                }));

                // Show success message
                setTimeout(() => {
                    setModalConfig({
                        isOpen: true,
                        title: 'Encryption Removed',
                        message: 'Encryption has been removed. Please re-enter your API keys to save them unencrypted.',
                        type: 'alert',
                        isDanger: false,
                    });
                }, 300);
            }
        });
    };

    if (!hasAnyKey) {
        return null;
    }

    return (
        <div className="mb-4 p-4 rounded-xl border border-border bg-muted/30">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Lock size={18} className={keysAreEncrypted ? 'text-green-500' : 'text-muted-foreground'} />
                    <span className="text-sm font-medium">Key Encryption</span>
                    {keysAreEncrypted && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                            Encrypted
                        </span>
                    )}
                </div>
                {!keysAreEncrypted && !showPinSetup && (
                    <button
                        onClick={() => setShowPinSetup(true)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        Set Up PIN
                    </button>
                )}
                {keysAreEncrypted && (
                    <div className="flex gap-2">
                        {!isUnlocked && !showUnlock && (
                            <button
                                onClick={() => setShowUnlock(true)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
                            >
                                <Unlock size={12} />
                                Unlock Keys
                            </button>
                        )}
                        {isUnlocked && (
                            <span className="text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Unlock size={12} />
                                Unlocked
                            </span>
                        )}
                        <button
                            onClick={handleRemoveEncryption}
                            className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors text-muted-foreground"
                        >
                            Remove Encryption
                        </button>
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground mb-3">
                {keysAreEncrypted
                    ? 'Your API keys are encrypted. Unlock to add new keys or edit existing ones.'
                    : 'Add a PIN to encrypt your API keys. This protects them if someone accesses your browser.'
                }
            </p>

            {showUnlock && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 pt-3 border-t border-border mb-3"
                >
                    <div>
                        <label className="text-xs font-medium mb-1 block">Enter PIN to Unlock</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type={showPin ? 'text' : 'password'}
                                    value={unlockPin}
                                    onChange={(e) => setUnlockPin(e.target.value)}
                                    placeholder="Enter PIN"
                                    className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPin(!showPin)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                >
                                    {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            <button
                                onClick={handleUnlock}
                                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
                            >
                                Unlock
                            </button>
                        </div>
                        {unlockError && (
                            <p className="text-xs text-red-500 mt-1">{unlockError}</p>
                        )}
                    </div>
                </motion.div>
            )}

            {showPinSetup && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 pt-3 border-t border-border"
                >
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            <strong>Remember your PIN!</strong> If you forget it, you'll need to re-enter your API keys.
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-medium mb-1 block">Create PIN (min 6 characters)</label>
                        <div className="relative">
                            <input
                                type={showPin ? 'text' : 'password'}
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                placeholder="Enter PIN"
                                className="w-full px-3 py-2 pr-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPin(!showPin)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                            >
                                {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        {pin.length > 0 && pin.length < 6 && (
                            <p className="text-xs text-amber-500 mt-1">Must be at least 6 characters</p>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-medium mb-1 block">Confirm PIN</label>
                        <input
                            type={showPin ? 'text' : 'password'}
                            value={confirmPin}
                            onChange={(e) => setConfirmPin(e.target.value)}
                            placeholder="Confirm PIN"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {confirmPin && pin !== confirmPin && (
                            <p className="text-xs text-red-500 mt-1">PINs do not match</p>
                        )}
                        {confirmPin && pin === confirmPin && (
                            <p className="text-xs text-green-500 mt-1">PINs match</p>
                        )}
                    </div>

                    {pinError && (
                        <p className="text-xs text-red-500">{pinError}</p>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setShowPinSetup(false);
                                setPin('');
                                setConfirmPin('');
                                setPinError('');
                            }}
                            className="flex-1 px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSetupEncryption}
                            disabled={isEncrypting || pin.length < 6 || pin !== confirmPin}
                            className={`
                                flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                ${isEncrypting || pin.length < 6 || pin !== confirmPin
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                }
                            `}
                        >
                            {isEncrypting ? 'Encrypting...' : 'Encrypt Keys'}
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}


