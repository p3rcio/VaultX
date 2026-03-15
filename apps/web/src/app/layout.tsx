// root layout — wraps the entire app with AuthProvider and the DM Sans font
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { TotpGuard } from "@/components/TotpGuard";

const dmSans = DM_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "VaultX — Encrypted File Sharing",
  description: "Privacy-first, zero-knowledge, end-to-end encrypted cloud file sharing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.className}>
      <head>
        {/*
          Runs before any HTML is painted — reads the saved theme from localStorage and
          adds the "light" class to <html> immediately. Without this, light-mode users
          see a dark flash on every page load while React boots up.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('vaultx_theme')==='light')document.documentElement.classList.add('light')}catch(e){}`,
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <TotpGuard>{children}</TotpGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
