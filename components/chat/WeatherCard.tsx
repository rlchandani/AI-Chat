'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Cloud, Droplets, Eye, Gauge, Loader2, MapPin, MapPinOff, Share2, Sun, Thermometer, Wind } from 'lucide-react';
import clsx from 'clsx';
import { useCardShare } from '@/hooks/use-card-share';

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
    onAutoLocationChange?: (useAuto: boolean) => void;
    onDataChange?: (data: WeatherData) => void;
    initialData?: WeatherData | null;
}

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

export function WeatherCard({
    location: initialLocation = 'San Francisco',
    temperature: initialTemperature,
    autoFetch = true,
    onRefreshStateChange,
    useAutoLocation = false,
    unitType = 'imperial',
    onLocationChange,
    onAutoLocationChange,
    onDataChange,
    initialData,
}: WeatherCardProps) {
    const [weatherData, setWeatherData] = useState<WeatherData | null>(initialData || null);

    // Sync initialData when it changes
    useEffect(() => {
        if (initialData) {
            setWeatherData(initialData);
        }
    }, [initialData]);

    // Sync local data changes to parent
    useEffect(() => {
        if (weatherData && onDataChange) {
            onDataChange(weatherData);
        }
    }, [weatherData, onDataChange]);

    const [loading, setLoading] = useState(autoFetch && initialTemperature === undefined);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
    const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    const [isRequestingLocation, setIsRequestingLocation] = useState(false);
    const [autoLocationEnabled, setAutoLocationEnabled] = useState(useAutoLocation);

    const { share, isSharing, shareSuccess } = useCardShare();
    const hasFetchedRef = useRef(false);
    const cardRef = useRef<HTMLDivElement>(null);

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
            if (onDataChange) onDataChange(data);
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
                            if (onDataChange) onDataChange(data);
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
                                if (onDataChange) onDataChange(data);
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
                if (onDataChange) onDataChange(data);
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
    }, [weatherData?.location, initialLocation, autoLocationEnabled, unitType, onDataChange]);

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
    }, [onLocationChange, unitType]);

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



    // Share card as image - Gold Standard implementation
    const handleShare = useCallback(async () => {
        if (!weatherData) return;

        // Generate unique filename with date and time
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        const locationSlug = (weatherData.location || 'weather').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const fileName = `${locationSlug}-weather-${timestamp}.png`;

        await share(cardRef, {
            fileName,
            title: `Weather in ${weatherData.location}`,
            text: `${weatherData.location} - ${weatherData.temperature}°${unitType === 'metric' ? 'C' : 'F'} ${weatherData.condition}`,
        });
    }, [weatherData, unitType, share]);

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
                loadWeather().catch(console.error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return (
            <div className="w-full h-full rounded-2xl border border-border bg-card shadow-sm p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-foreground">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Loading weather...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full rounded-2xl border border-border bg-card shadow-sm p-6 flex items-center justify-center">
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`/api/proxy-image?url=${encodeURIComponent(weatherIconUrl)}`}
                    alt={condition || 'Weather icon'}
                    className="w-16 h-16"
                    crossOrigin="anonymous"
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
        <div className="relative h-full">
            {/* Share Button - positioned outside the captured area */}
            <button
                onClick={handleShare}
                disabled={isSharing}
                className="absolute -top-2 -right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-200 disabled:opacity-50"
                title={shareSuccess ? 'Shared!' : 'Share as image'}
                aria-label="Share as image"
            >
                {isSharing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : shareSuccess ? (
                    <Check className="w-4 h-4 text-green-500" />
                ) : (
                    <Share2 className="w-4 h-4" />
                )}
            </button>

            {/* Card content - this gets captured as image */}
            <div
                ref={cardRef}
                className="w-full h-full rounded-2xl border border-border bg-card shadow-sm p-6 space-y-4 overflow-hidden relative flex flex-col"
            >
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
                                    className="absolute w-8 h-32 bg-yellow-500/20 dark:bg-yellow-500/20 rounded-full blur-xl"
                                    style={{
                                        left: '-10%',
                                        top: '-10%',
                                        transformOrigin: '50% 100%',
                                        transform: `rotate(${i * 45}deg) translateY(-50px)`,
                                    }}
                                    animate={{
                                        opacity: [0.1, 0.3, 0.1],
                                        scale: [1, 1.2, 1],
                                    }}
                                    transition={{
                                        duration: 4,
                                        repeat: Infinity,
                                        delay: i * 0.5,
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
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                <span>Location</span>
                                {isRequestingLocation && (
                                    <Loader2 className="w-3 h-3 animate-spin text-slate-500 dark:text-slate-400" />
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
                                    aria-label="Use your current location"
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
                                    aria-label="Switch to manual location"
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
                            <div className="text-sm text-muted-foreground capitalize">{condition || 'Unknown'}</div>
                        </div>
                    </div>
                </div>

                {/* Temperature Range */}
                {(high !== undefined || low !== undefined) && (
                    <div className="relative z-10 flex items-center gap-4 text-sm">
                        {high !== undefined && (
                            <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">High:</span>
                                <span className="font-semibold text-foreground">{formatTemperature(high)}</span>
                            </div>
                        )}
                        {low !== undefined && (
                            <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Low:</span>
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
                                                'flex-shrink-0 rounded-lg border p-1.5 min-w-[50px] text-center',
                                                isNow ? 'bg-primary border-primary' : 'bg-muted border-border'
                                            )}
                                        >
                                            <div className={clsx("text-[10px] mb-0.5", isNow ? "text-primary-foreground" : "text-muted-foreground")}>
                                                {isNow ? 'Now' : hourStr}
                                            </div>
                                            <div className={clsx("text-sm font-semibold", isNow ? "text-primary-foreground" : "text-foreground")}>
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
                        <div className="rounded-xl border border-border bg-muted p-3">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                <Sun size={12} />
                                <span className="flex-1">UV Index</span>
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
                        <div className="rounded-xl border border-border bg-muted p-3">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
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
                        <div className="rounded-xl border border-border bg-muted p-3">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                <Thermometer size={12} />
                                <span>Feels Like</span>
                            </div>
                            <div className="text-lg font-semibold text-foreground">
                                {Number.isFinite(feelsLike) ? formatTemperature(feelsLike) : '—'}
                            </div>
                        </div>
                    )}
                    {windSpeed !== undefined && (
                        <div className="rounded-xl border border-border bg-muted p-3">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                <Wind size={12} />
                                <span>Wind</span>
                            </div>
                            <div className="text-lg font-semibold text-foreground">
                                {Number.isFinite(windSpeed) ? formatWindSpeed(windSpeed) : '—'}
                            </div>
                        </div>
                    )}
                    {humidity !== undefined && (
                        <div className="rounded-xl border border-border bg-muted p-3">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                <Droplets size={12} />
                                <span>Humidity</span>
                            </div>
                            <div className="text-lg font-semibold text-foreground">
                                {Number.isFinite(humidity) ? `${Math.round(humidity)}%` : '—'}
                            </div>
                        </div>
                    )}
                    {visibility !== undefined && (
                        <div className="rounded-xl border border-border bg-muted p-3">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                                <Eye size={12} />
                                <span>Visibility</span>
                            </div>
                            <div className="text-lg font-semibold text-foreground">
                                {Number.isFinite(visibility) ? formatVisibility(visibility) : '—'}
                            </div>
                        </div>
                    )}
                </div>


                <div className="relative z-10 text-[11px] uppercase tracking-wider text-muted-foreground text-right">
                    Sourced from Google
                </div>
            </div>
        </div>
    );
}

// Icon Components for Fallback
const AnimatedSun = () => (
    <motion.svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-yellow-500"
    >
        <motion.circle
            cx="12"
            cy="12"
            r="5"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <line key={angle} x1="12" y1="1" x2="12" y2="3" transform={`rotate(${angle} 12 12)`} />
            ))}
        </motion.g>
    </motion.svg>
);

const AnimatedCloud = () => (
    <motion.svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-400"
    >
        <motion.path
            d="M17.5 19c2.485 0 4.5-2.015 4.5-4.5S19.985 10 17.5 10c-.157 0-.311.008-.462.024a5.003 5.003 0 0 0-9.076 0A5.003 5.003 0 0 0 3 14.5C3 16.985 5.015 19 7.5 19h10z"
            animate={{ x: [0, 2, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
    </motion.svg>
);

const AnimatedRain = () => (
    <motion.svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-blue-400"
    >
        <path d="M17.5 19c2.485 0 4.5-2.015 4.5-4.5S19.985 10 17.5 10c-.157 0-.311.008-.462.024a5.003 5.003 0 0 0-9.076 0A5.003 5.003 0 0 0 3 14.5C3 16.985 5.015 19 7.5 19h10z" />
        <motion.line
            x1="8"
            y1="13"
            x2="8"
            y2="15"
            animate={{ y: [0, 5], opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear', delay: 0 }}
        />
        <motion.line
            x1="12"
            y1="13"
            x2="12"
            y2="15"
            animate={{ y: [0, 5], opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear', delay: 0.3 }}
        />
        <motion.line
            x1="16"
            y1="13"
            x2="16"
            y2="15"
            animate={{ y: [0, 5], opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear', delay: 0.6 }}
        />
    </motion.svg>
);

const AnimatedSnow = () => (
    <motion.svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-300"
    >
        <path d="M17.5 19c2.485 0 4.5-2.015 4.5-4.5S19.985 10 17.5 10c-.157 0-.311.008-.462.024a5.003 5.003 0 0 0-9.076 0A5.003 5.003 0 0 0 3 14.5C3 16.985 5.015 19 7.5 19h10z" />
        {[8, 12, 16].map((x, i) => (
            <motion.circle
                key={x}
                cx={x}
                cy="15"
                r="1"
                fill="currentColor"
                animate={{ y: [0, 10], opacity: [0, 1, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: i * 0.5 }}
            />
        ))}
    </motion.svg>
);

const AnimatedWind = () => (
    <motion.svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-400"
    >
        <motion.path
            d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"
            animate={{ x: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
    </motion.svg>
);
