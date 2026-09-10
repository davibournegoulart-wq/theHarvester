"use client";

import React, { useState, useRef, useEffect, MouseEvent } from "react";

interface ImageMagnifierProps {
  src: string;
  alt?: string;
  zoomLevel?: number;
  lensSize?: number;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Optical Magnifier Glass Inspector Component based on Magnifier.js
 * Enables investigators to inspect micro-details (eyes, scars, IDs, text, reflections)
 * on any photo or biometric face crop with mouse-tracking and wheel zoom adjustment.
 */
export default function ImageMagnifier({
  src,
  alt = "Magnified image",
  zoomLevel: initialZoom = 2.5,
  lensSize = 130,
  style,
  className,
}: ImageMagnifierProps) {
  const [zoomLevel, setZoomLevel] = useState(initialZoom);
  const [showLens, setShowLens] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [bounds, setBounds] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const updateBounds = () => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    }
  };

  useEffect(() => {
    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, []);

  const handleMouseEnter = () => {
    updateBounds();
    setShowLens(true);
  };

  const handleMouseLeave = () => {
    setShowLens(false);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();

    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    // Constrain lens within image bounds
    const halfLens = lensSize / 2;
    x = Math.max(halfLens, Math.min(rect.width - halfLens, x));
    y = Math.max(halfLens, Math.min(rect.height - halfLens, y));

    setPos({ x, y });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Zoom in/out via wheel scroll matching Magnifier.js wheel capability
    e.preventDefault();
    setZoomLevel((prev) => {
      const delta = e.deltaY < 0 ? 0.3 : -0.3;
      return Math.min(6.0, Math.max(1.5, Number((prev + delta).toFixed(1))));
    });
  };

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        overflow: "visible",
        userSelect: "none",
        cursor: showLens ? "crosshair" : "default",
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={updateBounds}
        style={{
          display: "block",
          maxWidth: "100%",
          height: "auto",
          borderRadius: 4,
          border: "1px solid var(--panel-border)",
        }}
      />

      {/* Cyberpunk Optical Magnifier Glass Lens */}
      {showLens && bounds.width > 0 && (
        <div
          style={{
            position: "absolute",
            pointerEvents: "none",
            top: `${pos.y - lensSize / 2}px`,
            left: `${pos.x - lensSize / 2}px`,
            width: `${lensSize}px`,
            height: `${lensSize}px`,
            borderRadius: "50%",
            border: "2px solid var(--cyan)",
            boxShadow: "0 0 15px rgba(5, 217, 232, 0.6), inset 0 0 8px rgba(0, 0, 0, 0.5)",
            backgroundRepeat: "no-repeat",
            backgroundImage: `url('${src}')`,
            backgroundSize: `${bounds.width * zoomLevel}px ${bounds.height * zoomLevel}px`,
            backgroundPosition: `-${pos.x * zoomLevel - lensSize / 2}px -${pos.y * zoomLevel - lensSize / 2}px`,
            zIndex: 1000,
          }}
        >
          {/* Lens HUD Crosshair and Zoom Tag */}
          <div
            style={{
              position: "absolute",
              bottom: 4,
              right: 6,
              fontSize: 9,
              fontWeight: "bold",
              color: "var(--cyan)",
              background: "rgba(0,0,0,0.8)",
              padding: "1px 4px",
              borderRadius: 2,
              letterSpacing: "0.05em",
            }}
          >
            {zoomLevel}x
          </div>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 8,
              height: 8,
              transform: "translate(-50%, -50%)",
              borderLeft: "1px solid rgba(5, 217, 232, 0.5)",
              borderTop: "1px solid rgba(5, 217, 232, 0.5)",
            }}
          />
        </div>
      )}
    </div>
  );
}
