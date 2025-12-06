'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimeZone {
  city: string;
  offset: number; // Hours offset from UTC
}

interface ClockWidgetProps {
  timeZones?: TimeZone[];
}

const DEFAULT_TIME_ZONES: TimeZone[] = [
  { city: 'New York', offset: -5 }, // EST (will adjust for DST)
  { city: 'London', offset: 0 },
  { city: 'Dubai', offset: 4 },
  { city: 'Tokyo', offset: 9 },
];

export function ClockWidget({ timeZones = DEFAULT_TIME_ZONES }: ClockWidgetProps) {
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    // Update time every 30 seconds (30000ms)
    // This provides a good balance between performance and showing reasonably current time
    // The time will update smoothly without causing unnecessary re-renders
    setCurrentTime(Date.now());
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getTimeForZone = (offset: number) => {
    if (currentTime === null) return '--:--';
    const utcTime = currentTime;
    const zoneTime = new Date(utcTime + offset * 60 * 60 * 1000);
    return zoneTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      {timeZones.map((zone) => (
        <div
          key={zone.city}
          className="p-3 rounded-xl border border-border/70 bg-transparent dark:bg-transparent shadow-sm dark:shadow-md"
        >
          <div className="flex items-center gap-2 text-xs text-foreground uppercase tracking-wide">
            <Clock size={12} className="text-foreground" /> {zone.city}
          </div>
          <div className="text-lg font-semibold mt-1 text-foreground">
            {getTimeForZone(zone.offset)}
          </div>
        </div>
      ))}
    </div>
  );
}

