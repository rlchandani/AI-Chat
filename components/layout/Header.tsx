'use client';

import { Menu, MessageSquare, Swords, LayoutGrid } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { NavTab } from './NavTab';

interface HeaderProps {
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    autoHideSidebar: boolean;
    rightContent?: ReactNode;
    className?: string; // Allow external styling or overriding
}

export function Header({
    sidebarOpen,
    onToggleSidebar,
    autoHideSidebar,
    rightContent,
    className,
}: HeaderProps) {
    const pathname = usePathname();

    return (
        <header className={`h-14 border-b border-border flex items-center justify-between px-1 bg-background/80 backdrop-blur-md z-50 sticky top-0 ${className || ''}`}>
            <div className="flex items-center gap-3">
                {/* Mobile Hamburger - Always visible on mobile, handling is usually in parent but UI here */}
                <button
                    onClick={onToggleSidebar}
                    className="md:hidden p-3 -ml-2 rounded-lg hover:bg-accent transition-colors"
                    aria-label="Toggle sidebar"
                >
                    <Menu size={20} />
                </button>

                {/* Desktop Hamburger - Conditional based on auto-hide */}
                {autoHideSidebar && (
                    <button
                        onClick={onToggleSidebar}
                        className="hidden md:block p-3 rounded-lg hover:bg-accent transition-colors"
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
                {rightContent}
            </div>
        </header>
    );
}
