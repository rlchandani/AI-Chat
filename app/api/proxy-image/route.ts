import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        // Validation: Only allow specific domains to prevent open proxy abuse
        const allowedDomains = ['gstatic.com', 'googleusercontent.com', 'openweathermap.org'];
        const urlObj = new URL(url);

        if (!allowedDomains.some(domain => urlObj.hostname.endsWith(domain))) {
            return new NextResponse('Forbidden domain', { status: 403 });
        }

        const response = await fetch(url);

        if (!response.ok) {
            return new NextResponse(`Failed to fetch image: ${response.statusText}`, { status: response.status });
        }

        const contentType = response.headers.get('content-type');
        const buffer = await response.arrayBuffer();

        // Return the image with CORS headers
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType || 'image/png',
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
