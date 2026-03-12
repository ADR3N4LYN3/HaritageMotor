import type { Metadata, Viewport } from "next";
import { DM_Sans, Cormorant_Garamond } from "next/font/google";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { AuthBootstrap } from "@/components/AuthBootstrap";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Heritage Motor",
  description: "Vehicle custody platform for operators",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Heritage Motor",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e0d0b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${cormorant.variable} min-h-screen bg-black text-white antialiased`}>
        <AppErrorBoundary>
          <AuthBootstrap>
            <SWRProvider>{children}</SWRProvider>
          </AuthBootstrap>
        </AppErrorBoundary>
      </body>
    </html>
  );
}
