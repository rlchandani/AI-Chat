'use client';

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  LayoutGrid,
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
} from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { StockQuoteCard } from '@/components/chat/StockQuoteCard';
import { WeatherCard } from '@/components/chat/WeatherCard';
import { ThemeToggle } from '@/components/chat/ThemeToggle';
import { LocationAutocomplete } from './LocationAutocomplete';
import { StockTableWidget } from './StockTableWidget';
import { ClockWidget } from './ClockWidget';
import { GitHubActivityWidget } from './GitHubActivityWidget';

const STORAGE_KEY = 'widget-dashboard-state';

// Fixed width for all widgets
const FIXED_WIDGET_WIDTH = 450;

const DEFAULT_WIDGETS = [
  { id: 'stock-demo', type: 'stock', width: FIXED_WIDGET_WIDTH, config: { ticker: 'AAPL' } },
  { id: 'weather-demo', type: 'weather', width: FIXED_WIDGET_WIDTH, config: { location: 'San Francisco, CA', unitType: 'imperial' } },
  { id: 'notes-demo', type: 'notes', width: FIXED_WIDGET_WIDTH },
] as const;

type WidgetType = 'stock' | 'stock-table' | 'weather' | 'notes' | 'clock' | 'github';

type WidgetDefinition = {
  type: WidgetType;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  accent: string;
};

type WidgetInstance = {
  id: string;
  type: WidgetType;
  width: number;
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

const WIDGET_LIBRARY: WidgetDefinition[] = [
  {
    type: 'stock',
    name: 'Stock Watch',
    description: 'Track real-time market moves',
    icon: TrendingUp,
    accent: 'from-emerald-500/20 via-transparent to-teal-500/20',
  },
  {
    type: 'stock-table',
    name: 'Stock Table',
    description: 'Compare multiple stocks at once',
    icon: TrendingUp,
    accent: 'from-emerald-500/20 via-transparent to-teal-500/20',
  },
  {
    type: 'weather',
    name: 'Weather Now',
    description: 'Monitor live conditions',
    icon: Sun,
    accent: 'from-sky-500/20 via-transparent to-blue-500/20',
  },
  {
    type: 'notes',
    name: 'Daily Notes',
    description: 'Capture quick ideas',
    icon: NotebookPen,
    accent: 'from-purple-500/20 via-transparent to-fuchsia-500/20',
  },
  {
    type: 'clock',
    name: 'World Clock',
    description: 'Stay in sync across timezones',
    icon: Clock,
    accent: 'from-amber-500/20 via-transparent to-orange-500/20',
  },
  {
    type: 'github',
    name: 'GitHub Activity',
    description: 'Track commits and contributions',
    icon: GitBranch,
    accent: 'from-slate-500/20 via-transparent to-gray-500/20',
  },
];

const SIZE_PRESETS: Record<WidgetType, { width: number }> = {
  stock: { width: FIXED_WIDGET_WIDTH },
  'stock-table': { width: FIXED_WIDGET_WIDTH },
  weather: { width: FIXED_WIDGET_WIDTH },
  notes: { width: FIXED_WIDGET_WIDTH },
  clock: { width: FIXED_WIDGET_WIDTH },
  github: { width: FIXED_WIDGET_WIDTH },
};

export function WidgetDashboard() {
  const [widgets, setWidgets] = useState<WidgetInstance[]>([...DEFAULT_WIDGETS]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [activeDrag, setActiveDrag] = useState<{
    id?: string;
    type: WidgetType;
  } | null>(null);
  const pathname = usePathname();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
  );

  const { setNodeRef: setBoardRef, isOver: isBoardOver } = useDroppable({ id: 'widget-board' });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WidgetInstance[];
        if (Array.isArray(parsed) && parsed.length) {
          // Migrate old widget sizes to new defaults
          const migrated = parsed.map((widget) => {
            // Update all widgets to use fixed width and remove height (auto-size)
            const { height, ...rest } = widget;
            return { ...rest, width: FIXED_WIDGET_WIDTH };
          });
          setWidgets(migrated);
        }
      }
    } catch (error) {
      console.warn('Failed to load widget layout', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets, loaded]);

  const filteredLibrary = useMemo(() => {
    if (!search) return WIDGET_LIBRARY;
    return WIDGET_LIBRARY.filter((widget) =>
      `${widget.name} ${widget.description}`.toLowerCase().includes(search.toLowerCase()),
    );
  }, [search]);

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
      newWidget.config = { username: 'octocat' };
    }
    
    setWidgets((prev) => [...prev, newWidget]);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const origin = event.active.data.current?.from as 'library' | 'board' | undefined;
    if (!origin) return;

    if (origin === 'library') {
      const widgetType = event.active.data.current?.widgetType as WidgetType | undefined;
      if (widgetType) {
        setActiveDrag({ id: undefined, type: widgetType });
      }
    } else {
      const current = widgets.find((w) => w.id === event.active.id);
      if (current) {
        setActiveDrag({ id: current.id, type: current.type });
      }
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
      return;
    }

    if (activeFrom === 'board' && over.id !== 'widget-board') {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setWidgets((items) => arrayMove(items, oldIndex, newIndex));
      }
    }
  };

  const handleRemove = (id: string) => {
    setWidgets((items) => items.filter((widget) => widget.id !== id));
  };

  const handleUpdateWidget = (id: string, config: Partial<WidgetInstance['config']>) => {
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
  };

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
        Loading widgets...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-72 border-r border-border bg-card/40 backdrop-blur-sm flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Puzzle size={16} /> Widget Library
          </div>
          <p className="text-sm text-muted-foreground mt-1">Drag widgets into your workspace</p>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search widgets"
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {filteredLibrary.map((widget) => (
            <LibraryWidget key={widget.type} widget={widget} onAdd={handleAddWidget} />
          ))}
        </div>
      </aside>

      <section className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 pt-2 bg-background/80 backdrop-blur-md z-50 sticky top-0">
          <div className="flex items-center gap-3">
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
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden lg:block text-sm text-muted-foreground">Drag widgets to rearrange or drop new ones in.</p>
            <ThemeToggle />
          </div>
        </header>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
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
              <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-3 gap-4 auto-rows-max">
                  {widgets.map((widget) => (
                    <SortableWidgetCard
                      key={widget.id}
                      widget={widget}
                      onRemove={handleRemove}
                      onUpdate={handleUpdateWidget}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </div>

          <DragOverlay>
            {activeDrag ? (
              <div className="pointer-events-none opacity-90" style={{ width: FIXED_WIDGET_WIDTH }}>
                <div className="rounded-2xl border border-primary/40 bg-card shadow-2xl overflow-hidden">
                  <div className="px-4 py-2 border-b border-border text-xs font-semibold uppercase tracking-wide text-primary">
                    {WIDGET_LIBRARY.find((w) => w.type === activeDrag.type)?.name ?? activeDrag.type}
                  </div>
                  <div className="p-4 bg-background/80">
                    <WidgetPreview
                      type={activeDrag.type}
                      widget={{ 
                        id: '', 
                        type: activeDrag.type, 
                        width: SIZE_PRESETS[activeDrag.type]?.width || FIXED_WIDGET_WIDTH,
                        config: activeDrag.type === 'stock-table' ? { tickers: 'AAPL,MSFT,GOOGL' } : undefined
                      }}
                      onUpdate={() => {}}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </section>
    </div>
  );
}

function NavTab({ href, currentPath, children }: { href: string; currentPath: string | null; children: ReactNode }) {
  const isActive = currentPath === href;
  return (
    <Link
      href={href}
      className={clsx(
        'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
        isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}

function LibraryWidget({ widget, onAdd }: { widget: WidgetDefinition; onAdd: (type: WidgetType) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${widget.type}`,
    data: { widgetType: widget.type, from: 'library' },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? CSS.Translate.toString(transform) : undefined }}
      className={clsx(
        'rounded-2xl border border-border bg-background/80 p-4 shadow-sm cursor-grab active:cursor-grabbing transition',
        isDragging ? 'ring-2 ring-primary/40' : undefined,
        `bg-gradient-to-r ${widget.accent}`,
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-3">
        <widget.icon className="h-10 w-10 text-foreground/80" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{widget.name}</p>
          <p className="text-xs text-muted-foreground">{widget.description}</p>
        </div>
      </div>
      <button
        onClick={() => onAdd(widget.type)}
        className="mt-4 w-full rounded-xl border border-border/60 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-background/30"
      >
        Add to board
      </button>
    </div>
  );
}

function SortableWidgetCard({
  widget,
  onRemove,
  onUpdate,
}: {
  widget: WidgetInstance;
  onRemove: (id: string) => void;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: widget.width,
  };

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

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={clsx(
          'rounded-2xl border border-border bg-card shadow-md overflow-hidden flex flex-col h-auto group',
          isDragging ? 'opacity-80 scale-[1.01]' : 'opacity-100',
          isOver ? 'ring-2 ring-primary/40 border-primary/30' : undefined,
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {widget.type.toUpperCase()}
          </p>
        <div className="flex items-center gap-2">
          {/* Refresh button and status - only for stock, weather, stock-table, and github widgets */}
          {(widget.type === 'stock' || widget.type === 'weather' || widget.type === 'stock-table' || widget.type === 'github') && refreshState && (
            <>
              <AnimatePresence>
                {refreshState.refreshing && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Loader2 className="w-3 h-3 animate-spin text-foreground/70" />
                  </motion.div>
                )}
                {refreshState.refreshMessage && !refreshState.refreshing && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="w-2 h-2 rounded-full bg-green-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={refreshState.refreshMessage}
                  />
                )}
              </AnimatePresence>
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
        </div>
        </div>
        <div className="p-4 flex-1 min-h-0">
          <WidgetPreview 
            type={widget.type} 
            widget={widget} 
            onUpdate={onUpdate}
            onRefreshStateChange={setRefreshState}
            editTrigger={editTrigger}
          />
        </div>
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

function WidgetPreview({
  type,
  widget,
  onUpdate,
  onRefreshStateChange,
  editTrigger,
}: {
  type: WidgetType;
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
}) {
  switch (type) {
    case 'stock':
      return <EditableStockWidget widget={widget} onUpdate={onUpdate} onRefreshStateChange={onRefreshStateChange} editTrigger={editTrigger} />;
    case 'stock-table':
      return <EditableStockTableWidget widget={widget} onUpdate={onUpdate} onRefreshStateChange={onRefreshStateChange} editTrigger={editTrigger} />;
    case 'weather':
      return <EditableWeatherWidget widget={widget} onUpdate={onUpdate} onRefreshStateChange={onRefreshStateChange} editTrigger={editTrigger} />;
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
      return <EditableGitHubWidget widget={widget} onUpdate={onUpdate} onRefreshStateChange={onRefreshStateChange} editTrigger={editTrigger} />;
    default:
      return null;
  }
}

function EditableStockTableWidget({
  widget,
  onUpdate,
  onRefreshStateChange,
  editTrigger,
}: {
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
}) {
  // Trigger edit mode when editTrigger changes
  useEffect(() => {
    if (editTrigger && editTrigger > 0) {
      // The StockTableWidget handles its own edit state, so we need to trigger it
      // We'll use a ref or state to communicate with it
      const editEvent = new CustomEvent('stock-table-edit', { detail: { widgetId: widget.id } });
      window.dispatchEvent(editEvent);
    }
  }, [editTrigger, widget.id]);
  
  return (
    <div className="w-full h-full relative group">
      <StockTableWidget 
        tickers={widget.config?.tickers || 'AAPL,MSFT,GOOGL'} 
        onUpdate={(tickers) => onUpdate(widget.id, { tickers })}
        isEditable={true}
        onRefreshStateChange={onRefreshStateChange}
      />
    </div>
  );
}

function EditableStockWidget({
  widget,
  onUpdate,
  onRefreshStateChange,
  editTrigger,
}: {
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [ticker, setTicker] = useState(widget.config?.ticker || 'AAPL');
  
  // Trigger edit mode when editTrigger changes
  useEffect(() => {
    if (editTrigger && editTrigger > 0) {
      setIsEditing(true);
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
        ticker={widget.config?.ticker || 'AAPL'} 
        autoFetch={true}
        onRefreshStateChange={onRefreshStateChange}
      />
    </div>
  );
}

function EditableWeatherWidget({
  widget,
  onUpdate,
  onRefreshStateChange,
  editTrigger,
}: {
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [location, setLocation] = useState(widget.config?.location || 'San Francisco, CA');
  const [unitType, setUnitType] = useState<'imperial' | 'metric'>(widget.config?.unitType || 'imperial');
  
  // Trigger edit mode when editTrigger changes
  useEffect(() => {
    if (editTrigger && editTrigger > 0) {
      setIsEditing(true);
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
        location={widget.config?.location || 'San Francisco, CA'} 
        autoFetch={true}
        onRefreshStateChange={onRefreshStateChange}
        useAutoLocation={widget.config?.useAutoLocation || false}
        unitType={widget.config?.unitType || 'imperial'}
        onLocationChange={handleLocationChange}
        onAutoLocationChange={handleAutoLocationChange}
      />
    </div>
  );
}

function EditableGitHubWidget({
  widget,
  onUpdate,
  onRefreshStateChange,
  editTrigger,
}: {
  widget: WidgetInstance;
  onUpdate: (id: string, config: Partial<WidgetInstance['config']>) => void;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void } | null) => void;
  editTrigger?: number;
}) {
  // Trigger edit mode when editTrigger changes
  useEffect(() => {
    if (editTrigger && editTrigger > 0) {
      // The GitHubActivityWidget handles its own edit state, so we need to trigger it
      const editEvent = new CustomEvent('github-edit', { detail: { widgetId: widget.id } });
      window.dispatchEvent(editEvent);
    }
  }, [editTrigger, widget.id]);
  
  return (
    <div className="w-full h-full relative group">
      <GitHubActivityWidget 
        username={widget.config?.username || 'octocat'} 
        onUpdate={(username) => onUpdate(widget.id, { username })}
        isEditable={true}
        onRefreshStateChange={onRefreshStateChange}
      />
    </div>
  );
}
