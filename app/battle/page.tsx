'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { InputArea } from '@/components/chat/InputArea';
import { BattleConversationsSidebar } from '@/components/battle/BattleConversationsSidebar';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { ThemeToggle } from '@/components/chat/ThemeToggle';
import { ShareConversation } from '@/components/chat/ShareConversation';
import { getSelectedModel, DEFAULT_MODEL, getModelInfo, calculateCost, setSelectedModel as saveSelectedModel, getAllModels } from '@/utils/modelStorage';
import { getCurrentBattleConversationId, createNewBattleConversation, loadBattleHistory, loadBattleUsageStats, getBattleConversationMetadata, getUnsavedBattleConversationMetadata, setCurrentBattleConversationId as saveCurrentBattleConversationId, findEmptyBattleConversation, saveBattleHistory, saveBattleUsageStats, getAllBattleConversationIds } from '@/utils/battleStorage';
import { type Message } from '@/utils/chatStorage';
import { ManualChatStorage, useManualChat } from '@/hooks/use-manual-chat';
import { getSetting, apiKeysNeedUnlock, unlockApiKeys, isApiKeyLocked, getApiKey } from '@/utils/settingsStorage';
import { Settings, type HighlightApiKey } from '@/components/chat/Settings';
import { APIKeyModal, type ApiKeyType } from '@/components/chat/APIKeyModal';
import { PinUnlockModal } from '@/components/chat/PinUnlockModal';
import { ApiKeyError } from '@/hooks/use-manual-chat';
import { Menu, AlertCircle, Settings as SettingsIcon, MessageSquare, Swords, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function BattlePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const [autoHideSidebar, setAutoHideSidebar] = useState(true);
  const [conversationTitle, setConversationTitle] = useState<string>('New Battle');
  const [showSettings, setShowSettings] = useState(false);
  const [modelConflict, setModelConflict] = useState<string | null>(null);
  const [hasInteractionStarted, setHasInteractionStarted] = useState(false);
  const [highlightApiKey, setHighlightApiKey] = useState<HighlightApiKey>(null);
  const [apiKeyModal, setApiKeyModal] = useState<{ isOpen: boolean; keyType: ApiKeyType | null }>({
    isOpen: false,
    keyType: null,
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
  }, [setApiKeyModal, setShowPinUnlock]);

  // Track which conversation ID the current messages belong to
  // This prevents saving messages to the wrong ID during switching/creation
  const loadedConversationIdRef = useRef<string>('');

  // Left chat (Chat 1)
  const [leftModel, setLeftModel] = useState<string>(DEFAULT_MODEL);
  const [leftUsage, setLeftUsage] = useState<{ tokens: number; cost: number } | null>(null);
  const battleStorageHandlers: ManualChatStorage = {
    loadHistory: () => [],
    saveHistory: () => { },
    loadUsageStats: () => null,
    saveUsageStats: () => { },
    getCurrentConversationId: () => getCurrentBattleConversationId(),
  };

  const leftChat = useManualChat({
    api: '/api/chat',
    model: leftModel,
    storage: battleStorageHandlers,
    onApiKeyError: handleApiKeyError,
  });
  const { setMessages: setLeftMessages } = leftChat;

  // Right chat (Chat 2)
  const [rightModel, setRightModel] = useState<string>(DEFAULT_MODEL);
  const [rightUsage, setRightUsage] = useState<{ tokens: number; cost: number } | null>(null);
  const rightChat = useManualChat({
    api: '/api/chat',
    model: rightModel,
    storage: battleStorageHandlers,
    onApiKeyError: handleApiKeyError,
  });
  const { setMessages: setRightMessages } = rightChat;

  // Initialize models and conversation
  useEffect(() => {
     
    setMounted(true);
    if (typeof window !== 'undefined') {
      const savedModel = getSelectedModel();
      const allModels = getAllModels();

      // Set different default models for left and right if possible
      if (allModels.length >= 2) {
        setLeftModel(allModels[0].id);
        setRightModel(allModels[1].id);
      } else {
        setLeftModel(savedModel);
        // Try to find a different model for right
        const otherModel = allModels.find(m => m.id !== savedModel);
        setRightModel(otherModel?.id || savedModel);
      }

      // Initialize conversation
      const urlParams = new URLSearchParams(window.location.search);
      const urlConversationId = urlParams.get('conversation');

      let convId: string;
      if (urlConversationId) {
        convId = urlConversationId;
        saveCurrentBattleConversationId(convId);
        const savedData = loadBattleHistory(convId);
        if (savedData.leftMessages.length > 0 || savedData.rightMessages.length > 0) {
          // Load saved messages and models
          setLeftMessages(savedData.leftMessages || []);
          setRightMessages(savedData.rightMessages || []);
          if (savedData.leftModel) setLeftModel(savedData.leftModel);
          if (savedData.rightModel) setRightModel(savedData.rightModel);
          setHasInteractionStarted(true); // Interaction has started if there are messages
        } else {
          setLeftMessages([]);
          setRightMessages([]);
          setHasInteractionStarted(false);
        }
      } else {
        const currentId = getCurrentBattleConversationId();

        if (currentId) {
          const currentData = loadBattleHistory(currentId);
          if (currentData.leftMessages.length === 0 && currentData.rightMessages.length === 0) {
            convId = currentId;
            setHasInteractionStarted(false);
          } else {
            const existingEmpty = findEmptyBattleConversation();
            if (existingEmpty) {
              convId = existingEmpty;
              setHasInteractionStarted(false);
            } else {
              convId = createNewBattleConversation();
              setHasInteractionStarted(false);
            }
          }
        } else {
          const existingEmpty = findEmptyBattleConversation();
          if (existingEmpty) {
            convId = existingEmpty;
            setHasInteractionStarted(false);
          } else {
            convId = createNewBattleConversation();
            setHasInteractionStarted(false);
          }
        }

        saveCurrentBattleConversationId(convId);
        leftChat.setMessages([]);
        rightChat.setMessages([]);

        const url = new URL(window.location.href);
        url.searchParams.set('conversation', convId);
        router.replace(url.pathname + url.search, { scroll: false });
      }
      setCurrentConversationId(convId);
      loadedConversationIdRef.current = convId;

      // Load usage stats
      const savedUsage = loadBattleUsageStats(convId);
      if (savedUsage) {
        if (savedUsage.left) {
          setLeftUsage({
            tokens: savedUsage.left.totalTokens,
            cost: savedUsage.left.totalCost,
          });
        }
        if (savedUsage.right) {
          setRightUsage({
            tokens: savedUsage.right.totalTokens,
            cost: savedUsage.right.totalCost,
          });
        }
      } else {
        setLeftUsage(null);
        setRightUsage(null);
      }

      // Load conversation title
      const metadata = getBattleConversationMetadata(convId);
      if (metadata) {
        setConversationTitle(metadata.title);
      } else {
        const unsavedMetadata = getUnsavedBattleConversationMetadata(convId);
        setConversationTitle(unsavedMetadata?.title || 'New Battle');
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

      // Check if encrypted API keys need to be unlocked
      if (apiKeysNeedUnlock()) {
        setShowPinUnlock(true);
      }
    }
  }, [setLeftMessages, setRightMessages, handleApiKeyError, router]);

  // Validate model selection - prevent duplicates and disable after interaction starts
  const handleLeftModelSelect = (newModelId: string) => {
    if (hasInteractionStarted) {
      setModelConflict('Cannot change model after interaction has started.');
      setTimeout(() => setModelConflict(null), 3000);
      return;
    }
    if (newModelId === rightModel) {
      setModelConflict('Left chat cannot use the same model as right chat. Please select a different model.');
      setTimeout(() => setModelConflict(null), 5000);
      return;
    }
    setLeftModel(newModelId);
    saveSelectedModel(newModelId);
    setModelConflict(null);
  };

  const handleRightModelSelect = (newModelId: string) => {
    if (hasInteractionStarted) {
      setModelConflict('Cannot change model after interaction has started.');
      setTimeout(() => setModelConflict(null), 3000);
      return;
    }
    if (newModelId === leftModel) {
      setModelConflict('Right chat cannot use the same model as left chat. Please select a different model.');
      setTimeout(() => setModelConflict(null), 5000);
      return;
    }
    setRightModel(newModelId);
    saveSelectedModel(newModelId);
    setModelConflict(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input?.trim()) {
      return;
    }

    // Validate API keys for both models BEFORE sending
    const leftModelInfo = getModelInfo(leftModel);
    const rightModelInfo = getModelInfo(rightModel);

    // Helper to map provider to key type
    const getApiKeyType = (provider: string): ApiKeyType => {
      return provider === 'google' ? 'gemini' : 'openai';
    };

    // Check Left Model Key
    if (leftModelInfo) {
      const keyType = getApiKeyType(leftModelInfo.provider);
      const apiKey = getApiKey(keyType);
      if (!apiKey) {
        handleApiKeyError({
          type: 'MISSING_API_KEY',
          keyType: keyType,
        });
        return;
      }
    }

    // Check Right Model Key
    if (rightModelInfo) {
      const keyType = getApiKeyType(rightModelInfo.provider);
      const apiKey = getApiKey(keyType);
      if (!apiKey) {
        handleApiKeyError({
          type: 'MISSING_API_KEY',
          keyType: keyType,
        });
        return;
      }
    }

    // Mark that interaction has started (first message sent)
    if (!hasInteractionStarted) {
      setHasInteractionStarted(true);
    }

    // Send the same prompt to both chats simultaneously
    leftChat.append({ role: 'user', content: input });
    rightChat.append({ role: 'user', content: input });
    setInput('');
  };

  const handleSwitchConversation = (data: { leftMessages: Message[], rightMessages: Message[], leftModel?: string, rightModel?: string }) => {
    // This function is called by the sidebar when a conversation is selected.
    // The sidebar now passes the loaded battle data directly.

    const battleData = data;

    leftChat.setMessages(battleData.leftMessages || []);
    rightChat.setMessages(battleData.rightMessages || []);

    // Restore models if they were saved
    if (battleData.leftModel) setLeftModel(battleData.leftModel);
    if (battleData.rightModel) setRightModel(battleData.rightModel);

    // Check if interaction has started
    const hasMessages = (battleData.leftMessages?.length || 0) > 0 || (battleData.rightMessages?.length || 0) > 0;
    setHasInteractionStarted(hasMessages);

    // Clear input
    setInput('');
  };

  const handleConversationChange = (conversationId: string) => {
    // Set flag to prevent save effect from running during switch
    isSwitchingRef.current = true;

    // Save current conversation first if it has messages
    const oldConversationId = currentConversationId;

    // Only save if we have a valid old ID, it's different from the new one, 
    // AND the loaded messages actually belong to the old ID
    // AND the old conversation still exists in storage (wasn't just deleted)
    const existingIds = getAllBattleConversationIds();
    const oldConversationStillExists = existingIds.includes(oldConversationId);

    if (oldConversationId &&
      oldConversationId !== conversationId &&
      loadedConversationIdRef.current === oldConversationId &&
      oldConversationStillExists &&
      (leftChat.messages.length > 0 || rightChat.messages.length > 0)) {
      // Save the old conversation with its ID explicitly
      saveBattleHistory(leftChat.messages, rightChat.messages, leftModel, rightModel, oldConversationId);
    }

    setCurrentConversationId(conversationId);
    saveCurrentBattleConversationId(conversationId);

    // CRITICAL: Update the ref immediately to match the new ID
    // This prevents any lingering effects from saving old messages to the new ID
    loadedConversationIdRef.current = conversationId;

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('conversation', conversationId);
      router.replace(url.pathname + url.search, { scroll: false });
    }

    // Note: Message loading is now handled by handleSwitchConversation (via sidebar)
    // We only handle metadata and usage stats here

    const savedUsage = loadBattleUsageStats(conversationId);
    if (savedUsage) {
      if (savedUsage.left) {
        setLeftUsage({
          tokens: savedUsage.left.totalTokens,
          cost: savedUsage.left.totalCost,
        });
      } else {
        setLeftUsage(null);
      }
      if (savedUsage.right) {
        setRightUsage({
          tokens: savedUsage.right.totalTokens,
          cost: savedUsage.right.totalCost,
        });
      } else {
        setRightUsage(null);
      }
    } else {
      setLeftUsage(null);
      setRightUsage(null);
    }

    const metadata = getBattleConversationMetadata(conversationId);
    if (metadata) {
      setConversationTitle(metadata.title);
    } else {
      const unsavedMetadata = getUnsavedBattleConversationMetadata(conversationId);
      setConversationTitle(unsavedMetadata?.title || 'New Battle');
    }

    // Clear the switching flag after a brief delay to allow state updates to complete
    setTimeout(() => {
      isSwitchingRef.current = false;
    }, 100);

    setInput('');
  };

  // Initialize sidebar state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      const autoHide = isMobile ? true : getSetting('autoHideSidebar');
       
      setAutoHideSidebar(autoHide);
      if (!autoHide) {
        setSidebarOpen(true);
      } else {
        if (window.innerWidth >= 768) {
          setSidebarOpen(true);
        } else {
          setSidebarOpen(false);
        }
      }
    }
  }, []);

  // Listen for settings updates
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
      const savedUsage = loadBattleUsageStats(currentConversationId);
      if (savedUsage) {
        if (savedUsage.left) {
           
          setLeftUsage({
            tokens: savedUsage.left.totalTokens,
            cost: savedUsage.left.totalCost,
          });
        } else {
          setLeftUsage(null);
        }
        if (savedUsage.right) {
          setRightUsage({
            tokens: savedUsage.right.totalTokens,
            cost: savedUsage.right.totalCost,
          });
        } else {
          setRightUsage(null);
        }
      } else {
        setLeftUsage(null);
        setRightUsage(null);
      }

      // Load conversation title
      const metadata = getBattleConversationMetadata(currentConversationId);
      if (metadata) {
        setConversationTitle(metadata.title);
      } else {
        const unsavedMetadata = getUnsavedBattleConversationMetadata(currentConversationId);
        setConversationTitle(unsavedMetadata?.title || 'New Battle');
      }
    }
     
  }, [currentConversationId]);

  // Listen for conversation updates (e.g., when title is renamed or auto-updated from first message)
  useEffect(() => {
    const handleConversationUpdate = () => {
      if (currentConversationId) {
        const metadata = getBattleConversationMetadata(currentConversationId);
        if (metadata) {
          setConversationTitle(metadata.title);
        } else {
          const unsavedMetadata = getUnsavedBattleConversationMetadata(currentConversationId);
          setConversationTitle(unsavedMetadata?.title || 'New Battle');
        }
      }
    };

    window.addEventListener('battleConversationUpdated', handleConversationUpdate);
    return () => window.removeEventListener('battleConversationUpdated', handleConversationUpdate);
  }, [currentConversationId]);

  // Update title when messages change (for auto-title generation)
  useEffect(() => {
    if (currentConversationId && (leftChat.messages.length > 0 || rightChat.messages.length > 0)) {
      const metadata = getBattleConversationMetadata(currentConversationId);
      if (metadata) {
         
        setConversationTitle(metadata.title);
      }
    }
  }, [leftChat.messages, rightChat.messages, currentConversationId]);

  // Listen for usage updates and reload cumulative stats
  useEffect(() => {
    const handleUsageUpdate = () => {
      if (currentConversationId) {
        const savedUsage = loadBattleUsageStats(currentConversationId);
        if (savedUsage) {
          if (savedUsage.left) {
            setLeftUsage({
              tokens: savedUsage.left.totalTokens,
              cost: savedUsage.left.totalCost,
            });
          } else {
            setLeftUsage(null);
          }
          if (savedUsage.right) {
            setRightUsage({
              tokens: savedUsage.right.totalTokens,
              cost: savedUsage.right.totalCost,
            });
          } else {
            setRightUsage(null);
          }
        } else {
          setLeftUsage(null);
          setRightUsage(null);
        }
      }
    };

    window.addEventListener('battleUsageUpdated', handleUsageUpdate);
    return () => window.removeEventListener('battleUsageUpdated', handleUsageUpdate);
  }, [currentConversationId]);

  // Save Battle messages when they change (save both chats with models)
  // Use a ref to track if we're in the middle of switching conversations
  const isSwitchingRef = useRef(false);

  useEffect(() => {
    if (isSwitchingRef.current) {
      return;
    }

    const currentId = getCurrentBattleConversationId();
    if (!currentId) {
      return;
    }

    // CRITICAL FIX: Only save if the messages actually belong to the current conversation
    // This prevents saving empty/old messages to a new conversation ID during switching
    if (loadedConversationIdRef.current && loadedConversationIdRef.current !== currentId) {
      return;
    }

    if (leftChat.messages.length > 0 || rightChat.messages.length > 0) {
      saveBattleHistory(leftChat.messages, rightChat.messages, leftModel, rightModel, currentId);
    }
  }, [leftChat.messages, rightChat.messages, leftModel, rightModel]);

  // Update usage stats from chat hooks and save to Battle storage
  useEffect(() => {
    if (leftChat.usageInfo && currentConversationId) {
      const cost = calculateCost(
        leftChat.usageInfo.promptTokens,
        leftChat.usageInfo.completionTokens,
        leftModel
      );
       
      setLeftUsage({
        tokens: leftChat.usageInfo.totalTokens,
        cost,
      });

      // Save usage stats to Battle storage for left chat
      saveBattleUsageStats(
        currentConversationId,
        leftChat.usageInfo,
        leftModel,
        'left'
      );
    }
  }, [leftChat.usageInfo, leftModel, currentConversationId]);

  useEffect(() => {
    if (rightChat.usageInfo && currentConversationId) {
      const cost = calculateCost(
        rightChat.usageInfo.promptTokens,
        rightChat.usageInfo.completionTokens,
        rightModel
      );
       
      setRightUsage({
        tokens: rightChat.usageInfo.totalTokens,
        cost,
      });

      // Save usage stats to Battle storage for right chat
      saveBattleUsageStats(
        currentConversationId,
        rightChat.usageInfo,
        rightModel,
        'right'
      );
    }
  }, [rightChat.usageInfo, rightModel, currentConversationId]);

  return (
    <main className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <BattleConversationsSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onConversationSelect={handleSwitchConversation}
        currentConversationId={currentConversationId}
        onConversationChange={handleConversationChange}
        isGenerating={leftChat.isLoading || rightChat.isLoading}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 pt-2 bg-background/80 backdrop-blur-md z-50 sticky top-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            {autoHideSidebar && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden md:block p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label="Toggle sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-8 w-8 object-contain"
              />
              <div className="font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                iRedlof
              </div>
              <div className="hidden md:flex items-center gap-1 ml-4 rounded-full bg-muted/40 p-1">
                <NavTab href="/" currentPath={pathname}>
                  <MessageSquare size={16} />
                  Chat
                </NavTab>
                <NavTab href="/battle" currentPath={pathname}>
                  <Swords size={16} />
                  Battle
                </NavTab>
                <NavTab href="/widgets" currentPath={pathname}>
                  <LayoutGrid size={16} />
                  Widgets
                </NavTab>
              </div>

            </div>
          </div>
          <div className="flex items-center gap-3">
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
          </div>
        </header>

        {/* Settings Panel */}
        <Settings
          isOpen={showSettings}
          onClose={() => {
            setShowSettings(false);
            setHighlightApiKey(null);
          }}
          highlightApiKey={highlightApiKey}
        />

        {/* Model Conflict Alert */}
        {modelConflict && (
          <div className="mx-4 mt-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertCircle size={16} />
            <span>{modelConflict}</span>
          </div>
        )}

        {/* Battle Chat Area - Two Windows Side by Side */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Chat Window */}
          <div className="flex-1 flex flex-col border-r border-border">
            <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-muted/20">
              <div className="flex items-center gap-2">

                <div className={hasInteractionStarted ? 'opacity-50 pointer-events-none' : ''}>
                  <ModelSelector
                    selectedModelId={leftModel}
                    onModelChange={setLeftModel}
                    onModelSelect={handleLeftModelSelect}
                    align="left"
                  />
                </div>
              </div>
              {mounted && leftUsage && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="px-2 py-1 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{leftUsage.tokens.toLocaleString()}</span> tokens
                    </span>
                  </div>
                  <div className="px-2 py-1 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">${leftUsage.cost.toFixed(4)}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            <ChatInterface
              messages={leftChat.messages}
              isLoading={leftChat.isLoading}
              modelId={leftModel}
            />
          </div>

          {/* Right Chat Window */}
          <div className="flex-1 flex flex-col">
            <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-muted/20">
              <div className="flex items-center gap-2">

                <div className={hasInteractionStarted ? 'opacity-50 pointer-events-none' : ''}>
                  <ModelSelector
                    selectedModelId={rightModel}
                    onModelChange={setRightModel}
                    onModelSelect={handleRightModelSelect}
                    align="left"
                  />
                </div>
              </div>
              {mounted && rightUsage && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="px-2 py-1 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{rightUsage.tokens.toLocaleString()}</span> tokens
                    </span>
                  </div>
                  <div className="px-2 py-1 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">${rightUsage.cost.toFixed(4)}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            <ChatInterface
              messages={rightChat.messages}
              isLoading={rightChat.isLoading}
              modelId={rightModel}
            />
          </div>
        </div>

        {/* Shared Input Area */}
        <div className="px-8 md:px-16 py-4 pb-8 bg-gradient-to-t from-background via-background to-transparent z-20 border-t border-border">
          <InputArea
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={onSubmit}
            isLoading={leftChat.isLoading || rightChat.isLoading}
            stop={() => {
              leftChat.stop();
              rightChat.stop();
            }}
            modelId={undefined}
            messageHistory={leftChat.messages.filter(m => m.role === 'user').map(m => m.content)}
            onInputSet={setInput}
            focusTrigger={currentConversationId}
          />
        </div>
      </div>

      {/* API Key Modal */}
      {
        apiKeyModal.keyType && (
          <APIKeyModal
            isOpen={apiKeyModal.isOpen}
            onClose={() => {
              setApiKeyModal({ isOpen: false, keyType: null });
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
    </main >
  );
}

function NavTab({ href, currentPath, children }: { href: string; currentPath: string | null; children: ReactNode }) {
  const isActive = currentPath === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
    >
      {children}
    </Link>
  );
}

