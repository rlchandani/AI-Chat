import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
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

STOCK TOOLS:
- get_stock_quote: Get complete stock info including price, daily change ($, %), YTD change ($, %), and SPY comparison
- get_multiple_quotes: Compare multiple stocks with all their data
- search_stocks: Find ticker symbol from company name

STOCK EXAMPLE CALLS:
- User: "What's Apple stock at?" → Call get_stock_quote with symbol="AAPL"
- User: "How is Tesla doing?" → Call get_stock_quote with symbol="TSLA"
- User: "Compare Google and Microsoft" → Call get_multiple_quotes with symbols=["GOOGL","MSFT"]

AFTER RECEIVING STOCK TOOL RESULTS:
You MUST generate a text response that includes:
1. The <<STOCK_CARD>> JSON block with ALL fields
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

// Helper function to format tool results as readable text when model doesn't generate response
function formatToolResultAsText(toolName: string, result: any): string {
    if (!result) return 'Unable to fetch data.';
    
    // Handle error responses
    if (result.error) {
        return result.error;
    }
    
    // Handle single stock quote (always includes YTD data now)
    if (toolName === 'get_stock_quote') {
        const q = result;
        
        // Normalize all numeric values
        const price = Number(q.price) || 0;
        const changePercent = Number(q.changePercent) || 0;
        const changeAmount = Number(q.change) || 0;
        const ytdChangePercent = Number(q.ytdChangePercent) || 0;
        const ytdChangeAmount = Number(q.ytdChangeAmount) || 0;
        const spyYtdChangePercent = Number(q.spyYtdChangePercent) || 0;
        
        // Helper to format with sign
        const formatWithSign = (val: number) => (val >= 0 ? '+' : '') + val.toFixed(2);
        
        // Generate stock card JSON
        const stockCard = `<<STOCK_CARD>>{"ticker":"${q.ticker}","name":"${q.name}","price":${price},"changePercent":${changePercent},"changeAmount":${changeAmount},"ytdChangePercent":${ytdChangePercent},"ytdChangeAmount":${ytdChangeAmount},"spyYtdChangePercent":${spyYtdChangePercent}}<<END_STOCK_CARD>>\n\n`;
        
        // Build response
        let response = stockCard;
        response += `**${q.name} (${q.ticker})**\n\n`;
        response += `💰 **Current Price:** $${price.toFixed(2)}\n\n`;
        response += `**Today's Performance:**\n`;
        response += `📊 Change: ${formatWithSign(changeAmount).replace(/^([+-])/, '$1$')} (${formatWithSign(changePercent)}%)\n\n`;
        response += `**Year-to-Date (YTD) Performance:**\n`;
        response += `📈 YTD Change: ${formatWithSign(ytdChangeAmount).replace(/^([+-])/, '$1$')} (${formatWithSign(ytdChangePercent)}%)\n`;
        
        if (spyYtdChangePercent !== 0) {
            const outperformance = ytdChangePercent - spyYtdChangePercent;
            response += `📉 S&P 500 (SPY) YTD: ${formatWithSign(spyYtdChangePercent)}%\n`;
            response += `⚡ vs SPY: ${formatWithSign(outperformance)}% (${outperformance >= 0 ? 'outperforming' : 'underperforming'})\n`;
        }
        
        response += `\n*Market: ${q.exchange || 'N/A'} | Currency: ${q.currency || 'USD'}*`;
        return response;
    }
    
    // Handle multiple quotes (now includes YTD data)
    if (toolName === 'get_multiple_quotes' && Array.isArray(result)) {
        let response = '';
        for (const q of result) {
            response += `<<STOCK_CARD>>{"ticker":"${q.ticker}","name":"${q.name}","price":${q.price},"changePercent":${q.changePercent || 0},"changeAmount":${q.change || 0},"ytdChangePercent":${q.ytdChangePercent || 0},"ytdChangeAmount":${q.ytdChangeAmount || 0},"spyYtdChangePercent":${q.spyYtdChangePercent || 0}}<<END_STOCK_CARD>>\n`;
        }
        response += '\n**Stock Comparison:**\n\n';
        
        // Get SPY YTD for reference (from first result that has it)
        const spyYtd = result.find(q => q.spyYtdChangePercent !== undefined)?.spyYtdChangePercent;
        
        for (const q of result) {
            const changeSign = (q.change || 0) >= 0 ? '+' : '';
            const ytdSign = (q.ytdChangePercent || 0) >= 0 ? '+' : '';
            response += `**${q.ticker}** (${q.name})\n`;
            response += `  💰 Price: $${q.price.toFixed(2)} | Today: ${changeSign}${(q.changePercent || 0).toFixed(2)}% | YTD: ${ytdSign}${(q.ytdChangePercent || 0).toFixed(2)}%\n\n`;
        }
        
        if (spyYtd !== undefined) {
            const spySign = spyYtd >= 0 ? '+' : '';
            response += `\n*S&P 500 (SPY) YTD: ${spySign}${spyYtd.toFixed(2)}%*`;
        }
        
        return response;
    }
    
    // Handle search results
    if (toolName === 'search_stocks' && Array.isArray(result)) {
        if (result.length === 0) {
            return 'No stocks found matching your search.';
        }
        let response = 'Found the following stocks:\n\n';
        for (const s of result.slice(0, 5)) {
            response += `- **${s.symbol}**: ${s.name} (${s.exchange})\n`;
        }
        return response;
    }
    
    // Handle single weather result
    if (toolName === 'get_weather') {
        const w = result;
        
        // Generate weather card JSON
        const weatherCard = `<<WEATHER_CARD>>{"location":"${w.location}","temperature":${w.temperature},"condition":"${w.condition}","humidity":${w.humidity || 'null'},"windSpeed":${w.windSpeed || 'null'},"visibility":${w.visibility || 'null'},"feelsLike":${w.feelsLike || 'null'},"high":${w.high || 'null'},"low":${w.low || 'null'},"uvIndex":${w.uvIndex || 'null'},"aqi":${w.aqi || 'null'}}<<END_WEATHER_CARD>>\n\n`;
        
        // Build response
        let response = weatherCard;
        response += `**Weather in ${w.location}**\n\n`;
        response += `🌡️ **Current:** ${w.temperature}°F - ${w.condition}\n\n`;
        
        if (w.high !== undefined && w.low !== undefined) {
            response += `📊 **High/Low:** ${w.high}°F / ${w.low}°F\n`;
        }
        if (w.feelsLike !== undefined) {
            response += `🤒 **Feels Like:** ${w.feelsLike}°F\n`;
        }
        if (w.humidity !== undefined) {
            response += `💧 **Humidity:** ${w.humidity}%\n`;
        }
        if (w.windSpeed !== undefined) {
            response += `💨 **Wind:** ${w.windSpeed} mph\n`;
        }
        if (w.uvIndex !== undefined) {
            const uvLabel = w.uvIndex <= 2 ? 'Low' : w.uvIndex <= 5 ? 'Moderate' : w.uvIndex <= 7 ? 'High' : 'Very High';
            response += `☀️ **UV Index:** ${w.uvIndex} (${uvLabel})\n`;
        }
        if (w.aqi !== undefined) {
            const aqiLabel = w.aqi <= 50 ? 'Good' : w.aqi <= 100 ? 'Moderate' : w.aqi <= 150 ? 'Unhealthy for Sensitive' : 'Unhealthy';
            response += `🌬️ **AQI:** ${w.aqi} (${aqiLabel})\n`;
        }
        
        return response;
    }
    
    // Handle multiple weather results
    if (toolName === 'get_multiple_weather' && Array.isArray(result)) {
        let response = '';
        for (const w of result) {
            response += `<<WEATHER_CARD>>{"location":"${w.location}","temperature":${w.temperature},"condition":"${w.condition}","humidity":${w.humidity || 'null'},"windSpeed":${w.windSpeed || 'null'},"visibility":${w.visibility || 'null'},"feelsLike":${w.feelsLike || 'null'},"high":${w.high || 'null'},"low":${w.low || 'null'},"uvIndex":${w.uvIndex || 'null'},"aqi":${w.aqi || 'null'}}<<END_WEATHER_CARD>>\n`;
        }
        response += '\n**Weather Comparison:**\n\n';
        
        for (const w of result) {
            response += `**${w.location}**\n`;
            response += `  🌡️ ${w.temperature}°F - ${w.condition}`;
            if (w.high !== undefined && w.low !== undefined) {
                response += ` | High: ${w.high}°F, Low: ${w.low}°F`;
            }
            response += '\n\n';
        }
        
        return response;
    }
    
    // Handle location search results
    if (toolName === 'search_locations' && Array.isArray(result)) {
        if (result.length === 0) {
            return 'No locations found matching your search.';
        }
        let response = 'Found the following locations:\n\n';
        for (const loc of result.slice(0, 5)) {
            response += `- **${loc.name}**: ${loc.formattedAddress}\n`;
        }
        return response;
    }
    
    // Fallback: return JSON
    return '```json\n' + JSON.stringify(result, null, 2) + '\n```';
}

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
        const { messages, model } = await req.json();

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

        // Check for required API keys based on provider
        if (modelInfo.provider === 'google' && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
            return new Response(
                JSON.stringify({ error: 'Missing Google API Key' }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        if (modelInfo.provider === 'openai' && !process.env.OPENAI_API_KEY) {
            console.error('Missing OPENAI_API_KEY');
            return new Response(
                JSON.stringify({ error: 'Missing OpenAI API Key' }),
                {
                    status: 500,
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
        const formattedMessages = messages
            .filter((msg: any) =>
                msg &&
                typeof msg === 'object' &&
                ['user', 'assistant', 'system'].includes(msg.role) &&
                typeof msg.content === 'string' &&
                msg.content.trim().length > 0
            )
            .map((msg: any) => ({
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
            content: `${TOOL_USAGE_INSTRUCTIONS}\n\n${STOCK_CARD_INSTRUCTIONS}\n\n${WEATHER_CARD_INSTRUCTIONS}`,
        });

        // Use the model from modelInfo (already validated)
        const selectedModel = modelInfo.id;

        // Select the appropriate provider model based on modelInfo
        let aiModel;
        if (modelInfo.provider === 'google') {
            aiModel = google(selectedModel);
        } else if (modelInfo.provider === 'openai') {
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
                    let lastToolResult: any = null;
                    let lastToolName: string = '';
                    
                    // Use fullStream to capture all text from all steps (including after tool calls)
                    for await (const part of result.fullStream) {
                        if (isClosed) break;
                        
                        // Stream text-delta events to the client
                        if (part.type === 'text-delta') {
                            const textContent = (part as any).text || (part as any).textDelta || '';
                            if (textContent) {
                                hasGeneratedText = true;
                                controller.enqueue(encoder.encode(textContent));
                            }
                        }
                        // Capture tool results for fallback formatting
                        else if (part.type === 'tool-result') {
                            const toolPart = part as any;
                            lastToolName = toolPart.toolName;
                            lastToolResult = toolPart.result || toolPart.output;
                        }
                        // Handle stream finish - format tool results if model didn't generate text
                        else if (part.type === 'finish') {
                            if (!hasGeneratedText && lastToolResult) {
                                const formattedResponse = formatToolResultAsText(lastToolName, lastToolResult);
                                controller.enqueue(encoder.encode(formattedResponse));
                            }
                        }
                    }

                    // After streaming completes, wait for usage info and send it
                    if (!isClosed) {
                        try {
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
