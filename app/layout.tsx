import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme-provider';
import { LicenseProvider } from '@/lib/license/license-context';
import { LicenseGate } from '@/components/license/LicenseGate';
import { StorageHydrationBarrier } from '@/components/StorageHydrationBarrier';
import { DesktopTitleBar } from '@/components/DesktopTitleBar';

export const metadata: Metadata = {
  title: 'ALCO Content Engine v2',
  description: 'Premium brand-aware content planning and calendar engine powered by Aladzan Corpora',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground flex flex-col" suppressHydrationWarning>
        <ThemeProvider>
          <DesktopTitleBar />
          <div className="flex-1 flex flex-col min-h-0">
            <LicenseProvider>
              <LicenseGate>
                <StorageHydrationBarrier>
                  {children}
                </StorageHydrationBarrier>
              </LicenseGate>
            </LicenseProvider>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

