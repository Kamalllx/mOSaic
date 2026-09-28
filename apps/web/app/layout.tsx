import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "mOSaic console",
  description: "Agents as processes, actions as governed syscalls, everything audited.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="flex min-h-full flex-col">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-[1800px] flex-1 px-5 py-5">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
