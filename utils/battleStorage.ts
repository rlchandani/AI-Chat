import { Message, ChatHistory, UsageStats } from './chatStorage';
import { calculateCost } from './modelStorage';

const BATTLE_STORAGE_KEY = 'gemini-battle-history';
const BATTLE_CONVERSATION_ID_KEY = 'gemini-current-battle-conversation-id';

export interface BattleHistory {
    leftMessages: Message[];
    rightMessages: Message[];
    leftModel: string;
    rightModel: string;
    lastUpdated: number;
    conversationId: string;
    title?: string;
    createdAt?: number;
    leftUsageStats?: UsageStats;
    rightUsageStats?: UsageStats;
}

/**
 * Get the current Battle conversation ID or create a new one
 */
export function getCurrentBattleConversationId(): string {
    if (typeof window === 'undefined') return '';

    let conversationId = localStorage.getItem(BATTLE_CONVERSATION_ID_KEY);
    if (!conversationId) {
        conversationId = `battle-${Date.now()}`;
        localStorage.setItem(BATTLE_CONVERSATION_ID_KEY, conversationId);
    }
    return conversationId;
}

/**
 * Set the current Battle conversation ID
 */
export function setCurrentBattleConversationId(conversationId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BATTLE_CONVERSATION_ID_KEY, conversationId);
}

/**
 * Save Battle messages to localStorage
 * Stores both left and right chat messages along with their models
 */
export function saveBattleHistory(
    leftMessages: Message[],
    rightMessages: Message[],
    leftModel: string,
    rightModel: string,
    conversationId?: string
): void {
    if (typeof window === 'undefined') return;

    try {
        const id = conversationId || getCurrentBattleConversationId();

        if (leftMessages.length === 0 && rightMessages.length === 0) {
            return;
        }

        const existing = localStorage.getItem(`${BATTLE_STORAGE_KEY}-${id}`);
        let existingHistory: BattleHistory | null = null;
        if (existing) {
            try {
                existingHistory = JSON.parse(existing);
            } catch {
                // Ignore parse errors
            }
        }

        const generateAutoTitle = (lMessages: Message[], rMessages: Message[]): string | null => {
            const allMessages = [...lMessages, ...rMessages];
            const firstUserMessage = allMessages.find(m => m.role === 'user');
            if (!firstUserMessage) return null;

            let title = firstUserMessage.content.slice(0, 50).trim();
            if (firstUserMessage.content.length > 50) {
                title += '...';
            }
            return title || null;
        };

        const autoTitle = generateAutoTitle(leftMessages, rightMessages);
        const existingTitle = existingHistory?.title;

        const isManuallySet = existingTitle && existingTitle !== autoTitle &&
            existingTitle !== 'New Battle';

        const existingLeftCount = existingHistory?.leftMessages?.length || 0;
        const existingRightCount = existingHistory?.rightMessages?.length || 0;
        const newLeftCount = leftMessages.length;
        const newRightCount = rightMessages.length;
        const hasNewMessages = (newLeftCount > existingLeftCount) || (newRightCount > existingRightCount);

        let messagesChanged = hasNewMessages;
        if (!hasNewMessages && existingHistory) {
            const leftChanged = JSON.stringify(existingHistory.leftMessages || []) !== JSON.stringify(leftMessages);
            const rightChanged = JSON.stringify(existingHistory.rightMessages || []) !== JSON.stringify(rightMessages);
            messagesChanged = leftChanged || rightChanged;
        }

        const finalLeftModel = existingHistory?.leftModel || leftModel;
        const finalRightModel = existingHistory?.rightModel || rightModel;

        const lastUpdated = messagesChanged
            ? Date.now()
            : (existingHistory?.lastUpdated || Date.now());

        const history: BattleHistory = {
            leftMessages,
            rightMessages,
            leftModel: finalLeftModel,
            rightModel: finalRightModel,
            lastUpdated,
            conversationId: id,
            title: isManuallySet ? existingTitle : (autoTitle || existingTitle || 'New Battle'),
            createdAt: existingHistory?.createdAt || Date.now(),
            leftUsageStats: existingHistory?.leftUsageStats,
            rightUsageStats: existingHistory?.rightUsageStats,
        };

        localStorage.setItem(`${BATTLE_STORAGE_KEY}-${id}`, JSON.stringify(history));

        const conversationsList = getAllBattleConversationIds();
        if (!conversationsList.includes(id)) {
            conversationsList.push(id);
            localStorage.setItem(`${BATTLE_STORAGE_KEY}-list`, JSON.stringify(conversationsList));
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('battleConversationUpdated'));
        }
    } catch (error) {
        console.error('Failed to save battle history:', error);
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded. Consider clearing old conversations.');
        }
    }
}

export function loadBattleHistory(conversationId?: string): { leftMessages: Message[]; rightMessages: Message[]; leftModel?: string; rightModel?: string } {
    if (typeof window === 'undefined') return { leftMessages: [], rightMessages: [] };

    try {
        const id = conversationId || getCurrentBattleConversationId();
        const stored = localStorage.getItem(`${BATTLE_STORAGE_KEY}-${id}`);

        if (!stored) return { leftMessages: [], rightMessages: [] };

        try {
            const history: BattleHistory = JSON.parse(stored);
            return {
                leftMessages: history.leftMessages || [],
                rightMessages: history.rightMessages || [],
                leftModel: history.leftModel,
                rightModel: history.rightModel,
            };
        } catch {
            const history: ChatHistory = JSON.parse(stored);
            return {
                leftMessages: history.messages || [],
                rightMessages: [],
            };
        }
    } catch (error) {
        console.error('Failed to load battle history:', error);
        return { leftMessages: [], rightMessages: [] };
    }
}

export function getAllBattleConversationIds(): string[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(`${BATTLE_STORAGE_KEY}-list`);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Failed to get battle conversation IDs:', error);
        return [];
    }
}

export function findEmptyBattleConversation(): string | null {
    if (typeof window === 'undefined') return null;

    const conversations = getAllBattleConversations();

    for (const conv of conversations) {
        if (conv.messageCount === 0) {
            const stored = localStorage.getItem(`${BATTLE_STORAGE_KEY}-${conv.id}`);
            if (stored) {
                try {
                    try {
                        const history: BattleHistory = JSON.parse(stored);
                        if (history.title === 'New Battle') {
                            return conv.id;
                        }
                    } catch {
                        const history: ChatHistory = JSON.parse(stored);
                        if (history.title === 'New Battle') {
                            return conv.id;
                        }
                    }
                } catch {
                    // Skip if can't parse
                }
            }
        }
    }

    return null;
}

export function createNewBattleConversation({ reuseEmpty = true }: { reuseEmpty?: boolean } = {}): string {
    if (typeof window === 'undefined') return '';

    if (reuseEmpty) {
        const existingEmpty = findEmptyBattleConversation();
        if (existingEmpty) {
            setCurrentBattleConversationId(existingEmpty);
            return existingEmpty;
        }
    }

    const newId = `battle-${Date.now()}`;
    setCurrentBattleConversationId(newId);
    return newId;
}

export function getBattleConversationMetadata(conversationId: string): { title: string; lastUpdated: number; messageCount: number; createdAt: number } | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(`${BATTLE_STORAGE_KEY}-${conversationId}`);
        if (!stored) return null;

        try {
            const history: BattleHistory = JSON.parse(stored);

            const generateAutoTitle = (leftMessages: Message[], rightMessages: Message[]): string | null => {
                const allMessages = [...leftMessages, ...rightMessages];
                if (allMessages.length === 0) return null;
                const firstUserMessage = allMessages.find(m => m.role === 'user');
                if (!firstUserMessage) return null;

                let title = firstUserMessage.content.slice(0, 50).trim();
                if (firstUserMessage.content.length > 50) {
                    title += '...';
                }
                return title || null;
            };

            const autoTitle = generateAutoTitle(history.leftMessages || [], history.rightMessages || []);
            const storedTitle = history.title;

            const isManuallySet = storedTitle && storedTitle !== autoTitle &&
                storedTitle !== 'New Battle';

            const title = isManuallySet ? storedTitle : (autoTitle || storedTitle || 'New Battle');
            const messageCount = (history.leftMessages?.length || 0) + (history.rightMessages?.length || 0);

            return {
                title,
                lastUpdated: history.lastUpdated,
                messageCount,
                createdAt: history.createdAt || history.lastUpdated,
            };
        } catch {
            const history: ChatHistory = JSON.parse(stored);

            const generateAutoTitle = (messages: Message[]): string | null => {
                if (messages.length === 0) return null;
                const firstUserMessage = messages.find(m => m.role === 'user');
                if (!firstUserMessage) return null;

                let title = firstUserMessage.content.slice(0, 50).trim();
                if (firstUserMessage.content.length > 50) {
                    title += '...';
                }
                return title || null;
            };

            const autoTitle = generateAutoTitle(history.messages);
            const storedTitle = history.title;

            const isManuallySet = storedTitle && storedTitle !== autoTitle &&
                storedTitle !== 'New Battle';

            const title = isManuallySet ? storedTitle : (autoTitle || storedTitle || 'New Battle');
            const messageCount = history.messages.length;

            return {
                title,
                lastUpdated: history.lastUpdated,
                messageCount,
                createdAt: history.createdAt || history.lastUpdated,
            };
        }
    } catch (error) {
        console.error('Failed to get battle conversation metadata:', error);
        return null;
    }
}

export function getUnsavedBattleConversationMetadata(conversationId: string): { id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number } | null {
    if (typeof window === 'undefined') return null;

    const stored = localStorage.getItem(`${BATTLE_STORAGE_KEY}-${conversationId}`);
    if (stored) return null;

    return {
        id: conversationId,
        title: 'New Battle',
        lastUpdated: Date.now(),
        messageCount: 0,
        createdAt: Date.now(),
    };
}

export function getAllBattleConversations(includeUnsaved?: string[]): Array<{ id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number }> {
    if (typeof window === 'undefined') return [];

    const conversationIds = getAllBattleConversationIds();
    const savedConvs = conversationIds
        .map(id => {
            const metadata = getBattleConversationMetadata(id);
            if (!metadata) return null;
            return { id, ...metadata };
        })
        .filter((conv): conv is { id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number } => conv !== null);

    const unsavedConvs: Array<{ id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number }> = [];
    if (includeUnsaved) {
        for (const id of includeUnsaved) {
            if (!savedConvs.some(c => c.id === id)) {
                const metadata = getUnsavedBattleConversationMetadata(id);
                if (metadata) {
                    unsavedConvs.push(metadata);
                }
            }
        }
    }

    return [...savedConvs, ...unsavedConvs].sort((a, b) => b.lastUpdated - a.lastUpdated);
}

export function loadBattleUsageStats(conversationId?: string): { left?: UsageStats; right?: UsageStats } | null {
    if (typeof window === 'undefined') return null;

    try {
        const id = conversationId || getCurrentBattleConversationId();
        const stored = localStorage.getItem(`${BATTLE_STORAGE_KEY}-${id}`);

        if (!stored) return null;

        try {
            const history: BattleHistory = JSON.parse(stored);
            return {
                left: history.leftUsageStats || undefined,
                right: history.rightUsageStats || undefined,
            };
        } catch {
            const history: ChatHistory = JSON.parse(stored);
            return {
                left: history.usageStats || undefined,
                right: undefined,
            };
        }
    } catch (error) {
        console.error('Failed to load battle usage stats:', error);
        return null;
    }
}

export function saveBattleUsageStats(
    conversationId: string,
    newUsage: { promptTokens: number; completionTokens: number; totalTokens: number },
    modelId: string,
    chatSide: 'left' | 'right'
): void {
    if (typeof window === 'undefined') return;

    try {
        const stored = localStorage.getItem(`${BATTLE_STORAGE_KEY}-${conversationId}`);

        // Don't create new entries for usage stats - only update existing conversations
        // This prevents orphaned storage entries
        if (!stored) {
            return;
        }

        let history: BattleHistory;

        try {
            history = JSON.parse(stored);
            if (!('leftMessages' in history)) {
                const oldHistory = history as unknown as ChatHistory & { leftModel?: string; rightModel?: string };
                history = {
                    leftMessages: oldHistory.messages || [],
                    rightMessages: [],
                    leftModel: oldHistory.leftModel || modelId,
                    rightModel: oldHistory.rightModel || modelId,
                    lastUpdated: oldHistory.lastUpdated || Date.now(),
                    conversationId,
                    title: oldHistory.title || 'New Battle',
                    createdAt: oldHistory.createdAt || Date.now(),
                    leftUsageStats: oldHistory.usageStats,
                    rightUsageStats: undefined,
                };
            }
        } catch {
            // If we can't parse the existing data, don't create orphaned entries
            return;
        }

        const existingStats = (chatSide === 'left' ? history.leftUsageStats : history.rightUsageStats) || {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            totalCost: 0,
        };

        const incrementalPromptTokens = Math.max(0, newUsage.promptTokens - existingStats.promptTokens);
        const incrementalCompletionTokens = Math.max(0, newUsage.completionTokens - existingStats.completionTokens);

        let incrementalCost = 0;
        if (incrementalPromptTokens > 0 || incrementalCompletionTokens > 0) {
            incrementalCost = calculateCost(
                incrementalPromptTokens,
                incrementalCompletionTokens,
                modelId
            );
        }

        const updatedStats: UsageStats = {
            promptTokens: newUsage.promptTokens,
            completionTokens: newUsage.completionTokens,
            totalTokens: newUsage.totalTokens,
            totalCost: existingStats.totalCost + incrementalCost,
            lastModel: modelId,
        };

        if (chatSide === 'left') {
            history.leftUsageStats = updatedStats;
            history.leftModel = history.leftModel || modelId;
        } else {
            history.rightUsageStats = updatedStats;
            history.rightModel = history.rightModel || modelId;
        }

        localStorage.setItem(`${BATTLE_STORAGE_KEY}-${conversationId}`, JSON.stringify(history));

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('battleUsageUpdated'));
        }
    } catch (error) {
        console.error('Failed to save battle usage stats:', error);
    }
}

export function renameBattleConversation(conversationId: string, newTitle: string): void {
    if (typeof window === 'undefined') return;

    try {
        const stored = localStorage.getItem(`${BATTLE_STORAGE_KEY}-${conversationId}`);
        let history: BattleHistory;

        if (stored) {
            try {
                history = JSON.parse(stored);
                if (!('leftMessages' in history)) {
                    const oldHistory = history as unknown as ChatHistory & { leftModel?: string; rightModel?: string };
                    history = {
                        leftMessages: oldHistory.messages || [],
                        rightMessages: [],
                        leftModel: oldHistory.leftModel || '',
                        rightModel: oldHistory.rightModel || '',
                        lastUpdated: oldHistory.lastUpdated || Date.now(),
                        conversationId,
                        title: newTitle.trim() || 'New Battle',
                        createdAt: oldHistory.createdAt || Date.now(),
                        leftUsageStats: oldHistory.usageStats,
                        rightUsageStats: undefined,
                    };
                }
            } catch {
                history = {
                    leftMessages: [],
                    rightMessages: [],
                    leftModel: '',
                    rightModel: '',
                    lastUpdated: Date.now(),
                    conversationId,
                    title: newTitle.trim() || 'New Battle',
                    createdAt: Date.now(),
                };
            }
        } else {
            history = {
                leftMessages: [],
                rightMessages: [],
                leftModel: '',
                rightModel: '',
                lastUpdated: Date.now(),
                conversationId,
                title: newTitle.trim() || 'New Battle',
                createdAt: Date.now(),
            };

            const conversationsList = getAllBattleConversationIds();
            if (!conversationsList.includes(conversationId)) {
                conversationsList.push(conversationId);
                localStorage.setItem(`${BATTLE_STORAGE_KEY}-list`, JSON.stringify(conversationsList));
            }
        }

        history.title = newTitle.trim() || 'New Battle';

        localStorage.setItem(`${BATTLE_STORAGE_KEY}-${conversationId}`, JSON.stringify(history));

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('battleConversationUpdated'));
        }
    } catch (error) {
        console.error('Failed to rename battle conversation:', error);
    }
}

export function deleteBattleConversation(conversationId: string): void {
    if (typeof window === 'undefined') return;

    // Remove the conversation data
    localStorage.removeItem(`${BATTLE_STORAGE_KEY}-${conversationId}`);

    // Remove from the list
    const conversationsList = getAllBattleConversationIds();
    const filtered = conversationsList.filter(id => id !== conversationId);
    localStorage.setItem(`${BATTLE_STORAGE_KEY}-list`, JSON.stringify(filtered));

    // Also clean up any orphaned battle entries not in the list
    cleanupOrphanedBattleEntries();

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('battleConversationUpdated'));
    }

    // Note: We don't auto-create a new conversation here anymore.
    // The UI (sidebar) is responsible for handling what happens after delete.
}

/**
 * Clean up any orphaned battle history entries that aren't in the conversation list
 */
export function cleanupOrphanedBattleEntries(): void {
    if (typeof window === 'undefined') return;

    try {
        const validIds = getAllBattleConversationIds();
        const currentId = getCurrentBattleConversationId();

        // Collect all localStorage keys that are battle history entries
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`${BATTLE_STORAGE_KEY}-battle-`)) {
                // Extract the conversation ID from the key
                const conversationId = key.replace(`${BATTLE_STORAGE_KEY}-`, '');
                // If it's not in the list and not the current conversation, it's orphaned
                if (!validIds.includes(conversationId) && conversationId !== currentId) {
                    keysToRemove.push(key);
                }
            }
        }

        // Remove orphaned entries
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
    } catch (error) {
        console.error('Failed to cleanup orphaned battle entries:', error);
    }
}

export function clearBattleHistory(conversationId?: string): void {
    if (typeof window === 'undefined') return;

    const id = conversationId || getCurrentBattleConversationId();
    localStorage.removeItem(`${BATTLE_STORAGE_KEY}-${id}`);

    const conversationsList = getAllBattleConversationIds();
    const filtered = conversationsList.filter(cid => cid !== id);
    localStorage.setItem(`${BATTLE_STORAGE_KEY}-list`, JSON.stringify(filtered));
}

/**
 * Clear all battle history
 */
export function clearAllBattleHistory(): void {
    if (typeof window === 'undefined') return;

    const conversationsList = getAllBattleConversationIds();
    conversationsList.forEach(id => {
        localStorage.removeItem(`${BATTLE_STORAGE_KEY}-${id}`);
    });
    localStorage.removeItem(`${BATTLE_STORAGE_KEY}-list`);
    localStorage.removeItem(BATTLE_CONVERSATION_ID_KEY);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('battleConversationUpdated'));
    }
}

