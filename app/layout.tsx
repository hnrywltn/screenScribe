import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "ScreenScribe",
  description: "Turn a recorded screen/lecture video into screenshots, a transcript, and an mp4 — packaged per session.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full flex flex-col md:flex-row antialiased">
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </body>
    </html>
  );
}
