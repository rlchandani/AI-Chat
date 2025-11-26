import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username parameter is required' },
        { status: 400 }
      );
    }

    // Fetch user data
    const userResponse = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Chatbot',
      },
    });

    if (!userResponse.ok) {
      if (userResponse.status === 404) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      if (userResponse.status === 403) {
        // Check if it's a rate limit issue
        const rateLimitRemaining = userResponse.headers.get('x-ratelimit-remaining');
        const rateLimitReset = userResponse.headers.get('x-ratelimit-reset');
        
        if (rateLimitRemaining === '0' || rateLimitRemaining === null) {
          const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : null;
          const resetTimeStr = resetTime ? resetTime.toLocaleTimeString() : 'soon';
          return NextResponse.json(
            { 
              error: `GitHub API rate limit exceeded. Please try again after ${resetTimeStr}. You can also use a GitHub Personal Access Token to increase the rate limit.` 
            },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: 'GitHub API access forbidden. This may be due to rate limiting or API restrictions.' },
          { status: 403 }
        );
      }
      throw new Error(`GitHub API error: ${userResponse.status}`);
    }

    const userData = await userResponse.json();

    // Fetch user events (public activity)
    let events: any[] = [];
    const eventsResponse = await fetch(`https://api.github.com/users/${username}/events/public?per_page=100`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Chatbot',
      },
    });

    if (eventsResponse.ok) {
      events = await eventsResponse.json();
    } else if (eventsResponse.status === 403) {
      // Rate limit on events endpoint - continue without events rather than failing
      // The widget will still show user profile and stats
      events = [];
    }

    // Process events and calculate stats
    const stats = {
      totalCommits: 0,
      totalPRs: 0,
      totalIssues: 0,
    };

    const processedEvents = events.slice(0, 10).map((event: any) => {
      if (event.type === 'PushEvent') {
        stats.totalCommits += event.payload?.commits?.length || 0;
      } else if (event.type === 'PullRequestEvent') {
        stats.totalPRs += 1;
      } else if (event.type === 'IssuesEvent') {
        stats.totalIssues += 1;
      }

      return {
        id: event.id,
        type: event.type,
        created_at: event.created_at,
        repo: {
          name: event.repo.name,
          url: `https://github.com/${event.repo.name}`,
        },
        payload: {
          commits: event.payload?.commits,
          action: event.payload?.action,
          pull_request: event.payload?.pull_request,
          issue: event.payload?.issue,
        },
      };
    });

    const githubData = {
      user: {
        login: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
        bio: userData.bio,
        public_repos: userData.public_repos,
        followers: userData.followers,
        following: userData.following,
        html_url: userData.html_url,
      },
      events: processedEvents,
      stats,
    };

    return NextResponse.json(githubData);
  } catch (error) {
    console.error('GitHub API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch GitHub data' },
      { status: 500 }
    );
  }
}

