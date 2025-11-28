/**
 * Chat Interfaces
 */

import { StockQuoteWithYTD, StockSearchResult } from './stock';
import { WeatherData, LocationSearchResult } from './weather';

export interface BaseToolInvocation {
    toolName: string;
    args: unknown;
    result?: unknown;
}

export interface GetStockQuoteTool extends BaseToolInvocation {
    toolName: 'get_stock_quote';
    args: { symbol: string };
    result?: StockQuoteWithYTD | { error: string };
}

export interface GetMultipleQuotesTool extends BaseToolInvocation {
    toolName: 'get_multiple_quotes';
    args: { symbols: string[] };
    result?: StockQuoteWithYTD[] | { error: string };
}

export interface SearchStocksTool extends BaseToolInvocation {
    toolName: 'search_stocks';
    args: { query: string };
    result?: StockSearchResult[] | { error: string };
}

export interface GetWeatherTool extends BaseToolInvocation {
    toolName: 'get_weather';
    args: { location: string };
    result?: WeatherData | { error: string };
}

export interface GetMultipleWeatherTool extends BaseToolInvocation {
    toolName: 'get_multiple_weather';
    args: { locations: string[] };
    result?: WeatherData[] | { error: string };
}

export interface SearchLocationsTool extends BaseToolInvocation {
    toolName: 'search_locations';
    args: { query: string };
    result?: LocationSearchResult[] | { error: string };
}

export type ToolInvocation =
    | GetStockQuoteTool
    | GetMultipleQuotesTool
    | SearchStocksTool
    | GetWeatherTool
    | GetMultipleWeatherTool
    | SearchLocationsTool;
