"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Graph from "graphology";
import { bidirectional } from "graphology-shortest-path/unweighted";
import { useActiveCase } from "@/lib/activeCase";
import { apiGet, apiPostJson, apiPostFormData, API_URL, getApiKey } from "@/lib/api";
import { CheckIcon, CrossIcon, BoltIcon, AlertIcon } from "@/components/FlatIcons";

type NodeData = {
  id: string;
  label: string;
  type: string;
  details?: Record<string, any>;
  degree?: number;
  betweenness?: number;
  closeness?: number;
  community?: number;
  color?: string;
  image?: string;
  size?: number;
};

type EdgeData = {
  source: string;
  target: string;
  relation_type?: string;
  weight?: number;
  label?: string;
  color?: string;
  size?: number;
};

type ViewMode = "active" | "custom" | "all";

type CaseOption = {
  id: string;
  name: string;
  status: string;
};

const NODE_SETTINGS: Record<string, { color: string; size: number; label: string }> = {
  // Case Root Hub
  case: { color: "#05D9E8", size: 24, label: "Case Hub" },

  // Identity & People
  person: { color: "#FF4D4D", size: 18, label: "Person" },
  username: { color: "#00E676", size: 16, label: "Username" },

  // Contact & Comms
  email: { color: "#00B0FF", size: 16, label: "Email" },
  phone: { color: "#FF9100", size: 16, label: "Phone" },
  whatsapp: { color: "#25D366", size: 16, label: "WhatsApp" },
  telegram: { color: "#2AABEE", size: 16, label: "Telegram" },

  // Corporate, Organization & Work
  corporate: { color: "#9C27B0", size: 18, label: "Corporate / CNPJ" },
  company: { color: "#9C27B0", size: 18, label: "Company" },
  enterprise: { color: "#9C27B0", size: 18, label: "Enterprise" },
  partner: { color: "#E040FB", size: 16, label: "Partner / QSA" },
  qsa: { color: "#E040FB", size: 16, label: "QSA Partner" },
  work: { color: "#7C4DFF", size: 16, label: "Work" },
  employment: { color: "#7C4DFF", size: 16, label: "Employment" },

  // Network & Infra
  domain: { color: "#00BCD4", size: 16, label: "Domain" },
  dns: { color: "#00BCD4", size: 15, label: "DNS" },
  ip: { color: "#607D8B", size: 15, label: "IP Address" },

  // Crypto & Financial
  crypto: { color: "#FFD600", size: 16, label: "Crypto Wallet" },
  bitcoin: { color: "#F7931A", size: 16, label: "Bitcoin" },
  ethereum: { color: "#627EEA", size: 16, label: "Ethereum" },

  // Geolocation & Map Pins
  geolocation: { color: "#FF0055", size: 18, label: "Geolocation Pin" },
  location: { color: "#FF0055", size: 18, label: "Location" },

  // Exposed Secrets & Credentials
  secret: { color: "#FF5500", size: 16, label: "Exposed Secret / Key" },

  // Biometrics & Facial Intel
  biometric: { color: "#E040FB", size: 18, label: "Biometric Face" },
  face_crop: { color: "#E040FB", size: 18, label: "Face Crop" },

  // Databank, Files & Documents
  document: { color: "#05D9E8", size: 16, label: "Document / PDF" },
  file: { color: "#05D9E8", size: 15, label: "Databank File" },
  dork_dump: { color: "#FF2A6D", size: 16, label: "Dork Web Dump" },
  evidence: { color: "#00FF9F", size: 16, label: "Preserved Evidence" },
  image: { color: "#FFAB00", size: 16, label: "Image Asset" },
  audio_video: { color: "#A259FF", size: 16, label: "Audio / Video" },

  // Social Platforms
  facebook: { color: "#1877F2", size: 16, label: "Facebook" },
  instagram: { color: "#E4405F", size: 16, label: "Instagram" },
  twitter: { color: "#1DA1F2", size: 16, label: "Twitter / X" },
  x: { color: "#FFFFFF", size: 16, label: "X" },
  tiktok: { color: "#FE2C55", size: 16, label: "TikTok" },
  github: { color: "#F0F6FC", size: 16, label: "GitHub" },
  linkedin: { color: "#0A66C2", size: 16, label: "LinkedIn" },
  reddit: { color: "#FF4500", size: 16, label: "Reddit" },
  youtube: { color: "#FF0000", size: 16, label: "YouTube" },

  // System default
  default: { color: "#05D9E8", size: 14, label: "Entity" },
};

const EDGE_COLORS: Record<string, string> = {
  investigates: "#05D9E8",
  has_account: "#00E676",
  located_at: "#FF0055",
  located_document: "#FF0055",
  attached_file: "#05D9E8",
  attached_link: "#00FF9F",
  evidence_saved: "#00FF9F",
  evidence_url: "#00FF9F",
  exposed_secret: "#FF5500",
  biometric_match: "#E040FB",
  cross_case_match: "#FF2A6D",
  default: "#445566",
};

interface SimNode extends NodeData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  nodeColor: string;
  targetX?: number;
  targetY?: number;
  treeLevel?: number;
  branchId?: number;
}

function drawNodeIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  n: SimNode,
  isDimmed: boolean
) {
  if (r < 6) return;

  const t = (n.type || "").toLowerCase();
  const label = (n.label || "").toLowerCase();
  const id = (n.id || "").toLowerCase();

  ctx.save();
  ctx.fillStyle = isDimmed ? "#445566" : "#FFFFFF";
  ctx.strokeStyle = isDimmed ? "#445566" : "#FFFFFF";
  ctx.lineWidth = Math.max(1.3, r * 0.09);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const iconR = r * 0.52;

  // 1. CASE (5-Pointed Star)
  if (t === "case" || id.startsWith("case:")) {
    ctx.beginPath();
    const spikes = 5;
    const outerR = iconR * 1.1;
    const innerR = outerR * 0.44;
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerR;
      y = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  // 2. INSTAGRAM (Camera Vector)
  if (t === "instagram" || label.includes("instagram") || id.includes("instagram")) {
    const s = iconR * 1.45;
    const half = s / 2;
    const cornerR = s * 0.28;
    ctx.beginPath();
    ctx.roundRect(cx - half, cy - half, s, s, cornerR);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + s * 0.26, cy - s * 0.26, Math.max(1.2, s * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // 3. TELEPHONE / PHONE
  if (t === "phone" || label.startsWith("+") || /^\+?\d[\d\s-]{7,}/.test(label)) {
    const s = iconR * 1.35;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    ctx.beginPath();
    ctx.roundRect(-s * 0.42, -s * 0.4, s * 0.28, s * 0.22, 2);
    ctx.roundRect(s * 0.14, -s * 0.4, s * 0.28, s * 0.22, 2);
    ctx.roundRect(-s * 0.38, -s * 0.24, s * 0.76, s * 0.14, 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    return;
  }

  // 4. TELECOM / NETWORK / C2 (Radio Tower / Antenna)
  if (label.includes("telecom") || id.includes("telecom") || t === "telecom" || t === "carrier" || t === "c2") {
    const h = iconR * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.55);
    ctx.lineTo(cx - h * 0.38, cy + h * 0.5);
    ctx.moveTo(cx, cy - h * 0.55);
    ctx.lineTo(cx + h * 0.38, cy + h * 0.5);
    ctx.moveTo(cx - h * 0.18, cy - h * 0.05);
    ctx.lineTo(cx + h * 0.18, cy - h * 0.05);
    ctx.moveTo(cx - h * 0.3, cy + h * 0.28);
    ctx.lineTo(cx + h * 0.3, cy + h * 0.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.62, Math.max(1.5, h * 0.1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // 5. WEB / DOMAIN / URL (Globe Vector)
  if (label.includes("web") || t === "web" || t === "domain" || t === "dns" || label.includes(".com") || label.includes(".org") || label.includes(".net") || label.includes(".io")) {
    const s = iconR * 1.25;
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s, cy);
    ctx.lineTo(cx + s, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.45, s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 6. PERSON / USERNAME / SUSPECT
  if (t === "person" || t === "username" || t === "target" || t === "suspect" || (!label.startsWith("@") && !label.includes(".") && !label.startsWith("+"))) {
    const headR = iconR * 0.4;
    const headY = cy - iconR * 0.35;
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    const bodyW = iconR * 1.35;
    const bodyH = iconR * 0.75;
    const bodyY = cy + iconR * 0.2;
    ctx.beginPath();
    ctx.ellipse(cx, bodyY + bodyH * 0.4, bodyW / 2, bodyH / 2, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // 7. EMAIL (Envelope Vector)
  if (t === "email" || (label.includes("@") && label.includes("."))) {
    const w = iconR * 1.5;
    const h = iconR * 1.0;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy - h / 2);
    ctx.lineTo(cx, cy + h * 0.15);
    ctx.lineTo(cx + w / 2, cy - h / 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 8. CRYPTO / BITCOIN
  if (t === "crypto" || t === "bitcoin" || label.startsWith("bc1") || label.startsWith("1") || label.startsWith("0x")) {
    ctx.font = `bold ${Math.floor(r * 0.85)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("₿", cx, cy);
    ctx.restore();
    return;
  }

  // 9. WHATSAPP
  if (t === "whatsapp" || label.includes("whatsapp")) {
    const s = iconR * 1.25;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `bold ${Math.floor(r * 0.55)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("WA", cx, cy);
    ctx.restore();
    return;
  }

  // 10. TELEGRAM
  if (t === "telegram" || label.includes("telegram")) {
    const s = iconR * 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.6, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.7, cy - s * 0.5);
    ctx.lineTo(cx - s * 0.2, cy + s * 0.6);
    ctx.lineTo(cx - s * 0.1, cy + s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  // 11. LOCATION / GPS PIN
  if (t === "geolocation" || t === "location") {
    const s = iconR * 1.3;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.25, s * 0.5, Math.PI, 0);
    ctx.lineTo(cx, cy + s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.25, s * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = isDimmed ? "#121724" : n.nodeColor;
    ctx.fill();
    ctx.restore();
    return;
  }

  // 12. CORPORATE / COMPANY
  if (t === "corporate" || t === "company" || t === "enterprise") {
    const w = iconR * 1.4;
    const h = iconR * 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 2);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    const dotS = w * 0.14;
    for (let dy = -0.3; dy <= 0.2; dy += 0.25) {
      for (let dx = -0.25; dx <= 0.25; dx += 0.5) {
        ctx.fillRect(cx + dx * w - dotS / 2, cy + dy * h - dotS / 2, dotS, dotS);
      }
    }
    ctx.restore();
    return;
  }

  // 13. SECRET / CREDENTIAL
  if (t === "secret" || t === "password" || t === "credential") {
    const s = iconR * 1.2;
    ctx.beginPath();
    ctx.arc(cx - s * 0.3, cy, s * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.05, cy);
    ctx.lineTo(cx + s * 0.7, cy);
    ctx.moveTo(cx + s * 0.45, cy);
    ctx.lineTo(cx + s * 0.45, cy + s * 0.25);
    ctx.moveTo(cx + s * 0.65, cy);
    ctx.lineTo(cx + s * 0.65, cy + s * 0.2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Default: Forensic Diamond
  ctx.beginPath();
  ctx.moveTo(cx, cy - iconR * 0.6);
  ctx.lineTo(cx + iconR * 0.6, cy);
  ctx.lineTo(cx, cy + iconR * 0.6);
  ctx.lineTo(cx - iconR * 0.6, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- LAYOUT ENGINES ---
type LayoutMode = "mindmap" | "force" | "radial";

// Typology branching configuration for MindMeister layout
// Left side: Documents, Evidence, Dorks, Financial, Geo
// Right side: Comms/Phones, Identity/Accounts, Web/Infra
const MINDMAP_BRANCHES: {
  side: "right" | "left";
  title: string;
  types: string[];
}[] = [
  {
    side: "right",
    title: "Comms & Telecom",
    types: ["phone", "whatsapp", "telegram", "email", "carrier", "telecom"],
  },
  {
    side: "right",
    title: "Identity & Accounts",
    types: [
      "username",
      "person",
      "cpf",
      "instagram",
      "facebook",
      "twitter",
      "x",
      "tiktok",
      "github",
      "linkedin",
      "reddit",
      "youtube",
    ],
  },
  {
    side: "right",
    title: "Web, Domains & Infra",
    types: ["domain", "dns", "ip", "c2", "web", "host"],
  },
  {
    side: "left",
    title: "Documents & Evidence",
    types: ["document", "file", "dork_dump", "evidence", "image", "audio_video", "secret"],
  },
  {
    side: "left",
    title: "Financial & Corporate",
    types: ["corporate", "company", "enterprise", "partner", "qsa", "work", "employment", "crypto", "bitcoin", "ethereum"],
  },
  {
    side: "left",
    title: "Locations & Biometrics",
    types: ["geolocation", "location", "biometric", "face_crop"],
  },
];

function computeMindMeisterPositions(
  nodes: NodeData[],
  edges: EdgeData[]
): Map<string, { x: number; y: number; level: number; branchId: number }> {
  const result = new Map<string, { x: number; y: number; level: number; branchId: number }>();
  if (!nodes || nodes.length === 0) return result;

  // Find root node (case or highest degree node)
  const rootNode = nodes.find((n) => (n.type || "").toLowerCase() === "case") || nodes[0];
  result.set(rootNode.id, { x: 0, y: 0, level: 0, branchId: -1 });

  // Adjacency graph
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  }

  // Map each non-root node to one of the 6 branches
  function getBranchIndex(n: NodeData): number {
    const t = (n.type || "").toLowerCase();
    for (let bi = 0; bi < MINDMAP_BRANCHES.length; bi++) {
      if (MINDMAP_BRANCHES[bi].types.includes(t)) return bi;
    }
    // Default: split between right (1) and left (3)
    return (n.id.charCodeAt(0) % 2 === 0) ? 1 : 3;
  }

  // Collect branch buckets
  const branchNodes: NodeData[][] = Array.from({ length: 6 }, () => []);
  for (const n of nodes) {
    if (n.id === rootNode.id) continue;
    const bIdx = getBranchIndex(n);
    branchNodes[bIdx].push(n);
  }

  // Level 1 and sub-levels
  // Separate left vs right branches
  const rightBranchIndices = [0, 1, 2];
  const leftBranchIndices = [3, 4, 5];

  function layoutBranchGroup(indices: number[], sideSign: number) {
    let currentY = -((indices.length - 1) * 90);

    for (const bIdx of indices) {
      const bMembers = branchNodes[bIdx];
      const branchInfo = MINDMAP_BRANCHES[bIdx];

      // Identify primary level-1 nodes vs child level-2 nodes
      // Level 1 nodes are either attached to root or have direct edges
      const level1: NodeData[] = [];
      const level2: NodeData[] = [];

      for (const m of bMembers) {
        const neighbors = adj.get(m.id) || [];
        const isChildOfOtherMember = neighbors.some(
          (nbr) => bMembers.some((bm) => bm.id === nbr && bm.id !== m.id) && !neighbors.includes(rootNode.id)
        );
        // Special case: attached files or attached links to another node in same branch are Level 2
        const isAttachedToOther = edges.some(
          (e) => (e.target === m.id && (e.relation_type === "attached_file" || e.relation_type === "attached_link" || e.relation_type === "has_account"))
        );

        if (isChildOfOtherMember || isAttachedToOther) {
          level2.push(m);
        } else {
          level1.push(m);
        }
      }

      // If everything fell into level2, promote the first few to level1
      if (level1.length === 0 && bMembers.length > 0) {
        level1.push(...bMembers.slice(0, Math.ceil(bMembers.length / 2)));
        level2.push(...bMembers.slice(Math.ceil(bMembers.length / 2)));
      }

      const l1Spacing = 65;
      const branchHeight = Math.max(80, (level1.length + level2.length) * 35);
      const startL1Y = currentY - ((level1.length - 1) * l1Spacing) / 2;

      level1.forEach((node, i) => {
        const ny = startL1Y + i * l1Spacing;
        const nx = sideSign * 240;
        result.set(node.id, { x: nx, y: ny, level: 1, branchId: bIdx });

        // Find children of this level1 node
        const children = level2.filter((c) => {
          const neighbors = adj.get(c.id) || [];
          return neighbors.includes(node.id);
        });

        const childSpacing = 44;
        const startChildY = ny - ((children.length - 1) * childSpacing) / 2;
        children.forEach((child, ci) => {
          if (!result.has(child.id)) {
            result.set(child.id, {
              x: sideSign * 460,
              y: startChildY + ci * childSpacing,
              level: 2,
              branchId: bIdx,
            });
          }
        });
      });

      // Place any leftover level2 nodes
      level2.forEach((child, ci) => {
        if (!result.has(child.id)) {
          result.set(child.id, {
            x: sideSign * 460,
            y: currentY + ci * 44,
            level: 2,
            branchId: bIdx,
          });
        }
      });

      currentY += branchHeight + 50;
    }
  }

  layoutBranchGroup(rightBranchIndices, 1);
  layoutBranchGroup(leftBranchIndices, -1);

  return result;
}

function computeRadialPositions(nodes: NodeData[]): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (!nodes || nodes.length === 0) return result;

  const rootNode = nodes.find((n) => (n.type || "").toLowerCase() === "case") || nodes[0];
  result.set(rootNode.id, { x: 0, y: 0 });

  const others = nodes.filter((n) => n.id !== rootNode.id);
  const total = others.length;
  others.forEach((n, idx) => {
    const angle = (idx / Math.max(1, total)) * 2 * Math.PI;
    const ring = 160 + (idx % 3) * 90;
    result.set(n.id, {
      x: Math.cos(angle) * ring,
      y: Math.sin(angle) * ring,
    });
  });

  return result;
}

interface CanvasGraphProps {
  nodes: NodeData[];
  edges: EdgeData[];
  selectedNodes: string[];
  onSelectNode: (id: string) => void;
  onClearSelection: () => void;
  shortestPath: string[] | null;
  onInspectNode: (id: string | null) => void;
  layoutMode: LayoutMode;
  attachedNodeIds: Set<string>;
}

function CanvasGraph({
  nodes,
  edges,
  selectedNodes,
  onSelectNode,
  onClearSelection,
  shortestPath,
  onInspectNode,
  layoutMode,
  attachedNodeIds,
}: CanvasGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const simNodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<EdgeData[]>(edges);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });

  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const isDraggingNodeRef = useRef<SimNode | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const dragDistanceRef = useRef(0);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Sync edges ref
  edgesRef.current = edges;

  const fitToNodes = useCallback(() => {
    if (!containerRef.current || simNodesRef.current.length === 0) return;
    const { clientWidth: width, clientHeight: height } = containerRef.current;
    if (width === 0 || height === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of simNodesRef.current) {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }

    const padding = 80;
    const spanX = Math.max(120, (maxX - minX) + padding * 2);
    const spanY = Math.max(120, (maxY - minY) + padding * 2);
    const zoom = Math.min(width / spanX, height / spanY, 1.3);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    cameraRef.current = {
      x: width / 2 - centerX * zoom,
      y: height / 2 - centerY * zoom,
      zoom: Math.max(0.35, zoom),
    };
  }, []);

  // Initialize or update simulation nodes with computed layout targets
  useEffect(() => {
    if (!nodes || nodes.length === 0) {
      simNodesRef.current = [];
      return;
    }

    const prevMap = new Map<string, SimNode>();
    for (const n of simNodesRef.current) {
      prevMap.set(n.id, n);
    }

    // Compute MindMeister or Radial targets if active
    let mindmapTargets = new Map<string, { x: number; y: number; level: number; branchId: number }>();
    let radialTargets = new Map<string, { x: number; y: number }>();

    if (layoutMode === "mindmap") {
      mindmapTargets = computeMindMeisterPositions(nodes, edges);
    } else if (layoutMode === "radial") {
      radialTargets = computeRadialPositions(nodes);
    }

    const newSimNodes: SimNode[] = nodes.map((n, idx) => {
      let cleanId = n.id;
      if (cleanId.startsWith("[")) {
        const cidx = cleanId.indexOf("] ");
        if (cidx !== -1) cleanId = cleanId.substring(cidx + 2);
      }

      let detectedType = (n.type || "default").toLowerCase();
      let displayLabel = n.label || cleanId;

      if (cleanId.includes(":") && !NODE_SETTINGS[detectedType]) {
        const colonIdx = cleanId.indexOf(":");
        const prefixType = cleanId.substring(0, colonIdx).toLowerCase().trim();
        const valuePart = cleanId.substring(colonIdx + 1).trim();
        if (NODE_SETTINGS[prefixType]) {
          detectedType = prefixType;
        }
        if (!n.label) displayLabel = valuePart;
      }

      const st = NODE_SETTINGS[detectedType] || NODE_SETTINGS.default;
      const prev = prevMap.get(n.id);

      // Default radial start position
      const angle = (idx / Math.max(1, nodes.length)) * 2 * Math.PI;
      const r = detectedType === "case" ? 0 : 130 + (idx % 4) * 55;
      const defaultInitX = detectedType === "case" ? 0 : Math.cos(angle) * r;
      const defaultInitY = detectedType === "case" ? 0 : Math.sin(angle) * r;

      const mmTarget = mindmapTargets.get(n.id);
      const radTarget = radialTargets.get(n.id);

      const targetX = mmTarget ? mmTarget.x : (radTarget ? radTarget.x : undefined);
      const targetY = mmTarget ? mmTarget.y : (radTarget ? radTarget.y : undefined);

      const initX = prev ? prev.x : (targetX !== undefined ? targetX : defaultInitX);
      const initY = prev ? prev.y : (targetY !== undefined ? targetY : defaultInitY);

      return {
        ...n,
        label: displayLabel,
        type: detectedType,
        x: initX,
        y: initY,
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0,
        targetX,
        targetY,
        treeLevel: mmTarget?.level,
        branchId: mmTarget?.branchId,
        radius: n.size || st.size || 16,
        nodeColor: n.color || st.color || "#05D9E8",
      };
    });

    simNodesRef.current = newSimNodes;

    // Trigger auto-fit to frame newly loaded or rearranged nodes
    setTimeout(() => {
      fitToNodes();
    }, 60);
  }, [nodes, edges, layoutMode, fitToNodes]);

  // Main Physics and Render Animation Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function step() {
      const container = containerRef.current;
      if (!container || !canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(step);
        return;
      }

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. PHYSICS SIMULATION / LAYOUT GLIDE
      const simNodes = simNodesRef.current;
      const simEdges = edgesRef.current;
      const nodeMap = new Map<string, SimNode>();
      for (const n of simNodes) nodeMap.set(n.id, n);

      if (simNodes.length > 0 && !isDraggingNodeRef.current) {
        if (layoutMode === "mindmap") {
          // MindMeister layout: smooth lerp to target positions with light repulsion to prevent overlap
          for (const n of simNodes) {
            if (n.targetX !== undefined && n.targetY !== undefined) {
              const dx = n.targetX - n.x;
              const dy = n.targetY - n.y;
              n.vx = dx * 0.15;
              n.vy = dy * 0.15;
            }
          }
          // Micro-repulsion to prevent labels from colliding
          for (let i = 0; i < simNodes.length; i++) {
            for (let j = i + 1; j < simNodes.length; j++) {
              const n1 = simNodes[i];
              const n2 = simNodes[j];
              const dx = n1.x - n2.x;
              const dy = n1.y - n2.y;
              const dist2 = dx * dx + dy * dy;
              if (dist2 < 900 && dist2 > 0) {
                const dist = Math.sqrt(dist2);
                const push = (30 - dist) * 0.05;
                n1.y += (dy / dist) * push;
                n2.y -= (dy / dist) * push;
              }
            }
          }
          for (const n of simNodes) {
            n.x += n.vx;
            n.y += n.vy;
          }
        } else if (layoutMode === "radial") {
          // Radial Orbit layout: glide to circular orbits
          for (const n of simNodes) {
            if (n.targetX !== undefined && n.targetY !== undefined) {
              const dx = n.targetX - n.x;
              const dy = n.targetY - n.y;
              n.vx = dx * 0.12;
              n.vy = dy * 0.12;
            }
            n.x += n.vx;
            n.y += n.vy;
          }
        } else {
          // Organic Force-Directed Simulation
          const kRepel = 7500;
          for (let i = 0; i < simNodes.length; i++) {
            for (let j = i + 1; j < simNodes.length; j++) {
              const n1 = simNodes[i];
              const n2 = simNodes[j];
              let dx = n1.x - n2.x;
              let dy = n1.y - n2.y;
              let d2 = dx * dx + dy * dy;
              if (d2 < 1) {
                dx = (Math.random() - 0.5) * 4;
                dy = (Math.random() - 0.5) * 4;
                d2 = 4;
              }
              const dist = Math.sqrt(d2);
              if (dist < 600) {
                const force = kRepel / (d2 + 100);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                n1.vx += fx;
                n1.vy += fy;
                n2.vx -= fx;
                n2.vy -= fy;
              }
            }
          }

          // Edge spring attraction
          const kSpring = 0.025;
          const idealDist = 175;
          for (const e of simEdges) {
            const n1 = nodeMap.get(e.source);
            const n2 = nodeMap.get(e.target);
            if (!n1 || !n2) continue;
            let dx = n2.x - n1.x;
            let dy = n2.y - n1.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1) dist = 1;
            const force = (dist - idealDist) * kSpring;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            n1.vx += fx;
            n1.vy += fy;
            n2.vx -= fx;
            n2.vy -= fy;
          }

          // Gentle centering gravity & velocity damping
          for (const n of simNodes) {
            n.vx -= n.x * 0.012;
            n.vy -= n.y * 0.012;
            n.vx *= 0.84;
            n.vy *= 0.84;
            n.x += n.vx;
            n.y += n.vy;
          }
        }
      }

      // 2. CANVAS DRAWING
      const cam = cameraRef.current;

      // Background clear
      ctx.fillStyle = "#060812";
      ctx.fillRect(0, 0, width, height);

      // Subtle cyber grid
      ctx.strokeStyle = "rgba(5, 217, 232, 0.04)";
      ctx.lineWidth = 1;
      const gridSize = 40 * cam.zoom;
      const startX = (cam.x % gridSize);
      const startY = (cam.y % gridSize);
      ctx.beginPath();
      for (let gx = startX; gx < width; gx += gridSize) {
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
      }
      for (let gy = startY; gy < height; gy += gridSize) {
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
      }
      ctx.stroke();

      const hasSelection = selectedNodes.length > 0 || (shortestPath && shortestPath.length > 0);
      const pathSet = new Set(shortestPath || selectedNodes);

      // Transform helper
      function toScreen(x: number, y: number) {
        return {
          x: x * cam.zoom + cam.x,
          y: y * cam.zoom + cam.y,
        };
      }

      // 3. DRAW EDGES
      const pairIndexMap = new Map<string, number>();

      for (const e of simEdges) {
        const n1 = nodeMap.get(e.source);
        const n2 = nodeMap.get(e.target);
        if (!n1 || !n2) continue;

        const p1 = toScreen(n1.x, n1.y);
        const p2 = toScreen(n2.x, n2.y);

        const pairKey = [e.source, e.target].sort().join("---");
        const edgeIdx = pairIndexMap.get(pairKey) || 0;
        pairIndexMap.set(pairKey, edgeIdx + 1);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const offsetDist = edgeIdx === 0 ? 0 : (edgeIdx % 2 === 1 ? 1 : -1) * Math.ceil(edgeIdx / 2) * 22;

        const midX = (p1.x + p2.x) / 2 + nx * offsetDist;
        const midY = (p1.y + p2.y) / 2 + ny * offsetDist;

        // Check if edge is in shortest path
        let isPathEdge = false;
        if (shortestPath && shortestPath.length > 1) {
          for (let pi = 0; pi < shortestPath.length - 1; pi++) {
            if (
              (shortestPath[pi] === e.source && shortestPath[pi + 1] === e.target) ||
              (shortestPath[pi] === e.target && shortestPath[pi + 1] === e.source)
            ) {
              isPathEdge = true;
              break;
            }
          }
        }

        const isDimmed = hasSelection && !isPathEdge && !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target);

        ctx.save();
        if (isPathEdge) {
          ctx.strokeStyle = "#05D9E8";
          ctx.lineWidth = 3.5;
          ctx.shadowColor = "#05D9E8";
          ctx.shadowBlur = 12;
        } else if (isDimmed) {
          ctx.strokeStyle = "rgba(20, 30, 48, 0.4)";
          ctx.lineWidth = 1;
        } else {
          const relColor = EDGE_COLORS[e.relation_type || "default"] || EDGE_COLORS.default;
          ctx.strokeStyle = e.relation_type === "cross_case_match" ? "#FF2A6D" : relColor;
          ctx.lineWidth = (e.size || 1.5) * Math.max(0.8, cam.zoom * 0.7);
        }

        // Draw line: MindMeister smooth cubic Bezier vs standard arc/line
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        if (layoutMode === "mindmap") {
          // MindMeister-style horizontal S-curve cubic Bezier
          const cpDist = Math.max(40, Math.abs(p2.x - p1.x) * 0.5);
          const cp1x = p1.x + (p2.x >= p1.x ? cpDist : -cpDist);
          const cp1y = p1.y;
          const cp2x = p2.x + (p2.x >= p1.x ? -cpDist : cpDist);
          const cp2y = p2.y;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        } else if (edgeIdx === 0) {
          ctx.lineTo(p2.x, p2.y);
        } else {
          ctx.quadraticCurveTo(midX, midY, p2.x, p2.y);
        }
        ctx.stroke();

        // Draw arrow towards target
        let angle: number;
        if (layoutMode === "mindmap") {
          angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        } else if (edgeIdx === 0) {
          angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        } else {
          angle = Math.atan2(p2.y - midY, p2.x - midX);
        }

        const targetRadius = (n2.radius || 15) * cam.zoom;
        const arrowX = p2.x - Math.cos(angle) * (targetRadius + 3);
        const arrowY = p2.y - Math.sin(angle) * (targetRadius + 3);
        const arrowSize = 6 * Math.max(0.7, cam.zoom * 0.6);

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
          arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
          arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();

        // Edge label pill at midpoint (if not dimmed and zoom > 0.65)
        if (!isDimmed && cam.zoom > 0.65) {
          const labelText = (e.label || e.relation_type || "link").replace(/_/g, " ");

          ctx.font = "9px system-ui, sans-serif";
          const textWidth = ctx.measureText(labelText).width;
          const pillW = textWidth + 8;
          const pillH = 14;

          const labelCenterX = layoutMode === "mindmap" ? (p1.x + p2.x) / 2 : midX;
          const labelCenterY = layoutMode === "mindmap" ? (p1.y + p2.y) / 2 : midY;

          ctx.fillStyle = "rgba(6, 8, 18, 0.9)";
          ctx.strokeStyle = isPathEdge ? "#05D9E8" : "rgba(255, 255, 255, 0.12)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(labelCenterX - pillW / 2, labelCenterY - pillH / 2, pillW, pillH, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isPathEdge ? "#05D9E8" : "#8899aa";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(labelText, labelCenterX, labelCenterY);
        }

        ctx.restore();
      }

      // 4. DRAW NODES
      for (const n of simNodes) {
        const p = toScreen(n.x, n.y);
        const r = (n.radius || 15) * cam.zoom;
        const isSelected = selectedNodes.includes(n.id);
        const isPathNode = pathSet.has(n.id);
        const isDimmed = hasSelection && !isSelected && !isPathNode;
        const isHovered = hoveredNode?.id === n.id;
        const hasAttachment = attachedNodeIds.has(n.id);

        ctx.save();

        // Outer glow
        if (isSelected || isPathNode) {
          ctx.shadowColor = "#05D9E8";
          ctx.shadowBlur = 18;
        } else if (!isDimmed) {
          ctx.shadowColor = n.nodeColor;
          ctx.shadowBlur = isHovered ? 20 : 10;
        }

        // Node filled circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        if (isDimmed) {
          ctx.fillStyle = "#121724";
          ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        } else {
          ctx.fillStyle = n.nodeColor;
          ctx.strokeStyle = isSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.6)";
        }
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Selection ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "#05D9E8";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Inner visual: Miniature circular photo/avatar if image exists, otherwise drawNodeIcon vector symbol
        const nodeImgUrl = n.image || n.details?.image;
        let imageDrawn = false;

        if (nodeImgUrl && r >= 8) {
          let fullImgUrl = nodeImgUrl.startsWith("http") ? nodeImgUrl : `${API_URL}${nodeImgUrl}`;
          if (!fullImgUrl.includes("api_key=")) {
            const sep = fullImgUrl.includes("?") ? "&" : "?";
            fullImgUrl += `${sep}api_key=${encodeURIComponent(getApiKey())}`;
          }
          let img = imageCacheRef.current.get(fullImgUrl);
          if (!img) {
            img = new Image();
            img.crossOrigin = "anonymous";
            img.src = fullImgUrl;
            img.onload = () => {
              // Image loaded; next animation frame will render it
            };
            imageCacheRef.current.set(fullImgUrl, img);
          } else if (img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(1, r - 1.5), 0, Math.PI * 2);
            ctx.clip();
            if (isDimmed) {
              ctx.globalAlpha = 0.35;
            }
            ctx.drawImage(img, p.x - r, p.y - r, r * 2, r * 2);
            ctx.restore();
            imageDrawn = true;
          }
        }

        if (!imageDrawn) {
          // Inner vector intelligence icon / symbol
          drawNodeIcon(ctx, p.x, p.y, r, n, Boolean(isDimmed));
        }

        // Paperclip Badge if node has direct attached files or external Dork URLs
        if (hasAttachment && !isDimmed) {
          const badgeR = Math.max(7, r * 0.42);
          const badgeX = p.x + r * 0.72;
          const badgeY = p.y - r * 0.72;

          ctx.save();
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
          ctx.fillStyle = "#060812";
          ctx.strokeStyle = "#05D9E8";
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "#05D9E8";
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.stroke();

          ctx.font = `${Math.round(badgeR * 1.3)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("📎", badgeX, badgeY);
          ctx.restore();
        }

        // Node label below
        if (!isDimmed || isHovered) {
          const labelText = n.label || n.id;
          ctx.font = `${isHovered ? "bold " : ""}11px system-ui, sans-serif`;
          const textMetrics = ctx.measureText(labelText);
          const lw = textMetrics.width + 10;
          const lh = 18;
          const ly = p.y + r + 12;

          ctx.fillStyle = isSelected ? "rgba(5, 217, 232, 0.25)" : "rgba(6, 8, 18, 0.88)";
          ctx.strokeStyle = isSelected ? "#05D9E8" : "rgba(5, 217, 232, 0.25)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(p.x - lw / 2, ly - lh / 2, lw, lh, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isSelected ? "#05D9E8" : "#d6f3ff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(labelText, p.x, ly);
        }

        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(step);
    }

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [selectedNodes, shortestPath, hoveredNode, layoutMode, attachedNodeIds]);

  // Mouse Interaction Handlers
  function getMouseWorldPos(e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, screenX: 0, screenY: 0 };
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const cam = cameraRef.current;
    return {
      x: (clientX - cam.x) / cam.zoom,
      y: (clientY - cam.y) / cam.zoom,
      screenX: clientX,
      screenY: clientY,
    };
  }

  function findNodeAt(worldX: number, worldY: number): SimNode | null {
    for (let i = simNodesRef.current.length - 1; i >= 0; i--) {
      const n = simNodesRef.current[i];
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      const hitRadius = (n.radius + 6);
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return n;
      }
    }
    return null;
  }

  function handleMouseDown(e: React.MouseEvent) {
    const pos = getMouseWorldPos(e);
    dragDistanceRef.current = 0;
    const node = findNodeAt(pos.x, pos.y);

    if (node) {
      isDraggingNodeRef.current = node;
      node.vx = 0;
      node.vy = 0;
    } else {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const pos = getMouseWorldPos(e);
    mousePosRef.current = { x: pos.screenX, y: pos.screenY };

    if (isDraggingNodeRef.current) {
      dragDistanceRef.current += Math.abs(e.movementX) + Math.abs(e.movementY);
      isDraggingNodeRef.current.x = pos.x;
      isDraggingNodeRef.current.y = pos.y;
      isDraggingNodeRef.current.vx = 0;
      isDraggingNodeRef.current.vy = 0;
      return;
    }

    if (isPanningRef.current) {
      dragDistanceRef.current += Math.abs(e.movementX) + Math.abs(e.movementY);
      cameraRef.current.x += e.movementX;
      cameraRef.current.y += e.movementY;
      return;
    }

    // Hover state
    const node = findNodeAt(pos.x, pos.y);
    setHoveredNode(node);
  }

  function handleMouseUp(e: React.MouseEvent) {
    const pos = getMouseWorldPos(e);
    const wasDraggingNode = isDraggingNodeRef.current;

    isDraggingNodeRef.current = null;
    isPanningRef.current = false;

    // Check if it was a click (not a pan/drag)
    if (dragDistanceRef.current < 6) {
      const node = wasDraggingNode || findNodeAt(pos.x, pos.y);
      if (node) {
        onSelectNode(node.id);
        onInspectNode(node.id);
      } else {
        onClearSelection();
        onInspectNode(null);
      }
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cam = cameraRef.current;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(3.5, Math.max(0.2, cam.zoom * zoomFactor));

    // Zoom centered around mouse position
    cam.x = mouseX - (mouseX - cam.x) * (newZoom / cam.zoom);
    cam.y = mouseY - (mouseY - cam.y) * (newZoom / cam.zoom);
    cam.zoom = newZoom;
  }

  function handleZoomIn() {
    const cam = cameraRef.current;
    if (!containerRef.current) return;
    const cx = containerRef.current.clientWidth / 2;
    const cy = containerRef.current.clientHeight / 2;
    const newZoom = Math.min(3.5, cam.zoom * 1.3);
    cam.x = cx - (cx - cam.x) * (newZoom / cam.zoom);
    cam.y = cy - (cy - cam.y) * (newZoom / cam.zoom);
    cam.zoom = newZoom;
  }

  function handleZoomOut() {
    const cam = cameraRef.current;
    if (!containerRef.current) return;
    const cx = containerRef.current.clientWidth / 2;
    const cy = containerRef.current.clientHeight / 2;
    const newZoom = Math.max(0.2, cam.zoom * 0.77);
    cam.x = cx - (cx - cam.x) * (newZoom / cam.zoom);
    cam.y = cy - (cy - cam.y) * (newZoom / cam.zoom);
    cam.zoom = newZoom;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        cursor: hoveredNode ? "pointer" : isPanningRef.current ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

      {/* Zoom / Camera Controls Overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          zIndex: 10,
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          style={{
            width: 32,
            height: 32,
            background: "rgba(10, 14, 24, 0.9)",
            color: "var(--cyan)",
            border: "1px solid var(--cyan)",
            borderRadius: 4,
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 8px rgba(5,217,232,0.2)",
          }}
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          style={{
            width: 32,
            height: 32,
            background: "rgba(10, 14, 24, 0.9)",
            color: "var(--cyan)",
            border: "1px solid var(--cyan)",
            borderRadius: 4,
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 8px rgba(5,217,232,0.2)",
          }}
          title="Zoom Out"
        >
          -
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); fitToNodes(); }}
          style={{
            width: 32,
            height: 32,
            background: "rgba(10, 14, 24, 0.9)",
            color: "var(--cyan)",
            border: "1px solid var(--cyan)",
            borderRadius: 4,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 8px rgba(5,217,232,0.2)",
          }}
          title="Fit View / Center All Nodes"
        >
          🎯
        </button>
      </div>
    </div>
  );
}

export default function GraphView() {
  const { activeCase, setActiveCase } = useActiveCase();
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [availableCases, setAvailableCases] = useState<CaseOption[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  
  // Link Analysis & Inspector State
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [shortestPath, setShortestPath] = useState<string[] | null>(null);
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);

  // Quick Add Target Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTargetType, setNewTargetType] = useState<string>("username");
  const [newTargetValue, setNewTargetValue] = useState("");
  const [addingTarget, setAddingTarget] = useState(false);

  // Layout Mode: MindMeister, Force Net, Radial Orbit
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("mindmap");

  // Typology Filter
  const [typologyFilter, setTypologyFilter] = useState<string>("all");

  // Node Attachment States (Files & External Dork Links)
  const [attachUrl, setAttachUrl] = useState("");
  const [attachTitle, setAttachTitle] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [uploadingNodeFile, setUploadingNodeFile] = useState(false);
  const [nodeFileTypology, setNodeFileTypology] = useState("document");
  const nodeFileInputRef = useRef<HTMLInputElement>(null);
  const nodePhotoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Manual Knot (Link) Creation States
  const [manualRelType, setManualRelType] = useState("associates_with");
  const [manualCustomLabel, setManualCustomLabel] = useState("");
  const [creatingKnot, setCreatingKnot] = useState(false);
  const [drawerTargetNodeId, setDrawerTargetNodeId] = useState("");
  const [drawerRelType, setDrawerRelType] = useState("associates_with");
  const [drawerCustomLabel, setDrawerCustomLabel] = useState("");
  const [creatingDrawerKnot, setCreatingDrawerKnot] = useState(false);

  // Load available cases once on mount
  useEffect(() => {
    apiGet<CaseOption[]>("/cases/")
      .then((data) => {
        setAvailableCases(data || []);
        if (data && data.length > 0) {
          if (!activeCase) {
            setActiveCase({ id: data[0].id, name: data[0].name });
          }
          setSelectedCaseIds((prev) => (prev.length === 0 ? [data[0].id] : prev));
        }
      })
      .catch((err) => console.error("Error loading cases:", err));
  }, []);

  // Compute graphology instance for shortest path calculations
  const graphologyInstance = useMemo(() => {
    if (nodes.length === 0) return null;
    const g = new Graph({ multi: true });
    for (const n of nodes) {
      g.addNode(n.id);
    }
    for (const e of edges) {
      if (g.hasNode(e.source) && g.hasNode(e.target)) {
        try {
          g.addEdge(e.source, e.target);
        } catch {}
      }
    }
    return g;
  }, [nodes, edges]);

  // Compute shortest path when 2 nodes are selected
  useEffect(() => {
    if (selectedNodes.length === 2 && graphologyInstance) {
      try {
        const path = bidirectional(graphologyInstance, selectedNodes[0], selectedNodes[1]);
        setShortestPath(path || []);
      } catch (e) {
        setShortestPath([]);
      }
    } else {
      setShortestPath(null);
    }
  }, [selectedNodes, graphologyInstance]);

  async function loadGraphData() {
    setLoading(true);
    setSelectedNodes([]);
    try {
      let data: { nodes: NodeData[]; edges: EdgeData[] };

      if (viewMode === "active") {
        const targetId = activeCase?.id || (availableCases.length > 0 ? availableCases[0].id : null);
        if (!targetId) {
          setNodes([]);
          setEdges([]);
          setLoading(false);
          return;
        }
        data = await apiGet<{ nodes: NodeData[]; edges: EdgeData[] }>(`/cases/${targetId}/graph`);
      } else if (viewMode === "custom") {
        if (selectedCaseIds.length === 0) {
          setNodes([]);
          setEdges([]);
          setLoading(false);
          return;
        }
        data = await apiPostJson<{ nodes: NodeData[]; edges: EdgeData[] }>("/cases/custom-graph", {
          case_ids: selectedCaseIds,
        });
      } else if (viewMode === "all") {
        data = await apiGet<{ nodes: NodeData[]; edges: EdgeData[] }>("/cases/all/graph");
      } else {
        setNodes([]);
        setEdges([]);
        return;
      }
      
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      // Pre-select first entity node if none inspected
      if (data.nodes && data.nodes.length > 0) {
        const firstTarget = data.nodes.find((n) => (n.type || "").toLowerCase() !== "case") || data.nodes[0];
        setInspectedNodeId((prev) => (prev ? prev : firstTarget.id));
      }
    } catch (e) {
      console.error("Error loading graph:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGraphData();
  }, [activeCase?.id, viewMode, selectedCaseIds]);

  const toggleCaseSelection = (caseId: string) => {
    setSelectedCaseIds((prev) =>
      prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId]
    );
  };

  // Filtered nodes based on typology filter
  const displayedNodes = useMemo(() => {
    if (typologyFilter === "all") return nodes;
    if (typologyFilter === "identifiers") {
      return nodes.filter((n) => ["case", "person", "username", "email", "phone", "corporate", "domain", "crypto"].includes((n.type || "").toLowerCase()));
    }
    if (typologyFilter === "accounts") {
      return nodes.filter((n) => !["case", "person", "username", "email", "phone", "corporate", "domain", "crypto", "geolocation", "secret", "biometric", "document", "file", "dork_dump", "evidence"].includes((n.type || "").toLowerCase()) || n.type === "case");
    }
    if (typologyFilter === "geolocations") {
      return nodes.filter((n) => n.type === "geolocation" || n.type === "case");
    }
    if (typologyFilter === "files") {
      return nodes.filter((n) => ["case", "document", "file", "dork_dump", "image", "audio_video"].includes((n.type || "").toLowerCase()));
    }
    if (typologyFilter === "evidence_secrets") {
      return nodes.filter((n) => ["case", "evidence", "secret", "biometric"].includes((n.type || "").toLowerCase()));
    }
    return nodes;
  }, [nodes, typologyFilter]);

  const displayedNodeIds = useMemo(() => new Set(displayedNodes.map((n) => n.id)), [displayedNodes]);

  const displayedEdges = useMemo(() => {
    return edges.filter((e) => displayedNodeIds.has(e.source) && displayedNodeIds.has(e.target));
  }, [edges, displayedNodeIds]);

  // Currently inspected node details
  const inspectedNode = useMemo(() => {
    if (!inspectedNodeId) return null;
    return nodes.find((n) => n.id === inspectedNodeId) || null;
  }, [inspectedNodeId, nodes]);

  // Connected edges for the inspected node
  const inspectedNodeConnections = useMemo(() => {
    if (!inspectedNodeId) return [];
    return edges.filter((e) => e.source === inspectedNodeId || e.target === inspectedNodeId);
  }, [inspectedNodeId, edges]);

  // Set of node IDs that have attached files or attached external Dork links
  const attachedNodeIds = useMemo(() => {
    const s = new Set<string>();
    for (const e of edges) {
      if (e.relation_type === "attached_file" || e.relation_type === "attached_link") {
        s.add(e.source);
      }
    }
    return s;
  }, [edges]);

  // Handle saving an external Dork link / document URL directly to a node
  async function handleAttachLink() {
    if (!activeCase || !inspectedNodeId || !attachUrl.trim()) return;
    setSavingLink(true);
    try {
      await apiPostJson(`/cases/${activeCase.id}/evidence`, {
        url: attachUrl.trim(),
        title: attachTitle.trim() || undefined,
        note: `Attached to node ${inspectedNode?.label || inspectedNodeId} via Graph View`,
        target_node_id: inspectedNodeId,
      });
      setAttachUrl("");
      setAttachTitle("");
      await loadGraphData();
    } catch (err: any) {
      alert("Failed to attach link: " + (err?.message || err));
    } finally {
      setSavingLink(false);
    }
  }

  // Handle uploading a file directly to the inspected node
  async function handleUploadNodeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeCase || !inspectedNodeId) return;
    setUploadingNodeFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("typology", nodeFileTypology);
      fd.append("target_node_id", inspectedNodeId);

      await apiPostFormData(`/cases/${activeCase.id}/files/upload`, fd);
      if (nodeFileInputRef.current) nodeFileInputRef.current.value = "";
      await loadGraphData();
    } catch (err: any) {
      alert("Failed to upload file: " + (err?.message || err));
    } finally {
      setUploadingNodeFile(false);
    }
  }

  // Handle uploading a photo/avatar directly to the inspected node
  async function handleUploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeCase || !inspectedNodeId) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("typology", "image");
      fd.append("target_node_id", inspectedNodeId);

      await apiPostFormData(`/cases/${activeCase.id}/files/upload`, fd);
      if (nodePhotoInputRef.current) nodePhotoInputRef.current.value = "";
      await loadGraphData();
    } catch (err: any) {
      alert("Failed to upload node photo: " + (err?.message || err));
    } finally {
      setUploadingPhoto(false);
    }
  }

  // Handle creating a manual knot (edge) between selected 2 nodes
  async function handleCreateManualKnot() {
    if (!activeCase || selectedNodes.length < 2) return;
    setCreatingKnot(true);
    try {
      const source = selectedNodes[0];
      const target = selectedNodes[1];
      const rel = manualRelType === "custom" ? (manualCustomLabel.trim().toLowerCase().replace(/ /g, "_") || "connected_to") : manualRelType;
      const lbl = manualRelType === "custom" ? manualCustomLabel.trim() : manualRelType.replace(/_/g, " ");

      await apiPostJson(`/cases/${activeCase.id}/manual-links`, {
        source,
        target,
        relation_type: rel,
        label: lbl,
      });

      setManualCustomLabel("");
      await loadGraphData();
    } catch (err: any) {
      alert("Failed to attach knot: " + (err?.message || err));
    } finally {
      setCreatingKnot(false);
    }
  }

  // Handle creating a manual knot from inspector drawer
  async function handleCreateDrawerKnot() {
    if (!activeCase || !inspectedNodeId || !drawerTargetNodeId) return;
    setCreatingDrawerKnot(true);
    try {
      const rel = drawerRelType === "custom" ? (drawerCustomLabel.trim().toLowerCase().replace(/ /g, "_") || "connected_to") : drawerRelType;
      const lbl = drawerRelType === "custom" ? drawerCustomLabel.trim() : drawerRelType.replace(/_/g, " ");

      await apiPostJson(`/cases/${activeCase.id}/manual-links`, {
        source: inspectedNodeId,
        target: drawerTargetNodeId,
        relation_type: rel,
        label: lbl,
      });

      setDrawerTargetNodeId("");
      setDrawerCustomLabel("");
      await loadGraphData();
    } catch (err: any) {
      alert("Failed to attach knot: " + (err?.message || err));
    } finally {
      setCreatingDrawerKnot(false);
    }
  }

  // Quick Add Target
  async function handleAddTarget() {
    if (!activeCase || !newTargetValue.trim()) return;
    setAddingTarget(true);
    try {
      if (newTargetType === "geolocation") {
        const parts = newTargetValue.split(",").map((p) => parseFloat(p.trim()));
        const lat = !isNaN(parts[0]) ? parts[0] : 0.0;
        const lon = !isNaN(parts[1]) ? parts[1] : 0.0;
        await apiPostJson(`/cases/${activeCase.id}/geolocations`, {
          latitude: lat,
          longitude: lon,
          label: newTargetValue.trim(),
          source: "Graph Quick Add",
        });
      } else {
        await apiPostJson(`/cases/${activeCase.id}/findings`, {
          identifier_type: newTargetType,
          identifier_value: newTargetValue.trim(),
          platform: "target",
          exists: true,
          discovered_by: "investigator_graph",
        });
      }
      setNewTargetValue("");
      setShowAddModal(false);
      await loadGraphData();
    } catch (e: any) {
      alert("Failed to add target: " + (e?.message || e));
    } finally {
      setAddingTarget(false);
    }
  }

  function handleNodeSelect(nodeId: string) {
    setSelectedNodes((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      }
      if (prev.length >= 2) return [nodeId];
      return [...prev, nodeId];
    });
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Top Header & View Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ color: "var(--cyan)", margin: 0, textShadow: "0 0 10px rgba(5,217,232,0.4)" }}>
              MALTEGO RELATIONAL GRAPH
            </h2>
            <span style={{ fontSize: 11, background: "rgba(5, 217, 232, 0.15)", color: "var(--cyan)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(5,217,232,0.3)" }}>
              {displayedNodes.length} Entities • {displayedEdges.length} Links
            </span>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 0 0" }}>
            Visual intelligence correlation graph uniting targets, social footprints, documents, geolocations, credentials, and biometrics.
          </p>
        </div>
        
        {/* Scope & Case Selector */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {availableCases.length > 0 && viewMode === "active" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(5, 217, 232, 0.08)", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--cyan)" }}>
              <span style={{ fontSize: 11, color: "var(--cyan)", fontWeight: "bold" }}>CASE:</span>
              <select
                value={activeCase?.id || (availableCases[0]?.id ?? "")}
                onChange={(e) => {
                  const c = availableCases.find((x) => x.id === e.target.value);
                  if (c) setActiveCase({ id: c.id, name: c.name });
                }}
                style={{ background: "#0c0e17", color: "#fff", border: "1px solid var(--panel-border)", padding: "4px 8px", borderRadius: 4, fontSize: 12, cursor: "pointer" }}
              >
                {availableCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, background: "var(--panel)", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--panel-border)", height: "fit-content", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input 
                type="radio" 
                checked={viewMode === "active"} 
                onChange={() => setViewMode("active")} 
              />
              <span style={{ fontSize: 12, fontWeight: viewMode === "active" ? "bold" : "normal", color: viewMode === "active" ? "var(--cyan)" : "inherit" }}>
                Active Case Only
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input 
                type="radio" 
                checked={viewMode === "custom"} 
                onChange={() => setViewMode("custom")} 
              />
              <span style={{ fontSize: 12, fontWeight: viewMode === "custom" ? "bold" : "normal", color: viewMode === "custom" ? "var(--cyan)" : "inherit" }}>
                Select Cases (2 or more)
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input 
                type="radio" 
                checked={viewMode === "all"} 
                onChange={() => setViewMode("all")} 
              />
              <span style={{ fontSize: 12, fontWeight: viewMode === "all" ? "bold" : "normal", color: viewMode === "all" ? "var(--danger)" : "inherit" }}>
                Full Merge (All Cases)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Multi-case picker when Select Cases (2 or more) is chosen */}
      {viewMode === "custom" && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "rgba(5, 217, 232, 0.05)", border: "1px solid var(--cyan)", borderRadius: 6 }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)", marginBottom: 8 }}>
            CHOOSE 2 OR MORE CASES TO CORRELATE INTO THIS GRAPH:
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {availableCases.map((c) => {
              const isChecked = selectedCaseIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCaseSelection(c.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                    background: isChecked ? "rgba(5, 217, 232, 0.25)" : "var(--panel)",
                    border: isChecked ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
                    color: isChecked ? "var(--cyan)" : "var(--text-muted)",
                    fontWeight: isChecked ? "bold" : "normal",
                  }}
                >
                  {isChecked ? (
                    <CheckIcon size={12} color="var(--cyan)" />
                  ) : (
                    <span style={{ width: 12, height: 12, border: "1px solid var(--text-muted)", display: "inline-block", borderRadius: 2 }} />
                  )}
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            {selectedCaseIds.length} case(s) selected {selectedCaseIds.length < 2 && "(select at least 2 to analyze cross-case correlations)"}
          </div>
        </div>
      )}

      {/* Maltego Transforms, Layout Mode & Action Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        {/* Layout Engine Switcher & Typology Filter Tabs */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Layout Mode Group */}
          <div style={{ display: "flex", gap: 4, background: "rgba(5, 217, 232, 0.08)", padding: "3px 6px", borderRadius: 6, border: "1px solid rgba(5,217,232,0.25)" }}>
            <span style={{ fontSize: 10, color: "var(--cyan)", fontWeight: "bold", alignSelf: "center", marginRight: 4, textTransform: "uppercase" }}>
              Layout:
            </span>
            <button
              onClick={() => setLayoutMode("mindmap")}
              style={{
                background: layoutMode === "mindmap" ? "var(--cyan)" : "transparent",
                color: layoutMode === "mindmap" ? "#000" : "var(--text)",
                border: "none",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: layoutMode === "mindmap" ? "bold" : "normal",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Organized MindMeister-style hierarchical branching tree"
            >
              <span>🧠</span> Mind Map
            </button>
            <button
              onClick={() => setLayoutMode("force")}
              style={{
                background: layoutMode === "force" ? "var(--cyan)" : "transparent",
                color: layoutMode === "force" ? "#000" : "var(--text)",
                border: "none",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: layoutMode === "force" ? "bold" : "normal",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Organic dynamic force-directed network simulation"
            >
              <span>🌌</span> Force Net
            </button>
            <button
              onClick={() => setLayoutMode("radial")}
              style={{
                background: layoutMode === "radial" ? "var(--cyan)" : "transparent",
                color: layoutMode === "radial" ? "#000" : "var(--text)",
                border: "none",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: layoutMode === "radial" ? "bold" : "normal",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Concentric circular orbit layout around Case Hub"
            >
              <span>🎯</span> Radial
            </button>
          </div>

          {/* Typology Filter Tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Typologies" },
            { id: "identifiers", label: "Targets & IDs" },
            { id: "accounts", label: "Social Accounts" },
            { id: "geolocations", label: "Geolocations" },
            { id: "files", label: "Databank Files" },
            { id: "evidence_secrets", label: "Evidence & Leaks" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTypologyFilter(f.id)}
              style={{
                background: typologyFilter === f.id ? "var(--cyan)" : "var(--panel)",
                color: typologyFilter === f.id ? "#000" : "var(--text-muted)",
                border: typologyFilter === f.id ? "1px solid var(--cyan)" : "1px solid var(--panel-border)",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: typologyFilter === f.id ? "bold" : "normal",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
          </div>
        </div>

        {/* Quick Add Target Action */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {activeCase && (
            <button
              onClick={() => setShowAddModal(!showAddModal)}
              style={{
                background: "rgba(5, 217, 232, 0.15)",
                color: "var(--cyan)",
                border: "1px solid var(--cyan)",
                padding: "4px 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>+</span> Add Target to Graph
            </button>
          )}

          <button
            onClick={() => loadGraphData()}
            style={{
              background: "var(--panel)",
              color: "var(--text)",
              border: "1px solid var(--panel-border)",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Reload graph findings"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Inline Quick Add Target Modal */}
      {showAddModal && (
        <div style={{ marginBottom: 14, padding: 14, background: "rgba(17, 21, 31, 0.95)", border: "1px solid var(--cyan)", borderRadius: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)" }}>NEW TARGET ENTITY:</span>
          <select
            value={newTargetType}
            onChange={(e) => setNewTargetType(e.target.value)}
            style={{
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--panel-border)",
              padding: "5px 10px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            <option value="username">Username / Social Handle</option>
            <option value="email">Email Address</option>
            <option value="phone">Phone Number</option>
            <option value="person">Person Name / CPF</option>
            <option value="corporate">Company / CNPJ</option>
            <option value="domain">Domain / Hostname</option>
            <option value="crypto">Cryptocurrency Address</option>
            <option value="geolocation">Geolocation (Lat, Lon)</option>
          </select>

          <input
            type="text"
            placeholder={newTargetType === "geolocation" ? "-23.5505, -46.6333 (or Place Name)" : "Target value / identifier..."}
            value={newTargetValue}
            onChange={(e) => setNewTargetValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTarget()}
            style={{
              flex: 1,
              minWidth: 240,
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--panel-border)",
              padding: "5px 10px",
              borderRadius: 4,
              fontSize: 12,
            }}
          />

          <button
            onClick={handleAddTarget}
            disabled={addingTarget || !newTargetValue.trim()}
            style={{
              background: "var(--cyan)",
              color: "#000",
              fontWeight: "bold",
              border: "none",
              padding: "6px 14px",
              borderRadius: 4,
              fontSize: 12,
              cursor: addingTarget ? "wait" : "pointer",
            }}
          >
            {addingTarget ? "Linking..." : "Link to Case Hub"}
          </button>
          <button
            onClick={() => setShowAddModal(false)}
            style={{
              background: "transparent",
              color: "var(--text-muted)",
              border: "none",
              padding: "6px 8px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Link Analysis Path Tool Banner */}
      <div style={{ marginBottom: 12, fontSize: 12, background: "rgba(5, 217, 232, 0.08)", padding: "6px 12px", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(5,217,232,0.2)" }}>
        <div>
          <strong style={{ color: "var(--cyan)" }}>MALTEGO LINK ANALYSIS:</strong> Click any 2 nodes to calculate shortest path and correlation hops. Drag nodes to reposition.
          {selectedNodes.length === 1 && <span style={{ color: "var(--warning)", marginLeft: 8 }}>(Node 1 selected, click Node 2...)</span>}
          {selectedNodes.length === 2 && shortestPath && shortestPath.length > 0 && <span style={{ color: "var(--success)", marginLeft: 8 }}>(Correlated path found: {shortestPath.length - 1} hops)</span>}
          {selectedNodes.length === 2 && shortestPath && shortestPath.length === 0 && <span style={{ color: "var(--danger)", marginLeft: 8 }}>(No direct path exists between entities)</span>}
        </div>
        {selectedNodes.length > 0 && (
          <button 
            onClick={() => setSelectedNodes([])}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Manual Knot Attachment Action Bar when 2 nodes are selected */}
      {selectedNodes.length === 2 && (
        <div style={{
          marginBottom: 12,
          padding: "10px 14px",
          background: "rgba(10, 14, 24, 0.95)",
          border: "1px solid var(--cyan)",
          borderRadius: 6,
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          boxShadow: "0 0 16px rgba(5, 217, 232, 0.25)"
        }}>
          <span style={{ fontSize: 11, fontWeight: "bold", color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>🔗</span> ATTACH KNOT (LINK NODES):
          </span>
          <span style={{ fontSize: 11, color: "#fff", background: "rgba(255,255,255,0.08)", padding: "3px 8px", borderRadius: 4 }}>
            {nodes.find((n) => n.id === selectedNodes[0])?.label || selectedNodes[0]}
          </span>
          <span style={{ color: "var(--cyan)", fontSize: 12, fontWeight: "bold" }}>➔</span>
          <span style={{ fontSize: 11, color: "#fff", background: "rgba(255,255,255,0.08)", padding: "3px 8px", borderRadius: 4 }}>
            {nodes.find((n) => n.id === selectedNodes[1])?.label || selectedNodes[1]}
          </span>

          <select
            value={manualRelType}
            onChange={(e) => setManualRelType(e.target.value)}
            style={{
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--panel-border)",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            <option value="associates_with">Associates With</option>
            <option value="suspect_link">Suspect / Accomplice</option>
            <option value="communicates_with">Communicates With</option>
            <option value="financial_flow">Financial / Crypto Flow</option>
            <option value="family_relation">Family / Relative</option>
            <option value="same_owner">Same Owner / Operates</option>
            <option value="located_at">Located At / Co-resident</option>
            <option value="custom">Custom Relation...</option>
          </select>

          {manualRelType === "custom" && (
            <input
              type="text"
              placeholder="e.g. business_partner, ex_spouse..."
              value={manualCustomLabel}
              onChange={(e) => setManualCustomLabel(e.target.value)}
              style={{
                background: "var(--bg)",
                color: "var(--text)",
                border: "1px solid var(--panel-border)",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 11,
                minWidth: 160,
              }}
            />
          )}

          <button
            onClick={handleCreateManualKnot}
            disabled={creatingKnot}
            style={{
              background: creatingKnot ? "var(--panel)" : "var(--cyan)",
              color: creatingKnot ? "var(--text-muted)" : "#000",
              fontWeight: "bold",
              border: "none",
              borderRadius: 4,
              padding: "5px 12px",
              fontSize: 11,
              cursor: creatingKnot ? "wait" : "pointer",
            }}
          >
            {creatingKnot ? "Attaching..." : "+ Connect Nodes (Save Knot)"}
          </button>
        </div>
      )}

      {/* Main Canvas Container with Inspector Drawer */}
      <div style={{ height: "620px", width: "100%", background: "#060812", border: "1px solid var(--cyan)", borderRadius: 8, position: "relative", overflow: "hidden" }}>
        {loading && (
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, color: "var(--cyan)", fontSize: 12, background: "rgba(6,8,18,0.85)", padding: "6px 12px", borderRadius: 4, border: "1px solid rgba(5,217,232,0.3)", display: "flex", alignItems: "center", gap: 6 }}>
            <BoltIcon size={14} color="var(--cyan)" />
            Computing Graph Topology...
          </div>
        )}
        
        {viewMode === "all" && (
          <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 10, color: "var(--danger)", fontSize: 11, background: "rgba(0,0,0,0.8)", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertIcon size={14} color="var(--danger)" />
            MACRO MULTI-CASE VIEW: Shared identifiers are linked by highlighted correlation lines.
          </div>
        )}

        {!loading && nodes.length === 0 && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", color: "var(--text-muted)", zIndex: 10 }}>
            <p style={{ color: "var(--cyan)", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No Graph Entities Discovered Yet</p>
            <p style={{ fontSize: 13, maxWidth: 360, margin: "0 auto" }}>Select an active case or run intelligence tools to populate nodes and relational links.</p>
          </div>
        )}

        {/* 100% Reliable HTML5 Canvas 2D Force-Directed / MindMeister Graph */}
        <CanvasGraph
          nodes={displayedNodes}
          edges={displayedEdges}
          selectedNodes={selectedNodes}
          onSelectNode={handleNodeSelect}
          onClearSelection={() => setSelectedNodes([])}
          shortestPath={shortestPath}
          onInspectNode={setInspectedNodeId}
          layoutMode={layoutMode}
          attachedNodeIds={attachedNodeIds}
        />

        {/* MALTEGO ENTITY INSPECTOR DRAWER */}
        {inspectedNode && (
          <div 
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 320,
              height: "100%",
              background: "rgba(10, 14, 24, 0.95)",
              borderLeft: "1px solid var(--cyan)",
              backdropFilter: "blur(10px)",
              padding: 16,
              overflowY: "auto",
              zIndex: 50,
              boxShadow: "-8px 0 24px rgba(0,0,0,0.6)",
              color: "var(--text)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--panel-border)", paddingBottom: 10, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {inspectedNode.image || inspectedNode.details?.image ? (
                  <div style={{ position: "relative" }}>
                    {(() => {
                      const rawImg = inspectedNode.image || inspectedNode.details?.image;
                      let fullSrc = rawImg.startsWith("http") ? rawImg : `${API_URL}${rawImg}`;
                      if (!fullSrc.includes("api_key=")) {
                        const sep = fullSrc.includes("?") ? "&" : "?";
                        fullSrc += `${sep}api_key=${encodeURIComponent(getApiKey())}`;
                      }
                      return (
                        <img
                          src={fullSrc}
                          alt="Avatar"
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid var(--cyan)",
                            boxShadow: "0 0 10px rgba(5, 217, 232, 0.4)",
                          }}
                        />
                      );
                    })()}
                  </div>
                ) : (
                  <span 
                    style={{ 
                      width: 14, 
                      height: 14, 
                      borderRadius: "50%", 
                      background: (NODE_SETTINGS[inspectedNode.type] || NODE_SETTINGS.default).color,
                      boxShadow: `0 0 8px ${(NODE_SETTINGS[inspectedNode.type] || NODE_SETTINGS.default).color}`
                    }} 
                  />
                )}
                <div>
                  <div style={{ fontSize: 10, color: "var(--cyan)", fontWeight: "bold", textTransform: "uppercase" }}>
                    {(NODE_SETTINGS[inspectedNode.type] || NODE_SETTINGS.default).label}
                  </div>
                  <h4 style={{ margin: 0, fontSize: 14, wordBreak: "break-word", color: "#fff" }}>
                    {inspectedNode.label}
                  </h4>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  ref={nodePhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadPhoto}
                  disabled={uploadingPhoto}
                  style={{ display: "none" }}
                  id="node-photo-quick-input"
                />
                <label
                  htmlFor="node-photo-quick-input"
                  title="Attach Photo / Avatar to this Node"
                  style={{
                    background: uploadingPhoto ? "var(--panel)" : "rgba(5, 217, 232, 0.15)",
                    border: "1px solid var(--cyan)",
                    color: "var(--cyan)",
                    borderRadius: 4,
                    padding: "3px 6px",
                    fontSize: 11,
                    cursor: uploadingPhoto ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span>📷</span> {uploadingPhoto ? "..." : "+ Photo"}
                </label>
                <button 
                  onClick={() => setInspectedNodeId(null)}
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center" }}
                >
                  <CrossIcon size={14} color="var(--text-muted)" />
                </button>
              </div>
            </div>

            {/* Centrality Metrics */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: "bold", marginBottom: 6 }}>
                GRAPH CENTRALITY & TOPOLOGY:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ background: "var(--panel)", padding: 6, borderRadius: 4, border: "1px solid var(--panel-border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Degree (Links)</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "var(--cyan)" }}>
                    {inspectedNodeConnections.length}
                  </div>
                </div>
                <div style={{ background: "var(--panel)", padding: 6, borderRadius: 4, border: "1px solid var(--panel-border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Community Cluster</div>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: "var(--magenta)" }}>
                    #{inspectedNode.community ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Entity Attributes & Details */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: "bold", marginBottom: 6 }}>
                ENTITY ATTRIBUTES:
              </div>
              <div style={{ background: "var(--panel)", padding: 10, borderRadius: 4, border: "1px solid var(--panel-border)", fontSize: 11, lineHeight: 1.6 }}>
                <div style={{ color: "var(--text-muted)" }}>ID:</div>
                <div style={{ wordBreak: "break-all", color: "#fff", marginBottom: 6 }}>{inspectedNode.id}</div>
                
                {inspectedNode.details && Object.keys(inspectedNode.details).length > 0 ? (
                  Object.entries(inspectedNode.details).map(([k, v]) => {
                    if (v === null || v === undefined) return null;
                    return (
                      <div key={k} style={{ marginTop: 4 }}>
                        <span style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}: </span>
                        <span style={{ color: "var(--text)", wordBreak: "break-all" }}>
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No extra metadata attached</div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {inspectedNode.details?.url && (
              <div style={{ marginBottom: 14 }}>
                <a
                  href={inspectedNode.details.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: "var(--cyan)",
                    color: "#000",
                    fontWeight: "bold",
                    padding: "8px 12px",
                    borderRadius: 4,
                    textDecoration: "none",
                    fontSize: 12,
                  }}
                >
                  Visit Discovered Link ↗
                </a>
              </div>
            )}

            {/* Direct Node Attachments & Dork Documentation Section */}
            <div style={{ marginBottom: 16, borderTop: "1px solid var(--panel-border)", paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "var(--cyan)", fontWeight: "bold", letterSpacing: "0.5px" }}>
                  📎 ATTACHED EVIDENCE & DORKS:
                </span>
                <span style={{ fontSize: 10, background: "rgba(5, 217, 232, 0.15)", color: "var(--cyan)", padding: "1px 6px", borderRadius: 3 }}>
                  {edges.filter((e) => e.source === inspectedNode.id && (e.relation_type === "attached_file" || e.relation_type === "attached_link")).length} items
                </span>
              </div>

              {/* Existing Node Attached Evidence List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                {edges
                  .filter((e) => e.source === inspectedNode.id && (e.relation_type === "attached_file" || e.relation_type === "attached_link"))
                  .map((e, idx) => {
                    const targetNode = nodes.find((n) => n.id === e.target);
                    if (!targetNode) return null;
                    const isFile = e.relation_type === "attached_file" || targetNode.type === "document" || targetNode.type === "file";
                    const fileId = targetNode.details?.id || (targetNode.id.startsWith("file:") ? targetNode.id.substring(5) : null);
                    const targetUrl = targetNode.details?.url || (fileId && activeCase ? `${API_URL}/cases/${activeCase.id}/files/${fileId}/download` : null);

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "8px 10px",
                          background: "rgba(6, 8, 18, 0.8)",
                          border: "1px solid rgba(5, 217, 232, 0.25)",
                          borderRadius: 4,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, fontWeight: "bold", color: "#fff", display: "flex", alignItems: "center", gap: 5 }}>
                            {isFile ? "📄" : "🔗"} {targetNode.label}
                          </span>
                          <span style={{ fontSize: 9, color: "var(--cyan)", textTransform: "uppercase" }}>
                            {targetNode.type}
                          </span>
                        </div>
                        {targetUrl && (
                          <div style={{ marginTop: 2 }}>
                            <a
                              href={targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: "var(--cyan)",
                                fontSize: 10,
                                textDecoration: "underline",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {isFile ? "⬇ Download File" : "↗ Open External URL"}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Attach External Dork URL / Document Link Box */}
              <div style={{ background: "rgba(10, 14, 24, 0.6)", border: "1px solid rgba(5, 217, 232, 0.2)", borderRadius: 4, padding: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "var(--cyan)", fontWeight: "bold", marginBottom: 6, textTransform: "uppercase" }}>
                  + Link External Dork URL / File
                </div>
                <input
                  type="text"
                  placeholder="Paste URL (e.g. https://target.gov/dork.pdf)..."
                  value={attachUrl}
                  onChange={(e) => setAttachUrl(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg)",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text)",
                    fontSize: 11,
                    padding: "5px 8px",
                    borderRadius: 4,
                    marginBottom: 6,
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="text"
                  placeholder="Document Title / Note (optional)..."
                  value={attachTitle}
                  onChange={(e) => setAttachTitle(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg)",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text)",
                    fontSize: 11,
                    padding: "5px 8px",
                    borderRadius: 4,
                    marginBottom: 6,
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={handleAttachLink}
                  disabled={savingLink || !attachUrl.trim()}
                  style={{
                    width: "100%",
                    background: savingLink || !attachUrl.trim() ? "var(--panel)" : "var(--cyan)",
                    color: savingLink || !attachUrl.trim() ? "var(--text-muted)" : "#000",
                    fontWeight: "bold",
                    border: "none",
                    borderRadius: 4,
                    padding: "6px 10px",
                    fontSize: 11,
                    cursor: savingLink || !attachUrl.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {savingLink ? "Preserving URL..." : "🔗 Pin URL to this Node"}
                </button>
              </div>

              {/* Upload File to Node Box */}
              <div style={{ background: "rgba(10, 14, 24, 0.6)", border: "1px solid rgba(5, 217, 232, 0.2)", borderRadius: 4, padding: 10 }}>
                <div style={{ fontSize: 10, color: "var(--cyan)", fontWeight: "bold", marginBottom: 6, textTransform: "uppercase" }}>
                  📎 Upload File / Dump to this Node
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <select
                    value={nodeFileTypology}
                    onChange={(e) => setNodeFileTypology(e.target.value)}
                    style={{
                      flex: 1,
                      background: "var(--bg)",
                      border: "1px solid var(--panel-border)",
                      color: "var(--text)",
                      fontSize: 11,
                      padding: "4px 6px",
                      borderRadius: 4,
                    }}
                  >
                    <option value="document">Document (PDF/DOC)</option>
                    <option value="dork_dump">Dork Dump / Text</option>
                    <option value="image">Screenshot / Photo</option>
                    <option value="audio_video">Audio / Video</option>
                  </select>
                </div>
                <input
                  ref={nodeFileInputRef}
                  type="file"
                  onChange={handleUploadNodeFile}
                  disabled={uploadingNodeFile}
                  style={{ display: "none" }}
                  id="node-file-upload-input"
                />
                <label
                  htmlFor="node-file-upload-input"
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: uploadingNodeFile ? "var(--panel)" : "rgba(5, 217, 232, 0.15)",
                    border: "1px dashed var(--cyan)",
                    color: "var(--cyan)",
                    fontWeight: "bold",
                    borderRadius: 4,
                    padding: "6px 10px",
                    fontSize: 11,
                    cursor: uploadingNodeFile ? "wait" : "pointer",
                  }}
                >
                  {uploadingNodeFile ? "Uploading..." : "📁 Browse & Upload to Node"}
                </label>
              </div>
            </div>

            {/* Attach Knot (Link) to Another Node */}
            <div style={{ marginBottom: 16, borderTop: "1px solid var(--panel-border)", paddingTop: 12 }}>
              <div style={{ fontSize: 10, color: "var(--cyan)", fontWeight: "bold", marginBottom: 6, textTransform: "uppercase" }}>
                🔗 Attach Knot to Another Entity
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <select
                  value={drawerTargetNodeId}
                  onChange={(e) => setDrawerTargetNodeId(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--bg)",
                    border: "1px solid var(--panel-border)",
                    color: "var(--text)",
                    fontSize: 11,
                    padding: "5px 8px",
                    borderRadius: 4,
                  }}
                >
                  <option value="">-- Choose Target Entity --</option>
                  {nodes
                    .filter((n) => n.id !== inspectedNode.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label} ({n.type})
                      </option>
                    ))}
                </select>

                <div style={{ display: "flex", gap: 6 }}>
                  <select
                    value={drawerRelType}
                    onChange={(e) => setDrawerRelType(e.target.value)}
                    style={{
                      flex: 1,
                      background: "var(--bg)",
                      border: "1px solid var(--panel-border)",
                      color: "var(--text)",
                      fontSize: 11,
                      padding: "4px 6px",
                      borderRadius: 4,
                    }}
                  >
                    <option value="associates_with">Associates With</option>
                    <option value="suspect_link">Suspect / Accomplice</option>
                    <option value="communicates_with">Communicates With</option>
                    <option value="financial_flow">Financial / Crypto Flow</option>
                    <option value="family_relation">Family / Relative</option>
                    <option value="same_owner">Same Owner</option>
                    <option value="located_at">Located At</option>
                    <option value="custom">Custom Relation...</option>
                  </select>

                  {drawerRelType === "custom" && (
                    <input
                      type="text"
                      placeholder="Relation label..."
                      value={drawerCustomLabel}
                      onChange={(e) => setDrawerCustomLabel(e.target.value)}
                      style={{
                        flex: 1,
                        background: "var(--bg)",
                        border: "1px solid var(--panel-border)",
                        color: "var(--text)",
                        fontSize: 11,
                        padding: "4px 6px",
                        borderRadius: 4,
                      }}
                    />
                  )}
                </div>

                <button
                  onClick={handleCreateDrawerKnot}
                  disabled={creatingDrawerKnot || !drawerTargetNodeId}
                  style={{
                    width: "100%",
                    background: creatingDrawerKnot || !drawerTargetNodeId ? "var(--panel)" : "var(--cyan)",
                    color: creatingDrawerKnot || !drawerTargetNodeId ? "var(--text-muted)" : "#000",
                    fontWeight: "bold",
                    border: "none",
                    borderRadius: 4,
                    padding: "6px 10px",
                    fontSize: 11,
                    cursor: creatingDrawerKnot || !drawerTargetNodeId ? "not-allowed" : "pointer",
                  }}
                >
                  {creatingDrawerKnot ? "Attaching Knot..." : "+ Create Knot to Selected Entity"}
                </button>
              </div>
            </div>

            {/* Connected Links */}
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: "bold", marginBottom: 6 }}>
                CONNECTED CORRELATIONS ({inspectedNodeConnections.length}):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {inspectedNodeConnections.map((e, idx) => {
                  const otherId = e.source === inspectedNode.id ? e.target : e.source;
                  const otherNode = nodes.find((n) => n.id === otherId);
                  return (
                    <div 
                      key={idx}
                      onClick={() => setInspectedNodeId(otherId)}
                      style={{
                        padding: "6px 8px",
                        background: "var(--panel)",
                        border: "1px solid var(--panel-border)",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                        {otherNode?.label || otherId}
                      </div>
                      <span style={{ fontSize: 9, color: EDGE_COLORS[e.relation_type || "default"] || "var(--cyan)", textTransform: "uppercase" }}>
                        {(e.relation_type || "link").replace(/_/g, " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Maltego Typology Legend */}
      <div style={{ marginTop: 14, padding: "12px 16px", background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 6 }}>
        <div style={{ fontSize: 11, fontWeight: "bold", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.5px" }}>
          MALTEGO ENTITY CLUSTERS & RELATIONSHIPS:
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[
            { label: "Case Hub", color: "#05D9E8" },
            { label: "Person", color: "#FF4D4D" },
            { label: "Username", color: "#00E676" },
            { label: "Email", color: "#00B0FF" },
            { label: "Phone", color: "#FF9100" },
            { label: "Company / CNPJ", color: "#9C27B0" },
            { label: "Domain / Network", color: "#00BCD4" },
            { label: "Crypto Wallet", color: "#FFD600" },
            { label: "Geolocation", color: "#FF0055" },
            { label: "Exposed Secret", color: "#FF5500" },
            { label: "Face Biometric", color: "#E040FB" },
            { label: "Databank Document", color: "#05D9E8" },
            { label: "Evidence URL", color: "#00FF9F" },
            { label: "Social Footprint", color: "#1877F2" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text)" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: item.color, display: "inline-block", boxShadow: `0 0 6px ${item.color}` }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
