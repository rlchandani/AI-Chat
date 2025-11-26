'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, X, Check, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getAllConversations,
    getCurrentConversationId,
    setCurrentConversationId,
    createNewConversation,
    deleteConversation,
    renameConversation,
    loadChatHistory,
    getAllConversationIds,
    findEmptyConversation,
} from '@/utils/chatStorage';
import {
    getAllBattleConversations,
    getCurrentBattleConversationId,
    setCurrentBattleConversationId,
    createNewBattleConversation,
    deleteBattleConversation,
    renameBattleConversation,
    loadBattleHistory,
    getAllBattleConversationIds,
    findEmptyBattleConversation,
} from '@/utils/battleStorage';
import { getSetting } from '@/utils/settingsStorage';

interface ConversationsSidebarProps {
    isOpen: boolean;
    onClose?: () => void;
    onConversationSelect: (messages: any[]) => void;
    currentConversationId: string;
    onConversationChange: (id: string) => void;
    conversationType?: 'chat' | 'battle'; // Default to 'chat' for backward compatibility
}

export function ConversationsSidebar({
    isOpen,
    onClose,
    onConversationSelect,
    currentConversationId,
    onConversationChange,
    conversationType = 'chat',
}: ConversationsSidebarProps) {
    const [conversations, setConversations] = useState<Array<{ id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number }>>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [unsavedConversationIds, setUnsavedConversationIds] = useState<Set<string>>(new Set());
    const [alwaysShowSidebar, setAlwaysShowSidebar] = useState(false);

    // Track if we're on desktop and load settings
    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            setAlwaysShowSidebar(getSetting('alwaysShowSidebar'));
        }
    }, []);

    // Listen for settings updates
    useEffect(() => {
        const handleSettingsUpdate = () => {
            if (typeof window !== 'undefined') {
                setAlwaysShowSidebar(getSetting('alwaysShowSidebar'));
            }
        };

        window.addEventListener('settingsUpdated', handleSettingsUpdate);
        return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    }, []);

    // Show sidebar based on isOpen prop, but always show if alwaysShowSidebar setting is enabled
    const shouldShow = alwaysShowSidebar ? true : isOpen;

    // Load conversations when sidebar opens or conversation changes
    useEffect(() => {
        loadConversations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, currentConversationId]);

    // Track unsaved conversations (conversations that exist but aren't saved)
    useEffect(() => {
        const currentId = conversationType === 'battle' 
            ? getCurrentBattleConversationId() 
            : getCurrentConversationId();
        if (currentId) {
            const savedIds = conversationType === 'battle'
                ? getAllBattleConversationIds()
                : getAllConversationIds();
            
            // For Battle, check both left and right messages; for Chat, check messages array
            let isEmpty: boolean;
            if (conversationType === 'battle') {
                const battleData = loadBattleHistory(currentId);
                isEmpty = (battleData.leftMessages?.length || 0) === 0 && (battleData.rightMessages?.length || 0) === 0;
            } else {
                const messages = loadChatHistory(currentId);
                isEmpty = messages.length === 0;
            }
            
            if (!savedIds.includes(currentId) && isEmpty) {
                // Current conversation is unsaved and empty, add it to the set
                setUnsavedConversationIds(prev => {
                    if (prev.has(currentId)) return prev; // Already tracked
                    return new Set([...prev, currentId]);
                });
            } else {
                // Current conversation is saved or has messages, remove it from unsaved set
                setUnsavedConversationIds(prev => {
                    if (!prev.has(currentId)) return prev; // Already removed
                    const next = new Set(prev);
                    next.delete(currentId);
                    return next;
                });
            }
        }
    }, [currentConversationId, conversationType]);

    // Listen for storage changes to refresh conversations
    useEffect(() => {
        const handleStorageChange = () => {
            // Remove saved conversations from unsaved set
            const savedIds = conversationType === 'battle'
                ? getAllBattleConversationIds()
                : getAllConversationIds();
            setUnsavedConversationIds(prev => {
                const next = new Set(prev);
                savedIds.forEach(id => next.delete(id));
                return next;
            });
            loadConversations();
        };
        
        window.addEventListener('storage', handleStorageChange);
        // Also listen for custom events (for same-tab updates)
        const eventName = conversationType === 'battle' ? 'battleConversationUpdated' : 'conversationUpdated';
        window.addEventListener(eventName, handleStorageChange);
        
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener(eventName, handleStorageChange);
        };
    }, [conversationType]);

    const loadConversations = useCallback(() => {
        // Clean up unsaved set - remove any that are now saved
        const savedIds = conversationType === 'battle'
            ? getAllBattleConversationIds()
            : getAllConversationIds();
        
        setUnsavedConversationIds(prev => {
            const next = new Set(prev);
            savedIds.forEach(id => next.delete(id));
            
            // Load conversations with cleaned unsaved IDs
            const unsavedIds = Array.from(next);
            
            // Defensive check: filter out any IDs that don't match the conversation type
            // Battle IDs start with "battle-", Chat IDs start with "conv-"
            const filteredUnsavedIds = unsavedIds.filter(id => {
                if (conversationType === 'battle') {
                    return id.startsWith('battle-');
                } else {
                    return id.startsWith('conv-');
                }
            });
            
            const allConvs = conversationType === 'battle'
                ? getAllBattleConversations(filteredUnsavedIds)
                : getAllConversations(filteredUnsavedIds);
            
            // Additional defensive check: filter out any conversations that don't match the type
            const filteredConvs = allConvs.filter(conv => {
                if (conversationType === 'battle') {
                    return conv.id.startsWith('battle-');
                } else {
                    return conv.id.startsWith('conv-');
                }
            });
            
            setConversations(filteredConvs);
            
            return next;
        });
    }, [conversationType]);

    const handleNewConversation = () => {
        if (conversationType === 'battle') {
            const newId = createNewBattleConversation({ reuseEmpty: false });
            setCurrentBattleConversationId(newId);
            setUnsavedConversationIds(prev => {
                const next = new Set(prev);
                next.add(newId);
                return next;
            });
            setTimeout(() => loadConversations(), 0);
            onConversationChange(newId);
            onConversationSelect([]);
            return;
        }

        // Check if there's already an unsaved empty conversation (chat)
        const savedIds = getAllConversationIds();
        const existingUnsaved = Array.from(unsavedConversationIds).find(id => {
            if (savedIds.includes(id)) return false;
            const messages = loadChatHistory(id);
            return messages.length === 0;
        });

        if (existingUnsaved) {
            setCurrentConversationId(existingUnsaved);
            onConversationChange(existingUnsaved);
            onConversationSelect([]);
            return;
        }

        const existingSaved = findEmptyConversation();
        if (existingSaved) {
            setCurrentConversationId(existingSaved);
            onConversationChange(existingSaved);
            onConversationSelect([]);
            return;
        }

        const newId = createNewConversation();
        setUnsavedConversationIds(prev => new Set([...prev, newId]));
        onConversationChange(newId);
        onConversationSelect([]);
    };

    const handleSelectConversation = (conversationId: string) => {
        if (conversationType === 'battle') {
            setCurrentBattleConversationId(conversationId);
        } else {
            setCurrentConversationId(conversationId);
        }

        onConversationChange(conversationId);

        // For Battle, pass empty array since handleSwitchConversation will load from storage
        // For Chat, pass the messages array
        if (conversationType === 'battle') {
            onConversationSelect([]); // Battle page will load messages in handleSwitchConversation
        } else {
            const messages = loadChatHistory(conversationId);
            onConversationSelect(messages);
        }

        if (onClose) onClose();
    };

    const handleDeleteConversation = (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this conversation?')) {
            const wasCurrentConversation = conversationId === currentConversationId;
            
            // Check if it's a saved conversation
            const savedIds = conversationType === 'battle'
                ? getAllBattleConversationIds()
                : getAllConversationIds();
            if (savedIds.includes(conversationId)) {
                // It's saved, use delete function
                if (conversationType === 'battle') {
                    deleteBattleConversation(conversationId);
                } else {
                    deleteConversation(conversationId);
                }
            } else {
                // It's unsaved, remove from unsaved set
                setUnsavedConversationIds(prev => {
                    const next = new Set(prev);
                    next.delete(conversationId);
                    return next;
                });
            }
            
            // Reload conversations
            loadConversations();
            
            // If we deleted the current conversation, switch to another
            if (wasCurrentConversation) {
                const updatedConversations = conversationType === 'battle'
                    ? getAllBattleConversations()
                    : getAllConversations();
                if (updatedConversations.length > 0) {
                    // Switch to the first remaining conversation (most recent)
                    const newConversationId = updatedConversations[0].id;
                    if (conversationType === 'battle') {
                        setCurrentBattleConversationId(newConversationId);
                    } else {
                        setCurrentConversationId(newConversationId);
                    }
                    const messages = conversationType === 'battle'
                        ? []
                        : loadChatHistory(newConversationId);
                    onConversationSelect(messages);
                    onConversationChange(newConversationId);
                } else {
                    // No conversations left, create a new one
                    handleNewConversation();
                }
            }
        }
    };

    const handleStartEdit = (e: React.MouseEvent, conversationId: string, currentTitle: string) => {
        e.stopPropagation();
        setEditingId(conversationId);
        setEditTitle(currentTitle);
    };

    const handleSaveEdit = (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation();
        if (editTitle.trim()) {
            if (conversationType === 'battle') {
                renameBattleConversation(conversationId, editTitle.trim());
            } else {
                renameConversation(conversationId, editTitle.trim());
            }
            loadConversations();
        }
        setEditingId(null);
        setEditTitle('');
    };

    const handleCancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(null);
        setEditTitle('');
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            if (hours === 0) {
                const minutes = Math.floor(diff / (1000 * 60));
                return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
            }
            return `${hours}h ago`;
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return `${days}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    return (
        <>
            {/* Backdrop for mobile */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[40] md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar - Toggleable on both mobile and desktop */}
            <motion.div
                initial={false}
                animate={{ 
                    x: alwaysShowSidebar ? 0 : (shouldShow ? 0 : '-100%'),
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`
                    ${alwaysShowSidebar 
                        ? 'relative w-80 h-full flex flex-col' 
                        : 'fixed left-0 top-0 h-full w-80 z-[50] flex flex-col'
                    }
                    bg-card border-r border-border shadow-xl md:shadow-lg
                `}
            >
                        {/* Header */}
                        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
                            <h2 className="text-lg font-semibold">Conversations</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleNewConversation}
                                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                                    title="New conversation"
                                >
                                    <Plus size={20} />
                                </button>
                                {onClose && mounted && !alwaysShowSidebar && (
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                                        aria-label="Close sidebar"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Conversations List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {conversations.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                                    <p className="text-sm">No conversations yet</p>
                                    <button
                                        onClick={handleNewConversation}
                                        className="mt-4 text-primary hover:underline text-sm"
                                    >
                                        Create your first conversation
                                    </button>
                                </div>
                            ) : (
                                <div className="p-2">
                                    {conversations.map((conv) => {
                                        const isActive = conv.id === currentConversationId;
                                        const isEditing = editingId === conv.id;

                                        return (
                                            <div
                                                key={conv.id}
                                                onMouseEnter={() => setHoveredId(conv.id)}
                                                onMouseLeave={() => setHoveredId(null)}
                                                onClick={() => !isEditing && handleSelectConversation(conv.id)}
                                                className={`
                                                    relative group p-3 rounded-lg mb-1 cursor-pointer transition-colors
                                                    ${isActive
                                                        ? 'bg-primary/10 border border-primary/20'
                                                        : 'hover:bg-accent/50'
                                                    }
                                                `}
                                            >
                                                {isEditing ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={editTitle}
                                                            onChange={(e) => setEditTitle(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    handleSaveEdit(e as any, conv.id);
                                                                } else if (e.key === 'Escape') {
                                                                    handleCancelEdit(e as any);
                                                                }
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex-1 px-2 py-1 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={(e) => handleSaveEdit(e, conv.id)}
                                                            className="p-1 rounded hover:bg-accent text-green-500"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleCancelEdit(e)}
                                                            className="p-1 rounded hover:bg-accent text-red-500"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <MessageSquare size={16} className={isActive ? 'text-primary' : 'text-muted-foreground shrink-0'} />
                                                                    <h3 className={`
                                                                        text-sm font-medium truncate
                                                                        ${isActive ? 'text-primary' : 'text-foreground'}
                                                                    `}>
                                                                        {conv.title}
                                                                    </h3>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                    <span>{formatDate(conv.lastUpdated)}</span>
                                                                    {conv.messageCount > 0 && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span>{conv.messageCount} messages</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Action buttons on hover */}
                                                        {hoveredId === conv.id && (
                                                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={(e) => handleStartEdit(e, conv.id, conv.title)}
                                                                    className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                                                                    title="Rename"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                                                                    className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
        </>
    );
}

