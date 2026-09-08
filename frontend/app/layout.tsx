export const metadata = {
  title: "Net Scraper",
  description: "Sistema de investigação OSINT",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
