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
