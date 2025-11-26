import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

// Yahoo Finance API (Unofficial) - Direct API calls for batch stock data
// Fetches multiple stocks in parallel

async function fetchYahooQuote(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch quote: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
    throw new Error(`No data found for ticker ${ticker}`);
  }
  
  const result = data.chart.result[0];
  const meta = result.meta;
  
  const currentPrice = meta.regularMarketPrice;
  const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
  
  const change = currentPrice - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
  
  return {
    ticker: ticker.toUpperCase(),
    price: currentPrice,
    previousClose: previousClose,
    change: change,
    changePercent: changePercent,
    name: meta.longName || meta.shortName || ticker,
  };
}

async function fetchYTDData(ticker: string, currentPrice: number) {
  try {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01`);
    const today = new Date();
    const period1 = Math.floor(yearStart.getTime() / 1000);
    const period2 = Math.floor(today.getTime() / 1000);
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${period1}&period2=${period2}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      return { ytdChangePercent: 0, ytdChangeAmount: 0 };
    }
    
    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return { ytdChangePercent: 0, ytdChangeAmount: 0 };
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0];
    
    if (!quotes || !timestamps.length) {
      return { ytdChangePercent: 0, ytdChangeAmount: 0 };
    }
    
    // Get first trading day - use open price
    const firstDayOpen = quotes.open?.[0];
    const firstDayClose = quotes.close?.[0];
    const yearStartPrice = firstDayOpen || firstDayClose || currentPrice;
    
    if (yearStartPrice > 0 && currentPrice > 0) {
      const ytdChangePercent = ((currentPrice - yearStartPrice) / yearStartPrice) * 100;
      const ytdChangeAmount = currentPrice - yearStartPrice;
      return { ytdChangePercent, ytdChangeAmount };
    }
    
    return { ytdChangePercent: 0, ytdChangeAmount: 0 };
  } catch (err) {
    console.warn(`[Batch API] Failed to fetch YTD for ${ticker}:`, err);
    return { ytdChangePercent: 0, ytdChangeAmount: 0 };
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const tickersParam = searchParams.get('tickers') || '';
    
    if (!tickersParam) {
      return NextResponse.json(
        { error: 'Tickers parameter is required (comma-separated)' },
        { status: 400 }
      );
    }
    
    // Parse comma-separated tickers
    const tickers = tickersParam
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);
    
    if (tickers.length === 0) {
      return NextResponse.json(
        { error: 'No valid tickers provided' },
        { status: 400 }
      );
    }
    
    console.log(`[Batch Stock API] Fetching data for ${tickers.length} tickers:`, tickers.join(', '));
    
    // Fetch quotes for all tickers in parallel
    const quotePromises = tickers.map(ticker => 
      fetchYahooQuote(ticker).catch(err => {
        console.error(`[Batch Stock API] Error fetching ${ticker}:`, err);
        return {
          ticker,
          price: 0,
          previousClose: 0,
          change: 0,
          changePercent: 0,
          name: ticker,
          error: err.message,
        };
      })
    );
    
    const quotes = await Promise.all(quotePromises);
    
    // Fetch YTD data for all tickers in parallel (only for successful quotes)
    const ytdPromises = quotes.map(quote => {
      if (quote.error || quote.price === 0) {
        return Promise.resolve({ ytdChangePercent: 0, ytdChangeAmount: 0 });
      }
      return fetchYTDData(quote.ticker, quote.price);
    });
    
    const ytdData = await Promise.all(ytdPromises);
    
    // Fetch SPY YTD data for comparison
    let spyYtdChangePercent = 0;
    try {
      const spyQuote = await fetchYahooQuote('SPY');
      const spyYtd = await fetchYTDData('SPY', spyQuote.price);
      spyYtdChangePercent = Math.round(spyYtd.ytdChangePercent * 100) / 100;
    } catch (err) {
      console.warn('[Batch Stock API] Failed to fetch SPY YTD:', err);
    }
    
    // Combine quote and YTD data
    const stockData = quotes.map((quote, index) => {
      const ytdPercent = Math.round(ytdData[index].ytdChangePercent * 100) / 100;
      const vsSpyPercent = ytdPercent - spyYtdChangePercent;
      
      return {
        ticker: quote.ticker,
        name: quote.name,
        price: Math.round(quote.price * 100) / 100,
        change: Math.round(quote.change * 100) / 100,
        changePercent: Math.round(quote.changePercent * 100) / 100,
        ytdChangePercent: ytdPercent,
        ytdChangeAmount: Math.round(ytdData[index].ytdChangeAmount * 100) / 100,
        spyYtdChangePercent: spyYtdChangePercent,
        vsSpyPercent: Math.round(vsSpyPercent * 100) / 100,
        error: quote.error,
      };
    });
    
    return NextResponse.json({ stocks: stockData });
  } catch (error) {
    console.error('[Batch Stock API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stock data' },
      { status: 500 }
    );
  }
}

