import type { Metadata } from "next";
import { Geist } from "next/font/google";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Event Attendance",
  description: "QR check-in for event guests",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
