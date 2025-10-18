import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"; // <-- Import from sonner

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gruppy - Group Shipping",
  description: "Shop Globally, Ship Locally. Together.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/* Use the sonner Toaster, richColors makes it look nicer */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}