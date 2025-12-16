import Link from 'next/link';
import { type ReactNode } from 'react';
import clsx from 'clsx';

interface NavTabProps {
    href: string;
    currentPath: string | null;
    children: ReactNode;
}

export function NavTab({ href, currentPath, children }: NavTabProps) {
    const isActive = currentPath === href;
    return (
        <Link
            href={href}
            className={clsx(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-2',
                isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
        >
            {children}
        </Link>
    );
}
