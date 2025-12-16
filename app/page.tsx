'use client';

import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Settings as SettingsIcon, MessageSquare, Swords, LayoutGrid } from 'lucide-react';

import { useManualChat, type ApiKeyError, type UsageInfo } from '@/hooks/use-manual-chat';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { InputArea } from '@/components/chat/InputArea';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { ConversationsSidebar } from '@/components/chat/ConversationsSidebar';
import { ModelChangeDialog } from '@/components/chat/ModelChangeDialog';
import { ThemeToggle } from '@/components/chat/ThemeToggle';
import { ShareConversation } from '@/components/chat/ShareConversation';
import { Settings, type HighlightApiKey } from '@/components/chat/Settings';
import { APIKeyModal, type ApiKeyType } from '@/components/chat/APIKeyModal';
import { PinUnlockModal } from '@/components/chat/PinUnlockModal';
import { getSelectedModel, DEFAULT_MODEL, getModelInfo, calculateCost, setSelectedModel as saveSelectedModel } from '@/utils/modelStorage';
import { getCurrentConversationId, createNewConversation, loadChatHistory, loadUsageStats, getConversationMetadata, getUnsavedConversationMetadata, setCurrentConversationId as saveCurrentConversationId, findEmptyConversation, saveConversationModel, loadConversationModel, saveChatHistory, saveUsageStats, type Message } from '@/utils/chatStorage';
import { getSetting, apiKeysNeedUnlock, unlockApiKeys, isApiKeyLocked } from '@/utils/settingsStorage';
import { Header } from '@/components/layout/Header';

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Open by default for clean start, adjusts via effect
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const [cumulativeUsage, setCumulativeUsage] = useState<{ tokens: number; cost: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [conversationTitle, setConversationTitle] = useState<string>('New Conversation');
  const [autoHideSidebar, setAutoHideSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [highlightApiKey, setHighlightApiKey] = useState<HighlightApiKey>(null);
  const [apiKeyModal, setApiKeyModal] = useState<{ isOpen: boolean; keyType: ApiKeyType | null }>({
    isOpen: false,
    keyType: null,
  });
  const [modelChangeDialog, setModelChangeDialog] = useState<{ isOpen: boolean; newModelId: string | null }>({
    isOpen: false,
    newModelId: null,
  });
  const [showPinUnlock, setShowPinUnlock] = useState(false);

  const handleApiKeyError = useCallback((error: ApiKeyError) => {
    // If keys are encrypted and locked, show unlock modal instead of missing key modal
    if (isApiKeyLocked(error.keyType)) {
      setShowPinUnlock(true);
      return;
    }

    setApiKeyModal({
      isOpen: true,
      keyType: error.keyType,
    });
  }, []);


  // Custom storage helpers to ensure we always use the current conversation ID from state
  // This prevents race conditions where other tabs might change the localStorage "current" ID
  const storage = useMemo(() => ({
    saveHistory: (messages: Message[]) => saveChatHistory(messages, currentConversationId),
    loadHistory: () => loadChatHistory(currentConversationId),
    loadUsageStats: () => loadUsageStats(currentConversationId),
    saveUsageStats: (id: string, usage: UsageInfo, modelId: string) => saveUsageStats(id, usage, modelId),
    getCurrentConversationId: () => currentConversationId,
  }), [currentConversationId]);

  const { messages, isLoading, stop, append, setMessages, usageInfo, clearApiKeyError } = useManualChat({
    api: '/api/chat',
    model: selectedModel,
    onApiKeyError: handleApiKeyError,
    storage,
  });

  // Initialize model and conversation from localStorage only on client after mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (typeof window !== 'undefined') {
      // Check if there's a conversation ID in the URL (shared link)
      const urlParams = new URLSearchParams(window.location.search);
      const urlConversationId = urlParams.get('conversation');

      // Initialize conversation
      let convId: string = '';
      if (urlConversationId) {
        // Use conversation from URL if provided (shared link)
        convId = urlConversationId;
        saveCurrentConversationId(convId);

        // Load messages for shared conversation
        const savedMessages = loadChatHistory(convId);
        if (savedMessages.length > 0) {
          setMessages(savedMessages);
        }
      } else {
        // Check if current conversation exists and is empty (un-interacted)
        const currentId = getCurrentConversationId();

        if (currentId) {
          const currentMessages = loadChatHistory(currentId);
          if (currentMessages.length === 0) {
            // Current conversation is empty, reuse it
            convId = currentId;
          } else {
            // Current conversation has messages, check for other empty conversations
            const existingEmpty = findEmptyConversation();
            if (existingEmpty) {
              convId = existingEmpty;
            } else {
              convId = createNewConversation();
            }
          }
        } else {
          // No current conversation, check for existing empty conversation
          const existingEmpty = findEmptyConversation();
          if (existingEmpty) {
            convId = existingEmpty;
          } else {
            convId = createNewConversation();
          }
        }

        saveCurrentConversationId(convId);
        setMessages([]); // Start with empty messages

        // Update URL with conversation ID
        const url = new URL(window.location.href);
        url.searchParams.set('conversation', convId);
        router.replace(url.pathname + url.search, { scroll: false });
      }
      setCurrentConversationId(convId);

      // Load saved model for this conversation, or fall back to global saved model
      const conversationModel = loadConversationModel(convId);
      const globalModel = getSelectedModel();
      const modelToUse = conversationModel || globalModel;
      setSelectedModel(modelToUse);
      saveSelectedModel(modelToUse);

      // Load cumulative usage stats
      const savedUsage = loadUsageStats(convId);
      if (savedUsage) {
        setCumulativeUsage({
          tokens: savedUsage.totalTokens,
          cost: savedUsage.totalCost,
        });
      } else {
        setCumulativeUsage(null);
      }

      // Load conversation title
      const metadata = getConversationMetadata(convId);
      if (metadata) {
        setConversationTitle(metadata.title);
      } else {
        const unsavedMetadata = getUnsavedConversationMetadata(convId);
        setConversationTitle(unsavedMetadata?.title || 'New Conversation');
      }

      // Check if we should open settings with a specific API key highlighted
      const openSettingsParam = urlParams.get('openSettings');
      if (openSettingsParam && ['gemini', 'openai'].includes(openSettingsParam)) {
        setHighlightApiKey(openSettingsParam as HighlightApiKey);
        setShowSettings(true);

        // Clean up URL by removing the openSettings parameter
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('openSettings');
        router.replace(cleanUrl.pathname + cleanUrl.search, { scroll: false });
      }


    }
  }, [router, setMessages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input?.trim()) {
      return;
    }

    // Save model for this conversation when first message is sent
    if (currentConversationId) {
      saveConversationModel(currentConversationId, selectedModel);
    }

    const success = await append({ role: 'user', content: input });
    if (success) {
      setInput('');
    }
  };

  const handleNewConversation = () => {
    // For now, just create a new one - the sidebar will handle checking for existing unsaved
    const newId = createNewConversation();
    setCurrentConversationId(newId);
    setMessages([]);
    setCumulativeUsage(null);
    setConversationTitle('New Conversation');

    // Save the current model for the new conversation
    saveConversationModel(newId, selectedModel);

    // Update URL with new conversation ID
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('conversation', newId);
      router.replace(url.pathname + url.search, { scroll: false });
    }

    // Don't close sidebar on desktop - only close on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleModelSelect = (newModelId: string) => {
    // Only show dialog if there are messages in the current conversation
    if (messages.length > 0) {
      setModelChangeDialog({
        isOpen: true,
        newModelId,
      });
    } else {
      // No messages, just change the model directly
      setSelectedModel(newModelId); // Update state
      saveSelectedModel(newModelId); // Save to localStorage
      // Save model for this conversation
      if (currentConversationId) {
        saveConversationModel(currentConversationId, newModelId);
      }
    }
  };

  const handleModelChangeConfirm = () => {
    if (!modelChangeDialog.newModelId) return;

    const newModelId = modelChangeDialog.newModelId;

    // Update model in state and localStorage
    setSelectedModel(newModelId);
    saveSelectedModel(newModelId);

    // Start new conversation with new model
    handleNewConversation();

    // Close dialog
    setModelChangeDialog({ isOpen: false, newModelId: null });
  };

  const handleModelChangeCancel = () => {
    setModelChangeDialog({ isOpen: false, newModelId: null });
  };

  const handleSwitchConversation = (messages: Message[]) => {
    setMessages(messages);
    // Clear input when switching
    setInput('');
    // Note: Usage stats are loaded in handleConversationChange, which is called before this
  };

  const handleConversationChange = (conversationId: string) => {
    setCurrentConversationId(conversationId);

    // Update URL with conversation ID
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('conversation', conversationId);
      router.replace(url.pathname + url.search, { scroll: false });
    }

    // Load saved model for this conversation
    const savedModel = loadConversationModel(conversationId);
    if (savedModel) {
      setSelectedModel(savedModel);
      saveSelectedModel(savedModel);
    }

    // Load usage stats for the new conversation
    const savedUsage = loadUsageStats(conversationId);
    if (savedUsage) {
      setCumulativeUsage({
        tokens: savedUsage.totalTokens,
        cost: savedUsage.totalCost,
      });
    } else {
      setCumulativeUsage(null);
    }

    // Load conversation title
    const metadata = getConversationMetadata(conversationId);
    if (metadata) {
      setConversationTitle(metadata.title);
    } else {
      const unsavedMetadata = getUnsavedConversationMetadata(conversationId);
      setConversationTitle(unsavedMetadata?.title || 'New Conversation');
    }
  };

  // Initialize sidebar state - open by default on desktop, closed on mobile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      const autoHide = isMobile ? true : getSetting('autoHideSidebar');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoHideSidebar(autoHide);
      if (!autoHide) {
        setSidebarOpen(true);
      } else {
        // Set initial state based on screen size
        if (window.innerWidth >= 768) {
          setSidebarOpen(true);
        } else {
          setSidebarOpen(false);
        }
      }
    }
  }, []);

  // Listen for settings updates to handle autoHideSidebar changes
  useEffect(() => {
    const handleSettingsUpdate = () => {
      const isMobile = window.innerWidth < 768;
      const autoHide = isMobile ? true : getSetting('autoHideSidebar');
      setAutoHideSidebar(autoHide);
      if (!autoHide) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  // Load usage stats and title when conversation changes (e.g., on page refresh or conversation switch)
  useEffect(() => {
    if (currentConversationId) {
      const savedUsage = loadUsageStats(currentConversationId);
      if (savedUsage) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCumulativeUsage({
          tokens: savedUsage.totalTokens,
          cost: savedUsage.totalCost,
        });
      } else {
        setCumulativeUsage(null);
      }

      // Load conversation title
      const metadata = getConversationMetadata(currentConversationId);
      if (metadata) {
        setConversationTitle(metadata.title);
      } else {
        const unsavedMetadata = getUnsavedConversationMetadata(currentConversationId);
        setConversationTitle(unsavedMetadata?.title || 'New Conversation');
      }
    }
  }, [currentConversationId]);

  // Listen for conversation updates (e.g., when title is renamed or auto-updated from first message)
  useEffect(() => {
    const handleConversationUpdate = () => {
      if (currentConversationId) {
        const metadata = getConversationMetadata(currentConversationId);
        if (metadata) {
          setConversationTitle(metadata.title);
        } else {
          const unsavedMetadata = getUnsavedConversationMetadata(currentConversationId);
          setConversationTitle(unsavedMetadata?.title || 'New Conversation');
        }
      }
    };

    window.addEventListener('conversationUpdated', handleConversationUpdate);
    return () => window.removeEventListener('conversationUpdated', handleConversationUpdate);
  }, [currentConversationId]);

  // Update title when messages change (for auto-title generation)
  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      const metadata = getConversationMetadata(currentConversationId);
      if (metadata) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConversationTitle(metadata.title);
      }
    }
  }, [messages, currentConversationId]);

  // Listen for usage updates and reload cumulative stats
  useEffect(() => {
    const handleUsageUpdate = () => {
      if (currentConversationId) {
        const savedUsage = loadUsageStats(currentConversationId);
        if (savedUsage) {
          setCumulativeUsage({
            tokens: savedUsage.totalTokens,
            cost: savedUsage.totalCost,
          });
        }
      }
    };

    window.addEventListener('usageUpdated', handleUsageUpdate);
    return () => window.removeEventListener('usageUpdated', handleUsageUpdate);
  }, [currentConversationId]);

  return (
    <main className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <ConversationsSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onConversationSelect={handleSwitchConversation}
        currentConversationId={currentConversationId}
        onConversationChange={handleConversationChange}
        isGenerating={isLoading}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          autoHideSidebar={autoHideSidebar}
          rightContent={
            <>
              {/* Context Window Info - Show cumulative tokens from storage or current usage */}
              {mounted && (cumulativeUsage || usageInfo) && (() => {
                const modelInfo = getModelInfo(selectedModel);
                const contextWindow = modelInfo?.contextWindow || 0;
                // Use cumulative tokens from storage if available, otherwise use current usageInfo
                const totalTokens = cumulativeUsage?.tokens || usageInfo?.totalTokens || 0;
                const usagePercent = contextWindow > 0 ? (totalTokens / contextWindow) * 100 : 0;
                const formattedTokens = totalTokens.toLocaleString();
                const formattedLimit = contextWindow > 0 ? (contextWindow / 1000000).toFixed(contextWindow >= 1000000 ? 0 : 1) + 'M' : 'N/A';

                return (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-primary/60'}`}></div>
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{formattedTokens}</span>
                        {contextWindow > 0 && (
                          <>
                            <span className="text-muted-foreground"> / {formattedLimit}</span>
                            <span className="text-muted-foreground ml-1">
                              ({usagePercent.toFixed(1)}%)
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })()}
              {/* Cost Info - Show cumulative cost from storage */}
              {mounted && (cumulativeUsage || usageInfo) && (() => {
                // Use cumulative cost from storage if available, otherwise calculate from current usage
                let cost = cumulativeUsage?.cost;
                if (cost === undefined && usageInfo) {
                  cost = calculateCost(
                    usageInfo.promptTokens,
                    usageInfo.completionTokens,
                    selectedModel
                  );
                }
                const formattedCost = (cost || 0) > 0 ? (cost || 0).toFixed(4) : '0.0000';

                return (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">${formattedCost}</span>
                    </span>
                  </div>
                );
              })()}
              {mounted && currentConversationId && (
                <ShareConversation conversationId={currentConversationId} />
              )}
              <ThemeToggle />
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Settings"
              >
                <SettingsIcon size={20} className="text-muted-foreground" />
              </button>
            </>
          }
        />

        {/* Settings Panel */}
        <Settings
          isOpen={showSettings}
          onClose={() => {
            setShowSettings(false);
            setHighlightApiKey(null);
          }}
          highlightApiKey={highlightApiKey}
        />

        {/* Chat Area */}
        <ChatInterface messages={messages} isLoading={isLoading} modelId={selectedModel} />

        {/* Input Area */}
        <div className="px-8 md:px-16 py-4 pb-8 bg-gradient-to-t from-background via-background to-transparent z-20">
          <InputArea
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={onSubmit}
            isLoading={isLoading}
            stop={stop}
            modelId={selectedModel}
            messageHistory={messages.filter(m => m.role === 'user').map(m => m.content)}
            onInputSet={setInput}
            focusTrigger={currentConversationId}
            footerActions={
              <ModelSelector
                selectedModelId={selectedModel}
                onModelChange={setSelectedModel}
                onModelSelect={handleModelSelect}
                align="left"
                direction="up"
              />
            }
          />
        </div>
      </div >

      {/* Model Change Dialog */}
      <ModelChangeDialog
        isOpen={modelChangeDialog.isOpen}
        currentModelId={selectedModel}
        newModelId={modelChangeDialog.newModelId || ''}
        onStartNewConversation={handleModelChangeConfirm}
        onCancel={handleModelChangeCancel}
      />

      {/* API Key Modal */}
      {
        apiKeyModal.keyType && (
          <APIKeyModal
            isOpen={apiKeyModal.isOpen}
            onClose={() => {
              setApiKeyModal({ isOpen: false, keyType: null });
              clearApiKeyError();
            }}
            missingKey={apiKeyModal.keyType}
            onGoToSettings={() => {
              // Map ApiKeyType to HighlightApiKey
              const keyTypeMap: Record<ApiKeyType, HighlightApiKey> = {
                gemini: 'gemini',
                openai: 'openai',
              };
              setHighlightApiKey(keyTypeMap[apiKeyModal.keyType!]);
              setShowSettings(true);
            }}
          />
        )
      }

      {/* PIN Unlock Modal */}
      <PinUnlockModal
        isOpen={showPinUnlock}
        onUnlock={async (pin) => {
          const success = await unlockApiKeys(pin);
          if (success) {
            setShowPinUnlock(false);
          }
          return success;
        }}
        onCancel={() => setShowPinUnlock(false)}
      />
    </main>
  );
}
