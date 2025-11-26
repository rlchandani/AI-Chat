'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface LocationOption {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (location: string) => void;
  onSelect: (location: string) => void;
  placeholder?: string;
  className?: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search location or zip code...',
  className,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<LocationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Don't search if value is too short
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce the search
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/weather/geocode?q=${encodeURIComponent(value)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.results || []);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value]);

  const handleSelect = (option: LocationOption) => {
    onSelect(option.displayName);
    setShowSuggestions(false);
    setSuggestions([]);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        inputRef.current?.blur();
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={clsx('relative w-full', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-10 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((option, index) => (
            <button
              key={`${option.latitude}-${option.longitude}-${index}`}
              type="button"
              onClick={() => handleSelect(option)}
              className={clsx(
                'w-full px-4 py-2 text-left hover:bg-accent transition-colors',
                selectedIndex === index && 'bg-accent',
              )}
            >
              <div className="text-sm font-medium text-foreground">{option.displayName}</div>
              {option.admin1 && (
                <div className="text-xs text-muted-foreground">{option.country}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

