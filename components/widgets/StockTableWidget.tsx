'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Share2, TrendingUp, X } from 'lucide-react';
import { useCardShare } from '@/hooks/use-card-share';
import { StockUI } from '@/types/stock';

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

  const { share, isSharing, shareSuccess } = useCardShare();
  const hasFetchedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Share card as image
  const handleShare = useCallback(async () => {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const fileName = `stock-table-${timestamp}.png`;

    await share(cardRef, {
      fileName,
      title: 'Stock Table',
      text: 'Check out this stock comparison from iRedlof',
    });
  }, [share]);

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
      hasFetchedRef.current = true;
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

  // Stabilize handleRefresh for parent consumption
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
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
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
      {/* Share Button */}
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
        className="w-full h-full rounded-2xl border border-border bg-card shadow-sm p-4 flex flex-col relative overflow-hidden"
      >
        <div className="flex-1 overflow-auto space-y-0 divide-y divide-border/40">
          {stocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No stock data available
            </div>
          ) : (
            stocks.map((stock, index) => (
              <motion.div
                key={stock.ticker}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="py-3 first:pt-0 last:pb-0"
              >
                {/* Row 1: Ticker/Name on left, Price/Change on right */}
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Ticker & Name */}
                  <div className="flex-1 min-w-0">
                    {/* Show header label only for first stock */}
                    {index === 0 && (
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Ticker</div>
                    )}
                    <div className="text-lg font-bold text-foreground leading-tight">{stock.ticker}</div>
                    {stock.name && stock.name !== stock.ticker && (
                      <div className="text-xs text-muted-foreground truncate leading-tight">{stock.name}</div>
                    )}
                    {stock.error && (
                      <div className="text-xs text-red-500 truncate">{stock.error}</div>
                    )}
                  </div>

                  {/* Right: Price & 24h Change */}
                  <div className="text-right flex-shrink-0">
                    {/* Show header label only for first stock */}
                    {index === 0 && (
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Price</div>
                    )}
                    <div className="text-lg font-bold text-foreground leading-tight">
                      {stock.price > 0 ? formatPrice(stock.price) : '—'}
                    </div>
                    <div className={`text-sm font-medium leading-tight ${stock.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {stock.changePercent !== 0 ? formatPercent(stock.changePercent) : '—'}
                    </div>
                  </div>
                </div>

                {/* Row 2: YTD and vs SPY info */}
                <div className="mt-1 text-xs text-right">
                  <span className="text-foreground">YTD: </span>
                  <span className={stock.ytdChangePercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatPercent(stock.ytdChangePercent)}
                  </span>
                  <span className="text-foreground mx-1.5">|</span>
                  <span className="text-foreground">YTD vs SPY: </span>
                  {stock.vsSpyPercent !== undefined ? (
                    <span className={stock.vsSpyPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
                      {formatPercent(stock.vsSpyPercent)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
        <div className="text-[11px] uppercase tracking-wider text-foreground/80 text-right mt-2 pt-2 border-t border-border/30">
          iRedlof Intelligence
        </div>
      </div>
    </div>
  );
}
