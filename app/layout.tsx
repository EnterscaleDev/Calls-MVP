import type { Metadata } from "next";
import { Space_Grotesk, Barlow } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import "./ros.css";
import "./ros-dialer.css";

// Display font for headers and page titles, app-wide — matches
// enterscale.com and other .enterscale.com pages.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Only used for the dialer keypad's small letter labels (.dk-key small) —
// the one place the Research Ops Platform prototype uses Barlow instead of
// its display font. See app/ros-dialer.css.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Calls — Research Operations",
  description: "Telephone interview campaign operations: admin, agent, and participant experiences.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${spaceGrotesk.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
