'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, X, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    clearAllBattleHistory,
} from '@/utils/battleStorage';
import { getSetting } from '@/utils/settingsStorage';

interface BattleConversationsSidebarProps {
    isOpen: boolean;
    onClose?: () => void;
    onConversationSelect: (data: any) => void;
    currentConversationId: string;
    onConversationChange: (id: string) => void;
    isGenerating?: boolean;
}

export function BattleConversationsSidebar({
    isOpen,
    onClose,
    onConversationSelect,
    currentConversationId,
    onConversationChange,
    isGenerating = false,
}: BattleConversationsSidebarProps) {
    const [conversations, setConversations] = useState<Array<{ id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number }>>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [unsavedConversationIds, setUnsavedConversationIds] = useState<Set<string>>(new Set());
    const [autoHideSidebar, setAutoHideSidebar] = useState(true);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [savedConversationCount, setSavedConversationCount] = useState(0);

    // Track if we're on desktop and load settings
    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            setAutoHideSidebar(getSetting('autoHideSidebar'));
            setSavedConversationCount(getAllBattleConversationIds().length);
        }
    }, []);

    // Listen for settings updates
    useEffect(() => {
        const handleSettingsUpdate = () => {
            if (typeof window !== 'undefined') {
                setAutoHideSidebar(getSetting('autoHideSidebar'));
            }
        };

        window.addEventListener('settingsUpdated', handleSettingsUpdate);
        return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    }, []);

    // Show sidebar based on isOpen prop, but always show if autoHideSidebar is disabled
    const shouldShow = !autoHideSidebar ? true : isOpen;

    // Load conversations when sidebar opens or conversation changes
    useEffect(() => {
        loadConversations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, currentConversationId]);

    // Track unsaved conversations (conversations that exist but aren't saved)
    useEffect(() => {
        const currentId = getCurrentBattleConversationId();
        if (currentId) {
            const savedIds = getAllBattleConversationIds();

            // Check if empty
            const battleData = loadBattleHistory(currentId);
            const isEmpty = (battleData.leftMessages?.length || 0) === 0 && (battleData.rightMessages?.length || 0) === 0;

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
    }, [currentConversationId]);

    // Listen for storage changes to refresh conversations
    useEffect(() => {
        const handleStorageChange = () => {
            // Remove saved conversations from unsaved set
            const savedIds = getAllBattleConversationIds();
            setSavedConversationCount(savedIds.length);
            setUnsavedConversationIds(prev => {
                const next = new Set(prev);
                savedIds.forEach(id => next.delete(id));
                return next;
            });
            loadConversations();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('battleConversationUpdated', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('battleConversationUpdated', handleStorageChange);
        };
    }, []);

    const loadConversations = useCallback(() => {
        // Clean up unsaved set - remove any that are now saved
        const savedIds = getAllBattleConversationIds();

        setUnsavedConversationIds(prev => {
            const next = new Set(prev);
            savedIds.forEach(id => next.delete(id));

            // Ensure current conversation is tracked if it's unsaved
            // This fixes the issue where new chats don't appear immediately
            if (currentConversationId && !savedIds.includes(currentConversationId)) {
                if (currentConversationId.startsWith('battle-')) {
                    next.add(currentConversationId);
                }
            }

            // Load conversations with cleaned unsaved IDs
            const unsavedIds = Array.from(next);

            // Defensive check: filter out any IDs that don't match the conversation type
            const filteredUnsavedIds = unsavedIds.filter(id => id.startsWith('battle-'));

            const allConvs = getAllBattleConversations(filteredUnsavedIds);

            // Additional defensive check
            const filteredConvs = allConvs.filter(conv => conv.id.startsWith('battle-'));

            setConversations(filteredConvs);

            return next;
        });
    }, [currentConversationId]);

    const handleNewConversation = () => {
        // Check if there's already an unsaved empty conversation
        const savedIds = getAllBattleConversationIds();
        
        const existingUnsaved = Array.from(unsavedConversationIds).find(id => {
            if (savedIds.includes(id)) return false;
            if (!id.startsWith('battle-')) return false;
            const battleData = loadBattleHistory(id);
            return (battleData.leftMessages?.length || 0) === 0 && (battleData.rightMessages?.length || 0) === 0;
        });

        if (existingUnsaved) {
            setCurrentBattleConversationId(existingUnsaved);
            onConversationChange(existingUnsaved);
            onConversationSelect({
                leftMessages: [],
                rightMessages: [],
                leftModel: '',
                rightModel: ''
            });
            return;
        }

        // Check for existing saved empty conversation
        const existingSaved = findEmptyBattleConversation();
        if (existingSaved) {
            setCurrentBattleConversationId(existingSaved);
            onConversationChange(existingSaved);
            onConversationSelect({
                leftMessages: [],
                rightMessages: [],
                leftModel: '',
                rightModel: ''
            });
            return;
        }

        // Create new one
        const newId = createNewBattleConversation({ reuseEmpty: false }); // We already checked for empty above
        
        setCurrentBattleConversationId(newId);
        setUnsavedConversationIds(prev => new Set([...prev, newId]));
        onConversationChange(newId);
        // Pass empty battle data structure
        onConversationSelect({
            leftMessages: [],
            rightMessages: [],
            leftModel: '',
            rightModel: ''
        });
        
        // Immediately refresh the conversation list to show the new conversation
        // Need to manually add to conversations since state update is async
        const newConv = {
            id: newId,
            title: 'New Battle',
            lastUpdated: Date.now(),
            messageCount: 0,
            createdAt: Date.now(),
        };
        setConversations(prev => [newConv, ...prev.filter(c => c.id !== newId)]);
    };

    const handleSelectConversation = (conversationId: string) => {
        setCurrentBattleConversationId(conversationId);
        onConversationChange(conversationId);

        const battleData = loadBattleHistory(conversationId);
        onConversationSelect(battleData);

        if (onClose) onClose();
    };

    const handleDeleteConversation = (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (!confirm('Are you sure you want to delete this battle?')) {
            return;
        }
        
        const wasCurrentConversation = conversationId === currentConversationId;

        // Check if it's a saved conversation
        const savedIds = getAllBattleConversationIds();
        
        if (savedIds.includes(conversationId)) {
            deleteBattleConversation(conversationId);
        } else {
            // It's unsaved, remove from unsaved set
            setUnsavedConversationIds(prev => {
                const next = new Set(prev);
                next.delete(conversationId);
                return next;
            });
        }

        // Remove from local conversations state immediately
        setConversations(prev => prev.filter(c => c.id !== conversationId));

        // If we deleted the current conversation, switch to another
        if (wasCurrentConversation) {
            const remainingConversations = getAllBattleConversations();
            
            if (remainingConversations.length > 0) {
                // Switch to the first remaining conversation (most recent)
                const newConversationId = remainingConversations[0].id;
                setCurrentBattleConversationId(newConversationId);

                const battleData = loadBattleHistory(newConversationId);
                onConversationSelect(battleData);
                onConversationChange(newConversationId);
            } else {
                // No conversations left, create a new one
                handleNewConversation();
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
            renameBattleConversation(conversationId, editTitle.trim());
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

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <>
            {/* Backdrop for mobile */}
            <AnimatePresence>
                {isOpen && isMobile && (
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
                    width: !autoHideSidebar ? '20rem' : (shouldShow ? '20rem' : (isMobile ? '20rem' : '0rem')),
                    x: !autoHideSidebar ? 0 : (shouldShow ? 0 : (isMobile ? '-100%' : 0)),
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`
                    ${!autoHideSidebar
                        ? 'relative h-full flex flex-col'
                        : (isMobile ? 'fixed' : 'relative') + ' left-0 top-0 h-full z-[50] flex flex-col'
                    }
                    bg-card border-r border-border shadow-xl md:shadow-lg overflow-hidden
                `}
                style={{
                    width: '20rem', // Default width
                }}
            >
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-4 border-b border-border">
                    <h2 className="text-lg font-semibold">Battle History</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleNewConversation}
                            disabled={isGenerating}
                            className={`p-2 rounded-lg transition-colors ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'}`}
                            title={isGenerating ? "Cannot create new battle while generating" : "New battle"}
                        >
                            <Plus size={20} />
                        </button>
                        {onClose && mounted && autoHideSidebar && (
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
                <div className={`flex-1 overflow-y-auto custom-scrollbar ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                    {conversations.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="text-sm">No battles yet</p>
                            <button
                                onClick={handleNewConversation}
                                className="mt-4 text-primary hover:underline text-sm"
                            >
                                Start your first battle
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

                                                {/* Action buttons - always visible when active, hover to reveal otherwise */}
                                                <div className={`
                                                    absolute top-2 right-2 flex items-center gap-1 transition-opacity
                                                    ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                                                `}>
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
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Delete All History Button - only show if there are saved battles */}
                {mounted && savedConversationCount > 0 && (
                    <div className="p-3 border-t border-border">
                        <button
                            onClick={() => setShowDeleteAllModal(true)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                            Delete All History
                        </button>
                    </div>
                )}
            </motion.div>

            {/* Delete All Confirmation Modal */}
            <AnimatePresence>
                {showDeleteAllModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDeleteAllModal(false)}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border rounded-xl shadow-2xl z-[101] p-6"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 rounded-full bg-red-500/10">
                                    <AlertTriangle size={24} className="text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Delete All Battle History</h3>
                                    <p className="text-sm text-muted-foreground">This action cannot be undone</p>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6">
                                Are you sure you want to delete all <strong>{savedConversationCount}</strong> battle{savedConversationCount !== 1 ? 's' : ''}? 
                                This will permanently remove all your battle history.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowDeleteAllModal(false)}
                                    className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        clearAllBattleHistory();
                                        setShowDeleteAllModal(false);
                                        setConversations([]);
                                        setUnsavedConversationIds(new Set());
                                        // Create a new battle after clearing
                                        const newId = createNewBattleConversation();
                                        onConversationChange(newId);
                                        onConversationSelect({
                                            leftMessages: [],
                                            rightMessages: [],
                                            leftModel: '',
                                            rightModel: ''
                                        });
                                    }}
                                    className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                                >
                                    Delete All
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
