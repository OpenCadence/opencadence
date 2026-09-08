import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./globals.css";
import "./theme.css";
import "./workspace-detail.css";
import "./responsive.css";
import { themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "OpenCadence",
  applicationName: "OpenCadence",
  description:
    "A workspace for freelance tasks, projects, clients, and notes, stored on the computer running OpenCadence.",
  manifest: "/brand/site.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "any" },
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/apple-touch-icon.png",
    other: {
      rel: "mask-icon",
      url: "/brand/safari-pinned-tab.svg",
      color: "#287C73",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#287C73",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
