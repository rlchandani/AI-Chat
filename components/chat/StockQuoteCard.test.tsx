import { render, screen, waitFor } from '@testing-library/react';
import { StockQuoteCard } from './StockQuoteCard';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock html-to-image
vi.mock('html-to-image', () => ({
    toBlob: vi.fn().mockResolvedValue(new Blob([''], { type: 'image/png' })),
}));

// Mock fetch
global.fetch = vi.fn().mockImplementation(() => Promise.resolve({
    ok: true,
    json: async () => mockStockData,
}));

const mockStockData = {
    ticker: 'AAPL',
    name: 'Apple Inc',
    price: 150.25,
    change: 2.25,
    changePercent: 1.52,
    changeAmount: 2.25,
    ytdChangePercent: 12.0,
    ytdChangeAmount: 20.5,
    spyYtdChangePercent: 10.0,
    previousClose: 148.00,
    currency: 'USD',
    marketState: 'REGULAR',
    exchange: 'NASDAQ',
};

describe('StockQuoteCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state initially when autoFetch is true', () => {
        render(<StockQuoteCard ticker="AAPL" autoFetch={true} />);
        expect(screen.getByText('Loading stock data...')).toBeInTheDocument();
    });

    it('renders data correctly after fetch', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockStockData,
        });

        render(<StockQuoteCard ticker="AAPL" autoFetch={true} />);

        await waitFor(() => {
            expect(screen.queryByText('Loading stock data...')).not.toBeInTheDocument();
        });

        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('Apple Inc')).toBeInTheDocument();
        expect(screen.getByText('$150.25')).toBeInTheDocument();
        expect(screen.getByText('+1.52%')).toBeInTheDocument();
    });

    it('displays error message on fetch failure', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
        });

        render(<StockQuoteCard ticker="AAPL" autoFetch={true} />);

        await waitFor(() => {
            expect(screen.getByText('Failed to fetch stock data')).toBeInTheDocument();
        });
    });

    it('uses initialData if provided', () => {
        render(<StockQuoteCard ticker="AAPL" initialData={mockStockData} autoFetch={false} />);

        expect(screen.queryByText('Loading stock data...')).not.toBeInTheDocument();
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('$150.25')).toBeInTheDocument();
    });

    it('calls onDataChange with fetched data', async () => {
        const onDataChange = vi.fn();
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockStockData,
        });

        render(<StockQuoteCard ticker="AAPL" onDataChange={onDataChange} autoFetch={true} />);

        await waitFor(() => {
            expect(onDataChange).toHaveBeenCalledWith(mockStockData);
        });
    });
});
