'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, TrendingUp, Share2, Check } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

import { StockUI } from '@/types/stock';

interface StockQuoteCardProps {
    ticker: string;
    name?: string;
    price?: number;
    changePercent?: number;
    changeAmount?: number;
    ytdChangePercent?: number;
    ytdChangeAmount?: number;
    spyYtdChangePercent?: number;
    autoFetch?: boolean;
    onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void }) => void;
    onDataChange?: (data: StockUI) => void;
    initialData?: StockUI | null;
}

// Use centralized StockUI type but alias it to StockData for local compatibility
type StockData = StockUI;

export function StockQuoteCard({
    ticker: initialTicker,
    name: initialName,
    price: initialPrice,
    changePercent: initialChangePercent,
    changeAmount: initialChangeAmount,
    ytdChangePercent: initialYtdChangePercent,
    ytdChangeAmount: initialYtdChangeAmount,
    spyYtdChangePercent: initialSpyYtdChangePercent,
    autoFetch = true,
    onRefreshStateChange,
    onDataChange,
    initialData,
}: StockQuoteCardProps) {
    const [stockData, setStockData] = useState<StockData | null>(
        initialData || (initialPrice !== undefined
            ? {
                ticker: initialTicker,
                name: initialName || initialTicker,
                price: initialPrice,
                change: initialChangeAmount ?? 0, // Map changeAmount to change
                changePercent: initialChangePercent ?? 0,
                changeAmount: initialChangeAmount ?? 0,
                ytdChangePercent: initialYtdChangePercent ?? 0,
                ytdChangeAmount: initialYtdChangeAmount ?? 0,
                spyYtdChangePercent: initialSpyYtdChangePercent,
                // Default values for StockUI required properties
                previousClose: 0,
                currency: 'USD',
                marketState: 'UNKNOWN',
                exchange: 'UNKNOWN'
            }
            : null)
    );

    // Sync initialData when it changes (e.g. during drag operations)
    useEffect(() => {
        if (initialData) {
            setStockData(initialData);
        }
    }, [initialData]);

    // Sync local data changes to parent
    useEffect(() => {
        if (stockData && onDataChange) {
            onDataChange(stockData);
        }
    }, [stockData, onDataChange]);
    const [loading, setLoading] = useState(autoFetch && initialPrice === undefined);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const hasFetchedRef = useRef(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Core fetch function - reused by initial load and refresh
    const fetchStockData = useCallback(async (ticker: string): Promise<StockData> => {
        const response = await fetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch stock data');
        }
        return response.json();
    }, []);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        setRefreshMessage('Fetching latest stock data...');
        setError(null);
        try {
            const ticker = stockData?.ticker || initialTicker;
            const data = await fetchStockData(ticker);
            setStockData(data);
            if (onDataChange) onDataChange(data);
            setRefreshMessage('Stock data updated successfully!');
            setTimeout(() => setRefreshMessage(null), 3000);
        } catch {
            setRefreshMessage(null);
        } finally {
            setRefreshing(false);
        }
    }, [stockData?.ticker, initialTicker, fetchStockData, onDataChange]);

    // Share card as image - Gold Standard implementation
    const handleShare = useCallback(async () => {
        if (!cardRef.current || isSharing) return;

        setIsSharing(true);
        try {
            const node = cardRef.current;

            // 1. Wait for fonts to be ready to prevent "glitchy" text (FOUT fix)
            await document.fonts.ready;

            // Detect if dark mode - use slate colors that match the card
            const isDarkMode = document.documentElement.classList.contains('dark');
            const bgColor = isDarkMode ? '#1e293b' : '#f8fafc'; // slate-800 / slate-50

            // Capture the card as PNG blob using html-to-image (Gold Standard config)
            const blob = await htmlToImage.toBlob(node, {
                pixelRatio: window.devicePixelRatio || 2, // Retina display support
                backgroundColor: bgColor,                  // Prevent transparent artifacts
                cacheBust: true,                          // CORS fix for external images
                width: node.scrollWidth,                  // Layout stability
                height: node.scrollHeight,
                style: { transform: 'none', margin: '0' }, // Prevent layout shifts
            });

            if (!blob) {
                throw new Error('Failed to create image');
            }

            // Generate unique filename with date and time (YYYY-MM-DD_HH-MM-SS)
            const now = new Date();
            const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
            const fileName = `${stockData?.ticker || 'stock'}-quote-${timestamp}.png`;

            // Try Web Share API first (works on mobile and some desktop browsers)
            if (navigator.share && navigator.canShare) {
                const file = new File([blob], fileName, { type: 'image/png' });
                const shareData = {
                    title: `${stockData?.ticker} Stock Quote`,
                    text: `${stockData?.name} (${stockData?.ticker}) - $${stockData?.price?.toFixed(2)}`,
                    files: [file],
                };

                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    setShareSuccess(true);
                    setTimeout(() => setShareSuccess(false), 2000);
                    return;
                }
            }

            // Fallback: Download the image
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 2000);
        } catch (err) {
            // Silently ignore AbortError (user cancelled the share dialog)
            if (err instanceof Error && err.name === 'AbortError') {
                // User cancelled - not an error, just return silently
                return;
            }
            // Log actual errors
            console.error('Share error:', err);
        } finally {
            setIsSharing(false);
        }
    }, [stockData, isSharing]);

    // Expose refresh state to parent
    useEffect(() => {
        if (onRefreshStateChange) {
            onRefreshStateChange({
                refreshing,
                refreshMessage,
                onRefresh: handleRefresh,
            });
        }
    }, [refreshing, refreshMessage, handleRefresh, onRefreshStateChange]);

    // Initial data fetch on mount
    useEffect(() => {
        if (autoFetch && initialPrice === undefined && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            setLoading(true);
            fetchStockData(initialTicker)
                .then(setStockData)
                .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stock data'))
                .finally(() => setLoading(false));
        }
    }, [autoFetch, initialPrice, initialTicker, fetchStockData]);

    if (loading) {
        return (
            <div className="w-full h-full rounded-2xl border border-border bg-card shadow-sm p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-foreground">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Loading stock data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full rounded-2xl border border-border bg-card shadow-sm p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-foreground">
                    <TrendingUp className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }

    if (!stockData) {
        return null;
    }

    const { ticker, name, price, changePercent, changeAmount, ytdChangePercent, ytdChangeAmount, spyYtdChangePercent } = stockData;

    // Helper to check if a number is valid and finite
    const isValidNumber = (val: unknown): val is number => typeof val === 'number' && Number.isFinite(val);

    // Calculate change amount - use provided value if non-zero, otherwise derive from price & percent
    const normalizedChangeAmount = isValidNumber(changeAmount) && changeAmount !== 0
        ? changeAmount
        : isValidNumber(price) && isValidNumber(changePercent)
            ? price * (changePercent / 100)
            : undefined;

    // Calculate YTD amount - use provided value if non-zero, otherwise derive from price & percent
    const normalizedYtdAmount = isValidNumber(ytdChangeAmount) && ytdChangeAmount !== 0
        ? ytdChangeAmount
        : isValidNumber(price) && isValidNumber(ytdChangePercent)
            ? price - price / (1 + ytdChangePercent / 100)
            : undefined;

    // SPY YTD - treat 0 as valid since SPY can have 0% change
    const normalizedSpyYtd = isValidNumber(spyYtdChangePercent) ? spyYtdChangePercent : undefined;
    const hasSpyYtd = normalizedSpyYtd !== undefined;

    // Calculate YTD vs SPY comparison
    const ytdVsSpy = isValidNumber(ytdChangePercent) && hasSpyYtd
        ? ytdChangePercent - normalizedSpyYtd
        : undefined;

    const isChangePositive = (changePercent ?? 0) >= 0;
    const isYtdPositive = (ytdChangePercent ?? 0) >= 0;

    const formatPercent = (value: number): string => {
        const sign = value > 0 ? '+' : value < 0 ? '−' : '';
        return `${sign}${Math.abs(value).toFixed(2)}%`;
    };

    const formatAmount = (value: number | undefined): string => {
        if (!isValidNumber(value)) return '—';
        const sign = value > 0 ? '+' : value < 0 ? '−' : '';
        return `${sign}$${Math.abs(value).toFixed(2)}`;
    };

    return (
        <div className="relative h-full">
            {/* Share Button - positioned outside the captured area */}
            <button
                onClick={handleShare}
                disabled={isSharing}
                className="absolute -top-2 -right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-200 disabled:opacity-50"
                title={shareSuccess ? 'Shared!' : 'Share as image'}
                aria-label="Share as image"
            >
                {isSharing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : shareSuccess ? (
                    <Check className="w-4 h-4 text-green-500" />
                ) : (
                    <Share2 className="w-4 h-4" />
                )}
            </button>

            {/* Card content - this gets captured as image */}
            <div
                ref={cardRef}
                className="w-full h-full rounded-2xl border border-border bg-card shadow-sm p-4 space-y-4 flex flex-col"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                            <span>Ticker</span>
                        </div>
                        <div className="text-3xl font-black tracking-tight text-foreground">{ticker?.toUpperCase() || '—'}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[220px]">{name || 'Unknown company'}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Price</div>
                        <div className="text-3xl font-bold text-foreground">
                            {Number.isFinite(price) ? `$${price.toFixed(2)}` : '—'}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-muted p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Change</div>
                        <div
                            className={`text-lg font-semibold flex items-center gap-1 ${isChangePositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}
                        >
                            <span>{isChangePositive ? '▲' : '▼'}</span>
                            {isValidNumber(changePercent) ? formatPercent(changePercent) : '—'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {formatAmount(normalizedChangeAmount)}
                        </div>
                    </div>
                    <div className="rounded-xl border border-border bg-muted p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">YTD</div>
                        <div
                            className={`text-lg font-semibold flex items-center gap-1 ${isYtdPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}
                        >
                            <span>{isYtdPositive ? '▲' : '▼'}</span>
                            {isValidNumber(ytdChangePercent) ? formatPercent(ytdChangePercent) : '—'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            {formatAmount(normalizedYtdAmount)}
                        </div>
                    </div>
                </div>

                {(isValidNumber(ytdChangePercent) || hasSpyYtd) && (
                    <div className="rounded-xl border border-border bg-muted p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">YTD vs SPY</div>
                        <div
                            className={`text-lg font-semibold flex items-center gap-1 ${ytdVsSpy !== undefined
                                ? ytdVsSpy >= 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                : 'text-foreground'
                                }`}
                        >
                            {ytdVsSpy !== undefined && <span>{ytdVsSpy >= 0 ? '▲' : '▼'}</span>}
                            {ytdVsSpy !== undefined ? formatPercent(ytdVsSpy) : '—'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Stock YTD: {isValidNumber(ytdChangePercent) ? formatPercent(ytdChangePercent) : '—'} • SPY YTD:{' '}
                            {hasSpyYtd ? formatPercent(normalizedSpyYtd) : 'Unavailable'}
                        </div>
                    </div>
                )}

                <div className="text-[11px] uppercase tracking-wider text-muted-foreground text-right">
                    iRedlof Intelligence
                </div>
            </div>
        </div>
    );
}

