import { useRef, useEffect, useState, useCallback } from 'react';
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
    messageHistory?: string[]; // Previous user messages for up/down navigation
    onInputSet?: (value: string) => void; // Callback to set input value directly
    focusTrigger?: string | number; // When this changes, focus the textarea
    footerActions?: React.ReactNode; // Actions to display in the footer (e.g. model selector)
}

export function InputArea({
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    modelId,
    messageHistory = [],
    onInputSet,
    focusTrigger,
    footerActions,
}: InputAreaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [historyIndex, setHistoryIndex] = useState(-1); // -1 means not browsing history
    const [savedInput, setSavedInput] = useState(''); // Saves current input when starting to browse

    // Auto-focus textarea when focusTrigger changes (conversation selected/created)
    useEffect(() => {
        if (focusTrigger !== undefined && textareaRef.current) {
            // Small delay to ensure DOM is ready after conversation switch
            const timeoutId = setTimeout(() => {
                textareaRef.current?.focus();
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [focusTrigger]);

    // Reset history index when a new message is sent (input becomes empty)
    useEffect(() => {
        if (input === '' && historyIndex !== -1) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setHistoryIndex(-1);
            setSavedInput('');
        }
    }, [input, historyIndex]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const setInputValue = useCallback((value: string) => {
        if (onInputSet) {
            onInputSet(value);
        } else {
            // Fallback: create a synthetic change event
            const syntheticEvent = {
                target: { value },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
        }
    }, [onInputSet, handleInputChange]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Handle Enter to submit
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading) {
                handleSubmit(e as unknown as React.FormEvent);
            }
            return;
        }

        // Handle Up/Down arrow for history navigation
        if (messageHistory.length === 0) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();

            // Save current input when starting to browse history
            if (historyIndex === -1) {
                setSavedInput(input);
            }

            // Move up in history (towards older messages)
            const newIndex = historyIndex === -1
                ? messageHistory.length - 1
                : Math.max(0, historyIndex - 1);

            setHistoryIndex(newIndex);
            setInputValue(messageHistory[newIndex]);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();

            if (historyIndex === -1) return; // Not browsing history

            // Move down in history (towards newer messages)
            const newIndex = historyIndex + 1;

            if (newIndex >= messageHistory.length) {
                // Reached the end, restore saved input
                setHistoryIndex(-1);
                setInputValue(savedInput);
            } else {
                setHistoryIndex(newIndex);
                setInputValue(messageHistory[newIndex]);
            }
        }
    };

    return (
        <div className="w-full relative z-10">
            <form onSubmit={handleSubmit} className="relative group" suppressHydrationWarning>
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl opacity-20 group-hover:opacity-40 transition duration-500 blur-lg"></div>

                <div className="relative flex flex-col bg-card border border-border rounded-2xl shadow-lg transition-all duration-300 focus-within:shadow-xl focus-within:border-primary/50">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask iRedlof anything..."
                        className={clsx(
                            "w-full min-h-[60px] max-h-[200px] p-4 pr-14 bg-transparent border-none focus:ring-0 resize-none text-base outline-none custom-scrollbar placeholder:text-muted-foreground transition-colors",
                            footerActions ? "pb-12" : ""
                        )}
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

                    {/* Footer Actions (Model Selector, etc.) */}
                    {footerActions && (
                        <div className="absolute bottom-2 left-2 flex items-center gap-2 z-20">
                            {footerActions}
                        </div>
                    )}
                </div>

                <div className="absolute -bottom-6 left-0 right-0 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 opacity-0">
                        <Sparkles size={10} /> Powered by {modelId ? (getModelInfo(modelId)?.name || 'Gemini') : 'Gemini'}
                    </p>
                </div>
            </form>
        </div>
    );
}
