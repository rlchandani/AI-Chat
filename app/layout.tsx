import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeInitializer } from "@/components/ThemeInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "iRedlof",
  description: "AI Chat Assistant powered by Gemini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const settings = localStorage.getItem('gemini-chat-settings');
                  const theme = settings ? JSON.parse(settings).theme : 'system';
                  const root = document.documentElement;
                  
                  if (theme === 'dark') {
                    root.classList.add('dark');
                  } else if (theme === 'light') {
                    root.classList.add('light');
                  } else {
                    // System theme
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (prefersDark) {
                      root.classList.add('dark');
                    } else {
                      root.classList.add('light');
                    }
                  }
                } catch (e) {
                  // Fallback to system preference
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (prefersDark) {
                    document.documentElement.classList.add('dark');
                  }
                }
              })();
            `,
          }}
        />
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
