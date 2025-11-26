import { useRef, useEffect } from 'react';
import { Send, Square, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { getModelInfo } from '@/utils/modelStorage';

interface InputAreaProps {
    input: string;
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    stop: () => void;
    modelId?: string;
}

export function InputArea({ input, handleInputChange, handleSubmit, isLoading, stop, modelId }: InputAreaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // Don't submit if already loading
            if (!isLoading) {
                handleSubmit(e as any);
            }
        }
    };

    return (
        <div className="w-full relative z-10">
            <form onSubmit={handleSubmit} className="relative group" suppressHydrationWarning>
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur-lg"></div>

                <div className="relative flex flex-col bg-card border border-border rounded-2xl shadow-lg overflow-hidden transition-all duration-300 focus-within:shadow-xl focus-within:border-primary/50">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask iRedlof anything..."
                        className="w-full min-h-[60px] max-h-[200px] p-4 pr-14 bg-transparent border-none focus:ring-0 resize-none text-base outline-none custom-scrollbar placeholder:text-muted-foreground transition-colors"
                        rows={1}
                        suppressHydrationWarning
                    />

                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.button
                                    key="stop"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    type="button"
                                    onClick={stop}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                    title="Stop generation"
                                >
                                    <Square size={20} fill="currentColor" />
                                </motion.button>
                            ) : (
                                <motion.button
                                    key="send"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    type="submit"
                                    disabled={!input?.trim() || isLoading}
                                    className={clsx(
                                        "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200",
                                        input?.trim() && !isLoading
                                            ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-105"
                                            : "bg-muted text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    <Send size={20} />
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="absolute -bottom-6 left-0 right-0 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Sparkles size={10} /> Powered by {modelId ? (getModelInfo(modelId)?.name || 'Gemini') : 'Gemini'}
                    </p>
                </div>
            </form>
        </div>
    );
}
