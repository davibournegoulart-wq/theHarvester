import CryptoTrace from "@/components/CryptoTrace";
import DomainRecon from "@/components/DomainRecon";
import EmailSearch from "@/components/EmailSearch";
import PhoneSearch from "@/components/PhoneSearch";
import Tabs from "@/components/Tabs";
import UsernameSearch from "@/components/UsernameSearch";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Net Scraper</h1>
      <p style={{ color: "#666" }}>Sistema de investigação OSINT — módulos internos, sem ferramenta de terceiro embutida.</p>
      <Tabs
        tabs={[
          { label: "Username", content: <UsernameSearch /> },
          { label: "Email", content: <EmailSearch /> },
          { label: "Telefone", content: <PhoneSearch /> },
          { label: "Domínio/IP", content: <DomainRecon /> },
          { label: "Cripto", content: <CryptoTrace /> },
        ]}
      />
    </main>
  );
}
