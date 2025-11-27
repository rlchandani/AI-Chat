import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { DEFAULT_MODEL, getModelInfo } from '@/utils/modelStorage';
import {
    getStockQuoteWithYTD,
    getMultipleStockQuotes,
    searchStocks,
} from '@/mcp/yahoo-finance-tools';

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

const TOOL_USAGE_INSTRUCTIONS = `You have access to stock market tools. When a user asks about stocks, stock prices, or market performance:

CRITICAL RULES FOR TOOL CALLS:
1. ALWAYS extract the ticker symbol from the user's message before calling a tool
2. Common ticker symbols: AAPL (Apple), GOOGL (Google), MSFT (Microsoft), TSLA (Tesla), AMZN (Amazon), META (Facebook), NVDA (Nvidia)
3. When calling get_stock_quote, you MUST provide the "symbol" parameter with the actual ticker
4. NEVER call a tool without providing the required parameters

AVAILABLE TOOLS:
- get_stock_quote: Get complete stock info including price, daily change ($, %), YTD change ($, %), and SPY comparison
- get_multiple_quotes: Compare multiple stocks with all their data
- search_stocks: Find ticker symbol from company name

EXAMPLE TOOL CALLS:
- User: "What's Apple stock at?" → Call get_stock_quote with symbol="AAPL"
- User: "How is Tesla doing?" → Call get_stock_quote with symbol="TSLA"
- User: "Compare Google and Microsoft" → Call get_multiple_quotes with symbols=["GOOGL","MSFT"]
- User: "Find Netflix stock" → Call search_stocks with query="Netflix"

AFTER RECEIVING TOOL RESULTS:
You MUST generate a text response that includes:
1. The <<STOCK_CARD>> JSON block with ALL fields (ticker, name, price, changePercent, changeAmount, ytdChangePercent, ytdChangeAmount, spyYtdChangePercent)
2. A natural language summary covering:
   - Current price
   - Today's change ($ and %)
   - YTD performance ($ and %)
   - Comparison to S&P 500 (SPY) - whether stock is outperforming or underperforming
3. Any relevant analysis

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
    
    // Fallback: return JSON
    return '```json\n' + JSON.stringify(result, null, 2) + '\n```';
}

// Helper function to create a tool with proper typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTool(config: { description: string; parameters: z.ZodObject<any>; execute: (args: any) => Promise<any> }) {
    return tool({
        description: config.description,
        parameters: config.parameters,
        execute: config.execute,
    } as any);
}

// Define Yahoo Finance tools for AI SDK
const yahooFinanceTools = {
    get_stock_quote: createTool({
        description: 'Get complete stock info: current price, daily change ($, %), YTD change ($, %), and comparison vs SPY (S&P 500). Use for ANY stock price query. REQUIRED: Extract ticker symbol. Example: "Apple stock" → symbol="AAPL"',
        parameters: z.object({
            symbol: z.string().min(1).describe('Stock ticker symbol. Examples: AAPL, GOOGL, MSFT, TSLA, AMZN, NVDA'),
        }),
        execute: async (args: any) => {
            const ticker = args.symbol || args.ticker || args.stock || args.name;
            if (!ticker || ticker.trim() === '') {
                return { error: 'Missing stock symbol. Please ask about a specific stock like "What is Apple stock price?" or "TSLA price"' };
            }
            try {
                return await getStockQuoteWithYTD(ticker);
            } catch (error) {
                console.error(`[Tool] get_stock_quote error for ${ticker}:`, error);
                return { error: `Failed to fetch quote for ${ticker}: ${error instanceof Error ? error.message : 'Unknown error'}` };
            }
        },
    }),

    get_multiple_quotes: createTool({
        description: 'Get quotes for multiple stocks at once. Use for comparisons. Example: "Compare Apple and Microsoft" → symbols=["AAPL","MSFT"]',
        parameters: z.object({
            symbols: z.array(z.string().min(1)).min(1).describe('Array of ticker symbols. Example: ["AAPL", "GOOGL", "MSFT"]'),
        }),
        execute: async (args: any) => {
            const tickers = args.symbols || args.tickers;
            if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
                return { error: 'Missing stock symbols. Please specify which stocks to compare.' };
            }
            try {
                return await getMultipleStockQuotes(tickers);
            } catch (error) {
                console.error(`[Tool] get_multiple_quotes error:`, error);
                return { error: `Failed to fetch quotes: ${error instanceof Error ? error.message : 'Unknown error'}` };
            }
        },
    }),

    search_stocks: createTool({
        description: 'Search for stock ticker by company name. Use when you do not know the ticker symbol for a company. Example: User asks about "Netflix" but you need ticker → query="Netflix"',
        parameters: z.object({
            query: z.string().min(1).describe('Company name or partial ticker to search. Examples: "Netflix", "Nvidia", "Amazon"'),
        }),
        execute: async (args: any) => {
            const query = args.query;
            if (!query || query.trim() === '') {
                return { error: 'Missing search query. Please specify a company name.' };
            }
            try {
                return await searchStocks(query);
            } catch (error) {
                console.error(`[Tool] search_stocks error:`, error);
                return { error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
            }
        },
    }),
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

        // Prepend system instructions
        const systemPrompt = modelInfo.provider === 'google'
            ? `${TOOL_USAGE_INSTRUCTIONS}\n\n${STOCK_CARD_INSTRUCTIONS}`
            : STOCK_CARD_INSTRUCTIONS;

        formattedMessages.unshift({
            role: 'system',
            content: systemPrompt,
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

        // Configure streamText options with tools for Google models
        const streamOptions = modelInfo.provider === 'google'
            ? {
                  model: aiModel,
                  messages: formattedMessages,
                  tools: yahooFinanceTools,
                  maxSteps: 5, // Allow up to 5 tool calls per request
              }
            : {
                  model: aiModel,
                  messages: formattedMessages,
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
