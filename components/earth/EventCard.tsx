"use client";

import { useEffect, useState } from "react";
import { ClimateEvent } from "@/lib/events";

interface Props {
  event: ClimateEvent | null;
}

const SEVERITY_COLOURS = {
  info:     { border: "rgba(100,180,255,0.4)", glow: "rgba(100,180,255,0.15)", tag: "#64b4ff" },
  warning:  { border: "rgba(255,180,0,0.4)",   glow: "rgba(255,180,0,0.12)",   tag: "#ffb400" },
  critical: { border: "rgba(255,60,60,0.5)",   glow: "rgba(255,60,60,0.15)",   tag: "#ff3c3c" },
};

export default function EventCard({ event }: Props) {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState<ClimateEvent | null>(null);

  useEffect(() => {
    if (event) {
      setDisplayed(event);
      // Small delay so CSS transition fires
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setDisplayed(null), 500);
      return () => clearTimeout(t);
    }
  }, [event]);

  if (!displayed) return null;

  const colours = SEVERITY_COLOURS[displayed.severity];

  return (
    <div style={{
      position: "absolute",
      left: "clamp(16px, 5vw, 40px)",
      bottom: "140px",
      maxWidth: "min(360px, 85vw)",
      background: `rgba(0,0,0,0.85)`,
      border: `1px solid ${colours.border}`,
      boxShadow: `0 0 40px ${colours.glow}, inset 0 0 20px ${colours.glow}`,
      borderRadius: "10px",
      padding: "20px 22px",
      fontFamily: "'Space Mono', monospace",
      zIndex: 30,
      transition: "opacity 0.45s ease, transform 0.45s ease",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      backdropFilter: "blur(16px)",
    }}>
      {/* Year badge */}
      <div style={{
        display: "inline-block",
        padding: "2px 8px",
        background: `${colours.tag}22`,
        border: `1px solid ${colours.tag}55`,
        borderRadius: "3px",
        fontSize: "9px",
        color: colours.tag,
        letterSpacing: "0.15em",
        marginBottom: "10px",
      }}>
        {displayed.year}
      </div>

      <h2 style={{
        fontSize: "15px",
        fontWeight: "bold",
        color: "rgba(255,255,255,0.95)",
        marginBottom: "8px",
        lineHeight: 1.3,
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        {displayed.title}
      </h2>

      <p style={{
        fontSize: "11px",
        color: "rgba(255,255,255,0.65)",
        lineHeight: 1.7,
        margin: 0,
      }}>
        {displayed.body}
      </p>
    </div>
  );
}
