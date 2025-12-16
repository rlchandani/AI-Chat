'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, GitBranch, GitCommit, GitPullRequest, AlertCircle, ExternalLink, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface GitHubActivityWidgetProps {
  username: string;
  onUpdate?: (username: string) => void;
  isEditable?: boolean;
  onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void }) => void;
  autoFetch?: boolean;
  onDataChange?: (data: GitHubData) => void;
  initialData?: GitHubData | null;
}

interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
  html_url: string;
}

interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo: {
    name: string;
    url: string;
  };
  payload?: {
    commits?: Array<{ message: string; sha: string }>;
    action?: string;
    pull_request?: { title: string; html_url: string };
    issue?: { title: string; html_url: string };
  };
}

interface ContributionDay {
  date: string;
  contributionCount: number;
  color: string;
}

interface ContributionWeek {
  contributionDays: ContributionDay[];
}





export interface GitHubData {
  user: GitHubUser;
  events: GitHubEvent[];
  contributions: ContributionWeek[];
  stats: {
    totalContributions: number;
    currentStreak: number;
    longestStreak: number;
  };
}



export function GitHubActivityWidget({ username: initialUsername, onUpdate, isEditable = false, onRefreshStateChange, autoFetch = true, onDataChange, initialData }: GitHubActivityWidgetProps) {
  const [username, setUsername] = useState(initialUsername || 'rlchandani');
  const [isEditing, setIsEditing] = useState(false);
  const [githubData, setGithubData] = useState<GitHubData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  // Listen for edit events from widget header
  useEffect(() => {
    const handleEdit = () => {
      if (isEditable) {
        setIsEditing(true);
      }
    };
    window.addEventListener('github-edit', handleEdit as EventListener);
    return () => window.removeEventListener('github-edit', handleEdit as EventListener);
  }, [isEditable]);

  const fetchGitHubData = useCallback(async (user: string) => {
    if (!user.trim()) {
      setGithubData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/github?username=${encodeURIComponent(user)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch GitHub data');
      }

      const data = await response.json();
      setGithubData(data);
      if (onDataChange) onDataChange(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GitHub data');
      console.error('GitHub fetch error:', err);
      setGithubData(null);
    } finally {
      setLoading(false);
    }
  }, [onDataChange]);

  useEffect(() => {
    if (autoFetch && initialUsername && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchGitHubData(initialUsername);
    }
  }, [autoFetch, initialUsername, fetchGitHubData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshMessage('Fetching latest GitHub data...');
    setError(null);
    try {
      const userToFetch = username;
      if (!userToFetch.trim()) {
        setGithubData(null);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/github?username=${encodeURIComponent(userToFetch)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch GitHub data');
      }

      const data = await response.json();
      setGithubData(data);
      if (onDataChange) onDataChange(data);
      setRefreshMessage('GitHub data updated successfully!');
      setTimeout(() => {
        setRefreshMessage(null);
      }, 3000);
    } catch (err) {
      setRefreshMessage(null);
      setError(err instanceof Error ? err.message : 'Failed to load GitHub data');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [username, onDataChange]);

  // Stabilize handleRefresh for parent consumption to prevent infinite loops
  const handleRefreshRef = useRef(handleRefresh);
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  });

  const stableHandleRefresh = useCallback(() => {
    handleRefreshRef.current();
  }, []);

  // Expose refresh state to parent
  useEffect(() => {
    if (onRefreshStateChange) {
      onRefreshStateChange({
        refreshing,
        refreshMessage,
        onRefresh: stableHandleRefresh,
      });
    }
  }, [refreshing, refreshMessage, stableHandleRefresh, onRefreshStateChange]);

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(username);
    }
    setIsEditing(false);
    hasFetchedRef.current = false;
    fetchGitHubData(username);
  };

  const handleCancel = () => {
    setUsername(initialUsername || 'rlchandani');
    setIsEditing(false);
  };

  const getEventIcon = (type: string) => {
    if (type.includes('Push')) return <GitCommit size={14} className="text-green-500" />;
    if (type.includes('PullRequest')) return <GitPullRequest size={14} className="text-blue-500" />;
    if (type.includes('Issue')) return <AlertCircle size={14} className="text-purple-500" />;
    return <GitBranch size={14} className="text-muted-foreground" />;
  };

  const getEventDescription = (event: GitHubEvent) => {
    if (event.type === 'PushEvent' && event.payload?.commits) {
      const commitCount = event.payload.commits.length;
      return `Pushed ${commitCount} commit${commitCount > 1 ? 's' : ''} to ${event.repo.name.split('/')[1]}`;
    }
    if (event.type === 'PullRequestEvent') {
      const action = event.payload?.action || 'opened';
      return `${action.charAt(0).toUpperCase() + action.slice(1)} pull request in ${event.repo.name.split('/')[1]}`;
    }
    if (event.type === 'IssuesEvent') {
      const action = event.payload?.action || 'opened';
      return `${action.charAt(0).toUpperCase() + action.slice(1)} issue in ${event.repo.name.split('/')[1]}`;
    }
    return `Activity in ${event.repo.name.split('/')[1]}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isEditing && isEditable) {
    return (
      <div className="w-full h-full flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Edit GitHub Username</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="p-1.5 rounded-full hover:bg-primary/10 text-primary transition"
              aria-label="Save username"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive transition"
              aria-label="Cancel editing"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter GitHub username"
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
          autoFocus
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Loading GitHub activity...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-foreground">
          <GitBranch className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!githubData) {
    return null;
  }

  const { user, events } = githubData;

  return (
    <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-4 flex flex-col relative group">
      <div className="flex-1 overflow-auto">
        {/* User Profile Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border/50">
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-12 h-12 rounded-full border-2 border-border"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{user.name || user.login}</h3>
              <a
                href={user.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="View on GitHub"
              >
                <ExternalLink size={12} />
              </a>
            </div>
            <p className="text-xs text-muted-foreground truncate">@{user.login}</p>
            {user.bio && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{user.bio}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-transparent dark:bg-transparent border border-border/50">
            <div className="text-lg font-semibold text-foreground">{user.public_repos}</div>
            <div className="text-xs text-muted-foreground">Repos</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-transparent dark:bg-transparent border border-border/50">
            <div className="text-lg font-semibold text-foreground">{user.followers}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-transparent dark:bg-transparent border border-border/50">
            <div className="text-lg font-semibold text-foreground">{user.following}</div>
            <div className="text-xs text-muted-foreground">Following</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent Activity</h4>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            events.slice(0, 5).map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-background/50 transition-colors"
              >
                <div className="mt-0.5">
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground line-clamp-1">{getEventDescription(event)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(event.created_at)}</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-wider text-foreground/80 text-right mt-2 pt-2 border-t border-border/30">
        Sourced from GitHub
      </div>
    </div>
  );
}


