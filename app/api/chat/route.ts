/**
 * Chat API Route
 * 
 * SECURITY NOTICE:
 * - API keys are received from the client and used only for the current request
 * - Keys are NEVER logged, persisted, or stored in any way on the server
 * - Keys exist only in memory for the duration of the request
 * - This is a same-origin server route - keys are sent over HTTPS to your own server
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from 'zod';
import { DEFAULT_MODEL, getModelInfo } from '@/utils/modelStorage';
import {
    getStockQuoteWithYTD,
    getMultipleStockQuotes,
    searchStocks,
} from '@/mcp/yahoo-finance-tools';
import {
    getWeather,
    getMultipleWeather,
    searchLocations,
} from '@/mcp/weather-tools';

// System instructions for structured card output
const STOCK_CARD_INSTRUCTIONS = `When you receive stock data from tools, format the response with a structured stock card.
Use this exact JSON envelope (valid JSON, one block per stock):
<<STOCK_CARD>>{"ticker":"AAPL","name":"Apple Inc.","price":191.45,"changePercent":1.23,"changeAmount":2.34,"ytdChangePercent":8.90,"ytdChangeAmount":14.22,"spyYtdChangePercent":15.30}<<END_STOCK_CARD>>
- ticker: uppercase ticker symbol
- name: full company name
- price: latest price in USD
- changePercent: today's % move vs prior close
- changeAmount: today's $ move vs prior close
- ytdChangePercent: year-to-date % change (if available)
- ytdChangeAmount: year-to-date $ change (if available)
- spyYtdChangePercent: SPY (S&P 500 ETF) YTD % change for comparison (if available)
Emit the stock card block first, then follow with your natural-language analysis.`;

const STOCK_TABLE_CARD_INSTRUCTIONS = `When you receive multiple stock data points for comparison, format the response with a structured stock table card.
Use this exact JSON envelope (valid JSON, containing an array of stocks):
<<STOCK_TABLE_CARD>>{"stocks":[{"ticker":"AAPL","name":"Apple Inc.","price":191.45,"changePercent":1.23,"changeAmount":2.34,"ytdChangePercent":8.90,"ytdChangeAmount":14.22,"spyYtdChangePercent":15.30},{"ticker":"MSFT","name":"Microsoft","price":420.55,"changePercent":0.85,"changeAmount":3.50,"ytdChangePercent":12.40,"ytdChangeAmount":45.20,"spyYtdChangePercent":15.30}]}<<END_STOCK_TABLE_CARD>>
- stocks: array of stock objects with the same fields as the single stock card
Emit the stock table card block first, then follow with your natural-language analysis.`;

const WEATHER_CARD_INSTRUCTIONS = `When you receive weather data from tools, format the response with a structured weather card.
Use this exact JSON envelope (valid JSON, one block per location):
<<WEATHER_CARD>>{"location":"San Francisco, CA","temperature":68,"condition":"Partly Cloudy","humidity":65,"windSpeed":12,"visibility":10,"feelsLike":66,"high":72,"low":58,"uvIndex":5,"aqi":42}<<END_WEATHER_CARD>>
- location: city/location name
- temperature: current temperature (in F for imperial, C for metric)
- condition: weather condition description
- humidity: humidity percentage (optional)
- windSpeed: wind speed in mph/km/h (optional)
- visibility: visibility in miles/km (optional)
- feelsLike: feels like temperature (optional)
- high: daily high temperature (optional)
- low: daily low temperature (optional)
- uvIndex: UV index (optional)
- aqi: air quality index (optional)
Emit the weather card block first, then follow with your natural-language analysis.`;

const TOOL_USAGE_INSTRUCTIONS = `You have access to stock market and weather tools.

=== STOCK TOOLS ===
When a user asks about stocks, stock prices, or market performance:

CRITICAL RULES FOR STOCK TOOL CALLS:
1. ALWAYS extract the ticker symbol from the user's message before calling a tool
2. Common ticker symbols: AAPL (Apple), GOOGL (Google), MSFT (Microsoft), TSLA (Tesla), AMZN (Amazon), META (Facebook), NVDA (Nvidia)
3. When calling get_stock_quote, you MUST provide the "symbol" parameter with the actual ticker
4. NEVER call a tool without providing the required parameters
5. GROUPING RULE: If the user mentions multiple stocks, ALWAYS prefer grouping them into a single get_multiple_quotes call (Stock Table).
   - Group ALL stocks into one table, even if phrased as "and also check X" or "how about X?".
   - ONLY use separate get_stock_quote calls if the user EXPLICITLY uses the words "separately", "individually", or "alone".
   - Example: "Check AAPL and MSFT. Also check GOOGL" → ONE get_multiple_quotes call for [AAPL, MSFT, GOOGL].
   - Example: "Check AAPL. What about MSFT?" → ONE get_multiple_quotes call for [AAPL, MSFT].
   - Example: "Check AAPL and MSFT, and check GOOGL separately" → get_multiple_quotes for [AAPL, MSFT] AND get_stock_quote for GOOGL.

STOCK TOOLS:
- get_stock_quote: Get complete stock info including price, daily change ($, %), YTD change ($, %), and SPY comparison
- get_multiple_quotes: Compare multiple stocks with all their data
- search_stocks: Find ticker symbol from company name

STOCK EXAMPLE CALLS:
- User: "What's Apple stock at?" → Call get_stock_quote with symbol="AAPL"
- User: "How is Tesla doing?" → Call get_stock_quote with symbol="TSLA"
- User: "Compare Google, Microsoft and Airbnb" → Call get_multiple_quotes with symbols=["GOOGL","MSFT","ABNB"]
- User: "Compare MSFT and META, and check NVDA separately" → Call get_multiple_quotes with symbols=["MSFT","META"] AND get_stock_quote with symbol="NVDA" (in parallel)

AFTER RECEIVING STOCK TOOL RESULTS:
You MUST generate a text response that includes:
1. The <<STOCK_CARD>> JSON block (for single stock) AND/OR <<STOCK_TABLE_CARD>> JSON block (for multiple stocks).
   - CRITICAL: If you made multiple tool calls (e.g. mixed query), you MUST emit ALL corresponding JSON blocks in sequence.
   - Example for mixed query: Emit <<STOCK_TABLE_CARD>>...<<END_STOCK_TABLE_CARD>> followed by <<STOCK_CARD>>...<<END_STOCK_CARD>>
2. A natural language summary of the stock data

=== WEATHER TOOLS ===
When a user asks about weather, temperature, or conditions:

WEATHER TOOLS:
- get_weather: Get current weather for a location including temperature, conditions, humidity, wind, UV index, and AQI
- get_multiple_weather: Compare weather across multiple locations
- search_locations: Find location names for ambiguous queries

WEATHER EXAMPLE CALLS:
- User: "What's the weather in New York?" → Call get_weather with location="New York"
- User: "How's the weather in Tokyo?" → Call get_weather with location="Tokyo, Japan"
- User: "Compare weather in LA and SF" → Call get_multiple_weather with locations=["Los Angeles, CA","San Francisco, CA"]

AFTER RECEIVING WEATHER TOOL RESULTS:
You MUST generate a text response that includes:
1. The <<WEATHER_CARD>> JSON block with ALL available fields (location, temperature, condition, humidity, windSpeed, visibility, feelsLike, high, low, uvIndex, aqi)
2. A natural language summary covering:
   - Current temperature and conditions
   - High/low for the day
   - Any notable weather factors (UV, AQI, humidity)

NEVER just call a tool and stop. ALWAYS follow up with a complete text response.`;

import { formatToolResultAsText } from '@/utils/formatters';

// Define all tools for AI SDK v5 (compatible with both OpenAI and Google)
// AI SDK v5 uses 'inputSchema' instead of 'parameters'
const aiTools = {
    // Stock Tools
    get_stock_quote: {
        description: 'Get complete stock info: current price, daily change ($, %), YTD change ($, %), and comparison vs SPY (S&P 500). Use for ANY stock price query. REQUIRED: Extract ticker symbol. Example: "Apple stock" → symbol="AAPL"',
        inputSchema: z.object({
            symbol: z.string().describe('Stock ticker symbol. Examples: AAPL, GOOGL, MSFT, TSLA, AMZN, NVDA'),
        }),
        execute: async ({ symbol }: { symbol: string }) => {
            const ticker = symbol?.trim();
            if (!ticker) {
                return { error: 'Missing stock symbol. Please ask about a specific stock like "What is Apple stock price?" or "TSLA price"' };
            }
            try {
                return await getStockQuoteWithYTD(ticker);
            } catch (error) {
                console.error(`[Tool] get_stock_quote error for ${ticker}:`, error);
                return { error: `Failed to fetch quote for ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}` };
            }
        },
    },

    get_multiple_quotes: {
        description: 'Get quotes for multiple stocks at once. Use for comparisons. Example: "Compare Apple and Microsoft" → symbols=["AAPL","MSFT"]',
        inputSchema: z.object({
            symbols: z.array(z.string()).describe('Array of ticker symbols. Example: ["AAPL", "GOOGL", "MSFT"]'),
        }),
        execute: async ({ symbols }: { symbols: string[] }) => {
            if (!symbols || symbols.length === 0) {
                return { error: 'Missing stock symbols. Please specify which stocks to compare.' };
            }
            try {
                return await getMultipleStockQuotes(symbols);
            } catch (error) {
                console.error(`[Tool] get_multiple_quotes error:`, error);
                return { error: `Failed to fetch quotes: ${error instanceof Error ? error.message : 'Unknown error'}` };
            }
        },
    },

    search_stocks: {
        description: 'Search for stock ticker by company name. Use when you do not know the ticker symbol for a company. Example: User asks about "Netflix" but you need ticker → query="Netflix"',
        inputSchema: z.object({
            query: z.string().describe('Company name or partial ticker to search. Examples: "Netflix", "Nvidia", "Amazon"'),
        }),
        execute: async ({ query }: { query: string }) => {
            if (!query?.trim()) {
                return { error: 'Missing search query. Please specify a company name.' };
            }
            try {
                return await searchStocks(query);
            } catch (error) {
                console.error(`[Tool] search_stocks error:`, error);
                return { error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
            }
        },
    },

    // Weather Tools
    get_weather: {
        description: 'Get current weather for a location including temperature, conditions, humidity, wind speed, UV index, and air quality. Use for ANY weather query. Example: "Weather in New York" → location="New York"',
        inputSchema: z.object({
            location: z.string().describe('City name or location. Examples: "New York", "Tokyo, Japan", "London, UK", "San Francisco, CA"'),
        }),
        execute: async ({ location }: { location: string }) => {
            const loc = location?.trim();
            if (!loc) {
                return { error: 'Missing location. Please ask about a specific location like "What is the weather in New York?"' };
            }
            try {
                return await getWeather(loc);
            } catch (error) {
                console.error(`[Tool] get_weather error for ${loc}:`, error);
                return { error: `Failed to fetch weather for ${loc}: ${error instanceof Error ? error.message : 'Unknown error'}` };
            }
        },
    },

    get_multiple_weather: {
        description: 'Get weather for multiple locations at once. Use for comparisons. Example: "Compare weather in LA and NYC" → locations=["Los Angeles, CA","New York, NY"]',
        inputSchema: z.object({
            locations: z.array(z.string()).describe('Array of location names. Example: ["New York", "Los Angeles", "Chicago"]'),
        }),
        execute: async ({ locations }: { locations: string[] }) => {
            if (!locations || locations.length === 0) {
                return { error: 'Missing locations. Please specify which locations to compare.' };
            }
            try {
                return await getMultipleWeather(locations);
            } catch (error) {
                console.error(`[Tool] get_multiple_weather error:`, error);
                return { error: `Failed to fetch weather: ${error instanceof Error ? error.message : 'Unknown error'}` };
            }
        },
    },

    search_locations: {
        description: 'Search for location names. Use when you need to clarify or find the exact location name. Example: User asks about "SF" → query="San Francisco"',
        inputSchema: z.object({
            query: z.string().describe('Location name or partial name to search. Examples: "San Francisco", "NYC", "Paris"'),
        }),
        execute: async ({ query }: { query: string }) => {
            if (!query?.trim()) {
                return { error: 'Missing search query. Please specify a location name.' };
            }
            try {
                return await searchLocations(query);
            } catch (error) {
                console.error(`[Tool] search_locations error:`, error);
                return { error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
            }
        },
    },
};

// Allow streaming responses up to 60 seconds (tools may take longer)
export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const { messages, model, apiKey, provider: clientProvider } = await req.json();

        // Get model info to determine provider
        const modelInfo = getModelInfo(model || DEFAULT_MODEL);
        if (!modelInfo) {
            return new Response(
                JSON.stringify({ error: 'Invalid model' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Use provider from client or determine from model
        const provider = clientProvider || modelInfo.provider;

        // Check for required API key based on provider
        // Priority: client-provided key > environment variable
        const envKey = provider === 'google'
            ? process.env.GOOGLE_GENERATIVE_AI_API_KEY
            : process.env.OPENAI_API_KEY;

        const effectiveApiKey = apiKey || envKey || '';

        if (!effectiveApiKey) {
            const keyType = provider === 'google' ? 'gemini' : 'openai';
            return new Response(
                JSON.stringify({
                    error: `Missing ${provider === 'google' ? 'Google' : 'OpenAI'} API Key`,
                    errorType: 'MISSING_API_KEY',
                    keyType
                }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }



        // Validate and transform messages to AI SDK format
        if (!Array.isArray(messages)) {
            console.error('Messages is not an array:', typeof messages);
            return new Response(
                JSON.stringify({ error: 'Messages must be an array' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        if (messages.length === 0) {
            console.error('Messages array is empty');
            return new Response(
                JSON.stringify({ error: 'Messages array must not be empty' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Transform messages: remove id, toolInvocations, and filter out invalid roles
        interface IncomingMessage {
            role: string;
            content: string;
            [key: string]: unknown;
        }

        const formattedMessages = messages
            .filter((msg: unknown): msg is IncomingMessage =>
                typeof msg === 'object' &&
                msg !== null &&
                'role' in msg &&
                'content' in msg &&
                typeof (msg as IncomingMessage).role === 'string' &&
                ['user', 'assistant', 'system'].includes((msg as IncomingMessage).role) &&
                typeof (msg as IncomingMessage).content === 'string' &&
                (msg as IncomingMessage).content.trim().length > 0
            )
            .map((msg: IncomingMessage) => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
            }));

        if (formattedMessages.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No valid messages found' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Prepend system instructions (tools available for both Google and OpenAI)
        formattedMessages.unshift({
            role: 'system',
            content: `${TOOL_USAGE_INSTRUCTIONS}\n\n${STOCK_CARD_INSTRUCTIONS}\n\n${STOCK_TABLE_CARD_INSTRUCTIONS}\n\n${WEATHER_CARD_INSTRUCTIONS}`,
        });

        // Use the model from modelInfo (already validated)
        const selectedModel = modelInfo.id;

        // Select the appropriate provider model based on modelInfo
        let aiModel;
        if (modelInfo.provider === 'google') {
            const google = createGoogleGenerativeAI({ apiKey: effectiveApiKey });
            aiModel = google(selectedModel);
        } else if (modelInfo.provider === 'openai') {
            const openai = createOpenAI({ apiKey: effectiveApiKey });
            aiModel = openai(selectedModel);
        } else {
            return new Response(
                JSON.stringify({ error: 'Unsupported model provider' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Configure streamText options with tools (works for both Google and OpenAI)
        const streamOptions = {
            model: aiModel,
            messages: formattedMessages,
            tools: aiTools,
            maxSteps: 5, // Allow up to 5 tool calls per request
        };

        const result = streamText(streamOptions);

        // Create a readable stream from the fullStream async iterator
        // fullStream includes all events: text-delta, tool-call, tool-result, finish, etc.
        const encoder = new TextEncoder();
        let isClosed = false;
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Track whether any text was generated and store tool results
                    let hasGeneratedText = false;
                    const toolResults: { name: string; result: unknown }[] = [];

                    // Use fullStream to capture all text from all steps (including after tool calls)
                    for await (const part of result.fullStream) {
                        if (isClosed) break;

                        // Stream text-delta events to the client
                        if (part.type === 'text-delta') {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const textContent = (part as any).textDelta || (part as any).text || '';
                            if (textContent) {
                                hasGeneratedText = true;
                                controller.enqueue(encoder.encode(textContent));
                            }
                        }
                        // Capture tool results for fallback formatting
                        else if (part.type === 'tool-result') {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const p = part as any;
                            toolResults.push({
                                name: p.toolName,
                                result: p.result || p.output
                            });
                        }
                        // Handle stream finish - format tool results if model didn't generate text
                        else if (part.type === 'finish') {
                            if (!hasGeneratedText && toolResults.length > 0) {
                                for (const { name, result } of toolResults) {
                                    const formattedResponse = formatToolResultAsText(name, result);
                                    controller.enqueue(encoder.encode(formattedResponse));
                                }
                            }
                        }
                    }

                    // After streaming completes, wait for usage info and send it
                    if (!isClosed) {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const usage = await result.usage as any;
                            if (usage && !isClosed) {
                                // Send usage info as a special marker followed by JSON
                                // AI SDK v5 may use different property names
                                const usageData = JSON.stringify({
                                    type: 'usage',
                                    usage: {
                                        promptTokens: usage.promptTokens || usage.inputTokens || 0,
                                        completionTokens: usage.completionTokens || usage.outputTokens || 0,
                                        totalTokens: usage.totalTokens || (usage.inputTokens || 0) + (usage.outputTokens || 0),
                                    }
                                });
                                // Send usage info at the end
                                controller.enqueue(encoder.encode(`\n\n__USAGE__${usageData}__USAGE__`));
                            }
                        } catch (usageError) {
                            console.error('Error getting usage info:', usageError);
                        }
                    }

                    if (!isClosed) {
                        isClosed = true;
                        controller.close();
                    }
                } catch (error) {
                    console.error('Stream error:', error);
                    if (!isClosed) {
                        isClosed = true;
                        controller.error(error);
                    }
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });
    } catch (error) {
        console.error('Server Error:', error);
        return new Response(
            JSON.stringify({ error: 'Internal Server Error', details: String(error) }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
