'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare, X } from 'lucide-react';
import { getModelInfo } from '@/utils/modelStorage';

interface ModelChangeDialogProps {
    isOpen: boolean;
    currentModelId: string;
    newModelId: string;
    onStartNewConversation: () => void;
    onCancel: () => void;
}

export function ModelChangeDialog({
    isOpen,
    currentModelId,
    newModelId,
    onStartNewConversation,
    onCancel,
}: ModelChangeDialogProps) {
    const currentModel = getModelInfo(currentModelId);
    const newModel = getModelInfo(newModelId);

    if (!isOpen || !currentModel || !newModel) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
                    />

                    {/* Dialog */}
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
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
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                        <Sparkles size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold">Change Model</h2>
                                        <p className="text-sm text-muted-foreground">Start a new conversation</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onCancel}
                                    className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                                    aria-label="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Switching from <span className="font-medium text-foreground">{currentModel.name}</span> to <span className="font-medium text-foreground">{newModel.name}</span> will start a new conversation.
                                </p>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={onCancel}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={onStartNewConversation}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                                    >
                                        <MessageSquare size={18} />
                                        Start New Chat
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

