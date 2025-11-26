import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

// Get Google API key from environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_API_KEY) {
  console.warn('Warning: GOOGLE_MAPS_API_KEY is not set. Google APIs will not work.');
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');
    const location = searchParams.get('location'); // User-provided location from widget config
    const unitType = searchParams.get('unitType') || 'imperial'; // Unit type: 'imperial' or 'metric', default to 'imperial'

    // Priority order:
    // 1. Use geocode (coordinates) if available
    // 2. Else use user-provided location
    // 3. Else default to San Francisco, CA
    let lat: number | undefined;
    let lon: number | undefined;
    let resolvedLocation = location || 'San Francisco, CA';
    let useGeocode = false;

    // Priority 1: Use geocode (coordinates) if available
    if (latitude && longitude) {
      const parsedLat = parseFloat(latitude);
      const parsedLon = parseFloat(longitude);
      
      if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
        // Reverse geocode to get the location name from coordinates using Google Geocoding API
        try {
          if (!GOOGLE_API_KEY) {
            throw new Error('Google Maps API key not configured');
          }
          
          const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${parsedLat},${parsedLon}&key=${GOOGLE_API_KEY}`;
          const reverseGeocodeResponse = await fetch(reverseGeocodeUrl);
          
          if (reverseGeocodeResponse.ok) {
            const reverseGeocodeData = await reverseGeocodeResponse.json();
            
            if (reverseGeocodeData.status === 'OK' && reverseGeocodeData.results && reverseGeocodeData.results.length > 0) {
              // Find the result with types containing "locality" and "political"
              let localityResult = null;
              for (const result of reverseGeocodeData.results) {
                const types = result.types || [];
                if (types.includes('locality') && types.includes('political')) {
                  localityResult = result;
                  break;
                }
              }
              
              // If no locality result found, use the first result as fallback
              const result = localityResult || reverseGeocodeData.results[0];
              
              // Use formatted_address from the locality result, or fallback to first result
              if (localityResult && localityResult.formatted_address) {
                resolvedLocation = localityResult.formatted_address;
                console.log('Found locality result with formatted_address:', resolvedLocation);
                console.log('Locality result types:', localityResult.types);
              } else {
                // Fallback: extract from address components
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
                
                // Format: "City, State, Country" or "City, Country"
                if (city) {
                  resolvedLocation = `${city}${state ? `, ${state}` : ''}${country ? `, ${country}` : ''}`.trim();
                } else if (state) {
                  resolvedLocation = `${state}${country ? `, ${country}` : ''}`.trim();
                } else {
                  resolvedLocation = result.formatted_address || `${parsedLat.toFixed(4)}, ${parsedLon.toFixed(4)}`;
                }
                console.log('Using fallback location extraction:', resolvedLocation);
              }
              
              lat = parsedLat;
              lon = parsedLon;
              useGeocode = true;
            } else {
              // Fall through to Priority 2
            }
          } else {
            // Fall through to Priority 2
          }
        } catch (reverseError) {
          // If reverse geocoding fails, fall through to Priority 2 (user-provided location)
        }
      }
    }
    
    // Priority 2: Use user-provided location if geocode wasn't used or failed
    if (!useGeocode) {
      // Priority 2: Use user-provided location, or Priority 3: default to San Francisco, CA
      const locationToUse = location || 'San Francisco, CA';
      
      if (!GOOGLE_API_KEY) {
        throw new Error('Google Maps API key not configured');
      }
      
      // Clean up location string - remove state abbreviations and extra commas
      const cleanLocation = locationToUse.replace(/,\s*[A-Z]{2}$/, '').trim();
      
      // Geocode the location to get coordinates using Google Geocoding API
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanLocation)}&key=${GOOGLE_API_KEY}`;
      
      const geocodeResponse = await fetch(geocodeUrl);
      if (!geocodeResponse.ok) {
        // Priority 3: Default to San Francisco, CA
        const defaultUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=San Francisco, CA&key=${GOOGLE_API_KEY}`;
        const defaultResponse = await fetch(defaultUrl);
        if (defaultResponse.ok) {
          const defaultData = await defaultResponse.json();
          if (defaultData.status === 'OK' && defaultData.results && defaultData.results.length > 0) {
            const result = defaultData.results[0];
            const locationData = result.geometry.location;
            lat = locationData.lat;
            lon = locationData.lng;
            resolvedLocation = result.formatted_address || 'San Francisco, CA';
          }
        }
      } else {
        const geocodeData = await geocodeResponse.json();
        
        if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
          const result = geocodeData.results[0];
          const locationData = result.geometry.location;
          lat = locationData.lat;
          lon = locationData.lng;
          resolvedLocation = result.formatted_address || cleanLocation;
        } else {
          // Try with just the city name if it contains a comma
          if (cleanLocation.includes(',')) {
            const cityName = cleanLocation.split(',')[0].trim();
            const fallbackUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cityName)}&key=${GOOGLE_API_KEY}`;
            const fallbackResponse = await fetch(fallbackUrl);
            
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              if (fallbackData.status === 'OK' && fallbackData.results && fallbackData.results.length > 0) {
                const result = fallbackData.results[0];
                const locationData = result.geometry.location;
                lat = locationData.lat;
                lon = locationData.lng;
                resolvedLocation = result.formatted_address || cityName;
              } else {
                // Priority 3: Default to San Francisco, CA
                const defaultUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=San Francisco, CA&key=${GOOGLE_API_KEY}`;
                const defaultResponse = await fetch(defaultUrl);
                if (defaultResponse.ok) {
                  const defaultData = await defaultResponse.json();
                  if (defaultData.status === 'OK' && defaultData.results && defaultData.results.length > 0) {
                    const result = defaultData.results[0];
                    const locationData = result.geometry.location;
                    lat = locationData.lat;
                    lon = locationData.lng;
                    resolvedLocation = result.formatted_address || 'San Francisco, CA';
                  }
                }
              }
            } else {
              // Priority 3: Default to San Francisco, CA
              const defaultUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=San Francisco, CA&key=${GOOGLE_API_KEY}`;
              const defaultResponse = await fetch(defaultUrl);
              if (defaultResponse.ok) {
                const defaultData = await defaultResponse.json();
                if (defaultData.status === 'OK' && defaultData.results && defaultData.results.length > 0) {
                  const result = defaultData.results[0];
                  const locationData = result.geometry.location;
                  lat = locationData.lat;
                  lon = locationData.lng;
                  resolvedLocation = result.formatted_address || 'San Francisco, CA';
                }
              }
            }
          } else {
            // Priority 3: Default to San Francisco, CA
            const defaultUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=San Francisco, CA&key=${GOOGLE_API_KEY}`;
            const defaultResponse = await fetch(defaultUrl);
            if (defaultResponse.ok) {
              const defaultData = await defaultResponse.json();
              if (defaultData.status === 'OK' && defaultData.results && defaultData.results.length > 0) {
                const result = defaultData.results[0];
                const locationData = result.geometry.location;
                lat = locationData.lat;
                lon = locationData.lng;
                resolvedLocation = result.formatted_address || 'San Francisco, CA';
              }
            }
          }
        }
      }
    }
    
    // Ensure lat and lon are set (should always be set by now, but TypeScript needs this)
    if (lat === undefined || lon === undefined) {
      throw new Error('Failed to determine location coordinates');
    }

    if (!GOOGLE_API_KEY) {
      throw new Error('Google Maps API key not configured');
    }

    // Fetch weather data using Google Weather API
    // Google Weather API uses REST endpoints with location object
    const unitsSystem = unitType === 'metric' ? 'METRIC' : 'IMPERIAL';
    const weatherUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?location.latitude=${lat}&location.longitude=${lon}&key=${GOOGLE_API_KEY}`;
    const forecastUrl = `https://weather.googleapis.com/v1/forecast/hours:lookup?location.latitude=${lat}&location.longitude=${lon}&hours=12&unitsSystem=${unitsSystem}&key=${GOOGLE_API_KEY}`;

    const weatherResponse = await fetch(weatherUrl);
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      throw new Error(`Failed to fetch current weather data: ${weatherResponse.status} ${errorText}`);
    }

    const currentData = await weatherResponse.json();

    // Try to fetch forecast, but make it optional
    let forecastData: any = null;
    try {
      const forecastResponse = await fetch(forecastUrl);
      
      if (!forecastResponse.ok) {
        // Don't throw - continue without forecast
      } else {
        forecastData = await forecastResponse.json();
      }
    } catch (forecastError) {
      // Continue without forecast
    }
    
    // Parse Google Weather API response
    // Google Weather API structure may vary, so we'll need to adapt based on actual response
    // For now, let's assume a structure and log to see what we get
    
    // Extract current conditions - Google Weather API structure
    const current = currentData;
    
    // Get AQI if available (may not be in current conditions)
    let aqi: number | undefined;
    if (current.airQuality?.usAqi !== undefined) {
      aqi = Math.round(current.airQuality.usAqi);
    } else if (current.airQuality?.aqi !== undefined) {
      aqi = Math.round(current.airQuality.aqi);
    }
    
    // Extract temperature - Google Weather API returns in the requested unit system
    // If IMPERIAL: temperature is in FAHRENHEIT
    // If METRIC: temperature is in CELSIUS
    const temperature = current.temperature?.degrees !== undefined 
      ? Math.round(current.temperature.degrees) 
      : undefined;
    
    // Extract condition - Google uses weatherCondition.description.text
    const condition = current.weatherCondition?.description?.text || current.weatherCondition?.type || 'Unknown';
    
    // Extract other current conditions
    // Humidity is directly available as relativeHumidity (percentage)
    const humidity = current.relativeHumidity;
    
    // Wind speed - Google Weather API returns in the requested unit system
    // If IMPERIAL: wind.speed.value is in MILES_PER_HOUR
    // If METRIC: wind.speed.value is in KILOMETERS_PER_HOUR
    const windSpeed = current.wind?.speed?.value !== undefined 
      ? Math.round(current.wind.speed.value) 
      : undefined;
    
    // Visibility - Google Weather API returns in the requested unit system
    // If IMPERIAL: visibility.distance is in MILES
    // If METRIC: visibility.distance is in KILOMETERS
    const visibility = current.visibility?.distance !== undefined 
      ? Math.round(current.visibility.distance) 
      : undefined;
    
    // UV Index is directly available
    const uvIndex = current.uvIndex;
    
    // Feels like temperature - Google Weather API returns in the requested unit system
    const feelsLike = current.feelsLikeTemperature?.degrees !== undefined 
      ? Math.round(current.feelsLikeTemperature.degrees) 
      : undefined;
    
    // Extract daily forecast (high/low) - check currentConditionsHistory first, then forecast
    let high: number | undefined;
    let low: number | undefined;
    
    // Try to get high/low from currentConditionsHistory (today's min/max)
    if (current.currentConditionsHistory) {
      const maxTemp = current.currentConditionsHistory.maxTemperature?.degrees;
      const minTemp = current.currentConditionsHistory.minTemperature?.degrees;
      high = maxTemp !== undefined ? Math.round(maxTemp) : undefined;
      low = minTemp !== undefined ? Math.round(minTemp) : undefined;
    }
    
    // If not available, try forecast data
    if ((high === undefined || low === undefined) && forecastData) {
      const forecast = forecastData.forecast || forecastData;
      const dailyForecast = forecast.dailyForecast || forecast.daily || [];
      const todayForecast = dailyForecast[0] || {};
      const highTemp = todayForecast.highTemperature?.degrees || todayForecast.highTemperature?.value || todayForecast.high;
      const lowTemp = todayForecast.lowTemperature?.degrees || todayForecast.lowTemperature?.value || todayForecast.low;
      if (high === undefined && highTemp !== undefined) {
        high = Math.round(highTemp);
      }
      if (low === undefined && lowTemp !== undefined) {
        low = Math.round(lowTemp);
      }
    }
    
    // Process hourly forecast (next 12 hours) - optional if forecastData is available
    const hourlyForecast: Array<{
      time: string;
      temperature: number;
      condition: string;
      uvIndex: number;
      weatherIconUrl?: string;
    }> = [];

    if (forecastData) {
      // Google Weather API forecast/hours:lookup response structure
      // The response has forecastHours array
      const hourlyData = forecastData.forecastHours || [];
      
      for (let i = 0; i < Math.min(12, hourlyData.length); i++) {
        const hour = hourlyData[i];
        // Temperature is already in the requested unit system (IMPERIAL = Fahrenheit, METRIC = Celsius)
        // Time is in interval.startTime (ISO 8601 format)
        const hourTime = hour.interval?.startTime;
        const hourTemp = hour.temperature?.degrees !== undefined 
          ? Math.round(hour.temperature.degrees) 
          : undefined;
        const hourCondition = hour.weatherCondition?.description?.text 
          || hour.weatherCondition?.type 
          || 'Unknown';
        const hourUvIndex = hour.uvIndex !== undefined ? Math.round(hour.uvIndex) : 0;
        const hourIconUrl = hour.weatherCondition?.iconBaseUri 
          ? `${hour.weatherCondition.iconBaseUri}.svg`
          : undefined;
        
        if (hourTime && hourTemp !== undefined) {
          hourlyForecast.push({
            time: hourTime,
            temperature: hourTemp,
            condition: hourCondition,
            uvIndex: hourUvIndex,
            weatherIconUrl: hourIconUrl,
          });
        }
      }
    }


    // Extract weather icon URL from current conditions
    const weatherIconUrl = current.weatherCondition?.iconBaseUri 
      ? `${current.weatherCondition.iconBaseUri}.svg`
      : undefined;

    const weatherData = {
      location: resolvedLocation,
      temperature: temperature,
      condition: condition,
      humidity: humidity ? Math.round(humidity) : undefined,
      windSpeed: windSpeed,
      visibility: visibility,
      feelsLike: feelsLike,
      high: high,
      low: low,
      uvIndex: uvIndex ? Math.round(uvIndex) : undefined,
      aqi: aqi,
      weatherIconUrl: weatherIconUrl,
      hourlyForecast: hourlyForecast.slice(0, 12), // Limit to 12 hours
    };


    return NextResponse.json(weatherData);
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}

