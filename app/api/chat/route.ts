import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { DEFAULT_MODEL, getModelInfo } from '@/utils/modelStorage';

const STOCK_CARD_INSTRUCTIONS = `Whenever the user asks about a stock/ticker/market performance, add a structured stock card before your main explanation.
Use this exact JSON envelope (valid JSON, one block per stock):
<<STOCK_CARD>>{"ticker":"AAPL","name":"Apple Inc.","price":191.45,"changePercent":1.23,"changeAmount":2.34,"ytdChangePercent":8.90,"ytdChangeAmount":14.22,"spyYtdChangePercent":15.30}<<END_STOCK_CARD>>
- ticker: uppercase ticker symbol
- name: full company name
- price: latest price in USD
- changePercent: today's % move vs prior close
- changeAmount: today's $ move vs prior close
- ytdChangePercent: year-to-date % change
- ytdChangeAmount: year-to-date $ change (derive it if needed)
- spyYtdChangePercent: SPY (S&P 500 ETF) YTD % change (always include it for comparison)
If a value is missing, compute a reasonable estimate (e.g., changeAmount ≈ price * changePercent / 100) or output 0.00. Emit the block before your narrative, then continue with the natural-language analysis.`;

const WEATHER_CARD_INSTRUCTIONS = `Whenever the user asks about weather/forecast/current conditions, add a structured weather card before your main explanation.
Use this exact JSON envelope (valid JSON, one block per location):
<<WEATHER_CARD>>{"location":"New York, NY","temperature":72,"condition":"Partly Cloudy","humidity":65,"windSpeed":8,"visibility":10,"feelsLike":75,"high":78,"low":65}<<END_WEATHER_CARD>>
- location: city name or location (e.g., "New York, NY" or "San Francisco")
- temperature: current temperature in Fahrenheit
- condition: weather condition description (e.g., "Sunny", "Partly Cloudy", "Rain", "Snow")
- humidity: humidity percentage (0-100, optional)
- windSpeed: wind speed in mph (optional)
- visibility: visibility in miles (optional)
- feelsLike: "feels like" temperature in Fahrenheit (optional)
- high: high temperature for the day in Fahrenheit (optional)
- low: low temperature for the day in Fahrenheit (optional)
Only emit the block when confident in the weather data, then follow with normal narrative analysis.`;

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

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

        // Prepend system instructions (ensures structured stock and weather data when needed)
        formattedMessages.unshift({
            role: 'system',
            content: `${STOCK_CARD_INSTRUCTIONS}\n\n${WEATHER_CARD_INSTRUCTIONS}`,
        });

        // Use the model from modelInfo (already validated)
        const selectedModel = modelInfo.id;

        // Select the appropriate provider model based on modelInfo
        let aiModel;
        if (modelInfo.provider === 'google') {
            aiModel = google(selectedModel);
        } else if (modelInfo.provider === 'openai') {
            // The AI SDK accepts the model ID directly, so we can use it as-is
            // Current OpenAI models: gpt-5.1, gpt-5-mini, gpt-5-pro
            // Note: Some models may have version suffixes like -2024-11-20
            // The AI SDK will handle the model name as provided
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

        const result = streamText({
            model: aiModel,
            messages: formattedMessages,
        });

        // Create a readable stream from the textStream async iterator
        // We'll send usage info after the stream completes
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Stream the text content
                    for await (const textPart of result.textStream) {
                        controller.enqueue(encoder.encode(textPart));
                    }
                    
                    // After streaming completes, wait for usage info and send it
                    try {
                        const usage = await result.usage;
                        if (usage) {
                            // Send usage info as a special marker followed by JSON
                            const usageData = JSON.stringify({
                                type: 'usage',
                                usage: {
                                    promptTokens: usage.promptTokens || 0,
                                    completionTokens: usage.completionTokens || 0,
                                    totalTokens: usage.totalTokens || 0,
                                }
                            });
                            // Send usage info at the end
                            controller.enqueue(encoder.encode(`\n\n__USAGE__${usageData}__USAGE__`));
                        }
                    } catch (usageError) {
                        console.error('Error getting usage info:', usageError);
                    }
                    
                    controller.close();
                } catch (error) {
                    console.error('Stream error:', error);
                    controller.error(error);
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
