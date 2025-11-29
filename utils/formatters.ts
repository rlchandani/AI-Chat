import { StockQuoteWithYTD, StockSearchResult } from '@/types/stock';
import { WeatherData, LocationSearchResult } from '@/types/weather';

// Helper to format a single weather card
export function formatWeatherCard(w: WeatherData): string {
    const weatherCard = `<<WEATHER_CARD>>{"location":"${w.location}","temperature":${w.temperature},"condition":"${w.condition}","humidity":${w.humidity || 'null'},"windSpeed":${w.windSpeed || 'null'},"visibility":${w.visibility || 'null'},"feelsLike":${w.feelsLike || 'null'},"high":${w.high || 'null'},"low":${w.low || 'null'},"uvIndex":${w.uvIndex || 'null'},"aqi":${w.aqi || 'null'}}<<END_WEATHER_CARD>>\n\n`;

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

// Helper function to format tool results as readable text when model doesn't generate response
export function formatToolResultAsText(toolName: string, result: unknown): string {
    if (!result) return 'Unable to fetch data.';

    // Handle error responses generically first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((result as any).error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (result as any).error;
    }

    // Handle single stock quote (always includes YTD data now)
    if (toolName === 'get_stock_quote') {
        const q = result as StockQuoteWithYTD;

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
        const r = result as StockQuoteWithYTD[];
        // Generate stock table card JSON
        const stocksData = r.map((q: StockQuoteWithYTD) => ({
            ticker: q.ticker,
            name: q.name,
            price: q.price,
            changePercent: q.changePercent || 0,
            changeAmount: q.change || 0,
            ytdChangePercent: q.ytdChangePercent || 0,
            ytdChangeAmount: q.ytdChangeAmount || 0,
            spyYtdChangePercent: q.spyYtdChangePercent || 0
        }));

        let response = `<<STOCK_TABLE_CARD>>${JSON.stringify({ stocks: stocksData })}<<END_STOCK_TABLE_CARD>>\n\n`;

        response += '**Stock Comparison:**\n\n';

        // Get SPY YTD for reference (from first result that has it)
        const spyYtd = r.find(q => q.spyYtdChangePercent !== undefined)?.spyYtdChangePercent;

        for (const q of r) {
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
        const r = result as StockSearchResult[];
        if (r.length === 0) {
            return 'No stocks found matching your search.';
        }
        let response = 'Found the following stocks:\n\n';
        for (const s of r.slice(0, 5)) {
            response += `- **${s.symbol}**: ${s.name} (${s.exchange})\n`;
        }
        return response;
    }

    // Handle single weather result
    if (toolName === 'get_weather') {
        const w = result as WeatherData;
        return formatWeatherCard(w);
    }

    // Handle multiple weather results
    if (toolName === 'get_multiple_weather' && Array.isArray(result)) {
        const r = result as WeatherData[];
        let response = '';
        for (const w of r) {
            response += `<<WEATHER_CARD>>{"location":"${w.location}","temperature":${w.temperature},"condition":"${w.condition}","humidity":${w.humidity || 'null'},"windSpeed":${w.windSpeed || 'null'},"visibility":${w.visibility || 'null'},"feelsLike":${w.feelsLike || 'null'},"high":${w.high || 'null'},"low":${w.low || 'null'},"uvIndex":${w.uvIndex || 'null'},"aqi":${w.aqi || 'null'}}<<END_WEATHER_CARD>>\n`;
        }
        response += '\n**Weather Comparison:**\n\n';

        for (const w of r) {
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
        const r = result as LocationSearchResult[];
        if (r.length === 0) {
            return 'No locations found matching your search.';
        }
        let response = 'Found the following locations:\n\n';
        for (const loc of r.slice(0, 5)) {
            response += `- **${loc.name}**: ${loc.formattedAddress}\n`;
        }
        return response;
    }

    // Fallback: return JSON
    return '```json\n' + JSON.stringify(result, null, 2) + '\n```';
}
