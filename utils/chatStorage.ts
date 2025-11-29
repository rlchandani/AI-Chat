import { calculateCost } from '@/utils/modelStorage';

export interface ToolInvocation {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    state?: 'call' | 'result' | 'partial-call';
    result?: unknown;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'data';
    content: string;
    toolInvocations?: ToolInvocation[];
    timestamp?: number;
}

export interface UsageStats {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    totalCost: number; // Total cost in USD
    lastModel?: string; // Last model used for this conversation
}

export interface ChatHistory {
    messages: Message[];
    lastUpdated: number;
    conversationId: string;
    title?: string; // Custom title for the conversation
    createdAt?: number; // When the conversation was created
    usageStats?: UsageStats; // Cumulative usage statistics
    model?: string; // Model used for this conversation
}

export interface BattleHistory {
    leftMessages: Message[];
    rightMessages: Message[];
    leftModel: string;
    rightModel: string;
    lastUpdated: number;
    conversationId: string;
    title?: string; // Custom title for the conversation
    createdAt?: number; // When the conversation was created
    leftUsageStats?: UsageStats; // Usage stats for left chat
    rightUsageStats?: UsageStats; // Usage stats for right chat
}

const STORAGE_KEY = 'gemini-chat-history';
const CONVERSATION_ID_KEY = 'gemini-current-conversation-id';

/**
 * Helper to get stored history safely
 */
function getStoredHistory(id: string): ChatHistory | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(`${STORAGE_KEY}-${id}`);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

/**
 * Helper to save history and update list
 */
function saveStoredHistory(id: string, history: ChatHistory): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${STORAGE_KEY}-${id}`, JSON.stringify(history));

    // Update list if needed
    const conversationsList = getAllConversationIds();
    if (!conversationsList.includes(id)) {
        conversationsList.push(id);
        localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(conversationsList));
    }
}

/**
 * Helper to create initial history
 */
function createInitialHistory(id: string, title: string = 'New Conversation'): ChatHistory {
    return {
        messages: [],
        lastUpdated: Date.now(),
        conversationId: id,
        title,
        createdAt: Date.now(),
    };
}

/**
 * Get the current conversation ID or create a new one
 */
export function getCurrentConversationId(): string {
    if (typeof window === 'undefined') return '';

    let conversationId = localStorage.getItem(CONVERSATION_ID_KEY);
    if (!conversationId) {
        conversationId = `conv-${Date.now()}`;
        localStorage.setItem(CONVERSATION_ID_KEY, conversationId);
    }
    return conversationId;
}

/**
 * Set the current conversation ID
 */
export function setCurrentConversationId(conversationId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CONVERSATION_ID_KEY, conversationId);
}

/**
 * Save messages to localStorage
 * Only saves if there are messages (interaction) or conversation was renamed
 */
export function saveChatHistory(messages: Message[], conversationId?: string): void {
    if (typeof window === 'undefined') return;

    try {
        const id = conversationId || getCurrentConversationId();

        // Don't save empty conversations
        if (messages.length === 0) {
            return;
        }

        // Load existing history to preserve title and createdAt
        const existingHistory = getStoredHistory(id);

        // Generate auto-title from first user message
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

        const autoTitle = generateAutoTitle(messages);
        const existingTitle = existingHistory?.title;

        // Determine if title was manually set
        const isManuallySet = existingTitle && existingTitle !== autoTitle &&
            existingTitle !== 'New Conversation';

        // Only update lastUpdated if there are new messages
        const existingMessageCount = existingHistory?.messages?.length || 0;
        const newMessageCount = messages.length;
        const hasNewMessages = newMessageCount > existingMessageCount;

        const history: ChatHistory = {
            messages,
            lastUpdated: hasNewMessages ? Date.now() : (existingHistory?.lastUpdated || Date.now()),
            conversationId: id,
            title: isManuallySet ? existingTitle : (autoTitle || existingTitle || 'New Conversation'),
            createdAt: existingHistory?.createdAt || Date.now(),
            usageStats: existingHistory?.usageStats,
            model: existingHistory?.model,
        };

        saveStoredHistory(id, history);

        // Dispatch event to notify other components
        window.dispatchEvent(new Event('conversationUpdated'));
    } catch (error) {
        console.error('Failed to save chat history:', error);
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded. Consider clearing old conversations.');
        }
    }
}

/**
 * Load chat history from localStorage
 */
export function loadChatHistory(conversationId?: string): Message[] {
    if (typeof window === 'undefined') return [];

    try {
        const id = conversationId || getCurrentConversationId();
        const history = getStoredHistory(id);
        return history?.messages || [];
    } catch (error) {
        console.error('Failed to load chat history:', error);
        return [];
    }
}

/**
 * Clear chat history for current conversation
 */
export function clearChatHistory(conversationId?: string): void {
    if (typeof window === 'undefined') return;

    const id = conversationId || getCurrentConversationId();
    localStorage.removeItem(`${STORAGE_KEY}-${id}`);

    // Remove from conversations list
    const conversationsList = getAllConversationIds();
    const filtered = conversationsList.filter(cid => cid !== id);
    localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(filtered));
}

/**
 * Clear all chat history
 */
export function clearAllChatHistory(): void {
    if (typeof window === 'undefined') return;

    const conversationsList = getAllConversationIds();
    conversationsList.forEach(id => {
        localStorage.removeItem(`${STORAGE_KEY}-${id}`);
    });
    localStorage.removeItem(`${STORAGE_KEY}-list`);
    localStorage.removeItem(CONVERSATION_ID_KEY);
}

/**
 * Get all conversation IDs
 */
export function getAllConversationIds(): string[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(`${STORAGE_KEY}-list`);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Failed to get conversation IDs:', error);
        return [];
    }
}

/**
 * Find an existing empty conversation that hasn't been renamed
 * Only checks saved conversations (empty conversations that were renamed are saved)
 */
export function findEmptyConversation(): string | null {
    if (typeof window === 'undefined') return null;

    const conversations = getAllConversations();

    // Find a conversation that:
    // 1. Has no messages
    // 2. Hasn't been manually renamed (title is "New Conversation")
    // Note: Empty conversations that aren't renamed aren't saved, so we only check saved ones
    for (const conv of conversations) {
        if (conv.messageCount === 0) {
            // Check if title is still the default (not manually renamed)
            const stored = localStorage.getItem(`${STORAGE_KEY}-${conv.id}`);
            if (stored) {
                try {
                    const history: ChatHistory = JSON.parse(stored);
                    const storedTitle = history.title;

                    // If title is "New Conversation", it hasn't been renamed
                    // If it has any other title, it was manually renamed (and saved)
                    if (storedTitle === 'New Conversation') {
                        return conv.id;
                    }
                } catch {
                    // Skip if can't parse
                }
            }
        }
    }

    return null;
}

/**
 * Create a new conversation or return existing empty one
 * Note: Empty conversations are not saved until there's interaction or rename
 */
export function createNewConversation(): string {
    if (typeof window === 'undefined') return '';

    // Check if there's an existing empty conversation that hasn't been renamed
    const existingEmpty = findEmptyConversation();
    if (existingEmpty) {
        setCurrentConversationId(existingEmpty);
        return existingEmpty;
    }

    // Otherwise, create a new one (but don't save it yet - it will be saved when there's interaction or rename)
    const newId = `conv-${Date.now()}`;
    setCurrentConversationId(newId);

    // Don't save empty conversations - they'll be saved when:
    // 1. First message is sent (via saveChatHistory)
    // 2. Conversation is renamed (via renameConversation)

    return newId;
}

/**
 * Rename a conversation
 * This will save the conversation even if it's empty (since it's been manually renamed)
 */
export function renameConversation(conversationId: string, newTitle: string): void {
    if (typeof window === 'undefined') return;

    try {
        let history = getStoredHistory(conversationId);

        if (!history) {
            // If conversation doesn't exist yet (empty), create it
            history = createInitialHistory(conversationId, newTitle.trim() || 'New Conversation');
        }

        history.title = newTitle.trim() || 'New Conversation';
        history.lastUpdated = Date.now();

        saveStoredHistory(conversationId, history);

        // Dispatch event
        window.dispatchEvent(new Event('conversationUpdated'));
    } catch (error) {
        console.error('Failed to rename conversation:', error);
    }
}

/**
 * Delete a conversation
 */
export function deleteConversation(conversationId: string): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(`${STORAGE_KEY}-${conversationId}`);

    // Remove from conversations list
    const conversationsList = getAllConversationIds();
    const filtered = conversationsList.filter(id => id !== conversationId);
    localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(filtered));

    // Dispatch event
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('conversationUpdated'));
    }

    // If this was the current conversation, switch to another or create new
    if (getCurrentConversationId() === conversationId) {
        if (filtered.length > 0) {
            setCurrentConversationId(filtered[0]);
        } else {
            createNewConversation();
        }
    }
}

/**
 * Export chat history as JSON
 */
export function exportChatHistory(conversationId?: string): string {
    const id = conversationId || getCurrentConversationId();
    const messages = loadChatHistory(id);

    return JSON.stringify({
        conversationId: id,
        messages,
        exportedAt: new Date().toISOString(),
    }, null, 2);
}

/**
 * Get conversation metadata
 */
export function getConversationMetadata(conversationId: string): { title: string; lastUpdated: number; messageCount: number; createdAt: number; model?: string } | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(`${STORAGE_KEY}-${conversationId}`);
        if (!stored) return null;

        const history: ChatHistory = JSON.parse(stored);

        // Generate auto-title from first user message
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

        // If title exists and doesn't match auto-title, it was manually set
        // Otherwise, use auto-generated title
        const isManuallySet = storedTitle && storedTitle !== autoTitle &&
            storedTitle !== 'New Conversation';

        const title = isManuallySet ? storedTitle : (autoTitle || storedTitle || 'New Conversation');

        return {
            title,
            lastUpdated: history.lastUpdated,
            messageCount: history.messages.length,
            createdAt: history.createdAt || history.lastUpdated,
            model: history.model,
        };
    } catch (error) {
        console.error('Failed to get conversation metadata:', error);
        return null;
    }
}

/**
 * Get metadata for an unsaved conversation (not in localStorage)
 */
export function getUnsavedConversationMetadata(conversationId: string): { id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number; model?: string } | null {
    if (typeof window === 'undefined') return null;

    // Check if it's the current conversation and not saved
    const stored = localStorage.getItem(`${STORAGE_KEY}-${conversationId}`);
    if (stored) return null; // It's saved, not unsaved

    // Return metadata for unsaved conversation
    return {
        id: conversationId,
        title: 'New Conversation',
        lastUpdated: Date.now(),
        messageCount: 0,
        createdAt: Date.now(),
        // We don't know the model yet for unsaved, or could look up current selection?
        // For now leave undefined
    };
}

/**
 * Get all conversations with metadata (including unsaved ones)
 */
export function getAllConversations(includeUnsaved?: string[]): Array<{ id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number; model?: string }> {
    if (typeof window === 'undefined') return [];

    const conversationIds = getAllConversationIds();
    const savedConvs = conversationIds
        .map(id => {
            const metadata = getConversationMetadata(id);
            if (!metadata) return null;
            return { id, ...metadata };
        })
        .filter((conv): conv is { id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number; model?: string } => conv !== null);

    // Add unsaved conversations if provided
    const unsavedConvs: Array<{ id: string; title: string; lastUpdated: number; messageCount: number; createdAt: number; model?: string }> = [];
    if (includeUnsaved) {
        for (const id of includeUnsaved) {
            // Only include if not already in saved conversations
            if (!savedConvs.some(c => c.id === id)) {
                const metadata = getUnsavedConversationMetadata(id);
                if (metadata) {
                    unsavedConvs.push(metadata);
                }
            }
        }
    }

    // Combine and sort by lastUpdated (most recent first)
    return [...savedConvs, ...unsavedConvs].sort((a, b) => b.lastUpdated - a.lastUpdated);
}

/**
 * Save usage statistics for a conversation
 * This accumulates usage across all interactions in the conversation
 * Note: The API returns cumulative token counts for the entire conversation context,
 * so we store those directly and accumulate the cost incrementally.
 */
export function saveUsageStats(
    conversationId: string,
    newUsage: { promptTokens: number; completionTokens: number; totalTokens: number },
    modelId: string
): void {
    if (typeof window === 'undefined') return;

    try {
        let history = getStoredHistory(conversationId);

        if (!history) {
            history = createInitialHistory(conversationId);
        }

        // Get existing usage stats or initialize
        const existingStats = history.usageStats || {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            totalCost: 0,
        };

        // Calculate incremental tokens (difference between new and previous)
        const incrementalPromptTokens = Math.max(0, newUsage.promptTokens - existingStats.promptTokens);
        const incrementalCompletionTokens = Math.max(0, newUsage.completionTokens - existingStats.completionTokens);

        // Calculate incremental cost only if there are new tokens
        let incrementalCost = 0;
        if (incrementalPromptTokens > 0 || incrementalCompletionTokens > 0) {
            incrementalCost = calculateCost(
                incrementalPromptTokens,
                incrementalCompletionTokens,
                modelId
            );
        }

        // Update stats with latest cumulative values from API
        // Accumulate cost incrementally
        const updatedStats: UsageStats = {
            promptTokens: newUsage.promptTokens, // Cumulative from API
            completionTokens: newUsage.completionTokens, // Cumulative from API
            totalTokens: newUsage.totalTokens, // Cumulative from API
            totalCost: existingStats.totalCost + incrementalCost, // Accumulate incremental cost
            lastModel: modelId,
        };

        history.usageStats = updatedStats;
        history.lastUpdated = Date.now();

        saveStoredHistory(conversationId, history);

        // Dispatch event to notify other components
        window.dispatchEvent(new Event('conversationUpdated'));
    } catch (error) {
        console.error('Failed to save usage stats:', error);
    }
}

/**
 * Load usage statistics for a conversation
 */
export function loadUsageStats(conversationId?: string): UsageStats | null {
    if (typeof window === 'undefined') return null;

    try {
        const id = conversationId || getCurrentConversationId();
        const stored = localStorage.getItem(`${STORAGE_KEY}-${id}`);

        if (!stored) return null;

        const history: ChatHistory = JSON.parse(stored);
        return history.usageStats || null;
    } catch (error) {
        console.error('Failed to load usage stats:', error);
        return null;
    }
}

/**
 * Save model for a conversation
 */
export function saveConversationModel(conversationId: string, modelId: string): void {
    if (typeof window === 'undefined') return;

    try {
        let history = getStoredHistory(conversationId);

        if (!history) {
            history = createInitialHistory(conversationId);
        }

        history.model = modelId;

        saveStoredHistory(conversationId, history);
    } catch (error) {
        console.error('Failed to save conversation model:', error);
    }
}

/**
 * Load model for a conversation
 */
export function loadConversationModel(conversationId?: string): string | null {
    if (typeof window === 'undefined') return null;

    try {
        const id = conversationId || getCurrentConversationId();
        const stored = localStorage.getItem(`${STORAGE_KEY}-${id}`);

        if (!stored) return null;

        const history: ChatHistory = JSON.parse(stored);
        return history.model || null;
    } catch (error) {
        console.error('Failed to load conversation model:', error);
        return null;
    }
}



