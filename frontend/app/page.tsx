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
import {
  NetScraperLogo,
  FolderIcon,
  EyeIcon,
  UserIcon,
  GlobeIcon,
  PhoneIcon,
  BuildingIcon,
  RadarIcon,
  MapIcon,
  TerminalIcon,
  KeyIcon,
  ShieldIcon,
  CameraIcon,
  BoltIcon,
  DatabaseIcon,
} from "@/components/FlatIcons";

export default function Home() {
  return (
    <ApiKeyGate>
      <ActiveCaseProvider>
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
          <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 40 }}>
            <div style={{ flex: "1 1 500px", display: "flex", alignItems: "center", gap: 16 }}>
              <NetScraperLogo size={48} color="var(--cyan)" />
              <div>
                <div style={{ fontSize: 11, color: "var(--cyan)", marginBottom: 4, letterSpacing: "0.15em", fontFamily: "monospace" }}>
                  {"> SYSTEM ONLINE_"}
                </div>
                <h1 className="glitch-title" data-text="NET SCRAPER" style={{ fontSize: 40, margin: 0 }}>
                  NET SCRAPER
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 600, margin: "4px 0 0 0" }}>
                  OSINT investigation system — internal modules, no embedded third-party tools.
                </p>
              </div>
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
                { label: "CASES", icon: <FolderIcon size={13} />, content: <CaseManagement /> },
                { label: "BIOMETRICS", icon: <EyeIcon size={13} />, content: <FaceBiometricsRecon /> },
                { label: "USERNAME", icon: <UserIcon size={13} />, content: <UsernameSearch /> },
                { label: "EMAIL", icon: <GlobeIcon size={13} />, content: <EmailSearch /> },
                { label: "PHONE", icon: <PhoneIcon size={13} />, content: <PhoneSearch /> },
                { label: "DOMAIN/IP", icon: <GlobeIcon size={13} />, content: <DomainRecon /> },
                { label: "CORPORATE", icon: <BuildingIcon size={13} />, content: <CorporateSearch /> },
                { label: "AUTO-RECON", icon: <RadarIcon size={13} />, content: <AutoReconTool /> },
                { label: "GEOLOCATION", icon: <MapIcon size={13} />, content: <GeoMap /> },
                { label: "DORKS", icon: <TerminalIcon size={13} />, content: <DorkEngine /> },
                { label: "TOOLS", icon: <KeyIcon size={13} />, content: <ToolsPanel /> },
                { label: "ARSENAL", icon: <ShieldIcon size={13} />, content: <OsintArsenal /> },
                { label: "GLOBAL", icon: <GlobeIcon size={13} />, content: <GlobalOSINT /> },
                { label: "META (FB/IG/WA)", icon: <UserIcon size={13} />, content: <MetaRecon /> },
                { label: "TELEGRAM", icon: <TerminalIcon size={13} />, content: <TelegramRecon /> },
                { label: "TIKTOK", icon: <CameraIcon size={13} />, content: <TikTokRecon /> },
                { label: "DARK WEB", icon: <ShieldIcon size={13} />, content: <DarkWebSearch /> },
                { label: "CRYPTO", icon: <BoltIcon size={13} />, content: <CryptoTrace /> },
                { label: "GRAPH", icon: <RadarIcon size={13} />, content: <GraphView /> },
                { label: "BULK", icon: <DatabaseIcon size={13} />, content: <BulkExplorer /> },
              ]}
            />
          </CaseGate>
        </main>
      </ActiveCaseProvider>
    </ApiKeyGate>
  );
}
