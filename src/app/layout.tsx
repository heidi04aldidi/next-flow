import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextFlow — LLM Workflow Builder",
  description:
    "Build, run, and automate LLM workflows with a powerful visual node editor",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${GeistSans.variable} ${GeistMono.variable} dark`}
      >
        <body className="bg-canvas text-text-primary antialiased overflow-hidden h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
