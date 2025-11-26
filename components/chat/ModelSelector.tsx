'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Brain, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVAILABLE_MODELS, getSelectedModel, setSelectedModel, getModelInfo, DEFAULT_MODEL, type ModelInfo, type ModelProvider } from '@/utils/modelStorage';

interface ModelSelectorProps {
    selectedModelId?: string; // Current selected model from parent
    onModelChange?: (modelId: string) => void;
    onModelSelect?: (modelId: string) => void; // Called when user selects a model (before change)
    align?: 'left' | 'right'; // Alignment of the dropdown
}

const capabilityIcons = {
    fast: Zap,
    balanced: Sparkles,
    powerful: Brain,
};

const capabilityColors = {
    fast: 'text-yellow-500',
    balanced: 'text-blue-500',
    powerful: 'text-purple-500',
};

export function ModelSelector({ selectedModelId: propSelectedModelId, onModelChange, onModelSelect, align = 'right' }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL);
    const [mounted, setMounted] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    // Initialize from localStorage only on client after mount
    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            const currentModel = propSelectedModelId || getSelectedModel();
            setSelectedModelId(currentModel);
        }
    }, []);

    // Sync internal state with prop when it changes
    useEffect(() => {
        if (propSelectedModelId) {
            setSelectedModelId(propSelectedModelId);
        }
    }, [propSelectedModelId]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleModelSelect = (modelId: string) => {
        // Don't proceed if selecting the same model
        if (modelId === selectedModelId) {
            setIsOpen(false);
            return;
        }

        // If onModelSelect is provided, call it first (to show dialog)
        // Otherwise, proceed with immediate change
        if (onModelSelect) {
            onModelSelect(modelId);
            setIsOpen(false);
        } else {
            // Direct change (no dialog)
            setSelectedModelId(modelId);
            setSelectedModel(modelId);
            if (onModelChange) {
                onModelChange(modelId);
            }
            setIsOpen(false);
        }
    };

    const selectedModel = getModelInfo(selectedModelId) || AVAILABLE_MODELS[0];
    const Icon = capabilityIcons[selectedModel.capability];
    const colorClass = capabilityColors[selectedModel.capability];

    // Use default model info until mounted to avoid hydration mismatch
    const displayModel = mounted ? selectedModel : AVAILABLE_MODELS[0];
    const DisplayIcon = capabilityIcons[displayModel.capability];
    const displayColorClass = capabilityColors[displayModel.capability];

    return (
        <div className="relative" ref={selectorRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm"
                aria-label="Select model"
            >
                <DisplayIcon size={16} className={displayColorClass} />
                <span className="font-medium">{displayModel.name}</span>
                <ChevronDown
                    size={14}
                    className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden`}
                    >
                        <div className="p-2">
                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Select Model
                            </div>
                            <div className="space-y-1">
                                {/* Group models by provider */}
                                {(['google', 'openai'] as ModelProvider[]).map((provider) => {
                                    let providerModels = AVAILABLE_MODELS.filter(m => m.provider === provider);

                                    // Sort Google models: Gemini 3 Pro, Gemini 2.5 Pro, Gemini 2.5 Flash
                                    if (provider === 'google') {
                                        const sortOrder: Record<string, number> = {
                                            'gemini-3-pro-preview': 1,
                                            'gemini-2.5-pro': 2,
                                            'gemini-2.5-flash': 3,
                                        };
                                        providerModels = providerModels.sort((a, b) => {
                                            const orderA = sortOrder[a.id] ?? 999;
                                            const orderB = sortOrder[b.id] ?? 999;
                                            return orderA - orderB;
                                        });
                                    }

                                    if (providerModels.length === 0) return null;

                                    return (
                                        <div key={provider}>
                                            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                                                {provider === 'google' ? 'Google' : 'OpenAI'}
                                            </div>
                                            {providerModels.map((model) => {
                                                const ModelIcon = capabilityIcons[model.capability];
                                                const modelColorClass = capabilityColors[model.capability];
                                                const isSelected = model.id === selectedModelId;

                                                return (
                                                    <button
                                                        key={model.id}
                                                        onClick={() => handleModelSelect(model.id)}
                                                        className={`
                                                                    w-full px-3 py-2.5 text-left rounded-lg transition-colors
                                                                    ${isSelected
                                                                ? 'bg-accent border border-primary/20'
                                                                : 'hover:bg-accent/50'
                                                            }
                                                                `}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-start gap-3 flex-1">
                                                                <ModelIcon size={18} className={`${modelColorClass} mt-0.5 shrink-0`} />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-sm font-medium ${isSelected ? 'text-foreground' : 'text-foreground'}`}>
                                                                            {model.name}
                                                                        </span>
                                                                        {isSelected && (
                                                                            <Check size={14} className="text-primary shrink-0" />
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                                        {model.description}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

