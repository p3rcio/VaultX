// root layout — wraps the entire app with AuthProvider and the DM Sans font
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const dmSans = DM_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "VaultX — Encrypted File Sharing",
  description: "Privacy-first, zero-knowledge, end-to-end encrypted cloud file sharing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.className}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
