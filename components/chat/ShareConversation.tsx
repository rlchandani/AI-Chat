'use client';

import { useState, useEffect, useRef } from 'react';
import { Share2, Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareConversationProps {
    conversationId: string;
}

export function ShareConversation({ conversationId }: ShareConversationProps) {
    const [copied, setCopied] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showDropdown]);

    if (!mounted || !conversationId) return null;

    const getShareableLink = () => {
        if (typeof window === 'undefined') return '';
        const baseUrl = window.location.origin;
        return `${baseUrl}?conversation=${conversationId}`;
    };

    const handleShare = async () => {
        const link = getShareableLink();
        
        try {
            // Try using the Web Share API if available (mobile)
            if (navigator.share) {
                await navigator.share({
                    url: link,
                });
            } else {
                // Fallback to copying to clipboard
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch (error) {
            // If user cancels share or clipboard fails, try clipboard as fallback
            if (error instanceof Error && error.name !== 'AbortError') {
                try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                } catch (clipboardError) {
                    console.error('Failed to copy link:', clipboardError);
                }
            }
        }
    };

    const handleCopy = async () => {
        const link = getShareableLink();
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setShowDropdown(false);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy link:', error);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => {
                    if (navigator.share) {
                        handleShare();
                    } else {
                        setShowDropdown(!showDropdown);
                    }
                }}
                className="p-2 rounded-lg hover:bg-accent transition-colors relative"
                aria-label="Share conversation"
                title="Share conversation"
            >
                <AnimatePresence mode="wait">
                    {copied ? (
                        <motion.div
                            key="check"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Check size={18} className="text-green-500" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="share"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Share2 size={18} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>
            
            {/* Dropdown menu with copy option */}
            <AnimatePresence>
                {showDropdown && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 bg-card border border-border rounded-lg shadow-lg p-1 min-w-[200px] z-50"
                    >
                        <button
                            onClick={handleCopy}
                            className="w-full px-3 py-2 text-left text-sm rounded hover:bg-accent flex items-center gap-2"
                        >
                            <Copy size={14} />
                            <span>{copied ? 'Copied!' : 'Copy link'}</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

