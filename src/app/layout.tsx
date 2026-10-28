import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const display = Archivo_Black({ variable: "--font-archivo-black", weight: "400", subsets: ["latin"] });
const sans = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Twin Sync",
  description: "Sync with a twin in-store and unlock Two Is Better.",
  appleWebApp: { capable: true, title: "Twin Sync", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        <AppProvider>
          <main className="stripes mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
            {children}
          </main>
        </AppProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
