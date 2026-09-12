"use client";

import GhostTrackSuite, { GhostIpResult } from "./GhostTrackSuite";

export type { GhostIpResult };

export default function GhostTrackIpTool({ initialIp = "" }: { initialIp?: string }) {
  return <GhostTrackSuite initialTab="ip" initialIp={initialIp} />;
}
