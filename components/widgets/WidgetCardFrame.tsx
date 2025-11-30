import React from 'react';
import clsx from 'clsx';

interface WidgetCardFrameProps {
    title: string;
    children: React.ReactNode;
    headerActions?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
    isOver?: boolean;
}

export function WidgetCardFrame({
    title,
    children,
    headerActions,
    style,
    className,
    isOver,
}: WidgetCardFrameProps) {
    return (
        <div
            style={style}
            className={clsx(
                'rounded-2xl border border-border bg-card shadow-md overflow-hidden flex flex-col h-full w-full',
                isOver ? 'ring-2 ring-primary/40 border-primary/30' : undefined,
                className
            )}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {title}
                </p>
                {headerActions && (
                    <div className="flex items-center gap-2">
                        {headerActions}
                    </div>
                )}
            </div>
            <div className="p-4 flex-1 min-h-0">
                {children}
            </div>
        </div>
    );
}
