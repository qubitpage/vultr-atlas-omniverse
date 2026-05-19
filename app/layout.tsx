import type { Metadata } from "next";
import "./globals.css";
import { RoleProvider } from "@/lib/role";

export const metadata: Metadata = {
  title: "Vultr Atlas — 3D Infrastructure Cockpit",
  description: "Live 3D globe view of your Vultr fleet with an AI copilot. Human always approves.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="relative z-10">
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
