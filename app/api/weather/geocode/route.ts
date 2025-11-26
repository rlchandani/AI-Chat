import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

// Get Google API key from environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }

    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    // Use Google Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
    
    const geocodeResponse = await fetch(geocodeUrl);
    
    if (!geocodeResponse.ok) {
      throw new Error('Failed to geocode location');
    }

    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Format results for autocomplete
    const results = geocodeData.results.map((result: any) => {
      const addressComponents = result.address_components || [];
      let city = '';
      let state = '';
      let country = '';
      
      for (const component of addressComponents) {
        const types = component.types || [];
        if (types.includes('locality') || types.includes('sublocality')) {
          city = component.long_name;
        } else if (types.includes('administrative_area_level_1')) {
          state = component.short_name;
        } else if (types.includes('country')) {
          country = component.short_name;
        }
      }
      
      const location = result.geometry.location;
      
      return {
        name: city || result.formatted_address.split(',')[0],
        country: country,
        admin1: state, // State/Province
        latitude: location.lat,
        longitude: location.lng,
        displayName: result.formatted_address,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to geocode location' },
      { status: 500 }
    );
  }
}

