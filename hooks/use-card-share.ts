import { useCallback, useState } from 'react';
import * as htmlToImage from 'html-to-image';

interface ShareOptions {
    fileName: string;
    title: string;
    text: string;
}

export function useCardShare() {
    const [isSharing, setIsSharing] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);

    const share = useCallback(async (ref: React.RefObject<HTMLElement | null>, options: ShareOptions) => {
        if (!ref.current || isSharing) return;

        setIsSharing(true);
        try {
            const node = ref.current;

            // Wait for fonts to be ready
            await document.fonts.ready;

            // Detect dark mode
            const isDarkMode = document.documentElement.classList.contains('dark');
            const bgColor = isDarkMode ? '#1e293b' : '#f8fafc'; // slate-800 / slate-50

            let blob: Blob | null = null;

            // Strategy: 
            // 1. Try standard capture (no cacheBust to avoid breaking signed URLs)
            // 2. If that fails, capture without images (fallback for CORS issues)
            try {
                blob = await htmlToImage.toBlob(node, {
                    pixelRatio: window.devicePixelRatio || 2,
                    backgroundColor: bgColor,
                    // cacheBust can break signed URLs, so we disable it by default
                    // cacheBust: false, 
                    width: node.scrollWidth,
                    height: node.scrollHeight,
                    style: { transform: 'none', margin: '0' },
                });
            } catch (imageError) {
                console.warn('Initial capture failed, retrying with image filter...', imageError);
                try {
                    blob = await htmlToImage.toBlob(node, {
                        pixelRatio: window.devicePixelRatio || 2,
                        backgroundColor: bgColor,
                        width: node.scrollWidth,
                        height: node.scrollHeight,
                        style: { transform: 'none', margin: '0' },
                        filter: (child) => child.tagName !== 'IMG',
                    });
                } catch (fallbackError) {
                    console.error('Fallback capture also failed:', fallbackError);
                    throw fallbackError;
                }
            }

            if (!blob) {
                throw new Error('Failed to create image');
            }

            // Try Web Share API first
            if (navigator.share && navigator.canShare) {
                const file = new File([blob], options.fileName, { type: 'image/png' });
                const shareData = {
                    title: options.title,
                    text: options.text,
                    files: [file],
                };

                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    setShareSuccess(true);
                    setTimeout(() => setShareSuccess(false), 2000);
                    return;
                }
            }

            // Fallback: Download the image
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = options.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 2000);
        } catch (err) {
            // Silently ignore AbortError (user cancelled)
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }
            console.error('Share error:', err);
        } finally {
            setIsSharing(false);
        }
    }, [isSharing]);

    return { share, isSharing, shareSuccess };
}
