/**
 * Stock Data Interfaces
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

export interface StockUI extends StockQuoteWithYTD {
    vsSpyPercent?: number;
    error?: string;
    changeAmount?: number; // Optional alias for change, used in some UI contexts
}

export interface StockSearchResult {
    symbol: string;
    name: string;
    type: string;
    exchange: string;
}
