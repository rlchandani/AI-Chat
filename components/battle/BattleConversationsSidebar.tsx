'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, X, Check, CheckSquare, Square } from 'lucide-react';
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
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; title: string } | null>(null);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);

    // Track if we're on desktop and load settings
    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            setAutoHideSidebar(getSetting('autoHideSidebar'));
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

    const handleDeleteConversation = (e: React.MouseEvent, conversationId: string, title: string) => {
        e.stopPropagation();
        e.preventDefault();
        setDeleteConfirmation({ id: conversationId, title });
    };

    const confirmDeleteConversation = () => {
        if (!deleteConfirmation) return;
        
        const conversationId = deleteConfirmation.id;
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
        
        setDeleteConfirmation(null);
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

    // Multi-select functions
    const toggleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        setSelectedIds(new Set());
    };

    const toggleSelectConversation = (e: React.MouseEvent, conversationId: string) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(conversationId)) {
                next.delete(conversationId);
            } else {
                next.add(conversationId);
            }
            return next;
        });
    };

    const selectAllConversations = () => {
        setSelectedIds(new Set(conversations.map(c => c.id)));
    };

    const deselectAllConversations = () => {
        setSelectedIds(new Set());
    };

    const confirmDeleteSelected = () => {
        const savedIds = getAllBattleConversationIds();
        let deletedCurrentConversation = false;

        selectedIds.forEach(id => {
            if (id === currentConversationId) {
                deletedCurrentConversation = true;
            }
            if (savedIds.includes(id)) {
                deleteBattleConversation(id);
            } else {
                setUnsavedConversationIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
        });

        // Reload conversations
        loadConversations();

        // If we deleted the current conversation, switch to another
        if (deletedCurrentConversation) {
            const updatedConversations = getAllBattleConversations();
            if (updatedConversations.length > 0) {
                const newConversationId = updatedConversations[0].id;
                setCurrentBattleConversationId(newConversationId);
                const battleData = loadBattleHistory(newConversationId);
                onConversationSelect(battleData);
                onConversationChange(newConversationId);
            } else {
                handleNewConversation();
            }
        }

        setSelectedIds(new Set());
        setIsSelectMode(false);
        setShowDeleteSelectedModal(false);
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
                    <h2 className="text-lg font-semibold">
                        {isSelectMode ? `${selectedIds.size} selected` : 'Battle History'}
                    </h2>
                    <div className="flex items-center gap-1">
                        {isSelectMode ? (
                            <>
                                <button
                                    onClick={selectedIds.size === conversations.length ? deselectAllConversations : selectAllConversations}
                                    className="p-2 rounded-lg hover:bg-accent transition-colors text-sm"
                                    title={selectedIds.size === conversations.length ? "Deselect all" : "Select all"}
                                >
                                    {selectedIds.size === conversations.length ? (
                                        <CheckSquare size={18} className="text-primary" />
                                    ) : (
                                        <Square size={18} />
                                    )}
                                </button>
                                <button
                                    onClick={toggleSelectMode}
                                    className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
                                    title="Cancel selection"
                                >
                                    <X size={20} />
                                </button>
                            </>
                        ) : (
                            <>
                                {conversations.length > 0 && (
                                    <button
                                        onClick={toggleSelectMode}
                                        disabled={isGenerating}
                                        className={`p-2 rounded-lg transition-colors ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent'}`}
                                        title="Select multiple"
                                    >
                                        <CheckSquare size={18} />
                                    </button>
                                )}
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
                            </>
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
                                const isSelected = selectedIds.has(conv.id);

                                return (
                                    <div
                                        key={conv.id}
                                        onMouseEnter={() => setHoveredId(conv.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        onClick={(e) => {
                                            if (isSelectMode) {
                                                toggleSelectConversation(e, conv.id);
                                            } else if (!isEditing) {
                                                handleSelectConversation(conv.id);
                                            }
                                        }}
                                        className={`
                                                    relative group p-3 rounded-lg mb-1 cursor-pointer transition-colors
                                                    ${isSelectMode && isSelected
                                                ? 'bg-primary/10 border border-primary/20'
                                                : isActive && !isSelectMode
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
                                                <div className="flex items-start gap-3">
                                                    {/* Checkbox for select mode */}
                                                    {isSelectMode && (
                                                        <div className="shrink-0 mt-0.5">
                                                            {isSelected ? (
                                                                <CheckSquare size={18} className="text-primary" />
                                                            ) : (
                                                                <Square size={18} className="text-muted-foreground" />
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {!isSelectMode && (
                                                                <MessageSquare size={16} className={isActive ? 'text-primary' : 'text-muted-foreground shrink-0'} />
                                                            )}
                                                            <h3 className={`
                                                                        text-sm font-medium truncate
                                                                        ${isActive && !isSelectMode ? 'text-primary' : 'text-foreground'}
                                                                    `}>
                                                                {conv.title}
                                                            </h3>
                                                        </div>
                                                        <div className={`flex items-center gap-2 text-xs text-muted-foreground ${isSelectMode ? 'ml-0' : ''}`}>
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

                                                {/* Action buttons (hidden in select mode) */}
                                                {!isSelectMode && (
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
                                                        {/* Only show delete for conversations with messages */}
                                                        {conv.messageCount > 0 && (
                                                            <button
                                                                onClick={(e) => handleDeleteConversation(e, conv.id, conv.title)}
                                                                className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
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

                {/* Footer - Delete Selected */}
                {mounted && isSelectMode && selectedIds.size > 0 && (
                    <div className="p-3 border-t border-border">
                        <button
                            onClick={() => setShowDeleteSelectedModal(true)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors font-medium"
                        >
                            <Trash2 size={16} />
                            Delete {selectedIds.size} Selected
                        </button>
                    </div>
                )}
            </motion.div>

            {/* Delete Single Conversation Confirmation Modal */}
            <AnimatePresence>
                {deleteConfirmation && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDeleteConfirmation(null)}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
                        />
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
                                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                            <Trash2 size={20} className="text-red-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold">Delete Battle</h2>
                                            <p className="text-sm text-muted-foreground">This cannot be undone</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setDeleteConfirmation(null)}
                                        className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                                        aria-label="Close"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6 space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Are you sure you want to delete <span className="font-medium text-foreground">"{deleteConfirmation.title}"</span>? This will permanently remove this battle and all its messages.
                                    </p>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setDeleteConfirmation(null)}
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmDeleteConversation}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
                                        >
                                            <Trash2 size={18} />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* Delete Selected Confirmation Modal */}
            <AnimatePresence>
                {showDeleteSelectedModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDeleteSelectedModal(false)}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
                        />
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
                                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                            <Trash2 size={20} className="text-red-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold">Delete Selected</h2>
                                            <p className="text-sm text-muted-foreground">This cannot be undone</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowDeleteSelectedModal(false)}
                                        className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                                        aria-label="Close"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6 space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Are you sure you want to delete <span className="font-medium text-foreground">{selectedIds.size}</span> battle{selectedIds.size !== 1 ? 's' : ''}? This will permanently remove all selected battles and their messages.
                                    </p>

                                    {/* Action Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setShowDeleteSelectedModal(false)}
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-border hover:bg-accent transition-colors font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmDeleteSelected}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
                                        >
                                            <Trash2 size={18} />
                                            Delete {selectedIds.size}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
