import { Zap, Sparkles } from 'lucide-react';
import { getModelInfo, DEFAULT_MODEL } from '@/utils/modelStorage';

interface ModelIconProps {
    modelId?: string;
    size?: number;
    className?: string;
}

export function ModelIcon({ modelId, size = 16, className = '' }: ModelIconProps) {
    const model = getModelInfo(modelId || DEFAULT_MODEL);

    if (!model) return null;

    // Determine icon based on provider or capability
    // We want distinct icons for providers if possible, or fallback to capability

    let Icon = Sparkles; // Default to Sparkles (Gemini-like)
    let colorClass = 'text-blue-500';

    if (model.provider === 'openai') {
        Icon = Zap; // GPT-like
        colorClass = 'text-green-500';
    } else if (model.provider === 'google') {
        Icon = Sparkles;
        colorClass = 'text-blue-500';
    }

    // Override based on capability if desired, but user asked for provider icons
    // "The icons should be showing the model provider like Gemini or Chatgpt."

    return (
        <div className={`flex items-center justify-center ${className}`} title={model.name}>
            <Icon size={size} className={colorClass} />
        </div>
    );
}
