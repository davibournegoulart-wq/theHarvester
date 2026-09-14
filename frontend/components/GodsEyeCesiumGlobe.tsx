"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import { useActiveCase } from "@/lib/activeCase";
import SaveToCaseButton from "@/components/SaveToCaseButton";
import {
  GlobeIcon,
  CompassIcon,
  CrossIcon,
  RadarIcon,
  EyeIcon,
  TargetIcon,
  CheckIcon,
  AlertIcon,
} from "@/components/FlatIcons";

declare global {
  interface Window {
    Cesium?: any;
  }
}

export type VisualShaderMode = "DEFAULT" | "FLIR" | "NVG" | "CRT" | "NOIR";

export type GodsEyeCesiumProps = {
  activeShader: VisualShaderMode;
  onSelectCountry?: (countryCode: string) => void;
};

export default function GodsEyeCesiumGlobe({
  activeShader,
  onSelectCountry,
}: GodsEyeCesiumProps) {
  const { activeCase } = useActiveCase();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  const [loadingCesium, setLoadingCesium] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Entities state
  const [satellites, setSatellites] = useState<any[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [newsFeeds, setNewsFeeds] = useState<any[]>([]);
  const [cctvs, setCctvs] = useState<any[]>([]);

  const [satLoading, setSatLoading] = useState(false);
  const [flightLoading, setFlightLoading] = useState(false);

  // Active layer visibility filters
  const [showConflicts, setShowConflicts] = useState(true);
  const [showQuakes, setShowQuakes] = useState(true);
  const [showNews, setShowNews] = useState(true);
  const [showCctv, setShowCctv] = useState(true);
  const [showSats, setShowSats] = useState(true);
  const [showFlights, setShowFlights] = useState(true);

  // Cockpit Simulator State
  const [cockpitTarget, setCockpitTarget] = useState<any | null>(null);
  const [telemetry, setTelemetry] = useState({
    altitudeFt: 0,
    speedKnots: 0,
    headingDeg: 0,
    verticalRateFpm: 0,
    pitchDeg: 0,
    rollDeg: 0,
    callsign: "RECON-01",
    model: "ISR PLATFORM",
    origin: "CLASSIFIED",
    dest: "MISSION AIRSPACE",
  });

  // Tracked contact popup / inspection
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  // Globe illumination mode (false = 24/7 Daylit Tactical, true = Astronomical Sun Shading)
  const [sunLighting, setSunLighting] = useState(false);

  function toggleSunLighting() {
    if (!viewerRef.current) return;
    const nextVal = !sunLighting;
    viewerRef.current.scene.globe.enableLighting = nextVal;
    setSunLighting(nextVal);
  }

  // 1. Dynamic CDN loader for CesiumJS (Zero bundle overhead, Turbopack compatible)
  useEffect(() => {
    let isMounted = true;

    async function loadCesium() {
      if (window.Cesium) {
        if (isMounted) initCesium();
        return;
      }

      try {
        // Inject CSS
        if (!document.getElementById("cesium-css")) {
          const link = document.createElement("link");
          link.id = "cesium-css";
          link.rel = "stylesheet";
          link.href =
            "https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Widgets/widgets.css";
          document.head.appendChild(link);
        }

        // Inject JS
        if (!document.getElementById("cesium-js")) {
          const script = document.createElement("script");
          script.id = "cesium-js";
          script.src =
            "https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Cesium.js";
          script.async = true;
          script.onload = () => {
            if (isMounted) initCesium();
          };
          script.onerror = () => {
            if (isMounted) setLoadError("Failed to load Cesium WebGL library from CDN.");
          };
          document.body.appendChild(script);
        } else {
          // Poll if script tag exists but window.Cesium not yet ready
          const interval = setInterval(() => {
            if (window.Cesium) {
              clearInterval(interval);
              if (isMounted) initCesium();
            }
          }, 100);
        }
      } catch (err: any) {
        if (isMounted) setLoadError(err?.message || "Error loading Cesium");
      }
    }

    loadCesium();

    return () => {
      isMounted = false;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        try {
          viewerRef.current.destroy();
        } catch {}
        viewerRef.current = null;
      }
    };
  }, []);

  // 2. Initialize Cesium Viewer
  function initCesium() {
    if (!containerRef.current || !window.Cesium) return;
    if (viewerRef.current) return;

    const Cesium = window.Cesium;

    // Use default anonymous access with OpenStreetMap / Esri imagery
    try {
      // Base layer provider: Esri photorealistic satellite imagery
      const esriProvider = new Cesium.UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        credit: "Esri World Imagery",
        maximumLevel: 19,
      });

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        scene3DOnly: true,
        baseLayer: new Cesium.ImageryLayer(esriProvider),
        contextOptions: {
          webgl: {
            alpha: true,
            depth: true,
            stencil: true,
            antialias: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: true,
            failIfMajorPerformanceCaveat: false,
          },
        },
      });

      // Globe visual styling:
      // Disable solar night shading (enableLighting = false) so the Earth is brightly illuminated and photorealistic 24/7 across all timezones
      const scene = viewer.scene;
      scene.globe.enableLighting = false;
      scene.globe.depthTestAgainstTerrain = false;
      scene.globe.atmosphereBrightnessShift = 0.1;
      scene.skyAtmosphere.hueShift = 0.0;
      scene.skyAtmosphere.saturationShift = 0.1;
      scene.globe.baseColor = Cesium.Color.fromCssColorString("#0d1b2a");

      viewerRef.current = viewer;
      setLoadingCesium(false);

      // Default camera over global view (centered on South America / Americas)
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-47.9, -15.8, 14000000.0),
        duration: 2.0,
      });

      // Handle entity click selection
      const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction((click: any) => {
        const pickedObject = scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
          const props = pickedObject.id.properties.getValue(Cesium.JulianDate.now());
          setSelectedContact(props);
          if (props?.country_code && onSelectCountry) {
            onSelectCountry(props.country_code);
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // Handle right click for quick country dossier
      handler.setInputAction((click: any) => {
        const ray = viewer.camera.getPickRay(click.position);
        const cartesian = scene.globe.pick(ray, scene);
        if (Cesium.defined(cartesian)) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const lon = Cesium.Math.toDegrees(cartographic.longitude);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          if (onSelectCountry) {
            onSelectCountry(`coords:${lat.toFixed(4)},${lon.toFixed(4)}`);
          }
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

      // Auto-fetch data from God's Eye, Shadowbroker, and Osiris
      fetchSatellites();
      fetchFlights();
      fetchConflicts();
      fetchEarthquakes();
      fetchNews();
      fetchCctv();
    } catch (err: any) {
      console.error("Cesium initialization error:", err);
      setLoadError("WebGL Cesium Initialization Error: " + err.message);
      setLoadingCesium(false);
    }
  }

  // 3. Fetch Satellites and Plot 3D Orbital Rings
  async function fetchSatellites() {
    setSatLoading(true);
    try {
      const res = await apiGet<any>("/recon/godseye/satellites?group=stations");
      const list = Array.isArray(res) ? res : (res?.satellites || []);
      setSatellites(list);
      if (showSats) plotSatellitesInCesium(list);
    } catch (err) {
      console.warn("Error fetching satellites for Cesium:", err);
    } finally {
      setSatLoading(false);
    }
  }

  // 3b. Fetch Osiris Active Conflict Zones
  async function fetchConflicts() {
    try {
      const res = await apiGet<any>("/recon/osiris/conflicts");
      const list = res?.zones || [];
      setConflicts(list);
      if (showConflicts) plotConflictsInCesium(list);
    } catch (err) {
      console.warn("Error fetching conflicts for Cesium:", err);
    }
  }

  function plotConflictsInCesium(conflictList: any[]) {
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    const toRemove: any[] = [];
    viewer.entities.values.forEach((e: any) => {
      if (e.id && e.id.startsWith("conflict-")) toRemove.push(e);
    });
    toRemove.forEach((e) => viewer.entities.remove(e));

    conflictList.forEach((cz: any) => {
      if (!cz.lat || !cz.lon) return;
      const position = Cesium.Cartesian3.fromDegrees(cz.lon, cz.lat, 8000);

      viewer.entities.add({
        id: `conflict-${cz.id}`,
        name: `WARZONE: ${cz.label}`,
        position: position,
        point: {
          pixelSize: 12,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `⚔️ ${cz.label}`,
          font: "bold 10px monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString("#ff5555"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 25000000.0),
        },
        properties: {
          type: "CONFLICT_ZONE",
          name: cz.label,
          severity: cz.severity,
          threat_level: cz.threat_level,
          description: cz.description,
          region: cz.region,
          lat: cz.lat,
          lon: cz.lon,
          belligerents: cz.belligerents,
        },
      });
    });
  }

  // 3c. Fetch Osiris Earthquakes
  async function fetchEarthquakes() {
    try {
      const res = await apiGet<any>("/recon/osiris/earthquakes?min_magnitude=3.0");
      const list = res?.earthquakes || [];
      setEarthquakes(list);
      if (showQuakes) plotEarthquakesInCesium(list);
    } catch (err) {
      console.warn("Error fetching earthquakes for Cesium:", err);
    }
  }

  function plotEarthquakesInCesium(eqList: any[]) {
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    const toRemove: any[] = [];
    viewer.entities.values.forEach((e: any) => {
      if (e.id && e.id.startsWith("quake-")) toRemove.push(e);
    });
    toRemove.forEach((e) => viewer.entities.remove(e));

    eqList.slice(0, 35).forEach((eq: any) => {
      if (!eq.lat || !eq.lon) return;
      const mag = eq.magnitude || 3.0;
      const position = Cesium.Cartesian3.fromDegrees(eq.lon, eq.lat, 4000);

      viewer.entities.add({
        id: `quake-${eq.id}`,
        name: `EARTHQUAKE M${mag}: ${eq.place}`,
        position: position,
        point: {
          pixelSize: Math.min(16, Math.max(7, Math.round(mag * 2.5))),
          color: mag >= 5.5 ? Cesium.Color.RED : Cesium.Color.ORANGE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        label: {
          text: `🌋 M${mag}`,
          font: "9px monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString("#ffaa00"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -8),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 15000000.0),
        },
        properties: {
          type: "EARTHQUAKE",
          name: eq.place,
          magnitude: mag,
          depth_km: eq.depth_km,
          lat: eq.lat,
          lon: eq.lon,
          time: eq.time,
          tsunami: eq.tsunami,
        },
      });
    });
  }

  // 3d. Fetch Osiris Live News Broadcast Nodes
  async function fetchNews() {
    try {
      const res = await apiGet<any>("/recon/osiris/live-news");
      const list = res?.feeds || [];
      setNewsFeeds(list);
      if (showNews) plotNewsInCesium(list);
    } catch (err) {
      console.warn("Error fetching news for Cesium:", err);
    }
  }

  function plotNewsInCesium(newsList: any[]) {
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    const toRemove: any[] = [];
    viewer.entities.values.forEach((e: any) => {
      if (e.id && e.id.startsWith("news-")) toRemove.push(e);
    });
    toRemove.forEach((e) => viewer.entities.remove(e));

    newsList.forEach((nw: any) => {
      if (!nw.lat || !nw.lon) return;
      const position = Cesium.Cartesian3.fromDegrees(nw.lon, nw.lat, 6000);

      viewer.entities.add({
        id: `news-${nw.id}`,
        name: `BROADCAST: ${nw.name}`,
        position: position,
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString("#a259ff"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `📺 ${nw.name}`,
          font: "10px monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString("#c084fc"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 20000000.0),
        },
        properties: {
          type: "LIVE_NEWS",
          name: nw.name,
          city: nw.city,
          country: nw.country,
          stream_url: nw.stream_url,
          embed_allowed: nw.embed_allowed,
          category: nw.category,
          lat: nw.lat,
          lon: nw.lon,
        },
      });
    });
  }

  // 3e. Fetch Osiris CCTV Public Cameras
  async function fetchCctv() {
    try {
      const res = await apiGet<any>("/recon/osiris/cctv?limit=40");
      const list = res?.cameras || [];
      setCctvs(list);
      if (showCctv) plotCctvInCesium(list);
    } catch (err) {
      console.warn("Error fetching cctv for Cesium:", err);
    }
  }

  function plotCctvInCesium(cctvList: any[]) {
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    const toRemove: any[] = [];
    viewer.entities.values.forEach((e: any) => {
      if (e.id && e.id.startsWith("cctv-")) toRemove.push(e);
    });
    toRemove.forEach((e) => viewer.entities.remove(e));

    cctvList.forEach((cam: any) => {
      if (!cam.lat || !cam.lon) return;
      const position = Cesium.Cartesian3.fromDegrees(cam.lon, cam.lat, 3000);

      viewer.entities.add({
        id: `cctv-${cam.id}`,
        name: `CCTV: ${cam.name}`,
        position: position,
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString("#00e5ff"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        properties: {
          type: "CCTV_CAMERA",
          name: cam.name,
          city: cam.city,
          country: cam.country,
          feed_url: cam.feed_url,
          source: cam.source,
          lat: cam.lat,
          lon: cam.lon,
        },
      });
    });
  }

  function plotSatellitesInCesium(satList: any[]) {
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    // Remove existing satellite entities
    const toRemove: any[] = [];
    viewer.entities.values.forEach((e: any) => {
      if (e.id && e.id.startsWith("sat-")) toRemove.push(e);
    });
    toRemove.forEach((e) => viewer.entities.remove(e));

    satList.slice(0, 40).forEach((sat: any, i: number) => {
      const lat = sat.latitude || ((i * 37) % 140) - 70;
      const lon = sat.longitude || ((i * 47) % 360) - 180;
      const altMeters = (sat.altitude_km || 420) * 1000;

      const position = Cesium.Cartesian3.fromDegrees(lon, lat, altMeters);

      viewer.entities.add({
        id: `sat-${sat.norad_id || i}`,
        name: sat.name || `ORBITAL SATELLITE #${sat.norad_id || i}`,
        position: position,
        point: {
          pixelSize: 8,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        label: {
          text: sat.name ? sat.name.substring(0, 16) : `SAT-${sat.norad_id || i}`,
          font: "10px monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString("#00e5ff"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -9),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 30000000.0),
        },
        properties: {
          type: "SATELLITE",
          name: sat.name || "Orbital Asset",
          norad_id: sat.norad_id || "UNKNOWN",
          lat: lat,
          lon: lon,
          altitude_km: sat.altitude_km || 420,
          velocity_kms: sat.velocity_kms || 7.66,
          group: sat.group || "LEO Stations",
        },
      });
    });
  }

  // 4. Fetch Military Flights & Plot 3D Aircraft
  async function fetchFlights() {
    setFlightLoading(true);
    try {
      const res = await apiGet<any[]>("/recon/shadowbroker/military-flights?limit=50");
      const list = Array.isArray(res) ? res : [];
      setFlights(list);
      plotFlightsInCesium(list);
    } catch (err) {
      console.warn("Error fetching flights for Cesium:", err);
    } finally {
      setFlightLoading(false);
    }
  }

  function plotFlightsInCesium(flightList: any[]) {
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    // Remove old flights
    const toRemove: any[] = [];
    viewer.entities.values.forEach((e: any) => {
      if (e.id && e.id.startsWith("flight-")) toRemove.push(e);
    });
    toRemove.forEach((e) => viewer.entities.remove(e));

    flightList.forEach((fl: any, i: number) => {
      const lat = fl.lat;
      const lon = fl.lon;
      const altFt = fl.alt_baro || fl.alt_geom || 25000;
      const altMeters = altFt * 0.3048;

      if (!lat || !lon) return;

      const position = Cesium.Cartesian3.fromDegrees(lon, lat, altMeters);
      const groundPos = Cesium.Cartesian3.fromDegrees(lon, lat, 0);

      // Aircraft Marker with Altitude Drop-line
      viewer.entities.add({
        id: `flight-${fl.hex || i}`,
        name: fl.flight?.trim() || fl.hex || `MIL-${i}`,
        position: position,
        point: {
          pixelSize: 7,
          color: Cesium.Color.fromCssColorString("#a259ff"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        polyline: {
          positions: [position, groundPos],
          width: 1,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString("rgba(162, 89, 255, 0.45)"),
            dashLength: 8.0,
          }),
        },
        label: {
          text: `${fl.flight?.trim() || fl.hex || "RECON"} (${Math.round(altFt / 1000)}k ft)`,
          font: "10px monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString("#d8b4fe"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -9),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 15000000.0),
        },
        properties: {
          type: "AIRCRAFT",
          callsign: fl.flight?.trim() || fl.hex,
          hex: fl.hex,
          lat: lat,
          lon: lon,
          alt_baro: altFt,
          speed: fl.gs || 420,
          track: fl.track || 0,
          country_code: fl.country_code || "US",
          country: fl.country || "Military Aircraft",
          category: fl.category || "C4ISR / Reconnaissance",
          origin: fl.origin || "FORWARD AIRBASE",
          dest: fl.dest || "PATROL SECTOR",
        },
      });
    });
  }

  // 5. Cockpit Ride-Along Simulator Camera Rig & Dynamic Telemetry
  function engageCockpitMode(flight: any) {
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    setCockpitTarget(flight);

    const lat = flight.lat;
    const lon = flight.lon;
    const altFt = flight.alt_baro || 28000;
    const altMeters = altFt * 0.3048;
    const headingDeg = flight.track || 90;
    const speed = flight.speed || 450;

    // Point camera in aircraft forward-looking first-person chase view
    const headingRad = Cesium.Math.toRadians(headingDeg);
    const pitchRad = Cesium.Math.toRadians(-5.0); // Slight downward horizon

    const aircraftPos = Cesium.Cartesian3.fromDegrees(lon, lat, altMeters);

    viewer.camera.flyTo({
      destination: aircraftPos,
      orientation: {
        heading: headingRad,
        pitch: pitchRad,
        roll: 0.0,
      },
      duration: 1.5,
    });

    setTelemetry({
      altitudeFt: altFt,
      speedKnots: speed,
      headingDeg: headingDeg,
      verticalRateFpm: -100,
      pitchDeg: -5,
      rollDeg: 0,
      callsign: flight.callsign || flight.flight || "AIR-PATROL-1",
      model: flight.category || "USAF C4ISR AWACS / SIGINT",
      origin: flight.origin || "FORWARD PATROL BASE",
      dest: flight.dest || "COMBAT RECON AREA",
    });
  }

  function exitCockpitMode() {
    if (!viewerRef.current || !window.Cesium) return;
    const Cesium = window.Cesium;
    const viewer = viewerRef.current;

    setCockpitTarget(null);

    // Zoom back out to orbital view
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-30.0, 20.0, 18000000.0),
      duration: 1.5,
    });
  }

  // Dynamic Telemetry Simulator Clock
  useEffect(() => {
    if (!cockpitTarget) return;

    const interval = setInterval(() => {
      setTelemetry((prev) => {
        const jitterAlt = Math.floor(Math.random() * 20 - 10);
        const jitterSpd = Math.floor(Math.random() * 4 - 2);
        const jitterPitch = Number((Math.random() * 0.4 - 0.2).toFixed(1));
        const jitterRoll = Number((Math.random() * 0.6 - 0.3).toFixed(1));

        return {
          ...prev,
          altitudeFt: Math.max(1000, prev.altitudeFt + jitterAlt),
          speedKnots: Math.max(150, prev.speedKnots + jitterSpd),
          pitchDeg: jitterPitch,
          rollDeg: jitterRoll,
        };
      });
    }, 500);

    return () => clearInterval(interval);
  }, [cockpitTarget]);

  // Visual Shader CSS Filter Map
  const shaderFilters: Record<VisualShaderMode, string> = {
    DEFAULT: "none",
    FLIR: "invert(1) hue-rotate(180deg) contrast(1.7) brightness(1.2)",
    NVG: "sepia(1) hue-rotate(85deg) saturate(4) contrast(1.6) brightness(1.1)",
    CRT: "contrast(1.4) brightness(1.1) grayscale(0.2)",
    NOIR: "grayscale(1) contrast(1.9) brightness(0.9)",
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 680,
        borderRadius: 6,
        overflow: "hidden",
        background: "#05070c",
        border: "1px solid var(--panel-border)",
      }}
    >
      {/* Loading Overlay */}
      {loadingCesium && !loadError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(5, 7, 12, 0.92)",
            zIndex: 30,
            color: "var(--cyan)",
            fontFamily: "monospace",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "3px solid rgba(0, 229, 255, 0.2)",
              borderTopColor: "var(--cyan)",
              animation: "spin 1s linear infinite",
              marginBottom: 16,
            }}
          />
          <div style={{ fontSize: 13, letterSpacing: 2, fontWeight: "bold" }}>
            INITIALIZING GOD'S EYE 3D WEBGL CESIUM ORBITAL ENGINE...
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            Streaming Esri Photorealistic Surface Tiles &amp; Keplerian Satellites
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(5, 7, 12, 0.95)",
            zIndex: 30,
            color: "#ff5555",
            padding: 24,
            textAlign: "center",
            fontFamily: "monospace",
          }}
        >
          <AlertIcon size={32} color="#ff5555" />
          <h3 style={{ margin: "12px 0 6px 0" }}>3D Engine Initialization Warning</h3>
          <p style={{ fontSize: 12, maxWidth: 500, color: "var(--text-muted)" }}>
            {loadError}. You can continue utilizing the 2D Tactical Tactical Leaflet mode.
          </p>
        </div>
      )}

      {/* Cesium WebGL Container with Shader Filter Applied */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          filter: shaderFilters[activeShader] || "none",
          transition: "filter 0.3s ease",
        }}
      />

      {/* CRT Scanline Overlay when CRT mode is active */}
      {activeShader === "CRT" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 10,
            background:
              "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04))",
            backgroundSize: "100% 3px, 4px 100%",
          }}
        />
      )}

      {/* NVG Phosphor Grid & Vignette Overlay */}
      {activeShader === "NVG" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: "inset 0 0 100px rgba(0,0,0,0.85)",
            border: "1px solid rgba(0, 255, 100, 0.3)",
          }}
        />
      )}

      {/* Top Left HUD: C4ISR Status */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 20,
          background: "rgba(5, 7, 12, 0.85)",
          border: "1px solid rgba(0, 229, 255, 0.3)",
          borderRadius: 4,
          padding: "8px 12px",
          fontFamily: "monospace",
          fontSize: 11,
          color: "#e2e8f0",
          backdropFilter: "blur(6px)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <GlobeIcon size={13} color="var(--cyan)" />
          <span style={{ color: "var(--cyan)", fontWeight: "bold" }}>
            GOD'S EYE 3D C4ISR ORBITAL
          </span>
          <span
            style={{
              padding: "1px 5px",
              borderRadius: 3,
              fontSize: 9,
              background: "rgba(0, 229, 255, 0.2)",
              color: "var(--cyan)",
              border: "1px solid var(--cyan)",
            }}
          >
            {activeShader}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, color: "var(--text-muted)", marginTop: 2, flexWrap: "wrap", fontSize: 10 }}>
          <span>
            Sats: <strong style={{ color: "var(--cyan)" }}>{satLoading ? "..." : satellites.length}</strong>
          </span>
          <span>
            Flights: <strong style={{ color: "#a259ff" }}>{flightLoading ? "..." : flights.length}</strong>
          </span>
          <span>
            Wars: <strong style={{ color: "#ff5555" }}>{conflicts.length}</strong>
          </span>
          <span>
            Quakes: <strong style={{ color: "#ffaa00" }}>{earthquakes.length}</strong>
          </span>
          <span>
            News: <strong style={{ color: "#c084fc" }}>{newsFeeds.length}</strong>
          </span>
          <span>
            Sensor: <strong style={{ color: "#fff" }}>{activeShader === "FLIR" ? "LWIR 8-14μm" : activeShader === "NVG" ? "Gen-III Phosphor" : "EO Visible"}</strong>
          </span>
        </div>
      </div>

      {/* Cockpit Ride-Along HUD Overlay (When Cockpit is Engaged) */}
      {cockpitTarget && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 15,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 24,
            fontFamily: "monospace",
            color: activeShader === "NVG" ? "#39ff14" : activeShader === "FLIR" ? "#ff2a5f" : "#00e5ff",
            textShadow: "0 0 4px currentColor",
          }}
        >
          {/* Top Heading Tape */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 40,
            }}
          >
            <div
              style={{
                width: 320,
                borderBottom: "2px solid currentColor",
                textAlign: "center",
                paddingBottom: 4,
                fontSize: 13,
                fontWeight: "bold",
                letterSpacing: 3,
              }}
            >
              HDG {String(Math.round(telemetry.headingDeg)).padStart(3, "0")}° |{" "}
              {telemetry.headingDeg >= 315 || telemetry.headingDeg < 45
                ? "N"
                : telemetry.headingDeg < 135
                ? "E"
                : telemetry.headingDeg < 225
                ? "S"
                : "W"}
            </div>
            <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>
              TGT TRACK LOCK: {telemetry.callsign}
            </div>
          </div>

          {/* Center Pitch Ladder & Artificial Horizon Reticle */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) rotate(${telemetry.rollDeg}deg)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {/* Center crosshair */}
            <div
              style={{
                width: 40,
                height: 40,
                border: "1px dashed currentColor",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
            </div>

            {/* Pitch rungs */}
            <div
              style={{
                width: 140,
                height: 1,
                background: "currentColor",
                marginTop: 18,
                position: "relative",
              }}
            >
              <span style={{ position: "absolute", left: -24, top: -6, fontSize: 10 }}>+05</span>
              <span style={{ position: "absolute", right: -24, top: -6, fontSize: 10 }}>+05</span>
            </div>
            <div
              style={{
                width: 180,
                height: 2,
                background: "currentColor",
                marginTop: 18,
                position: "relative",
              }}
            >
              <span style={{ position: "absolute", left: -24, top: -6, fontSize: 10, fontWeight: "bold" }}>00</span>
              <span style={{ position: "absolute", right: -24, top: -6, fontSize: 10, fontWeight: "bold" }}>00</span>
            </div>
            <div
              style={{
                width: 140,
                height: 1,
                borderTop: "1px dashed currentColor",
                marginTop: 18,
                position: "relative",
              }}
            >
              <span style={{ position: "absolute", left: -24, top: -6, fontSize: 10 }}>-05</span>
              <span style={{ position: "absolute", right: -24, top: -6, fontSize: 10 }}>-05</span>
            </div>
          </div>

          {/* Left Speed Tape & Right Altitude Tape */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "0 60px" }}>
            {/* Speed Tape */}
            <div
              style={{
                borderLeft: "2px solid currentColor",
                paddingLeft: 8,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ fontSize: 9, opacity: 0.8 }}>IAS KTS</div>
              <div style={{ fontSize: 22, fontWeight: "bold" }}>{telemetry.speedKnots}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>GS {(telemetry.speedKnots * 1.15).toFixed(0)}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>M {(telemetry.speedKnots / 661).toFixed(2)}</div>
            </div>

            {/* Altitude Tape */}
            <div
              style={{
                borderRight: "2px solid currentColor",
                paddingRight: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 4,
              }}
            >
              <div style={{ fontSize: 9, opacity: 0.8 }}>ALT FT</div>
              <div style={{ fontSize: 22, fontWeight: "bold" }}>
                {telemetry.altitudeFt.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>BARO 29.92</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>VS {telemetry.verticalRateFpm} FPM</div>
            </div>
          </div>

          {/* Bottom Cockpit Mission Telemetry Bar */}
          <div
            style={{
              background: "rgba(5, 7, 12, 0.8)",
              border: "1px solid currentColor",
              borderRadius: 4,
              padding: "10px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              pointerEvents: "auto",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: "bold" }}>
                COCKPIT RIDE-ALONG: {telemetry.callsign}
              </div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>
                TYPE: {telemetry.model} | {telemetry.origin} ➔ {telemetry.dest}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <SaveToCaseButton
                identifierType="corporate"
                identifierValue={telemetry.callsign}
                platform="godseye_cockpit_flight"
                discoveredBy="godseye_cockpit_simulator"
                metadata={telemetry}
              />
              <button
                onClick={exitCockpitMode}
                style={{
                  padding: "5px 12px",
                  fontSize: 11,
                  background: "rgba(255, 85, 85, 0.2)",
                  color: "#ff5555",
                  border: "1px solid #ff5555",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontFamily: "monospace",
                }}
              >
                Exit Cockpit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Entity Dossier Modal / Drawer */}
      {selectedContact && !cockpitTarget && (
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 14,
            width: 380,
            maxWidth: "calc(100% - 28px)",
            background: "rgba(10, 14, 23, 0.95)",
            border: "1px solid var(--cyan)",
            borderRadius: 6,
            padding: 14,
            zIndex: 25,
            backdropFilter: "blur(8px)",
            fontFamily: "monospace",
            color: "#e2e8f0",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {selectedContact.type === "AIRCRAFT" ? (
                <RadarIcon size={15} color="#a259ff" />
              ) : selectedContact.type === "CONFLICT_ZONE" ? (
                <span style={{ fontSize: 14 }}>⚔️</span>
              ) : selectedContact.type === "EARTHQUAKE" ? (
                <span style={{ fontSize: 14 }}>🌋</span>
              ) : selectedContact.type === "LIVE_NEWS" ? (
                <span style={{ fontSize: 14 }}>📺</span>
              ) : selectedContact.type === "CCTV_CAMERA" ? (
                <span style={{ fontSize: 14 }}>📹</span>
              ) : (
                <EyeIcon size={15} color="var(--cyan)" />
              )}
              <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--cyan)" }}>
                {selectedContact.type === "AIRCRAFT"
                  ? "TACTICAL AIR CONTACT"
                  : selectedContact.type === "CONFLICT_ZONE"
                  ? "ACTIVE WAR ZONE"
                  : selectedContact.type === "EARTHQUAKE"
                  ? "SEISMIC EPICENTER"
                  : selectedContact.type === "LIVE_NEWS"
                  ? "GLOBAL BROADCAST STREAM"
                  : selectedContact.type === "CCTV_CAMERA"
                  ? "PUBLIC CCTV SURVEILLANCE"
                  : "ORBITAL ASSET"}
              </span>
            </div>
            <button
              onClick={() => setSelectedContact(null)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
            >
              <CrossIcon size={14} />
            </button>
          </div>

          <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", marginBottom: 6 }}>
            {selectedContact.name || selectedContact.callsign || "Tracked Entity"}
          </div>

          <div style={{ fontSize: 11, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12, background: "rgba(0,0,0,0.3)", padding: 8, borderRadius: 4 }}>
            {selectedContact.type === "AIRCRAFT" ? (
              <>
                <div>Callsign: <strong style={{ color: "#a259ff" }}>{selectedContact.callsign}</strong></div>
                <div>Hex ICAO: <code>{selectedContact.hex}</code></div>
                <div>Alt: <strong>{selectedContact.alt_baro?.toLocaleString()} ft</strong></div>
                <div>Speed: <strong>{selectedContact.speed} kts</strong></div>
                <div>Track: <strong>{selectedContact.track}°</strong></div>
                <div>Country: <strong>{selectedContact.country}</strong></div>
              </>
            ) : selectedContact.type === "CONFLICT_ZONE" ? (
              <>
                <div>Severity: <strong style={{ color: "#ff5555" }}>{selectedContact.severity?.toUpperCase()}</strong></div>
                <div>Threat: <strong>{selectedContact.threat_level}</strong></div>
                <div>Region: <strong>{selectedContact.region}</strong></div>
                <div>Coords: <strong>{selectedContact.lat}, {selectedContact.lon}</strong></div>
                <div style={{ gridColumn: "1 / -1", color: "var(--text-muted)", fontSize: 10 }}>{selectedContact.description}</div>
              </>
            ) : selectedContact.type === "EARTHQUAKE" ? (
              <>
                <div>Magnitude: <strong style={{ color: "#ffaa00" }}>M{selectedContact.magnitude}</strong></div>
                <div>Depth: <strong>{selectedContact.depth_km} km</strong></div>
                <div>Coords: <strong>{selectedContact.lat}, {selectedContact.lon}</strong></div>
                <div>Tsunami: <strong>{selectedContact.tsunami ? "YES" : "NO"}</strong></div>
              </>
            ) : selectedContact.type === "LIVE_NEWS" ? (
              <>
                <div>City: <strong>{selectedContact.city}</strong></div>
                <div>Country: <strong>{selectedContact.country}</strong></div>
                <div>Category: <strong>{selectedContact.category}</strong></div>
                <div>Embed: <strong>{selectedContact.embed_allowed ? "YES" : "NO"}</strong></div>
              </>
            ) : selectedContact.type === "CCTV_CAMERA" ? (
              <>
                <div>City: <strong>{selectedContact.city}</strong></div>
                <div>Country: <strong>{selectedContact.country}</strong></div>
                <div>Source: <strong>{selectedContact.source}</strong></div>
                <div>Coords: <strong>{selectedContact.lat?.toFixed(3)}, {selectedContact.lon?.toFixed(3)}</strong></div>
              </>
            ) : (
              <>
                <div>NORAD ID: <code>{selectedContact.norad_id}</code></div>
                <div>Group: <strong>{selectedContact.group}</strong></div>
                <div>Altitude: <strong>{selectedContact.altitude_km} km</strong></div>
                <div>Velocity: <strong>{selectedContact.velocity_kms} km/s</strong></div>
                <div>Lat/Lon: <strong>{selectedContact.lat?.toFixed(2)}, {selectedContact.lon?.toFixed(2)}</strong></div>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {selectedContact.type === "AIRCRAFT" && (
              <button
                onClick={() => {
                  engageCockpitMode(selectedContact);
                  setSelectedContact(null);
                }}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: 11,
                  background: "rgba(0, 229, 255, 0.2)",
                  color: "var(--cyan)",
                  border: "1px solid var(--cyan)",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontFamily: "monospace",
                }}
              >
                Ride Along (Cockpit HUD)
              </button>
            )}

            {selectedContact.type === "LIVE_NEWS" && selectedContact.stream_url && (
              <a
                href={selectedContact.stream_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: 11,
                  background: "rgba(162, 89, 255, 0.2)",
                  color: "#c084fc",
                  border: "1px solid #a259ff",
                  borderRadius: 4,
                  textAlign: "center",
                  textDecoration: "none",
                  fontWeight: "bold",
                  fontFamily: "monospace",
                }}
              >
                Open Broadcast Stream ↗
              </a>
            )}

            <div style={{ flex: 1 }}>
              <SaveToCaseButton
                identifierType="corporate"
                identifierValue={selectedContact.name || selectedContact.callsign || selectedContact.norad_id || "contact"}
                platform={
                  selectedContact.type === "AIRCRAFT"
                    ? "military_flight_radar"
                    : selectedContact.type === "CONFLICT_ZONE"
                    ? "osiris_conflict_zone"
                    : selectedContact.type === "EARTHQUAKE"
                    ? "osiris_earthquake"
                    : selectedContact.type === "LIVE_NEWS"
                    ? "osiris_live_news"
                    : selectedContact.type === "CCTV_CAMERA"
                    ? "osiris_cctv"
                    : "orbital_satellite"
                }
                discoveredBy="godseye_c4isr_cesium"
                metadata={selectedContact}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right Controls Bar */}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          zIndex: 20,
          display: "flex",
          gap: 6,
          background: "rgba(5, 7, 12, 0.85)",
          border: "1px solid rgba(0, 229, 255, 0.3)",
          borderRadius: 4,
          padding: 6,
          backdropFilter: "blur(6px)",
          flexWrap: "wrap",
          maxWidth: "calc(100% - 28px)",
        }}
      >
        <button
          onClick={toggleSunLighting}
          title={sunLighting ? "Switch to 24/7 Illuminated Daylight Mode" : "Switch to Astronomical Sun Shading"}
          style={{
            padding: "4px 8px",
            fontSize: 10,
            background: sunLighting ? "rgba(255, 170, 0, 0.2)" : "rgba(0, 229, 255, 0.15)",
            color: sunLighting ? "#ffaa00" : "var(--cyan)",
            border: `1px solid ${sunLighting ? "#ffaa00" : "var(--cyan)"}`,
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          {sunLighting ? "🌙 Sun Cycle" : "☀️ Daylit"}
        </button>

        <button
          onClick={() => {
            const next = !showConflicts;
            setShowConflicts(next);
            if (next) plotConflictsInCesium(conflicts);
            else {
              viewerRef.current?.entities.values
                .filter((e: any) => e.id?.startsWith("conflict-"))
                .forEach((e: any) => viewerRef.current.entities.remove(e));
            }
          }}
          style={{
            padding: "4px 8px",
            fontSize: 10,
            background: showConflicts ? "rgba(255, 85, 85, 0.2)" : "rgba(255,255,255,0.05)",
            color: showConflicts ? "#ff5555" : "var(--text-muted)",
            border: `1px solid ${showConflicts ? "#ff5555" : "transparent"}`,
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          ⚔️ Wars ({conflicts.length})
        </button>

        <button
          onClick={() => {
            const next = !showQuakes;
            setShowQuakes(next);
            if (next) plotEarthquakesInCesium(earthquakes);
            else {
              viewerRef.current?.entities.values
                .filter((e: any) => e.id?.startsWith("quake-"))
                .forEach((e: any) => viewerRef.current.entities.remove(e));
            }
          }}
          style={{
            padding: "4px 8px",
            fontSize: 10,
            background: showQuakes ? "rgba(255, 170, 0, 0.2)" : "rgba(255,255,255,0.05)",
            color: showQuakes ? "#ffaa00" : "var(--text-muted)",
            border: `1px solid ${showQuakes ? "#ffaa00" : "transparent"}`,
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          🌋 Quakes ({earthquakes.length})
        </button>

        <button
          onClick={() => {
            const next = !showNews;
            setShowNews(next);
            if (next) plotNewsInCesium(newsFeeds);
            else {
              viewerRef.current?.entities.values
                .filter((e: any) => e.id?.startsWith("news-"))
                .forEach((e: any) => viewerRef.current.entities.remove(e));
            }
          }}
          style={{
            padding: "4px 8px",
            fontSize: 10,
            background: showNews ? "rgba(162, 89, 255, 0.2)" : "rgba(255,255,255,0.05)",
            color: showNews ? "#c084fc" : "var(--text-muted)",
            border: `1px solid ${showNews ? "#a259ff" : "transparent"}`,
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          📺 News ({newsFeeds.length})
        </button>

        <button
          onClick={fetchSatellites}
          disabled={satLoading}
          style={{
            padding: "4px 8px",
            fontSize: 10,
            background: "rgba(0, 229, 255, 0.15)",
            color: "var(--cyan)",
            border: "1px solid var(--cyan)",
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          🛰️ Sats ({satellites.length})
        </button>

        <button
          onClick={fetchFlights}
          disabled={flightLoading}
          style={{
            padding: "4px 8px",
            fontSize: 10,
            background: "rgba(162, 89, 255, 0.15)",
            color: "#a259ff",
            border: "1px solid #a259ff",
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          ✈️ Flights ({flights.length})
        </button>
      </div>
    </div>
  );
}
