import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Toaster } from "@/components/Toast";

export const metadata: Metadata = { title: "Watchara Gold | สแกนใบรับซื้อ" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <Toaster>
          <Nav />
          <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6">{children}</main>
        </Toaster>
      </body>
    </html>
  );
}
