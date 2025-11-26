'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageSquare, X } from 'lucide-react';
import { getModelInfo } from '@/utils/modelStorage';

interface ModelChangeDialogProps {
    isOpen: boolean;
    currentModelId: string;
    newModelId: string;
    onStartNewConversation: () => void;
    onContinueInCurrent: () => void;
    onCancel: () => void;
}

export function ModelChangeDialog({
    isOpen,
    currentModelId,
    newModelId,
    onStartNewConversation,
    onContinueInCurrent,
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
                                        <p className="text-sm text-muted-foreground">Choose how to proceed</p>
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
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        You're switching from <span className="font-medium text-foreground">{currentModel.name}</span> to <span className="font-medium text-foreground">{newModel.name}</span>.
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        How would you like to proceed?
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3 pt-2">
                                    <button
                                        onClick={onStartNewConversation}
                                        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/10 hover:bg-primary/20 transition-colors text-left group"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/30 transition-colors">
                                            <MessageSquare size={20} className="text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-foreground">Start New Conversation</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                Create a fresh conversation with {newModel.name}
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={onContinueInCurrent}
                                        className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-colors text-left group"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
                                            <Sparkles size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-foreground">Continue in Current Conversation</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                Keep your current conversation and switch to {newModel.name}
                                            </div>
                                        </div>
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

