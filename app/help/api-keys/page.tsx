'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    ArrowLeft, 
    Key, 
    Shield, 
    ExternalLink, 
    Copy, 
    Check,
    Sparkles,
    Bot,
    ChevronDown,
    ChevronRight,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

interface StepProps {
    number: number;
    title: string;
    children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
    return (
        <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                {number}
            </div>
            <div className="flex-1 pb-6">
                <h4 className="font-semibold text-lg mb-2">{title}</h4>
                <div className="text-muted-foreground space-y-2">
                    {children}
                </div>
            </div>
        </div>
    );
}

interface APIKeySectionProps {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

function APIKeySection({ id, icon, title, description, color, children, defaultOpen = false }: APIKeySectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    // Check if this section should be opened based on URL hash
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash.replace('#', '');
            if (hash === id) {
                setIsOpen(true);
                // Scroll to section after a short delay
                setTimeout(() => {
                    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }, [id]);

    return (
        <motion.div
            id={id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border border-border rounded-2xl overflow-hidden ${color}`}
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-6 flex items-center gap-4 text-left hover:bg-accent/50 transition-colors"
            >
                <div className="p-3 rounded-xl bg-background/80 shadow-sm">
                    {icon}
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                {isOpen ? <ChevronDown size={24} /> : <ChevronRight size={24} />}
            </button>
            
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-6"
                >
                    <div className="pt-4 border-t border-border/50">
                        {children}
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="Copy to clipboard"
        >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
        </button>
    );
}

export default function APIKeysHelpPage() {
    return (
        <main className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <Link
                        href="/"
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold">API Keys Setup Guide</h1>
                        <p className="text-sm text-muted-foreground">Learn how to get your API keys</p>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
                {/* Security Notice */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-4 p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
                >
                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <Shield size={24} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Your API Keys Are Safe</h2>
                        <p className="text-muted-foreground">
                            All API keys you enter are stored <strong>only in your browser's local storage</strong> and are never 
                            stored on any server or cloud database. When making API requests, your keys are sent securely to 
                            your app's server-side routes (same origin/server) which then call the AI/Maps services. 
                            This is the standard secure pattern for web applications.
                        </p>
                    </div>
                </motion.div>

                {/* API Key Sections */}
                <div className="space-y-4">
                    {/* Google Gemini */}
                    <APIKeySection
                        id="gemini"
                        icon={<Sparkles size={28} className="text-blue-500" />}
                        title="Google Gemini API Key"
                        description="Required for Gemini 2.5 Flash, Gemini 2.5 Pro, and other Google AI models"
                        color="bg-gradient-to-br from-blue-500/5 to-indigo-500/5"
                        defaultOpen
                    >
                        <div className="space-y-6">
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Free Tier Available</p>
                                    <p className="text-xs text-muted-foreground">
                                        Google AI Studio offers a generous free tier with millions of tokens per month.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Step number={1} title="Go to Google AI Studio">
                                    <p>Visit the Google AI Studio website to create or manage your API key:</p>
                                    <a
                                        href="https://aistudio.google.com/app/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors font-medium"
                                    >
                                        Open Google AI Studio
                                        <ExternalLink size={16} />
                                    </a>
                                </Step>

                                <Step number={2} title="Sign in with Google">
                                    <p>Use your Google account to sign in. You'll need a Google account to access the API.</p>
                                </Step>

                                <Step number={3} title="Create an API Key">
                                    <p>Click on <strong>"Create API key"</strong> button. You can either create a key for a new project or use an existing Google Cloud project.</p>
                                </Step>

                                <Step number={4} title="Copy Your API Key">
                                    <p>Once created, copy the API key. It will start with <code className="px-2 py-1 rounded bg-muted font-mono text-sm">AIza...</code></p>
                                    <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
                                        ⚠️ Keep your API key secure and never share it publicly!
                                    </p>
                                </Step>

                                <Step number={5} title="Add to Settings">
                                    <p>Go back to the app settings and paste your API key in the <strong>"Google Gemini API Key"</strong> field.</p>
                                    <Link
                                        href="/?openSettings=gemini"
                                        className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                                    >
                                        <Key size={16} />
                                        Open Settings
                                    </Link>
                                </Step>
                            </div>
                        </div>
                    </APIKeySection>

                    {/* OpenAI */}
                    <APIKeySection
                        id="openai"
                        icon={<Bot size={28} className="text-emerald-500" />}
                        title="OpenAI API Key"
                        description="Required for GPT-4o, GPT-4o-mini, and other OpenAI models"
                        color="bg-gradient-to-br from-emerald-500/5 to-green-500/5"
                    >
                        <div className="space-y-6">
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <AlertCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Paid API</p>
                                    <p className="text-xs text-muted-foreground">
                                        OpenAI API requires a paid account. You'll need to add credits to use the API.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Step number={1} title="Go to OpenAI Platform">
                                    <p>Visit the OpenAI Platform to create or manage your API keys:</p>
                                    <a
                                        href="https://platform.openai.com/api-keys"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium"
                                    >
                                        Open OpenAI Platform
                                        <ExternalLink size={16} />
                                    </a>
                                </Step>

                                <Step number={2} title="Create an Account or Sign In">
                                    <p>If you don't have an OpenAI account, you'll need to create one. Then sign in to access the API dashboard.</p>
                                </Step>

                                <Step number={3} title="Add Billing (if needed)">
                                    <p>Navigate to <strong>Settings → Billing</strong> and add a payment method. Add credits to your account to use the API.</p>
                                    <a
                                        href="https://platform.openai.com/settings/organization/billing/overview"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Go to Billing Settings
                                        <ExternalLink size={14} />
                                    </a>
                                </Step>

                                <Step number={4} title="Create a New API Key">
                                    <p>Click <strong>"Create new secret key"</strong>. Give it a name (e.g., "iRedlof Chat") and click <strong>Create</strong>.</p>
                                </Step>

                                <Step number={5} title="Copy Your API Key">
                                    <p>Copy the API key immediately! It will start with <code className="px-2 py-1 rounded bg-muted font-mono text-sm">sk-...</code></p>
                                    <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
                                        ⚠️ You won't be able to see this key again after closing the dialog!
                                    </p>
                                </Step>

                                <Step number={6} title="Add to Settings">
                                    <p>Go back to the app settings and paste your API key in the <strong>"OpenAI API Key"</strong> field.</p>
                                    <Link
                                        href="/?openSettings=openai"
                                        className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                                    >
                                        <Key size={16} />
                                        Open Settings
                                    </Link>
                                </Step>
                            </div>
                        </div>
                    </APIKeySection>
                </div>

                {/* FAQ Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-12 space-y-6"
                >
                    <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
                    
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl border border-border">
                            <h3 className="font-semibold mb-2">Are my API keys stored securely?</h3>
                            <p className="text-sm text-muted-foreground">
                                Yes! Your API keys are stored only in your browser's local storage and are never persisted on any server. 
                                When you make requests, keys are transmitted securely to your app's server-side API routes (same server hosting this app), 
                                which then make the actual calls to AI/Maps services. This is the standard secure pattern for web applications.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-border bg-primary/5">
                            <h3 className="font-semibold mb-2">Can I add extra protection with a PIN?</h3>
                            <p className="text-sm text-muted-foreground">
                                Yes! In Settings, you can enable PIN encryption for your API keys. When enabled, your keys are encrypted 
                                with AES-256-GCM encryption using a PIN you choose. This protects your keys if someone gains access to 
                                your browser. You'll need to enter your PIN once per session to unlock your keys. 
                                <strong className="text-foreground"> Note:</strong> Remember your PIN - if you forget it, you'll need to 
                                re-enter your API keys.
                            </p>
                        </div>
                        
                        <div className="p-4 rounded-xl border border-border">
                            <h3 className="font-semibold mb-2">What if I clear my browser data?</h3>
                            <p className="text-sm text-muted-foreground">
                                If you clear your browser's local storage or cookies, you'll need to re-enter your API keys. 
                                We recommend keeping your API keys saved securely somewhere else as a backup.
                            </p>
                        </div>
                        
                        <div className="p-4 rounded-xl border border-border">
                            <h3 className="font-semibold mb-2">Can I use the app without API keys?</h3>
                            <p className="text-sm text-muted-foreground">
                                If the server has environment variables configured with API keys, those will be used as a fallback. 
                                However, for personal use or if no server keys are configured, you'll need to provide your own API keys.
                            </p>
                        </div>
                        
                        <div className="p-4 rounded-xl border border-border">
                            <h3 className="font-semibold mb-2">How do I revoke or regenerate my API keys?</h3>
                            <p className="text-sm text-muted-foreground">
                                You can manage your API keys on the respective platforms:
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors"
                                >
                                    Google AI Studio ↗
                                </a>
                                <a
                                    href="https://platform.openai.com/api-keys"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors"
                                >
                                    OpenAI Platform ↗
                                </a>
                                <a
                                    href="https://console.cloud.google.com/apis/credentials"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors"
                                >
                                    Google Cloud Console ↗
                                </a>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Back Button */}
                <div className="pt-8 flex justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                    >
                        <ArrowLeft size={18} />
                        Back to Chat
                    </Link>
                </div>
            </div>
        </main>
    );
}

