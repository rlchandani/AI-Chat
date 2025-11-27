/**
 * Yahoo Finance Tools Module
 * Functions for fetching stock data from Yahoo Finance
 * Used by AI SDK tool integration in the chat API
 */

export interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState: string;
  exchange: string;
}

export interface StockQuoteWithYTD extends StockQuote {
  ytdChangePercent: number;
  ytdChangeAmount: number;
  spyYtdChangePercent?: number;
}

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const YAHOO_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Fetch current stock quote from Yahoo Finance
 */
export async function getStockQuote(ticker: string): Promise<StockQuote> {
  const symbol = ticker.toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

  const response = await fetch(url, {
    headers: { 'User-Agent': YAHOO_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch quote for ${symbol}: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!data.chart?.result?.[0]) {
    throw new Error(`No data found for ticker ${symbol}`);
  }

  const result = data.chart.result[0];
  const meta = result.meta;

  const currentPrice = meta.regularMarketPrice;
  const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
  const change = currentPrice - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

  return {
    ticker: symbol,
    name: meta.longName || meta.shortName || symbol,
    price: Math.round(currentPrice * 100) / 100,
    previousClose: Math.round(previousClose * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    currency: meta.currency || 'USD',
    marketState: meta.marketState || 'UNKNOWN',
    exchange: meta.exchangeName || meta.exchange || 'UNKNOWN',
  };
}

/**
 * Fetch historical stock data from Yahoo Finance
 */
export async function getHistoricalData(
  ticker: string,
  startDate: Date,
  endDate: Date
): Promise<HistoricalDataPoint[]> {
  const symbol = ticker.toUpperCase();
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': YAHOO_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch historical data for ${symbol}: ${response.status}`
    );
  }

  const data = await response.json();

  if (!data.chart?.result?.[0]) {
    return [];
  }

  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0];

  if (!quotes || !timestamps.length) {
    return [];
  }

  return timestamps
    .map((timestamp: number, index: number) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: Math.round((quotes.open?.[index] || 0) * 100) / 100,
      high: Math.round((quotes.high?.[index] || 0) * 100) / 100,
      low: Math.round((quotes.low?.[index] || 0) * 100) / 100,
      close: Math.round((quotes.close?.[index] || 0) * 100) / 100,
      volume: quotes.volume?.[index] || 0,
    }))
    .filter((item: HistoricalDataPoint) => item.close !== 0);
}

/**
 * Get stock quote with YTD performance data
 */
export async function getStockQuoteWithYTD(
  ticker: string
): Promise<StockQuoteWithYTD> {
  const quote = await getStockQuote(ticker);

  const currentYear = new Date().getFullYear();
  const yearStart = new Date(`${currentYear}-01-01`);
  const today = new Date();

  let ytdChangePercent = 0;
  let ytdChangeAmount = 0;

  try {
    const historicalData = await getHistoricalData(ticker, yearStart, today);

    if (historicalData.length > 0) {
      const firstDay = historicalData[0];
      const yearStartPrice = firstDay.open || firstDay.close;

      if (yearStartPrice > 0) {
        ytdChangePercent =
          ((quote.price - yearStartPrice) / yearStartPrice) * 100;
        ytdChangeAmount = quote.price - yearStartPrice;
      }
    }
  } catch (error) {
    console.warn(`Failed to fetch YTD data for ${ticker}:`, error);
  }

  // Fetch SPY for comparison
  let spyYtdChangePercent: number | undefined;
  try {
    const spyQuote = await getStockQuote('SPY');
    const spyHistorical = await getHistoricalData('SPY', yearStart, today);

    if (spyHistorical.length > 0 && spyQuote) {
      const spyFirstDay = spyHistorical[0];
      const spyYearStartPrice = spyFirstDay.open || spyFirstDay.close;

      if (spyYearStartPrice > 0) {
        spyYtdChangePercent =
          ((spyQuote.price - spyYearStartPrice) / spyYearStartPrice) * 100;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch SPY YTD data:', error);
  }

  return {
    ...quote,
    ytdChangePercent: Math.round(ytdChangePercent * 100) / 100,
    ytdChangeAmount: Math.round(ytdChangeAmount * 100) / 100,
    spyYtdChangePercent:
      spyYtdChangePercent !== undefined
        ? Math.round(spyYtdChangePercent * 100) / 100
        : undefined,
  };
}

/**
 * Get multiple stock quotes at once (with YTD data)
 */
export async function getMultipleStockQuotes(
  tickers: string[]
): Promise<StockQuoteWithYTD[]> {
  const results = await Promise.allSettled(
    tickers.map((ticker) => getStockQuoteWithYTD(ticker))
  );

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => (result as PromiseFulfilledResult<StockQuoteWithYTD>).value);
}

/**
 * Search for stocks by company name or ticker
 */
export async function searchStocks(
  query: string
): Promise<Array<{ symbol: string; name: string; type: string; exchange: string }>> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

  const response = await fetch(url, {
    headers: { 'User-Agent': YAHOO_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to search stocks: ${response.status}`);
  }

  const data = await response.json();
  const quotes = data.quotes || [];

  return quotes
    .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
    .map((q: any) => ({
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      type: q.quoteType,
      exchange: q.exchange || 'UNKNOWN',
    }));
}

