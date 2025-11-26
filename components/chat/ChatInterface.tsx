import { useRef, useEffect, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSetting } from '@/utils/settingsStorage';
import { getModelInfo } from '@/utils/modelStorage';

interface ChatInterfaceProps {
    messages: any[];
    isLoading: boolean;
    modelId?: string;
}

export function ChatInterface({ messages, isLoading, modelId }: ChatInterfaceProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(getSetting('autoScroll'));

    // Update settings when they change
    useEffect(() => {
        const updateSettings = () => {
            setAutoScroll(getSetting('autoScroll'));
        };

        // Initial load
        updateSettings();

        // Listen for settings updates
        window.addEventListener('settingsUpdated', updateSettings);
        
        return () => {
            window.removeEventListener('settingsUpdated', updateSettings);
        };
    }, []);

    const scrollToBottom = () => {
        if (autoScroll) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, autoScroll]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-2xl space-y-8"
                >
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-blue-500/20">
                        <Sparkles className="text-white w-10 h-10" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                            Hello, Human
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            I'm your AI assistant powered by {modelId ? (getModelInfo(modelId)?.name || 'AI') : 'AI'}. Ask me anything, and I'll think through it before answering.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-8">
                        {['Explain quantum computing', 'Write a python script to scrape a website', 'What is the meaning of life?', 'Design a database schema for a blog'].map((suggestion, i) => (
                            <div key={i} className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer text-sm text-muted-foreground text-left">
                                {suggestion}
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pt-4">
            {messages.map((m) => (
                <MessageBubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    toolInvocations={m.toolInvocations}
                    timestamp={m.timestamp}
                />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start w-full px-8 md:px-16 pl-12">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm animate-pulse">
                        <Sparkles size={14} />
                        <span>Thinking...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
        </div>
    );
}
