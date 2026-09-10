import InvestigatorLogin from "@/components/InvestigatorLogin";
import GeoMap from "@/components/GeoMap";
import AutoReconTool from "@/components/AutoReconTool";
import DarkWebSearch from "@/components/DarkWebSearch";
import ActiveCaseBanner from "@/components/ActiveCaseBanner";
import ApiKeyGate from "@/components/ApiKeyGate";
import BulkExplorer from "@/components/BulkExplorer";
import CaseGate from "@/components/CaseGate";
import CaseManagement from "@/components/CaseManagement";
import CryptoTrace from "@/components/CryptoTrace";
import DomainRecon from "@/components/DomainRecon";
import CorporateSearch from "@/components/CorporateSearch";
import DorkEngine from "@/components/DorkEngine";
import EmailSearch from "@/components/EmailSearch";
import EvidenceQuickAdd from "@/components/EvidenceQuickAdd";
import GraphView from "@/components/GraphView";
import PhoneSearch from "@/components/PhoneSearch";
import Tabs from "@/components/Tabs";
import ToolsPanel from "@/components/ToolsPanel";
import UsernameSearch from "@/components/UsernameSearch";
import OsintArsenal from "@/components/OsintArsenal";
import GlobalOSINT from "@/components/GlobalOSINT";
import MetaRecon from "@/components/MetaRecon";
import TelegramRecon from "@/components/TelegramRecon";
import TikTokRecon from "@/components/TikTokRecon";
import FaceBiometricsRecon from "@/components/FaceBiometricsRecon";
import { ActiveCaseProvider } from "@/lib/activeCase";

export default function Home() {
  return (
    <ApiKeyGate>
      <ActiveCaseProvider>
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
          <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 40 }}>
            <div style={{ flex: "1 1 500px" }}>
              <div style={{ fontSize: 12, color: "var(--cyan)", marginBottom: 8, letterSpacing: "0.1em" }}>
                {"> SYSTEM ONLINE_"}
              </div>
              <h1 className="glitch-title" data-text="NET SCRAPER" style={{ fontSize: 42, margin: 0 }}>
                NET SCRAPER
              </h1>
              <p style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 600 }}>
                OSINT investigation system — internal modules, no embedded third-party tools.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <ActiveCaseBanner />
                <InvestigatorLogin />
              </div>
              <EvidenceQuickAdd />
            </div>
          </header>
          
          <CaseGate>
            <Tabs
              tabs={[
                { label: "CASES", content: <CaseManagement /> },
                { label: "BIOMETRICS", content: <FaceBiometricsRecon /> },
                { label: "USERNAME", content: <UsernameSearch /> },
                { label: "EMAIL", content: <EmailSearch /> },
                { label: "PHONE", content: <PhoneSearch /> },
                { label: "DOMAIN/IP", content: <DomainRecon /> },
                { label: "CORPORATE", content: <CorporateSearch /> },
                { label: "AUTO-RECON", content: <AutoReconTool /> },
                { label: "GEOLOCATION", content: <GeoMap /> },
                { label: "DORKS", content: <DorkEngine /> },
                { label: "TOOLS", content: <ToolsPanel /> },
                { label: "ARSENAL", content: <OsintArsenal /> },
                { label: "GLOBAL", content: <GlobalOSINT /> },
                { label: "META (FB/IG/WA)", content: <MetaRecon /> },
                { label: "TELEGRAM", content: <TelegramRecon /> },
                { label: "TIKTOK", content: <TikTokRecon /> },
                { label: "DARK WEB", content: <DarkWebSearch /> },
                { label: "CRYPTO", content: <CryptoTrace /> },
                { label: "GRAPH", content: <GraphView /> },
                { label: "BULK", content: <BulkExplorer /> },
              ]}
            />
          </CaseGate>
        </main>
      </ActiveCaseProvider>
    </ApiKeyGate>
  );
}
