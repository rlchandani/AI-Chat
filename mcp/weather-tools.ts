/**
 * Weather Tools Module
 * Functions for fetching weather data from Google Weather API
 * Used by AI SDK tool integration in the chat API
 */

// Get Google API key from environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface WeatherData {
    location: string;
    temperature: number;
    condition: string;
    humidity?: number;
    windSpeed?: number;
    visibility?: number;
    feelsLike?: number;
    high?: number;
    low?: number;
    uvIndex?: number;
    aqi?: number;
    weatherIconUrl?: string;
    hourlyForecast?: Array<{
        time: string;
        temperature: number;
        condition: string;
        uvIndex: number;
        weatherIconUrl?: string;
    }>;
}

/**
 * Get coordinates from location name using Google Geocoding API
 */
async function geocodeLocation(location: string): Promise<{ lat: number; lon: number; formattedAddress: string }> {
    if (!GOOGLE_API_KEY) {
        throw new Error('Google Maps API key not configured');
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(geocodeUrl);

    if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
        throw new Error(`Location not found: ${location}`);
    }

    const result = data.results[0];
    return {
        lat: result.geometry.location.lat,
        lon: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
    };
}

/**
 * Fetch current weather for a location
 */
interface ForecastDay {
    highTemperature?: { degrees: number };
    lowTemperature?: { degrees: number };
    high?: number;
    low?: number;
}

// Interface for Google Weather API Forecast Response
interface GoogleForecastResponse {
    forecast?: {
        dailyForecast?: Array<ForecastDay>;
        daily?: Array<ForecastDay>;
    };
    dailyForecast?: Array<ForecastDay>;
    daily?: Array<ForecastDay>;
    forecastHours?: Array<{
        interval?: { startTime: string };
        temperature?: { degrees: number };
        weatherCondition?: {
            description?: { text: string };
            type?: string;
            iconBaseUri?: string;
        };
        uvIndex?: number;
    }>;
    // Allow for other properties since the API is dynamic
    [key: string]: unknown;
}

export async function getWeather(location: string, unitType: 'imperial' | 'metric' = 'imperial'): Promise<WeatherData> {
    if (!GOOGLE_API_KEY) {
        throw new Error('Google Maps API key not configured');
    }

    // First, geocode the location
    const { lat, lon, formattedAddress } = await geocodeLocation(location);

    // Fetch weather data using Google Weather API
    const unitsSystem = unitType === 'metric' ? 'METRIC' : 'IMPERIAL';
    const weatherUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?location.latitude=${lat}&location.longitude=${lon}&unitsSystem=${unitsSystem}&key=${GOOGLE_API_KEY}`;
    const forecastUrl = `https://weather.googleapis.com/v1/forecast/hours:lookup?location.latitude=${lat}&location.longitude=${lon}&hours=12&unitsSystem=${unitsSystem}&key=${GOOGLE_API_KEY}`;

    const weatherResponse = await fetch(weatherUrl);

    if (!weatherResponse.ok) {
        const errorText = await weatherResponse.text();
        throw new Error(`Failed to fetch weather: ${weatherResponse.status} ${errorText}`);
    }

    const currentData = await weatherResponse.json();

    // Try to fetch forecast (optional)
    // Using any here because the Google Weather API response structure is dynamic and complex
    let forecastData: GoogleForecastResponse | null = null;
    try {
        const forecastResponse = await fetch(forecastUrl);
        if (forecastResponse.ok) {
            forecastData = await forecastResponse.json();
        }
    } catch {
        // Continue without forecast
    }

    // Parse current conditions
    const current = currentData;

    // Extract AQI if available
    let aqi: number | undefined;
    if (current.airQuality?.usAqi !== undefined) {
        aqi = Math.round(current.airQuality.usAqi);
    } else if (current.airQuality?.aqi !== undefined) {
        aqi = Math.round(current.airQuality.aqi);
    }

    // Extract temperature
    const temperature = current.temperature?.degrees !== undefined
        ? Math.round(current.temperature.degrees)
        : 0;

    // Extract condition
    const condition = current.weatherCondition?.description?.text || current.weatherCondition?.type || 'Unknown';

    // Extract other values
    const humidity = current.relativeHumidity;
    const windSpeed = current.wind?.speed?.value !== undefined
        ? Math.round(current.wind.speed.value)
        : undefined;
    const visibility = current.visibility?.distance !== undefined
        ? Math.round(current.visibility.distance)
        : undefined;
    const uvIndex = current.uvIndex;
    const feelsLike = current.feelsLikeTemperature?.degrees !== undefined
        ? Math.round(current.feelsLikeTemperature.degrees)
        : undefined;

    // Extract high/low from history or forecast
    let high: number | undefined;
    let low: number | undefined;

    if (current.currentConditionsHistory) {
        const maxTemp = current.currentConditionsHistory.maxTemperature?.degrees;
        const minTemp = current.currentConditionsHistory.minTemperature?.degrees;
        high = maxTemp !== undefined ? Math.round(maxTemp) : undefined;
        low = minTemp !== undefined ? Math.round(minTemp) : undefined;
    }

    if ((high === undefined || low === undefined) && forecastData) {
        const forecast = forecastData.forecast || forecastData;
        const dailyForecast = forecast.dailyForecast || forecast.daily || [];
        const todayForecast = (dailyForecast[0] || {}) as ForecastDay;
        const highTemp = todayForecast.highTemperature?.degrees || todayForecast.high;
        const lowTemp = todayForecast.lowTemperature?.degrees || todayForecast.low;
        if (high === undefined && highTemp !== undefined) high = Math.round(highTemp);
        if (low === undefined && lowTemp !== undefined) low = Math.round(lowTemp);
    }

    // Process hourly forecast
    const hourlyForecast: WeatherData['hourlyForecast'] = [];
    if (forecastData?.forecastHours) {
        for (let i = 0; i < Math.min(12, forecastData.forecastHours.length); i++) {
            const hour = forecastData.forecastHours[i];
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

    // Extract weather icon URL
    const weatherIconUrl = current.weatherCondition?.iconBaseUri
        ? `${current.weatherCondition.iconBaseUri}.svg`
        : undefined;

    return {
        location: formattedAddress,
        temperature,
        condition,
        humidity: humidity ? Math.round(humidity) : undefined,
        windSpeed,
        visibility,
        feelsLike,
        high,
        low,
        uvIndex: uvIndex ? Math.round(uvIndex) : undefined,
        aqi,
        weatherIconUrl,
        hourlyForecast,
    };
}

/**
 * Get weather for multiple locations
 */
export async function getMultipleWeather(
    locations: string[],
    unitType: 'imperial' | 'metric' = 'imperial'
): Promise<WeatherData[]> {
    const results = await Promise.allSettled(
        locations.map((location) => getWeather(location, unitType))
    );

    return results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<WeatherData>).value);
}

/**
 * Search for locations (uses Google Places Autocomplete)
 */
export async function searchLocations(
    query: string
): Promise<Array<{ name: string; formattedAddress: string }>> {
    if (!GOOGLE_API_KEY) {
        throw new Error('Google Maps API key not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Location search failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results) {
        return [];
    }

    return data.results.slice(0, 5).map((result: { formatted_address: string }) => ({
        name: result.formatted_address.split(',')[0],
        formattedAddress: result.formatted_address,
    }));
}

