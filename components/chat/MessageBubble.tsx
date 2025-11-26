import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import clsx from 'clsx';
import { getSetting } from '@/utils/settingsStorage';
import { StockQuoteCard } from '@/components/chat/StockQuoteCard';
import { WeatherCard } from '@/components/chat/WeatherCard';

interface MessageBubbleProps {
    role: 'user' | 'assistant' | 'system' | 'data';
    content: string;
    toolInvocations?: any[];
    timestamp?: number;
}

export function MessageBubble({ role, content, toolInvocations, timestamp }: MessageBubbleProps) {
    const isUser = role === 'user';
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showTimestamps, setShowTimestamps] = useState(getSetting('showTimestamps'));
    const [markdownRendering, setMarkdownRendering] = useState(getSetting('markdownRendering'));

    // Update settings when they change
    useEffect(() => {
        const updateSettings = () => {
            setShowTimestamps(getSetting('showTimestamps'));
            setMarkdownRendering(getSetting('markdownRendering'));
        };

        // Initial load
        updateSettings();

        // Listen for settings updates
        window.addEventListener('settingsUpdated', updateSettings);
        
        return () => {
            window.removeEventListener('settingsUpdated', updateSettings);
        };
    }, []);

    // Detect dark mode
    useEffect(() => {
        const checkDarkMode = () => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        };
        
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });
        
        return () => observer.disconnect();
    }, []);

    const formatTimestamp = (ts?: number) => {
        if (!ts) return '';
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Extract thinking block if present
    const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
    const thinkingContent = thinkingMatch ? thinkingMatch[1] : null;
    const cleanContent = content.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();

    // Extract stock cards if present
    interface StockCardData {
        ticker: string;
        name: string;
        price: number;
        changePercent: number;
        changeAmount?: number;
        ytdChangePercent: number;
        ytdChangeAmount?: number;
        spyYtdChangePercent?: number;
    }

    const stockCardRegex = /<<STOCK_CARD>>([\s\S]*?)<<END_STOCK_CARD>>/g;
    const stockCards: StockCardData[] = [];
    let contentWithoutStockCards = cleanContent;
    let stockMatch;
    while ((stockMatch = stockCardRegex.exec(cleanContent)) !== null) {
        try {
            const data = JSON.parse(stockMatch[1]);
            stockCards.push({
                ticker: data.ticker || data.symbol || '',
                name: data.name || data.companyName || '',
                price: typeof data.price === 'number' ? data.price : parseFloat(data.price),
                changePercent:
                    typeof data.changePercent === 'number'
                        ? data.changePercent
                        : parseFloat(data.changePercent),
                changeAmount:
                    typeof data.changeAmount === 'number'
                        ? data.changeAmount
                        : parseFloat(data.changeAmount),
                ytdChangePercent:
                    typeof data.ytdChangePercent === 'number'
                        ? data.ytdChangePercent
                        : parseFloat(data.ytdChangePercent),
                ytdChangeAmount:
                    typeof data.ytdChangeAmount === 'number'
                        ? data.ytdChangeAmount
                        : parseFloat(data.ytdChangeAmount),
                spyYtdChangePercent:
                    typeof data.spyYtdChangePercent === 'number'
                        ? data.spyYtdChangePercent
                        : parseFloat(data.spyYtdChangePercent),
            });
            contentWithoutStockCards = contentWithoutStockCards.replace(stockMatch[0], '').trim();
        } catch (error) {
            console.warn('Failed to parse stock card payload:', error);
        }
    }

    // Extract weather cards if present
    interface WeatherCardData {
        location: string;
        temperature: number;
        condition: string;
        humidity?: number;
        windSpeed?: number;
        visibility?: number;
        feelsLike?: number;
        high?: number;
        low?: number;
    }

    const weatherCardRegex = /<<WEATHER_CARD>>([\s\S]*?)<<END_WEATHER_CARD>>/g;
    const weatherCards: WeatherCardData[] = [];
    let contentWithoutWeatherCards = contentWithoutStockCards;
    let weatherMatch;
    while ((weatherMatch = weatherCardRegex.exec(contentWithoutStockCards)) !== null) {
        try {
            const data = JSON.parse(weatherMatch[1]);
            weatherCards.push({
                location: data.location || data.city || data.name || '',
                temperature:
                    typeof data.temperature === 'number' ? data.temperature : parseFloat(data.temperature),
                condition: data.condition || data.weather || data.description || '',
                humidity:
                    data.humidity !== undefined
                        ? typeof data.humidity === 'number'
                            ? data.humidity
                            : parseFloat(data.humidity)
                        : undefined,
                windSpeed:
                    data.windSpeed !== undefined
                        ? typeof data.windSpeed === 'number'
                            ? data.windSpeed
                            : parseFloat(data.windSpeed)
                        : undefined,
                visibility:
                    data.visibility !== undefined
                        ? typeof data.visibility === 'number'
                            ? data.visibility
                            : parseFloat(data.visibility)
                        : undefined,
                feelsLike:
                    data.feelsLike !== undefined
                        ? typeof data.feelsLike === 'number'
                            ? data.feelsLike
                            : parseFloat(data.feelsLike)
                        : undefined,
                high:
                    data.high !== undefined
                        ? typeof data.high === 'number'
                            ? data.high
                            : parseFloat(data.high)
                        : undefined,
                low:
                    data.low !== undefined
                        ? typeof data.low === 'number'
                            ? data.low
                            : parseFloat(data.low)
                        : undefined,
            });
            contentWithoutWeatherCards = contentWithoutWeatherCards.replace(weatherMatch[0], '').trim();
        } catch (error) {
            console.warn('Failed to parse weather card payload:', error);
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx(
                'flex w-full mb-8 gap-4 px-8 md:px-16',
                isUser ? 'flex-row-reverse' : 'flex-row'
            )}
        >
            {/* Avatar */}
            <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                isUser ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
            )}>
                {isUser ? <User size={18} /> : <Bot size={18} />}
            </div>

            {/* Content */}
            <div className={clsx(
                'flex flex-col gap-2 flex-1 min-w-0',
                isUser ? 'items-end' : 'items-start'
            )}>

                {/* Thinking Block */}
                {thinkingContent && !isUser && (
                    <div className="w-full bg-muted/50 rounded-lg border border-border overflow-hidden">
                        <button
                            onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                            className="flex items-center gap-2 w-full p-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                        >
                            {isThinkingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>Thinking Process</span>
                        </button>
                        <AnimatePresence>
                            {isThinkingExpanded && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-3 pt-0 text-sm text-muted-foreground font-mono bg-black/5">
                                        {thinkingContent}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Tool Invocations (Actions) */}
                {toolInvocations?.map((tool, index) => (
                    <div key={index} className="w-full bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-3 text-sm">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium mb-1">
                            <Terminal size={14} />
                            <span>Action: {tool.toolName}</span>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground truncate">
                            {JSON.stringify(tool.args)}
                        </div>
                        {tool.result && (
                            <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                                Result: {JSON.stringify(tool.result)}
                            </div>
                        )}
                    </div>
                ))}

                {/* Stock Cards */}
                {!isUser &&
                    stockCards.map((card, idx) => (
                        <StockQuoteCard
                            key={`${card.ticker}-${idx}`}
                            ticker={card.ticker}
                            name={card.name}
                            price={card.price}
                            changePercent={card.changePercent}
                            ytdChangePercent={card.ytdChangePercent}
                        />
                    ))}

                {/* Weather Cards */}
                {!isUser &&
                    weatherCards.map((card, idx) => (
                        <WeatherCard
                            key={`${card.location}-${idx}`}
                            location={card.location}
                            temperature={card.temperature}
                            condition={card.condition}
                            humidity={card.humidity}
                            windSpeed={card.windSpeed}
                            visibility={card.visibility}
                            feelsLike={card.feelsLike}
                            high={card.high}
                            low={card.low}
                        />
                ))}

                {/* Main Text Content */}
                {(contentWithoutWeatherCards || (!thinkingContent && !toolInvocations && stockCards.length === 0 && weatherCards.length === 0)) && (
                    <div className={clsx(
                        'px-4 py-3 rounded-2xl shadow-sm',
                        isUser
                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                            : 'bg-card border border-border text-card-foreground rounded-tl-sm'
                    )}>
                        {markdownRendering ? (
                        <div className="prose dark:prose-invert prose-sm max-w-none break-words">
                            <ReactMarkdown
                                components={{
                                        code({ node, inline, className, children, ...props }: any) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const language = match ? match[1] : '';
                                            
                                            // Inline code (not in a code block)
                                            if (inline || !language) {
                                                return (
                                                    <code className="bg-black/10 dark:bg-black/30 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                                                        {children}
                                                    </code>
                                                );
                                            }
                                            
                                            // Code block with syntax highlighting
                                            return (
                                                <SyntaxHighlighter
                                                    language={language}
                                                    style={isDarkMode ? oneDark : oneLight}
                                                    customStyle={{
                                                        margin: '0.5rem 0',
                                                        padding: '1rem',
                                                        borderRadius: '0.5rem',
                                                        fontSize: '0.875rem',
                                                        lineHeight: '1.5',
                                                        background: isDarkMode ? '#1e293b' : '#f8fafc',
                                                    }}
                                                    PreTag="div"
                                                    {...props}
                                                >
                                                    {String(children).replace(/\n$/, '')}
                                                </SyntaxHighlighter>
                                            );
                                        },
                                        pre: ({ children, ...props }: any) => {
                                            // For code blocks, the SyntaxHighlighter handles the container
                                            // For plain pre tags, render normally
                                            const child = children?.props;
                                            if (child && child.className && /language-/.test(child.className)) {
                                                // Code block - let the code component handle it
                                                return <>{children}</>;
                                            }
                                            
                                            // Plain pre tag
                                            return (
                                                <pre className="overflow-auto w-full my-2 bg-black/10 dark:bg-black/30 p-2 rounded-lg" {...props}>
                                                    {children}
                                                </pre>
                                            );
                                        },
                                }}
                            >
                                    {contentWithoutWeatherCards}
                            </ReactMarkdown>
                        </div>
                        ) : (
                            <div className="text-sm whitespace-pre-wrap break-words">
                                {contentWithoutWeatherCards}
                            </div>
                        )}
                        {showTimestamps && timestamp && (
                            <div className={clsx(
                                'text-xs mt-2 opacity-70',
                                isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}>
                                {formatTimestamp(timestamp)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
