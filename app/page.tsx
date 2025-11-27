'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useManualChat } from '@/hooks/use-manual-chat';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { InputArea } from '@/components/chat/InputArea';
import { ModelSelector } from '@/components/chat/ModelSelector';
import { ConversationsSidebar } from '@/components/chat/ConversationsSidebar';
import { ModelChangeDialog } from '@/components/chat/ModelChangeDialog';
import { ThemeToggle } from '@/components/chat/ThemeToggle';
import { ShareConversation } from '@/components/chat/ShareConversation';
import { Settings } from '@/components/chat/Settings';
import { getSelectedModel, DEFAULT_MODEL, getModelInfo, calculateCost, setSelectedModel as saveSelectedModel } from '@/utils/modelStorage';
import { getCurrentConversationId, createNewConversation, loadChatHistory, loadUsageStats, getConversationMetadata, getUnsavedConversationMetadata, setCurrentConversationId as saveCurrentConversationId, findEmptyConversation } from '@/utils/chatStorage';
import { getSetting } from '@/utils/settingsStorage';
import { Menu, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Open by default on desktop
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const [cumulativeUsage, setCumulativeUsage] = useState<{ tokens: number; cost: number } | null>(null);
  const [autoHideSidebar, setAutoHideSidebar] = useState(true);
  const [conversationTitle, setConversationTitle] = useState<string>('New Conversation');
  const [showSettings, setShowSettings] = useState(false);
  const [modelChangeDialog, setModelChangeDialog] = useState<{ isOpen: boolean; newModelId: string | null }>({
    isOpen: false,
    newModelId: null,
  });
  const { messages, isLoading, stop, append, clearMessages, setMessages, usageInfo } = useManualChat({
    api: '/api/chat',
    model: selectedModel,
  });

  // Initialize model and conversation from localStorage only on client after mount
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const savedModel = getSelectedModel();
      setSelectedModel(savedModel);

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
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input?.trim()) {
      return;
    }

    append({ role: 'user', content: input });
    setInput('');
  };

  const handleNewConversation = () => {
    // Check if there's already an unsaved empty conversation
    const { getAllConversationIds, loadChatHistory } = require('@/utils/chatStorage');
    const savedIds = getAllConversationIds();

    // For now, just create a new one - the sidebar will handle checking for existing unsaved
    const newId = createNewConversation();
    setCurrentConversationId(newId);
    setMessages([]);
    setCumulativeUsage(null);
    setConversationTitle('New Conversation');

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
    }
  };

  const handleModelChangeConfirm = (action: 'new' | 'continue') => {
    if (!modelChangeDialog.newModelId) return;

    const newModelId = modelChangeDialog.newModelId;

    // Update model in state and localStorage
    setSelectedModel(newModelId); // Update state
    saveSelectedModel(newModelId); // Save to localStorage

    if (action === 'new') {
      // Start new conversation with new model
      handleNewConversation();
    }
    // If 'continue', just keep the current conversation (model already changed)

    // Close dialog
    setModelChangeDialog({ isOpen: false, newModelId: null });
  };

  const handleModelChangeCancel = () => {
    setModelChangeDialog({ isOpen: false, newModelId: null });
  };

  const handleSwitchConversation = (messages: any[]) => {
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
      const autoHide = getSetting('autoHideSidebar');
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
      const autoHide = getSetting('autoHideSidebar');
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
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 pt-2 bg-background/80 backdrop-blur-md z-50 sticky top-0">
          <div className="flex items-center gap-3">
            {autoHideSidebar && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
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
                  Chat
                </NavTab>
                <NavTab href="/battle" currentPath={pathname}>
                  Battle
                </NavTab>
                <NavTab href="/widgets" currentPath={pathname}>
                  Widgets
                </NavTab>
              </div>
              {mounted && currentConversationId && (
                <>
                  <div className="h-4 w-px bg-border mx-1" />
                  <div className="text-sm font-medium text-muted-foreground truncate max-w-[200px] md:max-w-[300px]">
                    {conversationTitle}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ModelSelector
              selectedModelId={selectedModel}
              onModelChange={setSelectedModel}
              onModelSelect={handleModelSelect}
            />
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
          </div>
        </header>

        {/* Settings Panel */}
        <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />

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
          />
        </div>
      </div>

      {/* Model Change Dialog */}
      <ModelChangeDialog
        isOpen={modelChangeDialog.isOpen}
        currentModelId={selectedModel}
        newModelId={modelChangeDialog.newModelId || ''}
        onStartNewConversation={() => handleModelChangeConfirm('new')}
        onContinueInCurrent={() => handleModelChangeConfirm('continue')}
        onCancel={handleModelChangeCancel}
      />
    </main>
  );
}

function NavTab({ href, currentPath, children }: { href: string; currentPath: string | null; children: ReactNode }) {
  const isActive = currentPath === href;
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
        }`}
    >
      {children}
    </Link>
  );
}
