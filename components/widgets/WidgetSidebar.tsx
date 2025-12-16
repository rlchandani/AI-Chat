'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Puzzle,
    Search,
    X,
    LayoutGrid,
    MessageSquare,
    Swords,
    ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import { getSetting } from '@/utils/settingsStorage';
import { WIDGET_LIBRARY, WidgetDefinition, WidgetType } from './widget-definitions';

interface WidgetSidebarProps {
    isOpen: boolean;
    onClose?: () => void;
    onAddWidget: (type: WidgetType) => void;
    isMobile: boolean;
}

export function WidgetSidebar({
    isOpen,
    onClose,
    onAddWidget,
    isMobile,
}: WidgetSidebarProps) {
    const [search, setSearch] = useState('');
    const pathname = usePathname();

    // Resize listener now handled in parent
    useEffect(() => { }, []);

    const filteredLibrary = useMemo(() => {
        if (!search) return WIDGET_LIBRARY;
        return WIDGET_LIBRARY.filter((widget) =>
            `${widget.name} ${widget.description}`.toLowerCase().includes(search.toLowerCase()),
        );
    }, [search]);

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

            {/* Sidebar */}
            <motion.div
                suppressHydrationWarning
                initial={false}
                animate={{
                    width: isMobile ? '20rem' : (isOpen ? '20rem' : '0rem'),
                    x: isMobile ? (isOpen ? 0 : '-100%') : 0,
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={clsx(
                    isMobile
                        ? 'fixed inset-y-0 left-0 z-[50] flex flex-col'
                        : 'relative h-full flex-col',
                    'bg-card border-r border-border shadow-xl md:shadow-lg overflow-hidden',
                    // Hide on mobile by default via CSS to prevent flash, show only when explicitly open
                    (isMobile && isOpen) ? 'flex' : 'hidden md:flex'
                )}
                style={{
                    width: '20rem', // Default width to avoid layout shift
                }}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            <Puzzle size={16} /> Widget Library
                        </div>

                    </div>

                    {/* Mobile Navigation */}
                    {isMobile && (
                        <div className="p-2 border-b border-border space-y-1 shrink-0">
                            <Link
                                href="/"
                                className={clsx(
                                    'flex items-center gap-3 p-3 rounded-lg transition-colors',
                                    pathname === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <MessageSquare size={20} />
                                <span className="font-medium">Chat</span>
                            </Link>
                            <Link
                                href="/battle"
                                className={clsx(
                                    'flex items-center gap-3 p-3 rounded-lg transition-colors',
                                    pathname === '/battle' ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <Swords size={20} />
                                <span className="font-medium">Battle</span>
                            </Link>
                            <Link
                                href="/widgets"
                                className={clsx(
                                    'flex items-center gap-3 p-3 rounded-lg transition-colors',
                                    pathname === '/widgets' ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <LayoutGrid size={20} />
                                <span className="font-medium">Widgets</span>
                            </Link>
                        </div>
                    )}

                    {/* Search */}
                    <div className="p-4 shrink-0">
                        <p className="text-sm text-muted-foreground mb-3">Drag widgets into your workspace</p>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search widgets"
                                className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                        </div>
                    </div>

                    {/* Widget List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 pt-0">
                        {filteredLibrary.map((widget) => (
                            <LibraryWidget key={widget.type} widget={widget} onAdd={onAddWidget} />
                        ))}
                    </div>
                </div>
            </motion.div>
        </>
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
