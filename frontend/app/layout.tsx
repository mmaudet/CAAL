import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Public_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/app/theme-provider';
import { cn, getAppConfig, getStyles } from '@/lib/utils';
import '@/styles/globals.css';

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
});

const commitMono = localFont({
  display: 'swap',
  variable: '--font-commit-mono',
  src: [
    {
      path: '../fonts/CommitMono-400-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-700-Regular.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/CommitMono-400-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../fonts/CommitMono-700-Italic.otf',
      weight: '700',
      style: 'italic',
    },
  ],
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const hdrs = await headers();
  const appConfig = await getAppConfig(hdrs);
  const { pageTitle, pageDescription } = appConfig;
  const styles = getStyles(appConfig);

  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        publicSans.variable,
        commitMono.variable,
        'scroll-smooth font-sans antialiased'
      )}
    >
      <head>
        {/* Polyfill crypto.randomUUID for insecure contexts (HTTP over LAN) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
                crypto.randomUUID = function() {
                  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    var r = Math.random() * 16 | 0;
                    var v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                  });
                };
              }
            `,
          }}
        />
        {/* Apply CAAL theme from localStorage before React hydrates (prevents flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var themes = {
                  midnight: {
                    '--surface-deep': 'oklch(0.15 0.0398 265.75)',
                    '--surface-0': 'oklch(0.2077 0.0398 265.75)',
                    '--surface-1': 'oklch(0.2795 0.0368 260.03)',
                    '--surface-2': 'oklch(0.32 0.035 260)',
                    '--surface-3': 'oklch(0.36 0.033 260)',
                    '--surface-4': 'oklch(0.40 0.031 260)',
                    '--primary-bg': '#3fb184',
                    '--primary-text': '#3fb184',
                    '--primary': '#3fb184',
                    '--background': 'oklch(0.15 0.0398 265.75)',
                    '--foreground': 'oklch(0.985 0 0)',
                    '--muted': 'oklch(0.269 0.02 260)',
                    '--muted-foreground': 'oklch(0.7107 0.0351 256.79)',
                    '--border-subtle': 'oklch(1 0 0 / 4%)',
                    '--border-default': 'oklch(1 0 0 / 8%)',
                    '--border-emphasis': 'oklch(1 0 0 / 12%)',
                    '--border-top-highlight': 'oklch(1 0 0 / 6%)'
                  },
                  greySlate: {
                    '--surface-deep': 'oklch(0.2178 0 0)',
                    '--surface-0': 'oklch(0.2178 0 0)',
                    '--surface-1': 'oklch(0.2178 0 0)',
                    '--surface-2': 'oklch(0.31 0 0)',
                    '--surface-3': 'oklch(0.35 0 0)',
                    '--surface-4': 'oklch(0.39 0 0)',
                    '--primary-bg': '#45997c',
                    '--primary-text': '#45997c',
                    '--primary': '#45997c',
                    '--background': 'oklch(0.2178 0 0)',
                    '--foreground': 'oklch(0.985 0 0)',
                    '--muted': 'oklch(0.269 0 0)',
                    '--muted-foreground': 'oklch(0.708 0 0)',
                    '--border-subtle': 'oklch(1 0 0 / 4%)',
                    '--border-default': 'oklch(1 0 0 / 8%)',
                    '--border-emphasis': 'oklch(1 0 0 / 12%)',
                    '--border-top-highlight': 'oklch(1 0 0 / 6%)'
                  },
                  light: {
                    '--surface-deep': '#e2e8f0',
                    '--surface-0': '#f8fafc',
                    '--surface-1': '#ffffff',
                    '--surface-2': '#ffffff',
                    '--surface-3': '#f1f5f9',
                    '--surface-4': '#e2e8f0',
                    '--primary-bg': '#3fb184',
                    '--primary-text': '#3fb184',
                    '--primary': '#3fb184',
                    '--background': '#f8fafc',
                    '--foreground': '#0f172a',
                    '--muted': '#f1f5f9',
                    '--muted-foreground': '#64748b',
                    '--border-subtle': 'oklch(0 0 0 / 6%)',
                    '--border-default': 'oklch(0 0 0 / 10%)',
                    '--border-emphasis': 'oklch(0 0 0 / 15%)',
                    '--border-top-highlight': 'oklch(1 0 0 / 0%)'
                  }
                };
                try {
                  var themeName = localStorage.getItem('caal-theme') || 'midnight';
                  var theme = themes[themeName] || themes.midnight;
                  var root = document.documentElement;
                  for (var prop in theme) {
                    root.style.setProperty(prop, theme[prop]);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {styles && <style>{styles}</style>}
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </head>
      <body className="overflow-x-hidden">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
