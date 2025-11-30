import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StockTableWidget } from './StockTableWidget';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock html-to-image
vi.mock('html-to-image', () => ({
    toBlob: vi.fn().mockResolvedValue(new Blob([''], { type: 'image/png' })),
}));

// Mock fetch
global.fetch = vi.fn();

const mockStocks = [
    {
        ticker: 'MSFT',
        name: 'Microsoft Corp',
        price: 300.50,
        previousClose: 295.00,
        change: 5.50,
        changePercent: 1.86,
        currency: 'USD',
        marketState: 'REGULAR',
        exchange: 'NASDAQ',
        ytdChangePercent: 15.5,
        ytdChangeAmount: 45.2,
        spyYtdChangePercent: 10.0,
        vsSpyPercent: 5.5,
    },
    {
        ticker: 'AAPL',
        name: 'Apple Inc',
        price: 150.25,
        previousClose: 148.00,
        change: 2.25,
        changePercent: 1.52,
        currency: 'USD',
        marketState: 'REGULAR',
        exchange: 'NASDAQ',
        ytdChangePercent: 12.0,
        ytdChangeAmount: 20.5,
        spyYtdChangePercent: 10.0,
        vsSpyPercent: 2.0,
    },
];

describe('StockTableWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state initially when no initial data', () => {
        render(<StockTableWidget tickers="AAPL,MSFT" />);
        expect(screen.getByText('Loading stock data...')).toBeInTheDocument();
    });

    it('renders stocks sorted alphabetically by ticker', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ stocks: mockStocks }),
        });

        render(<StockTableWidget tickers="MSFT,AAPL" />);

        await waitFor(() => {
            expect(screen.queryByText('Loading stock data...')).not.toBeInTheDocument();
        });

        const rows = screen.getAllByRole('row');
        // Row 0 is header, Row 1 should be AAPL, Row 2 should be MSFT
        expect(rows[1]).toHaveTextContent('AAPL');
        expect(rows[2]).toHaveTextContent('MSFT');
    });

    it('displays error message on fetch failure', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
        });

        render(<StockTableWidget tickers="AAPL" />);

        await waitFor(() => {
            expect(screen.getByText('Failed to fetch stock data')).toBeInTheDocument();
        });
    });

    it('renders initial data correctly and sorted', () => {
        // Pass unsorted initial data
        render(<StockTableWidget tickers="MSFT,AAPL" initialData={mockStocks} />);

        const rows = screen.getAllByRole('row');
        // Should be sorted AAPL then MSFT
        expect(rows[1]).toHaveTextContent('AAPL');
        expect(rows[2]).toHaveTextContent('MSFT');
    });
});
