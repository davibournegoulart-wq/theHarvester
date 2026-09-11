"use client";

import { useEffect, useRef } from "react";

export default function ParallaxBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect user motion preferences
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;
    let scrollY = 0;
    let animationFrameId: number;

    const onMouseMove = (e: MouseEvent) => {
      // Normalize to -1 .. 1
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const onScroll = () => {
      scrollY = window.scrollY;
    };

    const loop = () => {
      // Smooth lerp
      currentX += (mouseX - currentX) * 0.05;
      currentY += (mouseY - currentY) * 0.05;

      if (containerRef.current) {
        containerRef.current.style.setProperty("--px", `${currentX * 20}px`);
        containerRef.current.style.setProperty("--py", `${currentY * 20}px`);
        containerRef.current.style.setProperty("--rot-x", `${currentY * -4}deg`);
        containerRef.current.style.setProperty("--rot-y", `${currentX * 6}deg`);
        containerRef.current.style.setProperty("--scroll-offset", `${scrollY * 0.15}px`);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* 3D Perspective Cyber-Grid */}
      <div
        style={{
          position: "absolute",
          inset: "-100px",
          backgroundImage: `
            linear-gradient(to right, rgba(5, 217, 232, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(5, 217, 232, 0.045) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          transform:
            "perspective(1000px) rotateX(var(--rot-x, 0deg)) rotateY(var(--rot-y, 0deg)) translate3d(var(--px, 0px), calc(var(--py, 0px) - var(--scroll-offset, 0px)), 0)",
          transition: "transform 0.1s ease-out",
          opacity: 0.8,
        }}
      />

      {/* Floating Ambient Holographic Glow 1 (Cyan) */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "25%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(5, 217, 232, 0.08) 0%, transparent 65%)",
          filter: "blur(60px)",
          transform: "translate3d(calc(var(--px, 0px) * 1.5), calc(var(--py, 0px) * 1.5), 0)",
          transition: "transform 0.2s ease-out",
        }}
      />

      {/* Floating Ambient Holographic Glow 2 (Magenta) */}
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          right: "20%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 42, 109, 0.06) 0%, transparent 65%)",
          filter: "blur(70px)",
          transform: "translate3d(calc(var(--px, 0px) * -1.2), calc(var(--py, 0px) * -1.2), 0)",
          transition: "transform 0.2s ease-out",
        }}
      />

      {/* Subtle Digital Circuit Dots Layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(5, 217, 232, 0.12) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          transform: "translate3d(calc(var(--px, 0px) * 0.5), calc(var(--py, 0px) * 0.5), 0)",
          opacity: 0.6,
        }}
      />
    </div>
  );
}
