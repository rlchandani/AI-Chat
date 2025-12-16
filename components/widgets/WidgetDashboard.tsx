'use client';

import { useEffect, useMemo, useState, memo, useCallback, type ComponentType, type ReactNode, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Puzzle,
  Search,
  TrendingUp,
  Sun,
  NotebookPen,
  Clock,
  Trash2,
  Edit2,
  Check,
  X,
  GripVertical,
  AlertTriangle,
  RefreshCw,
  Loader2,
  GitBranch,
  Settings as SettingsIcon,
  Menu,
} from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

import { StockQuoteCard } from '@/components/chat/StockQuoteCard';
import { WeatherCard, type WeatherData } from '@/components/chat/WeatherCard';
import { ThemeToggle } from '@/components/chat/ThemeToggle';
import { Settings } from '@/components/chat/Settings';
import { type StockUI } from '@/types/stock';
import { LocationAutocomplete } from './LocationAutocomplete';
import { StockTableWidget } from './StockTableWidget';
import { ClockWidget } from './ClockWidget';
import { GitHubActivityWidget, type GitHubData } from './GitHubActivityWidget';
import { WidgetCardFrame } from './WidgetCardFrame';
import { WidgetSidebar } from './WidgetSidebar';
import { WIDGET_LIBRARY, type WidgetType, type WidgetDefinition } from './widget-definitions';
import { getSetting } from '@/utils/settingsStorage';
import { Header } from '@/components/layout/Header';

// Restore WidgetInstance and WidgetData types
export type WidgetInstance = {
  id: string;
  type: WidgetType;
  // width removed - content is fluid
  height?: number; // Optional - widgets auto-size to content
  config?: {
    location?: string; // For weather widget
    useAutoLocation?: boolean; // For weather widget - use device location
    unitType?: 'imperial' | 'metric'; // For weather widget - temperature and wind units
    ticker?: string; // For stock widget
    tickers?: string; // For stock-table widget (comma-separated)
    username?: string; // For GitHub widget
  };
};

type WidgetData = StockUI | WeatherData | StockUI[] | GitHubData | Record<string, unknown>;

const STORAGE_KEY = 'widget-dashboard-state';

// Fixed width removed in favor of CSS grid
// const FIXED_WIDGET_WIDTH = 450;

const DEFAULT_WIDGETS = [
  { id: 'stock-demo', type: 'stock', config: { ticker: 'AAPL' } },
  { id: 'weather-demo', type: 'weather', config: { location: 'San Francisco, CA', unitType: 'imperial' } },
  { id: 'notes-demo', type: 'notes' },
] as const;

// Widget definitions moved to widget-definitions.ts

const SIZE_PRESETS: Record<WidgetType, Record<string, never>> = {
  stock: {},
  'stock-table': {},
  weather: {},
  notes: {},
  clock: {},
  github: {},
};



export function WidgetDashboard() {
  // Use lazy initialization to prevent recreating default widgets on every render
  const [widgets, setWidgets] = useState<WidgetInstance[]>(() => {
    // Check if we're on the client side (typeof window !== 'undefined')
    if (typeof window === 'undefined') {
      return [...DEFAULT_WIDGETS];
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WidgetInstance[];
        if (Array.isArray(parsed) && parsed.length) {
          // Migrate widgets to remove width if present
          const migrated = parsed.map((widget) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { width, ...rest } = widget as any; // Remove width from old state
            return rest;
          });
          return migrated;
        }
      }
    } catch (error) {
      console.warn('Failed to load widget layout', error);
    }
    // Return fresh copy of defaults only if nothing was loaded
    return [...DEFAULT_WIDGETS];
  });

  const [loaded, setLoaded] = useState(false);
  // Search state moved to WidgetSidebar
  const [activeDrag, setActiveDrag] = useState<{
    id?: string;
    type: WidgetType;
    widget?: WidgetInstance;
    from?: 'board' | 'library';
    data?: WidgetData; // Cache for drag preview data
    initialSize?: { width: number; height: number }; // Capture initial size for smooth drag
  } | null>(null);
  const [dragDirection, setDragDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [autoHideSidebar, setAutoHideSidebar] = useState(true);

  // Ref to store latest data for each widget to avoid re-renders but persist data during drag
  const widgetDataRef = useRef<Record<string, WidgetData>>({});

  const handleDataChange = useCallback((id: string, data: WidgetData) => {
    widgetDataRef.current[id] = data;
  }, []);
  const pathname = usePathname();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
  );

  const { setNodeRef: setBoardRef, isOver: isBoardOver } = useDroppable({ id: 'widget-board' });

  useEffect(() => {
    // Defer loading state to next tick to avoid synchronous setState warning
    const timer = setTimeout(() => setLoaded(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Debounced localStorage save to avoid excessive writes during drag operations
  useEffect(() => {
    if (!loaded || typeof window === 'undefined') return;

    const timeoutId = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    }, 500); // Wait 500ms after last change before saving

    return () => clearTimeout(timeoutId);
  }, [widgets, loaded]);

  // Check for auto-hide setting on mount to set initial sidebar state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      const autoHide = isMobile ? true : getSetting('autoHideSidebar');
      setAutoHideSidebar(autoHide);

      // If auto-hide is off, sidebar should be open by default on desktop
      if (!autoHide && !isMobile) {
        setSidebarOpen(true);
      } else if (window.innerWidth >= 768) {
        // Even if auto-hide is on, we can start with it open on desktop if we want
        // matching the behavior of chat page where sidebar is open by default on desktop
        setSidebarOpen(true);
      }
    }

    // Listen for settings updates
    const handleSettingsUpdate = () => {
      const isMobile = window.innerWidth < 768;
      const autoHide = isMobile ? true : getSetting('autoHideSidebar');
      setAutoHideSidebar(autoHide);
      if (!autoHide && !isMobile) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  const handleAddWidget = (type: WidgetType) => {
    const preset = SIZE_PRESETS[type];
    const newWidget: WidgetInstance = {
      id: `${type}-${Date.now()}`,
      type,
      ...preset,
    };

    // Add default config for widgets
    if (type === 'weather') {
      newWidget.config = { location: 'San Francisco, CA' };
    } else if (type === 'stock') {
      newWidget.config = { ticker: 'AAPL' };
    } else if (type === 'stock-table') {
      newWidget.config = { tickers: 'AAPL,MSFT,GOOGL,AMZN' };
    } else if (type === 'github') {
      newWidget.config = { username: 'rlchandani' };
    }

    setWidgets((prev) => [...prev, newWidget]);
  };



  const handleDragStart = (event: DragStartEvent) => {
    const origin = event.active.data.current?.from as 'library' | 'board' | undefined;
    if (!origin) return;

    if (origin === 'library') {
      const widgetType = event.active.data.current?.widgetType as WidgetType | undefined;
      if (widgetType) {
        setActiveDrag({
          id: undefined,
          type: widgetType,
          from: 'library',
          data: undefined
        });
      }
    } else {
      // Dragging from board - store full widget object for DragOverlay clone
      const current = widgets.find((w) => w.id === event.active.id);
      if (current) {
        // Capture the initial dimensions of the dragged item
        // Try dnd-kit's rect first, then fallback to DOM measurement
        let width = event.active.rect.current.initial?.width;
        let height = event.active.rect.current.initial?.height;

        if (!width || !height) {
          const element = document.getElementById(current.id);
          if (element) {
            const rect = element.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
          }
        }

        setActiveDrag({
          id: current.id,
          type: current.type,
          widget: current, // Store full widget for DragOverlay
          from: 'board',
          data: widgetDataRef.current[current.id], // Pass cached data to preview
          initialSize: width && height ? { width, height } : undefined
        });
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.from === 'board';
    const isOverTask = over.data.current?.from === 'board';

    if (!isActiveTask) return;

    // Implements sortable drag over logic
    if (isActiveTask && isOverTask) {
      setWidgets((items) => {
        const oldIndex = items.findIndex((item) => item.id === activeId);
        const newIndex = items.findIndex((item) => item.id === overId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          return arrayMove(items, oldIndex, newIndex);
        }
        return items;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;

    const activeFrom = active.data.current?.from;
    const overFrom = over.data.current?.from;

    if (activeFrom === 'library' && (over.id === 'widget-board' || overFrom === 'board')) {
      const widgetType = active.data.current?.widgetType as WidgetType;
      if (widgetType) handleAddWidget(widgetType);
    }

    // Clear drag direction after animation completes (400ms for vertical, 300ms for horizontal)
    const clearDelay = dragDirection === 'vertical' ? 450 : 350;
    setTimeout(() => {
      setDragDirection(null);
    }, clearDelay);
  };

  const handleRemove = useCallback((id: string) => {
    setWidgets((items) => items.filter((widget) => widget.id !== id));
  }, []);

  const handleUpdateWidget = useCallback((id: string, config: Partial<WidgetInstance['config']>) => {
    setWidgets((items) =>
      items.map((widget) =>
        widget.id === id
          ? {
            ...widget,
            config: {
              ...widget.config,
              ...config,
            },
          }
          : widget
      )
    );
  }, []);



  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading widgets...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <WidgetSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onAddWidget={handleAddWidget}
      />

      <section className="flex-1 flex flex-col">
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          autoHideSidebar={autoHideSidebar}
          rightContent={
            <>
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
        <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div
            ref={setBoardRef}
            className={clsx(
              'flex-1 overflow-y-auto custom-scrollbar p-6 transition-colors',
              isBoardOver ? 'bg-primary/5' : undefined,
            )}
          >
            {widgets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                Drag widgets from the library to get started
              </div>
            ) : (
              <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-3 gap-4 auto-rows-max">
                  {widgets.map((widget, index) =>
                    <MemoizedSortableWidgetCard
                      key={widget.id}
                      widget={widget}
                      onRemove={handleRemove}
                      onUpdate={handleUpdateWidget}
                      onDataChange={handleDataChange}
                      dragDirection={dragDirection}
                      itemIndex={index}
                    />
                  )}
                </div>
              </SortableContext>
            )}
          </div>

          <DragOverlay dropAnimation={{
            duration: 250,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}>
            {activeDrag ? (
              <div
                className="cursor-grabbing shadow-2xl origin-top-left"
                style={{
                  width: activeDrag.initialSize?.width ?? 350,
                  height: activeDrag.initialSize?.height,
                  // Removed scale and rotation for better performance
                  opacity: 0.9,
                  zIndex: 999,
                }}
              >
                {activeDrag.widget ? (
                  // Dragging from board - show clone of actual widget (no API calls)
                  <DragPreview widget={activeDrag.widget} initialData={activeDrag.data} />
                ) : (
                  // Dragging from library - show placeholder with default config
                  <DragPreview
                    widget={{
                      id: 'temp-drag',
                      type: activeDrag.type,
                      config: activeDrag.type === 'stock-table' ? { tickers: 'AAPL,MSFT,GOOGL' } : undefined
                    }}
                    initialData={activeDrag.data}
                  />
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </section>
    </div>
  );
}



// LibraryWidget moved to WidgetSidebar.tsx

function SortableWidgetCard({
  widget,
  onRemove,
  onUpdate,
  onDataChange,
  dragDirection,
}: {
  widget: WidgetInstance;
  onRemove: (id: string) => void;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onDataChange: (id: string, data: WidgetData) => void;
  dragDirection?: 'horizontal' | 'vertical' | null;
  itemIndex?: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging, isOver } = useSortable({
    id: widget.id,
    data: { from: 'board' },
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [refreshState, setRefreshState] = useState<{
    refreshing: boolean;
    refreshMessage: string | null;
    onRefresh: () => void;
  } | null>(null);
  const [editTrigger, setEditTrigger] = useState(0);

  // Adaptive transition timing based on drag direction
  // Horizontal drags: 300ms (shorter distance)
  // Vertical drags: 400ms (longer distance)
  const adaptiveTransition = isDragging
    ? 'none'
    : dragDirection === 'vertical'
      ? 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)' // Bouncy spring for multi-row
      : 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)'; // Snappy for same-row

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : adaptiveTransition,
    // width removed - controlled by grid
    zIndex: isDragging ? 50 : 'auto',
    position: isDragging ? 'relative' : undefined,
  } as React.CSSProperties;

  const placeholderStyle = {
    // width removed
  } as React.CSSProperties;

  const handleDeleteClick = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    onRemove(widget.id);
    setShowConfirmDialog(false);
  };

  const handleCancelDelete = () => {
    setShowConfirmDialog(false);
  };

  const headerActions = (
    <>
      {/* Refresh button and status - only for stock, weather, stock-table, and github widgets */}
      {(widget.type === 'stock' || widget.type === 'weather' || widget.type === 'stock-table' || widget.type === 'github') && refreshState && (
        <>
          {refreshState.refreshing && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <Loader2 className="w-3 h-3 animate-spin text-foreground/70" />
            </div>
          )}
          {refreshState.refreshMessage && !refreshState.refreshing && (
            <div
              className="w-2 h-2 rounded-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title={refreshState.refreshMessage}
            />
          )}
          <button
            type="button"
            onClick={refreshState.onRefresh}
            disabled={refreshState.refreshing}
            className="p-1.5 rounded-full hover:bg-accent/50 active:bg-accent text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Refresh data"
            title="Refresh data"
          >
            <RefreshCw
              size={14}
              className={refreshState.refreshing ? 'animate-spin' : ''}
            />
          </button>
        </>
      )}
      {/* Edit button - only for editable widgets */}
      {(widget.type === 'stock' || widget.type === 'weather' || widget.type === 'stock-table' || widget.type === 'github') && (
        <button
          type="button"
          onClick={() => setEditTrigger(prev => prev + 1)}
          className="p-1.5 rounded-full hover:bg-accent/50 active:bg-accent text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
          aria-label="Edit widget"
          title="Edit widget"
        >
          <Edit2 size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={handleDeleteClick}
        className="p-1.5 rounded-full hover:bg-destructive/20 active:bg-destructive/30 text-muted-foreground hover:text-destructive active:text-destructive transition-all opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95"
        aria-label="Remove widget"
      >
        <Trash2 size={14} />
      </button>
      <button
        type="button"
        className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition"
        {...attributes}
        {...listeners}
        aria-label="Drag widget"
      >
        <GripVertical size={16} />
      </button>
    </>
  );

  const handleWidgetDataChange = useCallback((data: WidgetData) => {
    onDataChange(widget.id, data);
  }, [widget.id, onDataChange]);

  const handleRefreshStateChange = useCallback((newState: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void; } | null) => {
    setRefreshState((prevState) => {
      // If both are null, no change
      if (!prevState && !newState) return prevState;
      // If one is null and other isn't, change
      if (!prevState || !newState) return newState;

      // Deep compare values
      if (
        prevState.refreshing === newState.refreshing &&
        prevState.refreshMessage === newState.refreshMessage &&
        prevState.onRefresh === newState.onRefresh
      ) {
        return prevState; // Return identical reference to skip re-render
      }

      return newState;
    });
  }, []);

  return (
    <>
      <div
        ref={setNodeRef}
        id={widget.id} // Add ID for robust size measurement during drag
        style={placeholderStyle}
        className={clsx(
          'rounded-2xl flex flex-col h-full group relative transition-all duration-200',
          isDragging && 'border-2 border-dashed border-primary/30 bg-primary/5',
          !isDragging && 'border border-transparent'
        )}
      >
        <WidgetCardFrame
          title={widget.type.toUpperCase()}
          headerActions={headerActions}
          style={style}
          className={isDragging ? 'opacity-0' : ''}
          isOver={isOver}
        >
          <WidgetPreview
            type={widget.type}
            widget={widget}
            onUpdate={onUpdate}
            onDataChange={handleWidgetDataChange}
            onRefreshStateChange={handleRefreshStateChange}
            editTrigger={editTrigger}
          />
        </WidgetCardFrame>
      </div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmDialog && (
          <DeleteConfirmationDialog
            widgetType={widget.type}
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
          />
        )}
      </AnimatePresence>
    </>
  );
}



// Memoize the SortableWidgetCard with custom comparison to prevent re-renders
// when widget data hasn't actually changed (only reference changed)
const MemoizedSortableWidgetCard = memo(
  SortableWidgetCard,
  (prevProps, nextProps) => {
    // Strict widget ID and type check
    if (prevProps.widget.id !== nextProps.widget.id ||
      prevProps.widget.type !== nextProps.widget.type) {
      return false;
    }

    // Config check using JSON stringify
    const prevConfig = JSON.stringify(prevProps.widget.config || {});
    const nextConfig = JSON.stringify(nextProps.widget.config || {});
    if (prevConfig !== nextConfig) {
      return false;
    }

    // Check if drag direction changed (needed for responsive transitions)
    if (prevProps.dragDirection !== nextProps.dragDirection) {
      return false;
    }

    // Check if drag-related props changed
    if (prevProps.dragDirection !== nextProps.dragDirection) {
      return false; // Drag props changed, re-render
    }

    // Check if callbacks changed
    if (prevProps.onRemove !== nextProps.onRemove ||
      prevProps.onUpdate !== nextProps.onUpdate ||
      prevProps.onDataChange !== nextProps.onDataChange) {
      return false; // Callbacks changed, re-render
    }

    // All props are equivalent, skip re-render
    return true;
  }
);

function DeleteConfirmationDialog({
  widgetType,
  onConfirm,
  onCancel,
}: {
  widgetType: WidgetType;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const widgetName = WIDGET_LIBRARY.find((w) => w.type === widgetType)?.name || widgetType;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle size={20} className="text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Delete Widget</h2>
              <p className="text-sm text-muted-foreground">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-foreground">
            Are you sure you want to delete the <span className="font-semibold">{widgetName}</span> widget? This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/40">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-accent text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors font-medium"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}



function DragPreview({ widget, initialData }: { widget: WidgetInstance; initialData?: WidgetData }) {
  return (
    <WidgetCardFrame
      title={widget.type.toUpperCase()}
    >
      <SnapshotPreview
        type={widget.type}
        widget={widget}
        initialData={initialData}
      />
    </WidgetCardFrame>
  );
}

function SnapshotPreview({
  type,
  widget,
  initialData,
}: {
  type: WidgetType;
  widget: WidgetInstance;
  initialData?: WidgetData;
}) {
  switch (type) {
    case 'stock':
      const stockData = initialData as StockUI | undefined;
      return (
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">{stockData?.ticker || widget.config?.ticker || 'AAPL'}</h2>
              <p className="text-sm text-muted-foreground">My List</p>
            </div>
            <div className={`flex items-center gap-1 ${stockData && (stockData.changePercent || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <span className="text-lg font-semibold">{stockData?.price ? `$${stockData.price.toFixed(2)}` : '--'}</span>
            </div>
          </div>
          <div className="flex-1 bg-muted/20 rounded-lg animate-pulse" />
        </div>
      );
    case 'weather':
      const weatherData = initialData as WeatherData | undefined;
      return (
        <div className="flex flex-col h-full justify-between">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold">{weatherData?.temperature ? Math.round(weatherData.temperature) : '--'}°</h2>
              <p className="text-muted-foreground">{widget.config?.location || 'San Francisco, CA'}</p>
            </div>
            <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-full">
              <Sun size={24} />
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <div className="h-4 bg-muted/20 rounded w-3/4" />
            <div className="h-4 bg-muted/20 rounded w-1/2" />
          </div>
        </div>
      );
    case 'stock-table':
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="h-5 w-16 bg-muted/30 rounded" />
            <div className="h-5 w-16 bg-muted/30 rounded" />
            <div className="h-5 w-16 bg-muted/30 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 w-12 bg-muted/20 rounded" />
                <div className="h-4 w-16 bg-muted/20 rounded" />
                <div className="h-4 w-16 bg-muted/20 rounded" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'notes':
      return (
        <div className="space-y-3 text-sm">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <NotebookPen size={14} /> Highlights
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary"></span>
              Prepare talking points
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary"></span>
              Review pricing
            </li>
          </ul>
        </div>
      );
    case 'clock':
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <Clock size={48} className="text-primary/50 mb-2" />
          <div className="h-8 w-32 bg-muted/20 rounded" />
        </div>
      );
    case 'github':
      return (
        <div className="flex flex-col h-full gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted/30" />
            <div>
              <div className="h-4 w-24 bg-muted/30 rounded mb-1" />
              <div className="h-3 w-32 bg-muted/20 rounded" />
            </div>
          </div>
          <div className="flex-1 rounded-lg border border-border bg-muted/10 p-2">
            <div className="grid grid-cols-7 gap-1 h-full opacity-50">
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="rounded-sm bg-primary/20" />
              ))}
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

const WidgetPreview = memo(function WidgetPreview({
  type,
  widget,
  onUpdate,
  onDataChange,
  onRefreshStateChange,
  editTrigger,
  isDragPreview = false,
  initialData,
}: {
  type: WidgetType;
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onDataChange?: (data: WidgetData) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
  isDragPreview?: boolean;
  initialData?: WidgetData;
}) {
  switch (type) {
    case 'stock':
      return <EditableStockWidget widget={widget} onUpdate={onUpdate} onDataChange={onDataChange} onRefreshStateChange={onRefreshStateChange} editTrigger={editTrigger} isDragPreview={isDragPreview} initialData={initialData} />;
    case 'stock-table':
      return <EditableStockTableWidget widget={widget} onUpdate={onUpdate} onDataChange={onDataChange} onRefreshStateChange={onRefreshStateChange} editTrigger={editTrigger} isDragPreview={isDragPreview} initialData={initialData} />;
    case 'weather':
      return <EditableWeatherWidget widget={widget} onUpdate={onUpdate} onDataChange={onDataChange} onRefreshStateChange={onRefreshStateChange} editTrigger={editTrigger} isDragPreview={isDragPreview} initialData={initialData} />;
    case 'notes':
      return (
        <div className="space-y-3 text-sm">
          <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <NotebookPen size={14} /> Highlights
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary"></span>
              Prepare talking points for strategy sync
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary"></span>
              Review updated pricing sheet
            </li>
            <li className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary"></span>
              Draft onboarding plan for new client
            </li>
          </ul>
        </div>
      );
    case 'clock':
      return <ClockWidget />;
    case 'github':
      return <EditableGitHubWidget widget={widget} onUpdate={onUpdate} onDataChange={onDataChange} onRefreshStateChange={onRefreshStateChange} editTrigger={editTrigger} isDragPreview={isDragPreview} initialData={initialData} />;
    default:
      return null;
  }
});

function EditableStockTableWidget({
  widget,
  onUpdate,
  onDataChange,
  onRefreshStateChange,
  editTrigger,
  isDragPreview = false,
  initialData,
}: {
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onDataChange?: (data: WidgetData) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
  isDragPreview?: boolean;
  initialData?: WidgetData;
}) {
  // Use useMemo to prevent StockTableWidget from remounting when widget reference changes
  const stableTickers = useMemo(() => widget.config?.tickers || 'AAPL,MSFT,GOOGL', [widget.config?.tickers]);

  // Track the last processed edit trigger to prevent re-entering edit mode on remount
  const lastProcessedTrigger = useRef(editTrigger || 0);

  // Trigger edit mode when editTrigger changes
  useEffect(() => {
    if (editTrigger && editTrigger > lastProcessedTrigger.current) {
      lastProcessedTrigger.current = editTrigger;
      // The StockTableWidget handles its own edit state, so we need to trigger it
      // We'll use a ref or state to communicate with it
      const editEvent = new CustomEvent('stock-table-edit', { detail: { widgetId: widget.id } });
      window.dispatchEvent(editEvent);
    }
  }, [editTrigger, widget.id]);

  return (
    <div className="w-full h-full relative group">
      <StockTableWidget
        tickers={stableTickers}
        onUpdate={(tickers) => onUpdate(widget.id, { tickers })}
        isEditable={true}
        onRefreshStateChange={onRefreshStateChange}
        autoFetch={!isDragPreview}
        onDataChange={onDataChange as ((data: StockUI[]) => void) | undefined}
        initialData={initialData as StockUI[] | undefined}
      />
    </div>
  );
}

function EditableStockWidget({
  widget,
  onUpdate,
  onDataChange,
  onRefreshStateChange,
  editTrigger,
  isDragPreview = false,
  initialData,
}: {
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onDataChange?: (data: WidgetData) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
  isDragPreview?: boolean;
  initialData?: WidgetData;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [ticker, setTicker] = useState(widget.config?.ticker || 'AAPL');

  // Use useMemo to prevent StockQuoteCard from remounting when widget reference changes
  // Only update when the actual ticker value changes
  const stableTicker = useMemo(() => widget.config?.ticker || 'AAPL', [widget.config?.ticker]);

  // Track the last processed edit trigger to prevent re-entering edit mode on remount
  const lastProcessedTrigger = useRef(editTrigger || 0);

  // Trigger edit mode when editTrigger changes
  useEffect(() => {
    if (editTrigger && editTrigger > lastProcessedTrigger.current) {
      lastProcessedTrigger.current = editTrigger;
      // Defer state update to avoid synchronous setState warning
      const timer = setTimeout(() => setIsEditing(true), 0);
      return () => clearTimeout(timer);
    }
  }, [editTrigger]);

  const handleSave = () => {
    onUpdate(widget.id, { ticker: ticker.toUpperCase() });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTicker(widget.config?.ticker || 'AAPL');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="w-full h-full flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Edit Ticker</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="p-1.5 rounded-full hover:bg-primary/10 text-primary transition"
              aria-label="Save ticker"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive transition"
              aria-label="Cancel editing"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Enter ticker symbol (e.g., AAPL)"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative group">
      <StockQuoteCard
        ticker={stableTicker}
        autoFetch={!isDragPreview}
        onRefreshStateChange={onRefreshStateChange}
        onDataChange={onDataChange as ((data: StockUI) => void) | undefined}
        initialData={initialData as StockUI | null | undefined}
      />
    </div>
  );
}

function EditableWeatherWidget({
  widget,
  onUpdate,
  onDataChange,
  onRefreshStateChange,
  editTrigger,
  isDragPreview = false,
  initialData,
}: {
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onDataChange?: (data: WidgetData) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
  isDragPreview?: boolean;
  initialData?: WidgetData;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [location, setLocation] = useState(widget.config?.location || 'San Francisco, CA');
  const [unitType, setUnitType] = useState<'imperial' | 'metric'>(widget.config?.unitType || 'imperial');

  // Use useMemo to prevent WeatherCard from remounting when widget reference changes
  const stableLocation = useMemo(() => widget.config?.location || 'San Francisco, CA', [widget.config?.location]);
  const stableUnitType = useMemo(() => widget.config?.unitType || ('imperial' as const), [widget.config?.unitType]);

  // Track the last processed edit trigger to prevent re-entering edit mode on remount
  const lastProcessedTrigger = useRef(editTrigger || 0);

  // Trigger edit mode when editTrigger changes
  useEffect(() => {
    if (editTrigger && editTrigger > lastProcessedTrigger.current) {
      lastProcessedTrigger.current = editTrigger;
      // Defer state update to avoid synchronous setState warning
      const timer = setTimeout(() => setIsEditing(true), 0);
      return () => clearTimeout(timer);
    }
  }, [editTrigger]);

  const handleSave = () => {
    onUpdate(widget.id, { location, unitType });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocation(widget.config?.location || 'San Francisco, CA');
    setUnitType(widget.config?.unitType || 'imperial');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="w-full h-full flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Edit Weather Settings</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="p-1.5 rounded-full hover:bg-primary/10 text-primary transition"
              aria-label="Save settings"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive transition"
              aria-label="Cancel editing"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
              Location
            </label>
            <LocationAutocomplete
              value={location}
              onChange={setLocation}
              onSelect={(selectedLocation) => {
                setLocation(selectedLocation);
              }}
              placeholder="Search location or zip code..."
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
              Unit Type
            </label>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as 'imperial' | 'metric')}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="imperial">Imperial (°F, mph, mi)</option>
              <option value="metric">Metric (°C, km/h, km)</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  const handleLocationChange = (newLocation: string) => {
    onUpdate(widget.id, { location: newLocation, useAutoLocation: true });
  };

  const handleAutoLocationChange = (enabled: boolean) => {
    onUpdate(widget.id, { useAutoLocation: enabled });
  };

  return (
    <div className="w-full h-full relative group">
      <WeatherCard
        location={stableLocation}
        autoFetch={!isDragPreview}
        onRefreshStateChange={onRefreshStateChange}
        useAutoLocation={widget.config?.useAutoLocation || false}
        unitType={stableUnitType}
        onLocationChange={handleLocationChange}
        onAutoLocationChange={handleAutoLocationChange}
        onDataChange={onDataChange as ((data: WeatherData) => void) | undefined}
        initialData={initialData as WeatherData | null | undefined}
      />
    </div>
  );
}

function EditableGitHubWidget({
  widget,
  onUpdate,
  onDataChange,
  onRefreshStateChange,
  editTrigger,
  isDragPreview = false,
  initialData,
}: {
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onDataChange?: (data: WidgetData) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
  isDragPreview?: boolean;
  initialData?: WidgetData;
}) {
  // Use useMemo to prevent GitHubActivityWidget from remounting when widget reference changes
  const stableUsername = useMemo(() => widget.config?.username || 'rlchandani', [widget.config?.username]);

  // Track the last processed edit trigger to prevent re-entering edit mode on remount
  const lastProcessedTrigger = useRef(editTrigger || 0);

  // Trigger edit mode when editTrigger changes
  useEffect(() => {
    if (editTrigger && editTrigger > lastProcessedTrigger.current) {
      lastProcessedTrigger.current = editTrigger;
      // The GitHubActivityWidget handles its own edit state, so we need to trigger it
      const editEvent = new CustomEvent('github-edit', { detail: { widgetId: widget.id } });
      window.dispatchEvent(editEvent);
    }
  }, [editTrigger, widget.id]);

  return (
    <div className="w-full h-full relative group">
      <GitHubActivityWidget
        username={stableUsername}
        onUpdate={(username) => onUpdate(widget.id, { username })}
        isEditable={true}
        onRefreshStateChange={onRefreshStateChange}
        autoFetch={!isDragPreview}
        onDataChange={onDataChange as ((data: GitHubData) => void) | undefined}
        initialData={initialData as GitHubData | null | undefined}
      />
    </div>
  );
}
