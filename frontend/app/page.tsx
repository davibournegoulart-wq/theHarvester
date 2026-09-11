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
import ParallaxBackground from "@/components/ParallaxBackground";
import TacticalNav, { NavItem } from "@/components/TacticalNav";
import ToolsPanel from "@/components/ToolsPanel";
import UsernameSearch from "@/components/UsernameSearch";
import OsintArsenal from "@/components/OsintArsenal";
import GlobalOSINT from "@/components/GlobalOSINT";
import TorSpiderTool from "@/components/TorSpiderTool";
import TargetWatchdog from "@/components/TargetWatchdog";
import WebhookManager from "@/components/WebhookManager";
import LocalAIAssistant from "@/components/LocalAIAssistant";
import MetaRecon from "@/components/MetaRecon";
import TelegramRecon from "@/components/TelegramRecon";
import TikTokRecon from "@/components/TikTokRecon";
import VkRecon from "@/components/VkRecon";
import YouTubeRecon from "@/components/YouTubeRecon";
import XRecon from "@/components/XRecon";
import FaceBiometricsRecon from "@/components/FaceBiometricsRecon";
import SocialAnalyticsRecon from "@/components/SocialAnalyticsRecon";
import { ActiveCaseProvider } from "@/lib/activeCase";
import {
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
  VkIcon,
  YouTubeIcon,
  XIcon,
  BarChartIcon,
} from "@/components/FlatIcons";

export default function Home() {
  const navItems: NavItem[] = [
    // 1. INVESTIGATION HUB
    {
      id: "cases",
      label: "CASES",
      hub: "investigation",
      icon: <FolderIcon size={13} />,
      content: <CaseManagement />,
      description: "Manage active investigation cases, dossiers, and evidence files.",
    },
    {
      id: "graph",
      label: "GRAPH",
      hub: "investigation",
      icon: <RadarIcon size={13} />,
      content: <GraphView />,
      description: "Visual link analysis and entity relationship network graph.",
    },
    {
      id: "bulk",
      label: "BULK DATA",
      hub: "investigation",
      icon: <DatabaseIcon size={13} />,
      content: <BulkExplorer />,
      description: "Ingest, query, and search massive scraped datasets.",
    },
    {
      id: "ai",
      label: "LOCAL AI",
      hub: "investigation",
      icon: <TerminalIcon size={13} />,
      content: <LocalAIAssistant />,
      description: "Local Ollama LLM, forensic named-entity extraction, and case dossier synthesis.",
    },

    // 2. IDENTITY & BIOMETRICS HUB
    {
      id: "biometrics",
      label: "BIOMETRICS",
      hub: "identity",
      icon: <EyeIcon size={13} />,
      content: <FaceBiometricsRecon />,
      description: "Facial recognition, reverse image search, and biometrics correlation.",
    },
    {
      id: "username",
      label: "USERNAME",
      hub: "identity",
      icon: <UserIcon size={13} />,
      content: <UsernameSearch />,
      description: "Cross-platform handle enumeration across 500+ sites.",
    },
    {
      id: "email",
      label: "EMAIL",
      hub: "identity",
      icon: <GlobeIcon size={13} />,
      content: <EmailSearch />,
      description: "Breach lookup, deliverability, MX records, and linked accounts.",
    },
    {
      id: "phone",
      label: "PHONE",
      hub: "identity",
      icon: <PhoneIcon size={13} />,
      content: <PhoneSearch />,
      description: "Carrier lookup, line type, country code, and owner profiling.",
    },
    {
      id: "corporate",
      label: "CORPORATE",
      hub: "identity",
      icon: <BuildingIcon size={13} />,
      content: <CorporateSearch />,
      description: "Entity registry, directors, UBOs, SEC filings, and corporate graphs.",
    },
    {
      id: "crypto",
      label: "CRYPTO",
      hub: "identity",
      icon: <BoltIcon size={13} />,
      content: <CryptoTrace />,
      description: "Blockchain address tracing, balance checks, and transaction clustering.",
    },

    // 3. SOCIAL HARVESTERS HUB
    {
      id: "meta",
      label: "META (FB/IG/WA)",
      hub: "social",
      icon: <UserIcon size={13} />,
      content: <MetaRecon />,
      description: "Profile deep scrape, post timelines, and audience metrics.",
    },
    {
      id: "telegram",
      label: "TELEGRAM",
      hub: "social",
      icon: <TerminalIcon size={13} />,
      content: <TelegramRecon />,
      description: "Channels, chats, forward traces, and member intelligence.",
    },
    {
      id: "tiktok",
      label: "TIKTOK",
      hub: "social",
      icon: <CameraIcon size={13} />,
      content: <TikTokRecon />,
      description: "Video metadata, hashtags, sound tracks, and author analytics.",
    },
    {
      id: "vk",
      label: "VKONTAKTE",
      hub: "social",
      icon: <VkIcon size={13} />,
      content: <VkRecon />,
      description: "Russian and CIS social network scrapers and profile mapping.",
    },
    {
      id: "youtube",
      label: "YOUTUBE",
      hub: "social",
      icon: <YouTubeIcon size={13} />,
      content: <YouTubeRecon />,
      description: "Channel audits, video comments, transcripts, and upload history.",
    },
    {
      id: "x",
      label: "X (TWITTER)",
      hub: "social",
      icon: <XIcon size={13} />,
      content: <XRecon />,
      description: "Tweet history, network engagement, bot analysis, and lists.",
    },
    {
      id: "analytics",
      label: "ANALYTICS",
      hub: "social",
      icon: <BarChartIcon size={13} />,
      content: <SocialAnalyticsRecon />,
      description: "Multi-platform sentiment tracking, velocity, and reach analytics.",
    },

    // 4. DEEP WEB & INFRA HUB
    {
      id: "domain",
      label: "DOMAIN/IP",
      hub: "deep",
      icon: <GlobeIcon size={13} />,
      content: <DomainRecon />,
      description: "DNS records, WHOIS, IP geolocation, SSL certificates, and subdomains.",
    },
    {
      id: "geoint",
      label: "GEOLOCATION",
      hub: "deep",
      icon: <MapIcon size={13} />,
      content: <GeoMap />,
      description: "Interactive tactical world map with coordinate clustering.",
    },
    {
      id: "darkweb",
      label: "DARK WEB",
      hub: "deep",
      icon: <ShieldIcon size={13} />,
      content: <DarkWebSearch />,
      description: "Tor onion search engines, paste sites, and leak monitoring.",
    },
    {
      id: "dorks",
      label: "DORKS",
      hub: "deep",
      icon: <TerminalIcon size={13} />,
      content: <DorkEngine />,
      description: "Google, Bing, and DuckDuckGo automated forensic dork generators.",
    },
    {
      id: "spider",
      label: "TOR SPIDER",
      hub: "deep",
      icon: <ShieldIcon size={13} />,
      content: <TorSpiderTool />,
      description: "Automated Tor hidden service spider, crypto address harvesting, and onion graphing.",
    },

    // 5. ARSENAL & ENGINES HUB
    {
      id: "autorecon",
      label: "AUTO-RECON",
      hub: "arsenal",
      icon: <RadarIcon size={13} />,
      content: <AutoReconTool />,
      description: "Automated multi-stage reconnaissance workflow engine.",
    },
    {
      id: "watchdog",
      label: "WATCHDOG",
      hub: "arsenal",
      icon: <RadarIcon size={13} />,
      content: <TargetWatchdog />,
      description: "Scheduled background reconnaissance daemon for automated continuous re-checks.",
    },
    {
      id: "alerts",
      label: "WEBHOOKS",
      hub: "arsenal",
      icon: <TerminalIcon size={13} />,
      content: <WebhookManager />,
      description: "Real-time Discord, Telegram, Slack, and REST alerting webhook dispatch.",
    },
    {
      id: "tools",
      label: "TOOLS PANEL",
      hub: "arsenal",
      icon: <KeyIcon size={13} />,
      content: <ToolsPanel />,
      description: "Direct API keys, CLI modules, and external microservice status.",
    },
    {
      id: "arsenal",
      label: "OSINT ARSENAL",
      hub: "arsenal",
      icon: <ShieldIcon size={13} />,
      content: <OsintArsenal />,
      description: "Curated collection of 100+ external specialized intelligence utilities.",
    },
    {
      id: "global",
      label: "GLOBAL OSINT",
      hub: "arsenal",
      icon: <GlobeIcon size={13} />,
      content: <GlobalOSINT />,
      description: "International public records, sanctions, and maritime tracking.",
    },
  ];

  return (
    <ApiKeyGate>
      <ActiveCaseProvider>
        <ParallaxBackground />
        <main
          style={{
            maxWidth: 1600,
            width: "100%",
            margin: "0 auto",
            padding: "32px 24px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <header
            className="hud-glass-header"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
              marginBottom: 24,
              padding: "16px 24px",
              borderRadius: 12,
            }}
          >
            <div style={{ flex: "1 1 450px", display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  position: "relative",
                  width: 58,
                  height: 58,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "2px solid var(--cyan)",
                  boxShadow: "0 0 16px rgba(5, 217, 232, 0.45), inset 0 0 8px rgba(5, 217, 232, 0.2)",
                  flexShrink: 0,
                  background: "#060812",
                }}
              >
                <img
                  src="/franken_scraper_logo.jpg"
                  alt="Franken-Scraper Logo"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--cyan)",
                    marginBottom: 3,
                    letterSpacing: "0.15em",
                    fontFamily: "monospace",
                  }}
                >
                  {"> SYSTEM ONLINE // FRANKEN_CORE ACTIVE_"}
                </div>
                <h1
                  className="glitch-title"
                  data-text="FRANKEN-SCRAPER"
                  style={{ fontSize: 32, margin: 0, letterSpacing: "0.14em" }}
                >
                  FRANKEN-SCRAPER
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: 12, maxWidth: 600, margin: "3px 0 0 0" }}>
                  OSINT Intelligence Beast — Stitched from Distributed Forensic Scrapers
                </p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <ActiveCaseBanner />
                <InvestigatorLogin />
              </div>
              <EvidenceQuickAdd />
            </div>
          </header>

          <CaseGate>
            <TacticalNav items={navItems} />
          </CaseGate>
        </main>
      </ActiveCaseProvider>
    </ApiKeyGate>
  );
}
