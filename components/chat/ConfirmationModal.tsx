'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    type?: 'confirm' | 'alert';
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = false,
    type = 'confirm'
}: ConfirmationModalProps) {
    const [mounted, setMounted] = useState(false);

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
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]"
                    />

                    {/* Dialog */}
                    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDanger ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                                        {isDanger ? <AlertTriangle size={20} /> : <Info size={20} />}
                                    </div>
                                    <h2 className="text-lg font-semibold">{title}</h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                                    aria-label="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {message}
                                </p>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-6">
                                    {type === 'confirm' && (
                                        <button
                                            onClick={onClose}
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors font-medium"
                                        >
                                            {cancelText}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (onConfirm) onConfirm();
                                            onClose();
                                        }}
                                        className={`
                                            flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors
                                            ${isDanger
                                                ? 'bg-red-500 text-white hover:bg-red-600'
                                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                            }
                                        `}
                                    >
                                        {type === 'alert' ? 'OK' : confirmText}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
}
