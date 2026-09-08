import { Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-display" });
const shareTechMono = Share_Tech_Mono({ subsets: ["latin"], weight: "400", variable: "--font-body" });

export const metadata = {
  title: "Net Scraper",
  description: "Sistema de investigação OSINT",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${orbitron.variable} ${shareTechMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
