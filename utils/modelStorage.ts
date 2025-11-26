export type ModelProvider = 'google' | 'openai';

export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    capability: 'fast' | 'balanced' | 'powerful';
    provider: ModelProvider; // Provider: 'google' or 'openai'
    contextWindow?: number; // Context window size in tokens
    pricing?: {
        inputPricePerMillion: number; // Price per million input tokens
        outputPricePerMillion: number; // Price per million output tokens
        tierThreshold?: number; // Optional: tokens threshold for tiered pricing
        inputPricePerMillionTier2?: number; // Optional: price for tokens over threshold
        outputPricePerMillionTier2?: number; // Optional: price for tokens over threshold
    };
}

export const AVAILABLE_MODELS: ModelInfo[] = [
    // Google Gemini Models
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Fast and efficient, great for quick responses',
        capability: 'fast',
        provider: 'google',
        contextWindow: 1000000, // 1M tokens
        pricing: {
            inputPricePerMillion: 0.10, // $0.10 per million input tokens
            outputPricePerMillion: 0.40, // $0.40 per million output tokens
        },
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'State-of-the-art thinking model for complex reasoning',
        capability: 'powerful',
        provider: 'google',
        contextWindow: 2000000, // 2M tokens
        pricing: {
            inputPricePerMillion: 1.25, // $1.25 per million input tokens (up to 200K)
            outputPricePerMillion: 10.00, // $10.00 per million output tokens (up to 200K)
            tierThreshold: 200000, // 200K tokens threshold
            inputPricePerMillionTier2: 2.50, // $2.50 per million input tokens (over 200K)
            outputPricePerMillionTier2: 15.00, // $15.00 per million output tokens (over 200K)
        },
    },
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        description: 'Most advanced model for multimodal understanding and reasoning',
        capability: 'powerful',
        provider: 'google',
        contextWindow: 2000000, // 2M tokens
        pricing: {
            inputPricePerMillion: 1.25, // $1.25 per million input tokens (up to 200K) - using 2.5 Pro pricing as estimate
            outputPricePerMillion: 10.00, // $10.00 per million output tokens (up to 200K)
            tierThreshold: 200000, // 200K tokens threshold
            inputPricePerMillionTier2: 2.50, // $2.50 per million input tokens (over 200K)
            outputPricePerMillionTier2: 15.00, // $15.00 per million output tokens (over 200K)
        },
    },
    // OpenAI ChatGPT Models
    {
        id: 'gpt-5.1',
        name: 'GPT-5.1',
        description: 'Latest flagship model with advanced reasoning and multimodal capabilities',
        capability: 'powerful',
        provider: 'openai',
        contextWindow: 400000, // 400K tokens (verify with official docs)
        pricing: {
            inputPricePerMillion: 5.00, // $5.00 per million input tokens (verify with official docs)
            outputPricePerMillion: 15.00, // $15.00 per million output tokens (verify with official docs)
        },
    },
    {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        description: 'Fast and cost-efficient model for well-defined tasks and precise prompts',
        capability: 'fast',
        provider: 'openai',
        contextWindow: 400000, // 400K tokens
        pricing: {
            inputPricePerMillion: 0.25, // $0.25 per million input tokens
            outputPricePerMillion: 2.00, // $2.00 per million output tokens
        },
    },
    {
        id: 'gpt-5-nano',
        name: 'GPT-5 Nano',
        description: 'Ultra-lightweight model optimized for speed and cost-sensitive applications',
        capability: 'fast',
        provider: 'openai',
        contextWindow: 400000, // 400K tokens
        pricing: {
            inputPricePerMillion: 0.05, // $0.05 per million input tokens
            outputPricePerMillion: 0.40, // $0.40 per million output tokens
        },
    },
];

const STORAGE_KEY = 'gemini-selected-model';
export const DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Get the selected model from localStorage
 */
export function getSelectedModel(): string {
    if (typeof window === 'undefined') return DEFAULT_MODEL;
    
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && AVAILABLE_MODELS.some(m => m.id === stored)) {
            return stored;
        }
    } catch (error) {
        console.error('Failed to get selected model:', error);
    }
    
    return DEFAULT_MODEL;
}

/**
 * Set the selected model in localStorage
 */
export function setSelectedModel(modelId: string): void {
    if (typeof window === 'undefined') return;
    
    // Validate model exists
    if (!AVAILABLE_MODELS.some(m => m.id === modelId)) {
        console.error('Invalid model ID:', modelId);
        return;
    }
    
    try {
        localStorage.setItem(STORAGE_KEY, modelId);
    } catch (error) {
        console.error('Failed to save selected model:', error);
    }
}

/**
 * Get model info by ID
 */
export function getModelInfo(modelId: string): ModelInfo | undefined {
    return AVAILABLE_MODELS.find(m => m.id === modelId);
}

/**
 * Get all available models
 */
export function getAllModels(): ModelInfo[] {
    return AVAILABLE_MODELS;
}

/**
 * Calculate cost based on token usage and model pricing
 */
export function calculateCost(
    promptTokens: number,
    completionTokens: number,
    modelId: string
): number {
    const modelInfo = getModelInfo(modelId);
    if (!modelInfo?.pricing) {
        return 0;
    }

    const { pricing } = modelInfo;
    let totalCost = 0;

    // Calculate input cost
    if (pricing.tierThreshold && promptTokens > pricing.tierThreshold) {
        // Tiered pricing: first tier + second tier
        const tier1Tokens = pricing.tierThreshold;
        const tier2Tokens = promptTokens - pricing.tierThreshold;
        totalCost += (tier1Tokens / 1_000_000) * pricing.inputPricePerMillion;
        totalCost += (tier2Tokens / 1_000_000) * (pricing.inputPricePerMillionTier2 || pricing.inputPricePerMillion);
    } else {
        // Simple pricing
        totalCost += (promptTokens / 1_000_000) * pricing.inputPricePerMillion;
    }

    // Calculate output cost
    if (pricing.tierThreshold && completionTokens > pricing.tierThreshold) {
        // Tiered pricing: first tier + second tier
        const tier1Tokens = pricing.tierThreshold;
        const tier2Tokens = completionTokens - pricing.tierThreshold;
        totalCost += (tier1Tokens / 1_000_000) * pricing.outputPricePerMillion;
        totalCost += (tier2Tokens / 1_000_000) * (pricing.outputPricePerMillionTier2 || pricing.outputPricePerMillion);
    } else {
        // Simple pricing
        totalCost += (completionTokens / 1_000_000) * pricing.outputPricePerMillion;
    }

    return totalCost;
}

