'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';

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
}

interface StockData {
    ticker: string;
    name: string;
    price: number;
    changePercent: number;
    changeAmount: number;
    ytdChangePercent: number;
    ytdChangeAmount: number;
    spyYtdChangePercent?: number;
}

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
}: StockQuoteCardProps) {
    const [stockData, setStockData] = useState<StockData | null>(
        initialPrice !== undefined
            ? {
                  ticker: initialTicker,
                  name: initialName || initialTicker,
                  price: initialPrice,
                  changePercent: initialChangePercent ?? 0,
                  changeAmount: initialChangeAmount ?? 0,
                  ytdChangePercent: initialYtdChangePercent ?? 0,
                  ytdChangeAmount: initialYtdChangeAmount ?? 0,
                  spyYtdChangePercent: initialSpyYtdChangePercent,
              }
            : null
    );
    const [loading, setLoading] = useState(autoFetch && initialPrice === undefined);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
    const hasFetchedRef = useRef(false);

    const fetchStock = async (tickerToFetch?: string) => {
        const ticker = tickerToFetch || initialTicker;
        try {
            setError(null);
            const response = await fetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch stock data');
            }

            const data = await response.json();
            setStockData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load stock data');
            console.error('Stock fetch error:', err);
            throw err;
        }
    };

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        setRefreshMessage('Fetching latest stock data...');
        setError(null);
        try {
            const tickerToFetch = stockData?.ticker || initialTicker;
            const response = await fetch(`/api/stock?ticker=${encodeURIComponent(tickerToFetch)}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch stock data');
            }

            const data = await response.json();
            setStockData(data);
            setRefreshMessage('Stock data updated successfully!');
            setTimeout(() => {
                setRefreshMessage(null);
            }, 3000);
        } catch (err) {
            setRefreshMessage(null);
        } finally {
            setRefreshing(false);
        }
    }, [stockData?.ticker, initialTicker]);

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

    useEffect(() => {
        if (autoFetch && initialPrice === undefined && !hasFetchedRef.current) {
            hasFetchedRef.current = true; // Mark as fetched to prevent duplicate calls
            const loadStock = async () => {
                try {
                    setLoading(true);
                    await fetchStock();
                } finally {
                    setLoading(false);
                }
            };

            loadStock();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return (
            <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-foreground">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Loading stock data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-6 flex items-center justify-center">
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
        <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-4 space-y-4 flex flex-col">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground mb-1">
                        <span>Ticker</span>
                    </div>
                    <div className="text-3xl font-black tracking-tight text-foreground">{ticker?.toUpperCase() || '—'}</div>
                    <div className="text-sm text-foreground truncate max-w-[220px]">{name || 'Unknown company'}</div>
                </div>
                <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-foreground mb-1">Price</div>
                    <div className="text-3xl font-bold text-foreground">
                        {Number.isFinite(price) ? `$${price.toFixed(2)}` : '—'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/70 bg-transparent dark:bg-transparent p-3 shadow-sm dark:shadow-md">
                    <div className="text-xs uppercase tracking-wide text-foreground">Change</div>
                    <div
                        className={`text-lg font-semibold flex items-center gap-1 ${
                            isChangePositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}
                    >
                        <span>{isChangePositive ? '▲' : '▼'}</span>
                        {isValidNumber(changePercent) ? formatPercent(changePercent) : '—'}
                    </div>
                    <div className="text-xs text-foreground mt-1">
                        {formatAmount(normalizedChangeAmount)}
                    </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-transparent dark:bg-transparent p-3 shadow-sm dark:shadow-md">
                    <div className="text-xs uppercase tracking-wide text-foreground">YTD</div>
                    <div
                        className={`text-lg font-semibold flex items-center gap-1 ${
                            isYtdPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}
                    >
                        <span>{isYtdPositive ? '▲' : '▼'}</span>
                        {isValidNumber(ytdChangePercent) ? formatPercent(ytdChangePercent) : '—'}
                    </div>
                    <div className="text-xs text-foreground mt-1">
                        {formatAmount(normalizedYtdAmount)}
                    </div>
                </div>
            </div>

            {(isValidNumber(ytdChangePercent) || hasSpyYtd) && (
                <div className="rounded-xl border border-border/70 bg-transparent dark:bg-transparent p-3 shadow-sm dark:shadow-md">
                    <div className="text-xs uppercase tracking-wide text-foreground">YTD vs SPY</div>
                    <div
                        className={`text-lg font-semibold flex items-center gap-1 ${
                            ytdVsSpy !== undefined
                                ? ytdVsSpy >= 0
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                : 'text-foreground'
                        }`}
                    >
                        {ytdVsSpy !== undefined && <span>{ytdVsSpy >= 0 ? '▲' : '▼'}</span>}
                        {ytdVsSpy !== undefined ? formatPercent(ytdVsSpy) : '—'}
                    </div>
                    <div className="text-xs text-foreground mt-1">
                        Stock YTD: {isValidNumber(ytdChangePercent) ? formatPercent(ytdChangePercent) : '—'} • SPY YTD:{' '}
                        {hasSpyYtd ? formatPercent(normalizedSpyYtd) : 'Unavailable'}
                    </div>
                </div>
            )}

            <div className="text-[11px] uppercase tracking-wider text-foreground/80 text-right">
                Sourced from Yahoo Finance
            </div>
        </div>
    );
}

