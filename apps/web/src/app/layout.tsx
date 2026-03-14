// root layout — wraps the entire app with AuthProvider so every page can access auth state
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "VaultX — Encrypted File Sharing",
  description: "Privacy-first, zero-knowledge, end-to-end encrypted cloud file sharing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* AuthProvider at the root means any nested component can call useAuth() */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
