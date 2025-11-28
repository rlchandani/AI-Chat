'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Shield, ExternalLink, Settings, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export type ApiKeyType = 'gemini' | 'openai';

interface APIKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    missingKey: ApiKeyType;
    onGoToSettings: () => void;
}

const API_KEY_INFO: Record<ApiKeyType, { name: string; description: string; helpText: string }> = {
    gemini: {
        name: 'Google Gemini API Key',
        description: 'Required for using Gemini AI models (Gemini 2.5 Flash, Gemini 2.5 Pro, etc.)',
        helpText: 'Get your API key from Google AI Studio',
    },
    openai: {
        name: 'OpenAI API Key',
        description: 'Required for using OpenAI models (GPT-4o, GPT-4o-mini, etc.)',
        helpText: 'Get your API key from OpenAI Platform',
    },
};

export function APIKeyModal({ isOpen, onClose, missingKey, onGoToSettings }: APIKeyModalProps) {
    const [mounted, setMounted] = useState(false);
    const keyInfo = API_KEY_INFO[missingKey];

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-0 flex items-center justify-center z-[9999] p-4"
                    >
                        <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                            {/* Header */}
                            <div className="p-6 border-b border-border bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                                            <AlertTriangle size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold">API Key Required</h2>
                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                {keyInfo.name}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                                        aria-label="Close"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-5">
                                <p className="text-muted-foreground">
                                    {keyInfo.description}
                                </p>

                                {/* Security Notice */}
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                                    <Shield size={20} className="text-primary shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-primary">Your keys are safe</p>
                                        <p className="text-xs text-muted-foreground">
                                            API keys are stored <strong>only in your browser's local storage</strong> and never stored on any server. 
                                            Keys are sent securely to your app's server-side routes (same origin) to make API requests.
                                        </p>
                                    </div>
                                </div>

                                {/* Help Link */}
                                <Link
                                    href="/help/api-keys"
                                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                                    onClick={onClose}
                                >
                                    <Key size={16} />
                                    <span>{keyInfo.helpText}</span>
                                    <ExternalLink size={14} />
                                </Link>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-border bg-muted/30 flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        onClose();
                                        onGoToSettings();
                                    }}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium flex items-center justify-center gap-2"
                                >
                                    <Settings size={18} />
                                    Go to Settings
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
}

