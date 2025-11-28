/**
 * Weather Data Interfaces
 */

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

export interface LocationSearchResult {
    name: string;
    formattedAddress: string;
}
