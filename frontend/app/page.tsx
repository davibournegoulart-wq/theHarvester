import ApiKeyGate from "@/components/ApiKeyGate";
import BulkExplorer from "@/components/BulkExplorer";
import CaseManagement from "@/components/CaseManagement";
import CryptoTrace from "@/components/CryptoTrace";
import DomainRecon from "@/components/DomainRecon";
import EmailSearch from "@/components/EmailSearch";
import GraphView from "@/components/GraphView";
import PhoneSearch from "@/components/PhoneSearch";
import Tabs from "@/components/Tabs";
import UsernameSearch from "@/components/UsernameSearch";

export default function Home() {
  return (
    <ApiKeyGate>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ fontSize: 12, color: "var(--cyan)", marginBottom: 8, letterSpacing: "0.1em" }}>
          {"> SYSTEM ONLINE_"}
        </div>
        <h1 className="glitch-title" data-text="NET SCRAPER" style={{ fontSize: 42, margin: 0 }}>
          NET SCRAPER
        </h1>
        <p style={{ marginTop: 8, marginBottom: 32 }}>
          Sistema de investigação OSINT — módulos internos, sem ferramenta de terceiro embutida.
        </p>
        <Tabs
          tabs={[
            { label: "Username", content: <UsernameSearch /> },
            { label: "Email", content: <EmailSearch /> },
            { label: "Telefone", content: <PhoneSearch /> },
            { label: "Domínio/IP", content: <DomainRecon /> },
            { label: "Cripto", content: <CryptoTrace /> },
            { label: "Grafo", content: <GraphView /> },
            { label: "Casos", content: <CaseManagement /> },
            { label: "Bulk", content: <BulkExplorer /> },
          ]}
        />
      </main>
    </ApiKeyGate>
  );
}
