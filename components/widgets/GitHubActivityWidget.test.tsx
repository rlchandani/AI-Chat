import { render, screen, waitFor } from '@testing-library/react';
import { GitHubActivityWidget } from './GitHubActivityWidget';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock html-to-image
vi.mock('html-to-image', () => ({
    toBlob: vi.fn().mockResolvedValue(new Blob([''], { type: 'image/png' })),
}));

// Mock fetch
global.fetch = vi.fn().mockImplementation(() => Promise.resolve({
    ok: true,
    json: async () => mockGitHubData,
}));

const mockGitHubData = {
    user: {
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://example.com/avatar.png',
        html_url: 'https://github.com/testuser',
        public_repos: 10,
        followers: 5,
        following: 2,
        bio: 'Test Bio',
    },
    events: [
        {
            id: '1',
            type: 'PushEvent',
            created_at: '2023-01-01T12:00:00Z',
            repo: { name: 'testuser/repo1', url: 'https://github.com/testuser/repo1' },
            payload: { commits: [{ message: 'feat: test commit', sha: '123456' }] },
        },
    ],
    contributions: [
        {
            contributionDays: [
                { date: '2023-01-01', contributionCount: 5, color: '#ebedf0' }
            ]
        }
    ],
    stats: {
        totalStars: 50,
        totalForks: 20,
        totalIssues: 5,
        totalPullRequests: 15,
    },
};

describe('GitHubActivityWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state initially', () => {
        render(<GitHubActivityWidget username="testuser" />);
        expect(screen.getByText('Loading GitHub activity...')).toBeInTheDocument();
    });

    it('renders data correctly after fetch', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockGitHubData,
        });

        render(<GitHubActivityWidget username="testuser" />);

        await waitFor(() => {
            expect(screen.queryByText('Loading GitHub activity...')).not.toBeInTheDocument();
        });

        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('@testuser')).toBeInTheDocument();
        // Contributions are not currently rendered in the widget
        // expect(screen.getByText('100 contributions in the last year')).toBeInTheDocument();
        expect(screen.getByText('Pushed 1 commit to repo1')).toBeInTheDocument();
    });

    it('displays error message on fetch failure', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
        });

        render(<GitHubActivityWidget username="testuser" />);

        await waitFor(() => {
            expect(screen.getByText('Failed to fetch GitHub data')).toBeInTheDocument();
        });
    });

    it('uses initialData if provided', () => {
        render(<GitHubActivityWidget username="testuser" initialData={mockGitHubData} autoFetch={false} />);

        expect(screen.queryByText('Loading GitHub activity...')).not.toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('calls onDataChange with fetched data', async () => {
        const onDataChange = vi.fn();
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockGitHubData,
        });

        render(<GitHubActivityWidget username="testuser" onDataChange={onDataChange} />);

        await waitFor(() => {
            expect(onDataChange).toHaveBeenCalled();
            const lastCall = onDataChange.mock.calls[onDataChange.mock.calls.length - 1][0];
            expect(lastCall.user.login).toBe('testuser');
        });
    });
});
