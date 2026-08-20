import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import {
  DEFAULT_THEME_MODE,
  THEME_MODE_COOKIE,
  isThemeMode,
  themeAttribute,
} from "@/lib/theme-mode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartPay Solutions",
  description: "Installment sales and recovery management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read on the server so the correct appearance is present on the first
  // paint; a client-side read would flash the wrong one on every load.
  const stored = (await cookies()).get(THEME_MODE_COOKIE)?.value;
  const mode = isThemeMode(stored) ? stored : DEFAULT_THEME_MODE;

  return (
    <html
      lang="en"
      data-theme={themeAttribute(mode)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
