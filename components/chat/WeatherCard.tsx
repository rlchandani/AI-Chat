'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets, Thermometer, Eye, Loader2, Gauge, RefreshCw, MapPin, MapPinOff } from 'lucide-react';
import clsx from 'clsx';

interface WeatherCardProps {
    location?: string;
    temperature?: number;
    condition?: string;
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
    autoFetch?: boolean;
    onRefreshStateChange?: (state: { refreshing: boolean; refreshMessage: string | null; onRefresh: () => void }) => void;
    useAutoLocation?: boolean;
    unitType?: 'imperial' | 'metric';
    onLocationChange?: (location: string) => void;
    onAutoLocationChange?: (enabled: boolean) => void;
}

interface WeatherData {
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

export function WeatherCard({
    location: initialLocation = 'San Francisco',
    temperature: initialTemperature,
    condition: initialCondition,
    humidity: initialHumidity,
    windSpeed: initialWindSpeed,
    visibility: initialVisibility,
    feelsLike: initialFeelsLike,
    high: initialHigh,
    low: initialLow,
    autoFetch = true,
    onRefreshStateChange,
    useAutoLocation = false,
    unitType = 'imperial',
    onLocationChange,
    onAutoLocationChange,
}: WeatherCardProps) {
    const [weatherData, setWeatherData] = useState<WeatherData | null>(
        initialTemperature !== undefined
            ? {
                  location: initialLocation,
                  temperature: initialTemperature,
                  condition: initialCondition || 'Unknown',
                  humidity: initialHumidity,
                  windSpeed: initialWindSpeed,
                  visibility: initialVisibility,
                  feelsLike: initialFeelsLike,
                  high: initialHigh,
                  low: initialLow,
                  uvIndex: undefined,
                  aqi: undefined,
                  hourlyForecast: undefined,
              }
            : null
    );
    const [loading, setLoading] = useState(autoFetch && initialTemperature === undefined);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
    const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    const [isRequestingLocation, setIsRequestingLocation] = useState(false);
    const [autoLocationEnabled, setAutoLocationEnabled] = useState(useAutoLocation);
    const hasFetchedRef = useRef(false);

    const fetchWeather = async (locationToFetch?: string, latitude?: number, longitude?: number) => {
        const location = locationToFetch || weatherData?.location || initialLocation;
        try {
            setError(null);
            let url = `/api/weather?unitType=${unitType}`;
            if (latitude !== undefined && longitude !== undefined) {
                url += `&latitude=${latitude}&longitude=${longitude}`;
            } else {
                url += `&location=${encodeURIComponent(location)}`;
            }
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch weather data');
            }

            const data = await response.json();
            setWeatherData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load weather');
            console.error('Weather fetch error:', err);
            throw err;
        }
    };

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        setRefreshMessage('Fetching latest weather data...');
        setError(null);
        try {
            // If auto-location is enabled, get current position and use coordinates
            if (autoLocationEnabled && typeof navigator !== 'undefined' && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        try {
                            const { latitude, longitude } = position.coords;
                            const response = await fetch(`/api/weather?latitude=${latitude}&longitude=${longitude}&unitType=${unitType}`);
                            
                            if (!response.ok) {
                                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                                throw new Error(errorData.error || `Failed to fetch weather data (${response.status})`);
                            }

                            const data = await response.json();
                            
                            // Check if the response contains an error
                            if (data.error) {
                                throw new Error(data.error);
                            }
                            
                            setWeatherData(data);
                            setRefreshMessage('Weather data updated successfully!');
                            setTimeout(() => {
                                setRefreshMessage(null);
                            }, 3000);
                        } catch (err) {
                            setRefreshMessage(null);
                            const errorMessage = err instanceof Error ? err.message : 'Failed to refresh weather';
                            setError(errorMessage);
                            console.error('Weather refresh error:', err);
                        } finally {
                            setRefreshing(false);
                        }
                    },
                    () => {
                        // Fallback to manual location if geolocation fails
                        const locationToFetch = weatherData?.location || initialLocation;
                        fetch(`/api/weather?location=${encodeURIComponent(locationToFetch)}&unitType=${unitType}`)
                            .then(async res => {
                                if (!res.ok) {
                                    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                                    throw new Error(errorData.error || `Failed to fetch weather data (${res.status})`);
                                }
                                return res.json();
                            })
                            .then(data => {
                                if (data.error) {
                                    throw new Error(data.error);
                                }
                                setWeatherData(data);
                                setRefreshMessage('Weather data updated successfully!');
                                setTimeout(() => {
                                    setRefreshMessage(null);
                                }, 3000);
                            })
                            .catch((err) => {
                                setRefreshMessage(null);
                                const errorMessage = err instanceof Error ? err.message : 'Failed to refresh weather';
                                setError(errorMessage);
                                console.error('Weather refresh error:', err);
                            })
                            .finally(() => {
                                setRefreshing(false);
                            });
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0, // Don't use cache for refresh
                    }
                );
            } else {
                // Use manual location
                const locationToFetch = weatherData?.location || initialLocation;
                const response = await fetch(`/api/weather?location=${encodeURIComponent(locationToFetch)}&unitType=${unitType}`);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(errorData.error || `Failed to fetch weather data (${response.status})`);
                }

                const data = await response.json();
                
                // Check if the response contains an error
                if (data.error) {
                    throw new Error(data.error);
                }
                
                setWeatherData(data);
                setRefreshMessage('Weather data updated successfully!');
                setTimeout(() => {
                    setRefreshMessage(null);
                }, 3000);
            }
        } catch (err) {
            setRefreshMessage(null);
            const errorMessage = err instanceof Error ? err.message : 'Failed to refresh weather';
            setError(errorMessage);
            console.error('Weather refresh error:', err);
        } finally {
            if (!autoLocationEnabled) {
                setRefreshing(false);
            }
        }
    }, [weatherData?.location, initialLocation, autoLocationEnabled, unitType]);

    // Expose refresh state to parent
    useEffect(() => {
        if (onRefreshStateChange) {
            onRefreshStateChange({
                refreshing,
                refreshMessage,
                onRefresh: handleRefresh,
            });
        }
    }, [refreshing, refreshMessage, handleRefresh, onRefreshStateChange]);

    // Check location permission status (only for information, don't trigger fetch here)
    useEffect(() => {
        if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
            navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
                setLocationPermission(result.state);
                // Don't trigger fetch here - let the main useEffect handle it
            }).catch(() => {
                // Permission API not supported, default to prompt
                setLocationPermission('prompt');
            });
        }
    }, []);

    // Request user's location
    const requestUserLocation = useCallback(async () => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            setLoading(false);
            return;
        }

        setIsRequestingLocation(true);
        setLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    
                    // Fetch weather using coordinates
                    const response = await fetch(`/api/weather?latitude=${latitude}&longitude=${longitude}&unitType=${unitType}`);
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                        throw new Error(errorData.error || `Failed to fetch weather data (${response.status})`);
                    }

                    const data = await response.json();
                    
                    // Check if the response contains an error
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    setWeatherData(data);
                    setLocationPermission('granted');
                    setAutoLocationEnabled(true);
                    
                    // Notify parent of location change
                    if (onLocationChange && data.location) {
                        onLocationChange(data.location);
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to load weather';
                    setError(errorMessage);
                    console.error('Weather fetch error:', err);
                } finally {
                    setIsRequestingLocation(false);
                    setLoading(false);
                }
            },
            (error) => {
                setIsRequestingLocation(false);
                setLoading(false);
                setLocationPermission('denied');
                setError('Location access denied. Please enable location permissions or enter a location manually.');
                console.error('Geolocation error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000, // Cache for 5 minutes
            }
        );
    }, [onLocationChange]);

    // Handle auto-location toggle
    const handleToggleAutoLocation = () => {
        if (autoLocationEnabled) {
            // Disable auto-location
            setAutoLocationEnabled(false);
            if (onAutoLocationChange) {
                onAutoLocationChange(false);
            }
            if (onLocationChange) {
                onLocationChange(initialLocation);
            }
            // Reload weather with manual location
            fetchWeather(initialLocation);
        } else {
            // Enable auto-location - request permission
            setAutoLocationEnabled(true);
            if (onAutoLocationChange) {
                onAutoLocationChange(true);
            }
            requestUserLocation();
        }
    };

    useEffect(() => {
        // Only auto-fetch if autoFetch is true AND we don't have temperature data AND we haven't fetched yet
        if (autoFetch && initialTemperature === undefined && !hasFetchedRef.current) {
            hasFetchedRef.current = true; // Mark as fetched to prevent duplicate calls
            
            if ((autoLocationEnabled || useAutoLocation) && (locationPermission === 'granted' || locationPermission === 'prompt')) {
                // Use auto-location if enabled - request permission if needed
                if (locationPermission === 'prompt' && !autoLocationEnabled) {
                    setAutoLocationEnabled(true);
                }
                requestUserLocation();
            } else {
                // Use manual location
                const loadWeather = async () => {
                    try {
                        setLoading(true);
                        await fetchWeather();
                    } finally {
                        setLoading(false);
                    }
                };
                loadWeather();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return (
            <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-foreground">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Loading weather...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-foreground">
                    <Cloud className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }

    if (!weatherData) {
        return null;
    }

    const { location, temperature, condition, humidity, windSpeed, visibility, feelsLike, high, low, uvIndex, aqi, weatherIconUrl, hourlyForecast } = weatherData;
    
    // Get AQI category and color
    const getAQICategory = (aqiValue: number) => {
        if (aqiValue <= 50) return { label: 'Good', color: 'text-green-600 dark:text-green-400' };
        if (aqiValue <= 100) return { label: 'Moderate', color: 'text-yellow-600 dark:text-yellow-400' };
        if (aqiValue <= 150) return { label: 'Unhealthy for Sensitive', color: 'text-orange-600 dark:text-orange-400' };
        if (aqiValue <= 200) return { label: 'Unhealthy', color: 'text-red-600 dark:text-red-400' };
        if (aqiValue <= 300) return { label: 'Very Unhealthy', color: 'text-purple-600 dark:text-purple-400' };
        return { label: 'Hazardous', color: 'text-red-700 dark:text-red-500' };
    };
    
    // Get weather icon - use Google Weather API icon if available, otherwise fallback to animated icons
    const getWeatherIcon = () => {
        if (weatherIconUrl) {
            return (
                <img 
                    src={weatherIconUrl} 
                    alt={condition || 'Weather icon'} 
                    className="w-16 h-16"
                />
            );
        }
        
        // Fallback to animated icons based on condition
        const cond = condition.toLowerCase();
        if (cond.includes('sun') || cond.includes('clear')) {
            return <AnimatedSun />;
        } else if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
            return <AnimatedRain />;
        } else if (cond.includes('snow') || cond.includes('blizzard')) {
            return <AnimatedSnow />;
        } else if (cond.includes('wind')) {
            return <AnimatedWind />;
        } else {
            return <AnimatedCloud />;
        }
    };

    const formatTemperature = (temp: number) => {
        return `${Math.round(temp)}°${unitType === 'metric' ? 'C' : 'F'}`;
    };
    
    const formatWindSpeed = (speed: number) => {
        return unitType === 'metric' ? `${speed} km/h` : `${speed} mph`;
    };
    
    const formatVisibility = (vis: number) => {
        return unitType === 'metric' ? `${vis} km` : `${vis} mi`;
    };

    return (
        <div className="w-full h-full rounded-2xl border border-border bg-transparent dark:bg-transparent shadow-sm dark:shadow-md p-6 space-y-4 overflow-hidden relative flex flex-col">
            {/* Enhanced Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Rain particles */}
                {condition.toLowerCase().includes('rain') && (
                    <div className="absolute inset-0 opacity-40 dark:opacity-35">
                        {[...Array(40)].map((_, i) => (
                            <motion.div
                                key={`rain-${i}`}
                                className="absolute w-0.5 h-10 bg-blue-600 dark:bg-blue-300 rounded-full shadow-sm"
                                initial={{ y: -30, x: `${(i * 2.5) % 100}%` }}
                                animate={{
                                    y: ['-30px', '250px'],
                                    opacity: [0, 1, 1, 0],
                                }}
                                transition={{
                                    duration: 0.8 + Math.random() * 0.4,
                                    repeat: Infinity,
                                    delay: Math.random() * 0.8,
                                    ease: 'linear',
                                }}
                            />
                        ))}
                    </div>
                )}
                
                {/* Snow particles */}
                {condition.toLowerCase().includes('snow') && (
                    <div className="absolute inset-0 opacity-60 dark:opacity-50">
                        {[...Array(30)].map((_, i) => (
                            <motion.div
                                key={`snow-${i}`}
                                className="absolute w-2 h-2 bg-slate-600 dark:bg-gray-200 rounded-full shadow-sm"
                                initial={{ y: -30, x: `${(i * 3.3) % 100}%`, rotate: 0 }}
                                animate={{
                                    y: ['-30px', '250px'],
                                    x: [`${(i * 3.3) % 100}%`, `${((i * 3.3) + Math.random() * 15 - 7.5) % 100}%`],
                                    rotate: [0, 360],
                                    opacity: [0, 1, 1, 0],
                                }}
                                transition={{
                                    duration: 3 + Math.random() * 2,
                                    repeat: Infinity,
                                    delay: Math.random() * 1.5,
                                    ease: 'easeInOut',
                                }}
                            />
                        ))}
                    </div>
                )}
                
                {/* Cloud movement for cloudy conditions */}
                {(condition.toLowerCase().includes('cloud') || condition.toLowerCase().includes('overcast') || condition.toLowerCase().includes('fog')) && (
                    <div className="absolute inset-0 opacity-30 dark:opacity-30">
                        {[...Array(3)].map((_, i) => (
                            <motion.div
                                key={`cloud-${i}`}
                                className="absolute w-32 h-16 bg-slate-500/40 dark:bg-gray-400/30 rounded-full blur-xl"
                                initial={{ x: `${-50 + i * 50}%`, y: `${20 + i * 15}%` }}
                                animate={{
                                    x: [`${-50 + i * 50}%`, `${150 + i * 50}%`],
                                }}
                                transition={{
                                    duration: 20 + i * 5,
                                    repeat: Infinity,
                                    ease: 'linear',
                                }}
                            />
                        ))}
                    </div>
                )}
                
                {/* Sun rays for sunny conditions */}
                {(condition.toLowerCase().includes('sun') || condition.toLowerCase().includes('clear')) && (
                    <div className="absolute inset-0 opacity-25 dark:opacity-25">
                        {[...Array(8)].map((_, i) => (
                            <motion.div
                                key={`ray-${i}`}
                                className="absolute w-1 h-20 bg-yellow-500 dark:bg-yellow-500 rounded-full shadow-sm"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    transformOrigin: '50% 0%',
                                    transform: `rotate(${i * 45}deg) translateY(-60px)`,
                                }}
                                animate={{
                                    opacity: [0.4, 0.9, 0.4],
                                    scale: [1, 1.2, 1],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.25,
                                    ease: 'easeInOut',
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground mb-1">
                            <span>Location</span>
                            {isRequestingLocation && (
                                <Loader2 className="w-3 h-3 animate-spin text-foreground/70" />
                            )}
                            {autoLocationEnabled && locationPermission === 'granted' && !isRequestingLocation && (
                                <span title="Using your location">
                                    <MapPin size={12} className="text-green-500" />
                                </span>
                            )}
                        </div>
                        <div className="text-2xl font-bold text-foreground">{location || 'Unknown'}</div>
                        {!autoLocationEnabled && (
                            <button
                                onClick={handleToggleAutoLocation}
                                className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                title="Use your current location"
                            >
                                <MapPin size={12} />
                                <span>Use my location</span>
                            </button>
                        )}
                        {autoLocationEnabled && (
                            <button
                                onClick={handleToggleAutoLocation}
                                className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                title="Switch to manual location"
                            >
                                <MapPinOff size={12} />
                                <span>Manual location</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Temperature and Icon */}
            <div className="relative z-10 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 flex items-center justify-center">
                        {getWeatherIcon()}
                    </div>
                    <div>
                        <div className="text-5xl font-black tracking-tight text-foreground">
                            {Number.isFinite(temperature) ? formatTemperature(temperature) : '—'}
                        </div>
                        <div className="text-sm text-foreground capitalize">{condition || 'Unknown'}</div>
                    </div>
                </div>
            </div>

            {/* Temperature Range */}
            {(high !== undefined || low !== undefined) && (
                <div className="relative z-10 flex items-center gap-4 text-sm">
                    {high !== undefined && (
                        <div className="flex items-center gap-1">
                            <span className="text-foreground">High:</span>
                            <span className="font-semibold text-foreground">{formatTemperature(high)}</span>
                        </div>
                    )}
                    {low !== undefined && (
                        <div className="flex items-center gap-1">
                            <span className="text-foreground">Low:</span>
                            <span className="font-semibold text-foreground">{formatTemperature(low)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Hourly Forecast - Condensed */}
            {hourlyForecast && hourlyForecast.length > 0 && (
                <div className="relative z-10">
                    <div className="overflow-x-auto -mx-2 px-2 scrollbar-hide">
                        <div className="flex gap-1.5 pb-1">
                            {hourlyForecast.slice(0, 24).map((hour, index) => {
                                const date = new Date(hour.time);
                                const hourStr = date.toLocaleTimeString([], { hour: 'numeric' });
                                const isNow = index === 0;
                                
                                return (
                                    <div
                                        key={`${hour.time}-${index}`}
                                        className={clsx(
                                            'flex-shrink-0 rounded-lg border border-border/60 bg-transparent dark:bg-transparent p-1.5 min-w-[50px] text-center',
                                            isNow && 'ring-1 ring-primary/50 border-primary/40 bg-primary/5'
                                        )}
                                    >
                                        <div className="text-[10px] text-muted-foreground mb-0.5">
                                            {isNow ? 'Now' : hourStr}
                                        </div>
                                        <div className="text-sm font-semibold text-foreground">
                                            {formatTemperature(hour.temperature)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Additional Details Grid */}
            <div className="relative z-10 grid grid-cols-2 gap-3">
                {uvIndex !== undefined && (
                    <div className="rounded-xl border border-border/70 bg-transparent dark:bg-transparent p-3 shadow-sm dark:shadow-md">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground mb-1">
                            <Sun size={12} />
                            <span>UV Index</span>
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                            {uvIndex}
                            <span className="text-xs ml-1 text-muted-foreground">
                                {uvIndex <= 2 ? '(Low)' : uvIndex <= 5 ? '(Moderate)' : uvIndex <= 7 ? '(High)' : uvIndex <= 10 ? '(Very High)' : '(Extreme)'}
                            </span>
                        </div>
                    </div>
                )}
                {aqi !== undefined && (
                    <div className="rounded-xl border border-border/70 bg-transparent dark:bg-transparent p-3 shadow-sm dark:shadow-md">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground mb-1">
                            <Gauge size={12} />
                            <span>AQI</span>
                        </div>
                        <div className={`text-lg font-semibold ${getAQICategory(aqi).color}`}>
                            {aqi}
                            <span className="text-xs ml-1 text-muted-foreground">
                                ({getAQICategory(aqi).label})
                            </span>
                        </div>
                    </div>
                )}
                {feelsLike !== undefined && (
                    <div className="rounded-xl border border-border/70 bg-transparent dark:bg-transparent p-3 shadow-sm dark:shadow-md">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground mb-1">
                            <Thermometer size={12} />
                            <span>Feels Like</span>
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                            {Number.isFinite(feelsLike) ? formatTemperature(feelsLike) : '—'}
                        </div>
                    </div>
                )}
                {windSpeed !== undefined && (
                    <div className="rounded-xl border border-border/70 bg-transparent dark:bg-transparent p-3 shadow-sm dark:shadow-md">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground mb-1">
                            <Wind size={12} />
                            <span>Wind</span>
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                            {Number.isFinite(windSpeed) ? formatWindSpeed(windSpeed) : '—'}
                        </div>
                    </div>
                )}
                {humidity !== undefined && (
                    <div className="rounded-xl border border-border/70 bg-transparent dark:bg-transparent p-3 shadow-sm dark:shadow-md">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground mb-1">
                            <Droplets size={12} />
                            <span>Humidity</span>
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                            {Number.isFinite(humidity) ? `${Math.round(humidity)}%` : '—'}
                        </div>
                    </div>
                )}
                {visibility !== undefined && (
                    <div className="rounded-xl border border-border/70 bg-transparent dark:bg-transparent p-3 shadow-sm dark:shadow-md">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-foreground mb-1">
                            <Eye size={12} />
                            <span>Visibility</span>
                        </div>
                        <div className="text-lg font-semibold text-foreground">
                            {Number.isFinite(visibility) ? formatVisibility(visibility) : '—'}
                        </div>
                    </div>
                )}
            </div>


            <div className="relative z-10 text-[11px] uppercase tracking-wider text-foreground/80 text-right">
                Sourced from Google
            </div>
        </div>
    );
}

// Animated Weather Icons
function AnimatedSun() {
    return (
        <motion.svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-yellow-400 dark:text-yellow-500"
            animate={{
                rotate: [0, 360],
                scale: [1, 1.1, 1],
            }}
            transition={{
                rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
                scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
            }}
        >
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <motion.g
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
                <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </motion.g>
        </motion.svg>
    );
}

function AnimatedRain() {
    return (
        <motion.svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-blue-400 dark:text-blue-500"
        >
            <motion.path
                d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                animate={{
                    scale: [1, 1.05, 1],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
            <motion.g
                initial={{ y: 0 }}
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
            >
                <line x1="7" y1="14" x2="7" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </motion.g>
            <motion.g
                initial={{ y: 0 }}
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            >
                <line x1="12" y1="14" x2="12" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </motion.g>
            <motion.g
                initial={{ y: 0 }}
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            >
                <line x1="17" y1="14" x2="17" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </motion.g>
        </motion.svg>
    );
}

function AnimatedSnow() {
    return (
        <motion.svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-blue-200 dark:text-blue-300"
        >
            <motion.path
                d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                animate={{
                    scale: [1, 1.05, 1],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
            <motion.circle
                cx="8"
                cy="18"
                r="1"
                fill="currentColor"
                animate={{
                    y: [0, 3, 0],
                    opacity: [1, 0.5, 1],
                }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
            <motion.circle
                cx="12"
                cy="18"
                r="1"
                fill="currentColor"
                animate={{
                    y: [0, 3, 0],
                    opacity: [1, 0.5, 1],
                }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.3,
                }}
            />
            <motion.circle
                cx="16"
                cy="18"
                r="1"
                fill="currentColor"
                animate={{
                    y: [0, 3, 0],
                    opacity: [1, 0.5, 1],
                }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.6,
                }}
            />
        </motion.svg>
    );
}

function AnimatedWind() {
    return (
        <motion.svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-foreground"
            animate={{
                rotate: [0, 360],
            }}
            transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'linear',
            }}
        >
            <path
                d="M9.59 4.59A2 2 0 1 1 11 8H2m10-4a2 2 0 1 0-2 2h7m-7 4a2 2 0 1 1-2 2H2m8 4a2 2 0 1 0 2 2h7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </motion.svg>
    );
}

function AnimatedCloud() {
    return (
        <motion.svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-foreground"
        >
            <motion.path
                d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                animate={{
                    x: [0, 2, 0],
                    scale: [1, 1.02, 1],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
        </motion.svg>
    );
}


