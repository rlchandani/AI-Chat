'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Moon, Sun, Monitor, Clock, Scroll, Code, Brain, Bug, Database, RotateCcw, PanelLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    getSettings, 
    saveSettings, 
    resetSettings, 
    type AppSettings,
    applyTheme 
} from '@/utils/settingsStorage';
import { AVAILABLE_MODELS } from '@/utils/modelStorage';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
    const [settings, setSettings] = useState<AppSettings>(getSettings());
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSettings(getSettings());
            setHasChanges(false);
        }
    }, [isOpen]);

    const handleSettingChange = <K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K]
    ) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = () => {
        const previousTheme = getSettings().theme;
        saveSettings(settings);
        applyTheme(settings.theme);
        setHasChanges(false);
        
        // Dispatch event to notify other components
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('settingsUpdated'));
        }
        
        // Only reload if theme actually changed
        if (settings.theme !== previousTheme) {
            // Small delay to ensure theme is applied before reload
            setTimeout(() => {
                window.location.reload();
            }, 100);
        }
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            resetSettings();
            setSettings(getSettings());
            applyTheme(getSettings().theme);
            setHasChanges(false);
            window.location.reload();
        }
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
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
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
                                    Cancel
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

    return createPortal(settingsContent, document.body);
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


