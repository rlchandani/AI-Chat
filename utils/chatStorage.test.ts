import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    saveChatHistory,
    loadChatHistory,
    createNewConversation,
    getConversationMetadata,
    Message,
    clearAllChatHistory
} from './chatStorage';

describe('chatStorage', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        vi.clearAllMocks();
    });

    const mockMessages: Message[] = [
        { id: '1', role: 'user', content: 'Hello world' },
        { id: '2', role: 'assistant', content: 'Hi there' },
    ];

    it('saves and loads chat history', () => {
        const conversationId = 'test-conv-1';
        saveChatHistory(mockMessages, conversationId);

        const loadedMessages = loadChatHistory(conversationId);
        expect(loadedMessages).toHaveLength(2);
        expect(loadedMessages[0].content).toBe('Hello world');
    });

    it('generates auto-title from first user message', () => {
        const conversationId = 'test-conv-2';
        saveChatHistory(mockMessages, conversationId);

        const metadata = getConversationMetadata(conversationId);
        expect(metadata?.title).toBe('Hello world');
    });

    it('creates new conversation with unique ID', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2023, 1, 1, 10, 0, 0));
        const id1 = createNewConversation();

        vi.setSystemTime(new Date(2023, 1, 1, 10, 0, 1));
        const id2 = createNewConversation();

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^conv-/);
        vi.useRealTimers();
    });

    it('clears all history', () => {
        const conversationId = 'test-conv-3';
        saveChatHistory(mockMessages, conversationId);

        clearAllChatHistory();

        const loadedMessages = loadChatHistory(conversationId);
        expect(loadedMessages).toHaveLength(0);
        const metadata = getConversationMetadata(conversationId);
        expect(metadata).toBeNull();
    });
});
