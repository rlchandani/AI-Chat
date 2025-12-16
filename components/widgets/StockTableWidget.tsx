'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, TrendingUp, Check, X, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import * as htmlToImage from 'html-to-image';

import { StockUI } from '@/types/stock';

// Use centralized StockUI type but alias it to StockData for local compatibility if needed,
// or just replace usages. Let's alias it for minimal diff.
type StockData = StockUI;

interface StockTableWidgetProps {
  tickers: string;
  onUpdate?: (tickers: string) => void;
  isEditable?: boolean;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void }) => void;
  initialData?: StockData[];
  autoFetch?: boolean;
  onDataChange?: (data: StockData[]) => void;
}

export function StockTableWidget({ tickers: initialTickers, onUpdate, isEditable = false, onRefreshStateChange, initialData, onDataChange }: StockTableWidgetProps) {
  const [tickers, setTickers] = useState(initialTickers || 'AAPL,MSFT,GOOGL');
  const [isEditing, setIsEditing] = useState(false);

  // Helper to process and deduplicate stock data
  const processStocks = useCallback((data: StockData[]) => {
    const processed = data.map(stock => {
      if (stock.vsSpyPercent === undefined && stock.spyYtdChangePercent !== undefined) {
        return {
          ...stock,
          vsSpyPercent: stock.ytdChangePercent - stock.spyYtdChangePercent
        };
      }
      return stock;
    });

    // Deduplicate by ticker
    const unique = Array.from(new Map(processed.map(item => [item.ticker, item])).values());

    // Sort by ticker
    return unique.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, []);

  const [stocks, setStocks] = useState<StockData[]>(() => {
    return initialData ? processStocks(initialData) : [];
  });

  // Sync initialData when it changes
  useEffect(() => {
    if (initialData) {
      setStocks(processStocks(initialData));
    }
  }, [initialData, processStocks]);

  // Sync local data changes to parent
  useEffect(() => {
    if (stocks.length > 0 && onDataChange) {
      onDataChange(stocks);
    }
  }, [stocks, onDataChange]);

  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const hasFetchedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

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
      const fileName = `stock-table-${timestamp}.png`;

      // Try Web Share API first (works on mobile and some desktop browsers)
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'image/png' });
        const shareData = {
          title: 'Stock Table',
          text: 'Check out this stock comparison from iRedlof',
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
        return;
      }
      console.error('Share error:', err);
    } finally {
      setIsSharing(false);
    }
  }, [isSharing]);

  // Listen for edit events from widget header
  useEffect(() => {
    const handleEdit = () => {
      if (isEditable) {
        setIsEditing(true);
      }
    };
    window.addEventListener('stock-table-edit', handleEdit as EventListener);
    return () => window.removeEventListener('stock-table-edit', handleEdit as EventListener);
  }, [isEditable]);

  const fetchStocks = useCallback(async (tickerList: string) => {
    if (!tickerList.trim()) {
      setStocks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/stock/batch?tickers=${encodeURIComponent(tickerList)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch stock data');
      }

      const data = await response.json();
      setStocks(processStocks(data.stocks || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock data');
      console.error('Stock fetch error:', err);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, [processStocks]);

  useEffect(() => {
    if (initialTickers && !hasFetchedRef.current && !initialData) {
      hasFetchedRef.current = true; // Mark as fetched to prevent duplicate calls
      fetchStocks(initialTickers);
    }

  }, [initialTickers, initialData, fetchStocks]);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(tickers);
    }
    setIsEditing(false);
    fetchStocks(tickers);
  };

  const handleCancel = () => {
    setTickers(initialTickers || 'AAPL,MSFT,GOOGL');
    setIsEditing(false);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshMessage('Fetching latest stock data...');
    setError(null);
    try {
      const tickerList = tickers;
      if (!tickerList.trim()) {
        setStocks([]);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/stock/batch?tickers=${encodeURIComponent(tickerList)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch stock data');
      }

      const data = await response.json();
      setStocks(processStocks(data.stocks || []));
      setRefreshMessage('Stock data updated successfully!');
      setTimeout(() => {
        setRefreshMessage(null);
      }, 3000);
    } catch (err) {
      setRefreshMessage(null);
      setError(err instanceof Error ? err.message : 'Failed to load stock data');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [tickers, processStocks]);

  // Stabilize handleRefresh for parent consumption to prevent infinite loops
  const handleRefreshRef = useRef(handleRefresh);
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  });

  const stableHandleRefresh = useCallback(() => {
    handleRefreshRef.current();
  }, []);

  // Expose refresh state to parent
  useEffect(() => {
    if (onRefreshStateChange) {
      onRefreshStateChange({
        refreshing,
        refreshMessage,
        onRefresh: stableHandleRefresh,
      });
    }
  }, [refreshing, refreshMessage, stableHandleRefresh, onRefreshStateChange]);

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    const absolute = Math.abs(value).toFixed(2);
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${absolute}%`;
  };

  const formatAmount = (value: number) => {
    const absolute = Math.abs(value).toFixed(2);
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}$${absolute}`;
  };

  if (isEditing && isEditable) {
    return (
      <div className="w-full h-full flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Edit Tickers</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="p-1.5 rounded-full hover:bg-primary/10 text-primary transition"
              aria-label="Save tickers"
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
          value={tickers}
          onChange={(e) => setTickers(e.target.value.toUpperCase())}
          placeholder="Enter tickers (e.g., AAPL,MSFT,GOOGL)"
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
        <p className="text-xs text-muted-foreground">Enter comma-separated ticker symbols</p>
      </div>
    );
  }

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

  return (
    <div className="relative group w-full h-full">
      {/* Share Button - positioned outside the captured area */}
      <button
        onClick={handleShare}
        disabled={isSharing}
        className="absolute -top-2 -right-2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-200 disabled:opacity-50 opacity-0 group-hover:opacity-100"
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

      <div
        ref={cardRef}
        className="w-full h-full rounded-2xl border border-border bg-card shadow-sm p-4 flex flex-col relative"
      >
        <div className="flex-1 overflow-auto">
          <table className="text-sm">
            <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
              <tr className="border-b border-border/70">
                <th className="text-left py-2 px-2 text-xs uppercase tracking-wide text-foreground font-semibold">Ticker</th>
                <th className="text-right py-2 px-2 text-xs uppercase tracking-wide text-foreground font-semibold">Price</th>
                <th className="text-right py-2 px-2 text-xs uppercase tracking-wide text-foreground font-semibold">Change</th>
                <th className="text-right py-2 px-2 text-xs uppercase tracking-wide text-foreground font-semibold">YTD</th>
                <th className="text-right py-2 px-2 text-xs uppercase tracking-wide text-foreground font-semibold">vs SPY</th>
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                    No stock data available
                  </td>
                </tr>
              ) : (
                stocks.map((stock, index) => (
                  <motion.tr
                    key={stock.ticker}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-border/30 hover:bg-background/50 transition-colors"
                  >
                    <td className="py-2.5 px-2">
                      <div className="font-semibold text-foreground">{stock.ticker}</div>
                      {stock.name && stock.name !== stock.ticker && (
                        <div className="text-xs text-muted-foreground truncate max-w-[120px]">{stock.name}</div>
                      )}
                      {stock.error && (
                        <div className="text-xs text-red-500">{stock.error}</div>
                      )}
                    </td>
                    <td className="text-right py-2.5 px-2">
                      <div className="font-semibold text-foreground">
                        {stock.price > 0 ? formatPrice(stock.price) : '—'}
                      </div>
                    </td>
                    <td className="text-right py-2.5 px-2">
                      <div className={`font-semibold flex items-center justify-end gap-1 ${stock.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                        <span>{stock.change >= 0 ? '▲' : '▼'}</span>
                        {stock.changePercent !== 0 ? formatPercent(stock.changePercent) : '—'}
                      </div>
                      {stock.change !== 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatAmount(stock.change)}
                        </div>
                      )}
                    </td>
                    <td className="text-right py-2.5 px-2">
                      <div className={`font-semibold flex items-center justify-end gap-1 ${stock.ytdChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                        <span>{stock.ytdChangePercent >= 0 ? '▲' : '▼'}</span>
                        {stock.ytdChangePercent !== 0 ? formatPercent(stock.ytdChangePercent) : '—'}
                      </div>
                      {stock.ytdChangeAmount !== 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatAmount(stock.ytdChangeAmount)}
                        </div>
                      )}
                    </td>
                    <td className="text-right py-2.5 px-2">
                      {stock.vsSpyPercent !== undefined ? (
                        <div className={`font-semibold flex items-center justify-end gap-1 ${stock.vsSpyPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                          <span>{stock.vsSpyPercent >= 0 ? '▲' : '▼'}</span>
                          {formatPercent(stock.vsSpyPercent)}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">—</div>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] uppercase tracking-wider text-foreground/80 text-right mt-2 pt-2 border-t border-border/30">
          iRedlof Intelligence
        </div>
      </div>
    </div>
  );
}
