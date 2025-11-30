import { useState, useCallback, useEffect, useRef } from 'react';
import {
    Message,
    loadChatHistory,
    saveChatHistory,
    clearChatHistory,
    saveUsageStats,
    loadUsageStats,
    getCurrentConversationId,
} from '@/utils/chatStorage';
import { calculateCost, getModelInfo } from '@/utils/modelStorage';
import { getApiKey } from '@/utils/settingsStorage';
import { encryptForTransit, isTransitEncryptionSupported, type EncryptedPayload } from '@/utils/transitEncryption.client';

export interface UsageInfo {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface ApiKeyError {
    type: 'MISSING_API_KEY';
    keyType: 'gemini' | 'openai';
}

export interface ManualChatStorage {
    loadHistory?: () => Message[];
    saveHistory?: (messages: Message[]) => void;
    loadUsageStats?: () => UsageInfo | null;
    saveUsageStats?: (conversationId: string, usage: UsageInfo, modelId: string) => void;
    getCurrentConversationId?: () => string;
}

export function useManualChat({ api = '/api/chat', model, storage, onApiKeyError }: { api?: string; model?: string; storage?: ManualChatStorage; onApiKeyError?: (error: ApiKeyError) => void }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesRef = useRef<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
    const [apiKeyError, setApiKeyError] = useState<ApiKeyError | null>(null);
    const modelRef = useRef<string>(model || 'gemini-2.5-flash');

    // Keep ref in sync with state
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Update model ref when model changes
    useEffect(() => {
        modelRef.current = model || 'gemini-2.5-flash';
    }, [model]);

    const defaultStorage: ManualChatStorage = {
        loadHistory: () => loadChatHistory(),
        saveHistory: (msgs) => saveChatHistory(msgs),
        loadUsageStats: () => loadUsageStats(),
        saveUsageStats: (conversationId, usage, modelId) => saveUsageStats(conversationId, usage, modelId),
        getCurrentConversationId: () => getCurrentConversationId(),
    };
    const storageHelpers = {
        ...defaultStorage,
        ...storage,
    };

    // Load chat history and usage stats on mount
    useEffect(() => {
        if (!isInitialized && typeof window !== 'undefined') {
            const savedMessages = storageHelpers.loadHistory?.() || [];
            if (savedMessages.length > 0) {
                setMessages(savedMessages);
                messagesRef.current = savedMessages;
            }

            const savedUsage = storageHelpers.loadUsageStats?.();
            if (savedUsage) {
                setUsageInfo({
                    promptTokens: savedUsage.promptTokens,
                    completionTokens: savedUsage.completionTokens,
                    totalTokens: savedUsage.totalTokens,
                });
            }

            setIsInitialized(true);
        }
    }, [isInitialized, storageHelpers]);

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (isInitialized && storageHelpers.saveHistory) {
            if (messages.length > 0) {
                storageHelpers.saveHistory(messages);
            } else {
                // If messages are empty, clear the history for this conversation
                // This prevents "ghost" messages from persisting in localStorage
                const conversationId = storageHelpers.getCurrentConversationId?.();
                if (conversationId) {
                    clearChatHistory(conversationId);
                }
            }
        }
    }, [messages, isInitialized, storageHelpers]);

    const stop = useCallback(() => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setIsLoading(false);
        }
    }, [abortController]);

    const append = useCallback(async (message: { role: 'user'; content: string }) => {
        // Validate input
        if (!message.content || !message.content.trim()) {
            console.error('Cannot send empty message');
            return;
        }

        const now = Date.now();
        const userMessage: Message = {
            id: now.toString(),
            role: 'user',
            content: message.content.trim(),
            timestamp: now,
        };

        // Get current messages from ref (always up-to-date)
        const currentMessages = messagesRef.current;

        // Filter out any incomplete assistant messages (empty content)
        const validMessages = currentMessages.filter(
            (msg) => !(msg.role === 'assistant' && (!msg.content || msg.content.trim().length === 0))
        );

        // Prepare messages to send (always includes the new user message)
        const messagesToSend: Message[] = [...validMessages, userMessage];

        // Update state with user message
        setMessages(messagesToSend);

        setIsLoading(true);

        const controller = new AbortController();
        setAbortController(controller);

        try {
            // Determine which API key is needed based on model provider
            const currentModel = model || 'gemini-2.5-flash';
            const modelInfo = getModelInfo(currentModel);
            const provider = modelInfo?.provider || 'google';

            // Only send the API key that's actually needed
            const apiKey = provider === 'google'
                ? getApiKey('gemini')
                : getApiKey('openai');

            // Encrypt API key for transit if supported
            let apiKeyPayload: string | EncryptedPayload = apiKey;
            if (isTransitEncryptionSupported()) {
                try {
                    apiKeyPayload = await encryptForTransit(apiKey);
                } catch (error) {
                    // Fall back to unencrypted transmission with warning
                    console.warn('Transit encryption failed, falling back to unencrypted transmission:', error);
                    apiKeyPayload = apiKey;
                }
            } else {
                // Web Crypto API not supported - fall back to unencrypted
                console.warn('Transit encryption not supported in this browser, using unencrypted transmission');
            }

            const response = await fetch(api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messagesToSend,
                    model: currentModel,
                    apiKey: apiKeyPayload, // Send encrypted payload or plain string
                    provider, // Tell server which provider we're using
                }),
                signal: controller.signal,
            });


            if (!response.ok) {
                const errorText = await response.text();

                // Try to parse error response to check for missing API key error
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.errorType === 'MISSING_API_KEY' && errorData.keyType) {
                        // This is a handled error - don't log as error, just handle it
                        const keyError: ApiKeyError = {
                            type: 'MISSING_API_KEY',
                            keyType: errorData.keyType,
                        };
                        setApiKeyError(keyError);
                        onApiKeyError?.(keyError);

                        // Remove the user message that was just added since we can't process it
                        // Use ID to remove the specific message, avoiding duplicate removal
                        setMessages(prev => prev.filter(m => m.id !== userMessage.id));
                        setIsLoading(false);
                        return;
                    }
                } catch {
                    // Not a JSON error, continue with generic error handling
                }

                // Only log actual unhandled errors
                console.error('API Error:', response.status, errorText);
                throw new Error(`Failed to fetch: ${response.status} ${errorText}`);
            }
            if (!response.body) throw new Error('No body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            const assistantMessageId = (Date.now() + 1).toString();
            let assistantContent = '';

            // Optimistic AI message
            const assistantTimestamp = Date.now();
            setMessages((prev) => [
                ...prev,
                { id: assistantMessageId, role: 'assistant', content: '', timestamp: assistantTimestamp },
            ]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                // Check if this chunk contains usage information
                const usageMatch = chunk.match(/__USAGE__(.*?)__USAGE__/);
                if (usageMatch) {
                    try {
                        const usageData = JSON.parse(usageMatch[1]);
                        if (usageData.type === 'usage' && usageData.usage) {
                            const newUsage = usageData.usage;
                            setUsageInfo(newUsage);

                            // Save usage stats to localStorage
                            // Note: The API returns cumulative token counts for the entire conversation
                            // The saveUsageStats function will calculate incremental cost automatically
                            const conversationId = storageHelpers.getCurrentConversationId?.() || '';
                            if (conversationId && storageHelpers.saveUsageStats) {
                                const currentModel = modelRef.current || 'gemini-2.5-flash';

                                storageHelpers.saveUsageStats(conversationId, newUsage, currentModel);

                                window.dispatchEvent(new Event('usageUpdated'));
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse usage info:', e);
                    }
                    // Remove usage marker from content
                    const cleanChunk = chunk.replace(/__USAGE__.*?__USAGE__/g, '');
                    if (cleanChunk) {
                        assistantContent += cleanChunk;
                    }
                } else {
                    // Regular text chunk
                    assistantContent += chunk;
                }

                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessageId
                            ? { ...m, content: assistantContent, timestamp: assistantTimestamp }
                            : m
                    )
                );
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Chat error:', error);
            }
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
    }, [api, model]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        clearChatHistory();
    }, []);

    const clearApiKeyError = useCallback(() => {
        setApiKeyError(null);
    }, []);

    return {
        messages,
        isLoading,
        stop,
        append,
        setMessages,
        clearMessages,
        usageInfo,
        apiKeyError,
        clearApiKeyError,
    };
}
