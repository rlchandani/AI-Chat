import { ComponentType } from 'react';
import {
    TrendingUp,
    Sun,
    NotebookPen,
    Clock,
    GitBranch,
} from 'lucide-react';

export type WidgetType = 'stock' | 'stock-table' | 'weather' | 'notes' | 'clock' | 'github';

export type WidgetDefinition = {
    type: WidgetType;
    name: string;
    description: string;
    icon: ComponentType<{ className?: string; size?: number }>;
    accent: string;
};

export const WIDGET_LIBRARY: WidgetDefinition[] = [
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
