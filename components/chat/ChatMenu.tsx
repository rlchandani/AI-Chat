'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Download, Plus, Check, History, Clock, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    exportChatHistory, 
    createNewConversation, 
    setCurrentConversationId as setStorageConversationId, 
    getCurrentConversationId,
    getAllConversations,
    loadChatHistory
} from '@/utils/chatStorage';
import { Settings } from './Settings';

interface ChatMenuProps {
    onClear: () => void;
    onNewConversation?: () => void;
    onSwitchConversation?: (messages: any[]) => void;
}

export function ChatMenu({ onClear, onNewConversation, onSwitchConversation }: ChatMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [exported, setExported] = useState(false);
    const [conversations, setConversations] = useState<Array<{ id: string; title: string; lastUpdated: number; messageCount: number }>>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState<string>('');
    const menuRef = useRef<HTMLDivElement>(null);

    // Load conversations when menu opens and get current conversation ID
    useEffect(() => {
        if (isOpen && typeof window !== 'undefined') {
            setConversations(getAllConversations());
            setCurrentConversationId(getCurrentConversationId());
        }
    }, [isOpen]);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleExport = () => {
        try {
            const json = exportChatHistory();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `iredlof-chat-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setExported(true);
            setTimeout(() => setExported(false), 2000);
        } catch (error) {
            console.error('Failed to export chat:', error);
        }
        setIsOpen(false);
    };

    const handleNewConversation = () => {
        createNewConversation();
        if (onNewConversation) {
            onNewConversation();
        }
        setIsOpen(false);
    };

    const handleClear = () => {
        if (confirm('Are you sure you want to clear this conversation? This action cannot be undone.')) {
            onClear();
        }
        setIsOpen(false);
    };

    const handleSwitchConversation = (conversationId: string) => {
        setCurrentConversationId(conversationId); // Update local state
        setStorageConversationId(conversationId); // Update storage
        const messages = loadChatHistory(conversationId);
        if (onSwitchConversation) {
            onSwitchConversation(messages);
        }
        setIsOpen(false);
        setShowHistory(false);
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            return 'Today';
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return `${days} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Chat menu"
            >
                <MoreVertical size={20} className="text-muted-foreground" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden max-h-[80vh] flex flex-col"
                    >
                        {!showHistory ? (
                            <div className="py-1 overflow-y-auto">
                                <button
                                    onClick={handleNewConversation}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-3 transition-colors"
                                >
                                    <Plus size={16} className="text-muted-foreground" />
                                    <span>New Conversation</span>
                                </button>

                                {conversations.length > 0 && (
                                    <>
                                        <div className="border-t border-border my-1" />
                                        <button
                                            onClick={() => setShowHistory(true)}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-3 transition-colors"
                                        >
                                            <History size={16} className="text-muted-foreground" />
                                            <span>Chat History ({conversations.length})</span>
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={handleExport}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-3 transition-colors"
                                >
                                    {exported ? (
                                        <>
                                            <Check size={16} className="text-green-500" />
                                            <span className="text-green-500">Exported!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={16} className="text-muted-foreground" />
                                            <span>Export Chat</span>
                                        </>
                                    )}
                                </button>

                                <div className="border-t border-border my-1" />

                                <button
                                    onClick={() => {
                                        setShowSettings(true);
                                        setIsOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-3 transition-colors"
                                >
                                    <SettingsIcon size={16} className="text-muted-foreground" />
                                    <span>Settings</span>
                                </button>

                                <div className="border-t border-border my-1" />

                                <button
                                    onClick={handleClear}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-red-500/10 text-red-500 flex items-center gap-3 transition-colors"
                                >
                                    <Trash2 size={16} />
                                    <span>Clear History</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col max-h-[60vh]">
                                <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                                    <span className="text-sm font-medium">Chat History</span>
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className="text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        Back
                                    </button>
                                </div>
                                <div className="overflow-y-auto py-1">
                                    {conversations.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                            No conversation history
                                        </div>
                                    ) : (
                                        conversations.map((conv) => (
                                            <button
                                                key={conv.id}
                                                onClick={() => handleSwitchConversation(conv.id)}
                                                className={`
                                                    w-full px-4 py-3 text-left hover:bg-accent transition-colors
                                                    ${conv.id === currentConversationId ? 'bg-accent border-l-2 border-primary' : ''}
                                                `}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate">
                                                            {conv.title}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                                            <Clock size={12} />
                                                            <span>{formatDate(conv.lastUpdated)}</span>
                                                            <span>•</span>
                                                            <span>{conv.messageCount} messages</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Settings Panel */}
            <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </div>
    );
}

