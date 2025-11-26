'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, TrendingUp, Edit2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StockData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  ytdChangePercent: number;
  ytdChangeAmount: number;
  spyYtdChangePercent?: number;
  vsSpyPercent?: number;
  error?: string;
}

interface StockTableWidgetProps {
  tickers: string;
  onUpdate?: (tickers: string) => void;
  isEditable?: boolean;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void }) => void;
}

export function StockTableWidget({ tickers: initialTickers, onUpdate, isEditable = false, onRefreshStateChange }: StockTableWidgetProps) {
  const [tickers, setTickers] = useState(initialTickers || 'AAPL,MSFT,GOOGL');
  const [isEditing, setIsEditing] = useState(false);
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  
  // Listen for edit events from widget header
  useEffect(() => {
    const handleEdit = (e: CustomEvent) => {
      if (isEditable) {
        setIsEditing(true);
      }
    };
    window.addEventListener('stock-table-edit', handleEdit as EventListener);
    return () => window.removeEventListener('stock-table-edit', handleEdit as EventListener);
  }, [isEditable]);

  const fetchStocks = async (tickerList: string) => {
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
      setStocks(data.stocks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock data');
      console.error('Stock fetch error:', err);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialTickers && !hasFetchedRef.current) {
      hasFetchedRef.current = true; // Mark as fetched to prevent duplicate calls
      fetchStocks(initialTickers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTickers]);

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
      setStocks(data.stocks || []);
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
  }, [tickers]);

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

  return (
    <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-4 flex flex-col relative group">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
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
                    <div className={`font-semibold flex items-center justify-end gap-1 ${
                      stock.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
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
                    <div className={`font-semibold flex items-center justify-end gap-1 ${
                      stock.ytdChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
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
                      <div className={`font-semibold flex items-center justify-end gap-1 ${
                        stock.vsSpyPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
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
        Sourced from Yahoo Finance
      </div>
    </div>
  );
}

