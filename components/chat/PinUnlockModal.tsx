'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Key, AlertCircle, Shield, Eye, EyeOff } from 'lucide-react';

interface PinUnlockModalProps {
    isOpen: boolean;
    onUnlock: (pin: string) => Promise<boolean>;
    onCancel: () => void;
}

export function PinUnlockModal({ isOpen, onUnlock, onCancel }: PinUnlockModalProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [mounted, setMounted] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError('');
            setIsLoading(false);
            // Focus input after modal animation
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!pin.trim()) {
            setError('Please enter your PIN');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const success = await onUnlock(pin);
            if (!success) {
                setError('Incorrect PIN. Please try again.');
                setPin('');
                inputRef.current?.focus();
            }
        } catch (err) {
            setError('Failed to unlock. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

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
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999]"
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
                            <div className="p-6 border-b border-border bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 rounded-xl bg-primary/20 text-primary">
                                        <Lock size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Unlock API Keys</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Enter your PIN to decrypt your API keys
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                                {/* Security Notice */}
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                                    <Shield size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground">
                                        Your API keys are encrypted. Enter your PIN to unlock them for this session.
                                        The PIN is never stored or transmitted.
                                    </p>
                                </div>

                                {/* PIN Input */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        PIN
                                    </label>
                                    <div className="relative">
                                        <input
                                            ref={inputRef}
                                            type={showPin ? 'text' : 'password'}
                                            value={pin}
                                            onChange={(e) => setPin(e.target.value)}
                                            placeholder="Enter your PIN"
                                            className="w-full px-4 py-3 pr-12 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-lg tracking-widest font-mono"
                                            autoComplete="off"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPin(!showPin)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                                        >
                                            {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Error */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
                                    >
                                        <AlertCircle size={16} />
                                        <span className="text-sm">{error}</span>
                                    </motion.div>
                                )}

                                {/* Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={onCancel}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading || !pin.trim()}
                                        className={`
                                            flex-1 px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors
                                            ${isLoading || !pin.trim()
                                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                            }
                                        `}
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                Unlocking...
                                            </>
                                        ) : (
                                            <>
                                                <Key size={18} />
                                                Unlock
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
}


