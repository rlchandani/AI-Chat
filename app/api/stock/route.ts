import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

// Yahoo Finance API (Unofficial) - Direct API calls
// Using Yahoo Finance's public endpoints directly
// Rate limits: ~1-2 requests/second recommended (no official limits)

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
  const quote = result.indicators?.quote?.[0];
  
  // Get current price - Yahoo uses regularMarketPrice for current price
  const currentPrice = meta.regularMarketPrice;
  // Yahoo uses chartPreviousClose for the previous day's close
  const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
  
  // Calculate change (Yahoo doesn't provide these directly in this endpoint)
  const change = currentPrice - previousClose;
  const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
  
  console.log(`[Yahoo Quote] ${ticker}: currentPrice=${currentPrice}, previousClose=${previousClose}, change=${change}, changePercent=${changePercent.toFixed(2)}%`);
  console.log(`[Yahoo Quote] ${ticker} meta keys:`, Object.keys(meta));
  
  return {
    regularMarketPrice: currentPrice,
    regularMarketPreviousClose: previousClose,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    longName: meta.longName || meta.shortName,
    shortName: meta.shortName,
  };
}

async function fetchYahooHistorical(ticker: string, startDate: Date, endDate: Date) {
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${period1}&period2=${period2}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch historical data: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
    return [];
  }
  
  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0];
  
  if (!quotes || !timestamps.length) {
    return [];
  }
  
  // Return array of { date, open, close, adjClose }
  return timestamps.map((timestamp: number, index: number) => ({
    date: new Date(timestamp * 1000),
    open: quotes.open?.[index],
    close: quotes.close?.[index],
    adjClose: quotes.close?.[index], // Yahoo doesn't always provide adjClose in this endpoint
  })).filter((item: any) => item.close != null || item.open != null);
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ticker = searchParams.get('ticker')?.toUpperCase() || 'AAPL';

    console.log(`[Stock API] Fetching data for ticker: ${ticker}`);

    // Fetch current quote
    let quote: any;
    try {
      quote = await fetchYahooQuote(ticker);
      console.log(`[Stock API] Quote received for ${ticker}:`, quote ? 'Success' : 'Null');
    } catch (quoteError: any) {
      console.error(`[Stock API] Error fetching quote for ${ticker}:`, quoteError);
      throw new Error(`Failed to fetch quote for "${ticker}": ${quoteError?.message || 'Unknown error'}`);
    }
    
    if (!quote || typeof quote.regularMarketPrice !== 'number') {
      console.error(`[Stock API] Invalid quote data for ${ticker}:`, quote);
      throw new Error(`Stock ticker "${ticker}" not found or no data available`);
    }

    const currentPrice = quote.regularMarketPrice;
    const previousClose = (typeof quote.regularMarketPreviousClose === 'number' ? quote.regularMarketPreviousClose : currentPrice);
    const changePercent = (typeof quote.regularMarketChangePercent === 'number' ? quote.regularMarketChangePercent : 
      (previousClose !== 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0));
    const changeAmount = (typeof quote.regularMarketChange === 'number' ? quote.regularMarketChange : (currentPrice - previousClose));
    const companyName = (typeof quote.longName === 'string' ? quote.longName : 
      (typeof quote.shortName === 'string' ? quote.shortName : ticker));
    
    console.log(`[${ticker}] Price data: current=${currentPrice}, previous=${previousClose}, change=${changeAmount}, changePercent=${changePercent}%`);

    // Calculate YTD - get price at start of year
    let ytdChangePercent = 0;
    let ytdChangeAmount = 0;
    
    try {
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(`${currentYear}-01-01`);
      const today = new Date();
      
      // Get historical data from start of year to today
      const historicalData: any = await fetchYahooHistorical(ticker, yearStart, today);

      if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
        // Get the first trading day of the year (first entry in the array)
        // Use open price for YTD calculation (price at the start of the first trading day)
        const firstDay: any = historicalData[0];
        const yearStartPrice = (typeof firstDay.open === 'number' ? firstDay.open : 
          (typeof firstDay.close === 'number' ? firstDay.close : currentPrice));
        
        if (yearStartPrice > 0 && currentPrice > 0) {
          ytdChangePercent = ((currentPrice - yearStartPrice) / yearStartPrice) * 100;
          ytdChangeAmount = currentPrice - yearStartPrice;
          console.log(`[${ticker}] YTD calculation: yearStartPrice (open)=${yearStartPrice.toFixed(2)}, currentPrice=${currentPrice.toFixed(2)}, ytdChangePercent=${ytdChangePercent.toFixed(2)}%`);
        } else {
          console.warn(`[${ticker}] Invalid YTD data: yearStartPrice=${yearStartPrice}, currentPrice=${currentPrice}`);
        }
      } else {
        console.warn(`[${ticker}] No historical data available for YTD calculation`);
      }
    } catch (err) {
      console.warn(`[${ticker}] Failed to fetch YTD data:`, err);
    }

    // Fetch SPY YTD for comparison
    let spyYtdChangePercent: number | undefined;
    try {
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(`${currentYear}-01-01`);
      const today = new Date();
      
      // Get SPY quote
      const spyQuote: any = await fetchYahooQuote('SPY');
      
      if (spyQuote && typeof spyQuote.regularMarketPrice === 'number') {
        const spyCurrentPrice = spyQuote.regularMarketPrice;
        
        // Get SPY historical data
        const spyHistoricalData: any = await fetchYahooHistorical('SPY', yearStart, today);

        if (spyHistoricalData && Array.isArray(spyHistoricalData) && spyHistoricalData.length > 0) {
          const spyFirstDay: any = spyHistoricalData[0];
          // Use open price for YTD calculation (price at the start of the first trading day)
          const spyYearStartPrice = (typeof spyFirstDay.open === 'number' ? spyFirstDay.open : 
            (typeof spyFirstDay.close === 'number' ? spyFirstDay.close : spyCurrentPrice));
          
          if (spyYearStartPrice > 0 && spyCurrentPrice > 0) {
            spyYtdChangePercent = ((spyCurrentPrice - spyYearStartPrice) / spyYearStartPrice) * 100;
            console.log(`[SPY] YTD calculation: yearStartPrice (open)=${spyYearStartPrice.toFixed(2)}, currentPrice=${spyCurrentPrice.toFixed(2)}, ytdChangePercent=${spyYtdChangePercent.toFixed(2)}%`);
          }
        }
      }
    } catch (err) {
      console.warn('[SPY] Failed to fetch SPY YTD data:', err);
    }

    const stockData = {
      ticker: ticker.toUpperCase(),
      name: companyName,
      price: Math.round(currentPrice * 100) / 100, // Round to 2 decimals
      changePercent: Math.round(changePercent * 100) / 100,
      changeAmount: Math.round(changeAmount * 100) / 100,
      ytdChangePercent: Math.round(ytdChangePercent * 100) / 100,
      ytdChangeAmount: Math.round(ytdChangeAmount * 100) / 100,
      spyYtdChangePercent: typeof spyYtdChangePercent === 'number' && !isNaN(spyYtdChangePercent) ? Math.round(spyYtdChangePercent * 100) / 100 : undefined,
    };

    return NextResponse.json(stockData);
  } catch (error) {
    console.error('[Stock API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch stock data';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[Stock API] Error details:', { message: errorMessage, stack: errorStack });
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
