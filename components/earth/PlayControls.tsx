"use client";

interface Props {
  playing: boolean;
  speed: number;
  onToggle: () => void;
  onSpeedChange: (s: number) => void;
}

const SPEEDS = [1, 5, 10, 25];

export default function PlayControls({ playing, speed, onToggle, onSpeedChange }: Props) {
  return (
    <div style={{
      position: "absolute",
      bottom: "110px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      zIndex: 25,
      fontFamily: "'Space Mono', monospace",
    }}>
      {/* Play / Pause */}
      <button
        onClick={onToggle}
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.3)",
          background: playing ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.9)",
          fontSize: "14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
          backdropFilter: "blur(8px)",
        }}
      >
        {playing ? "⏸" : "▶"}
      </button>

      {/* Speed controls */}
      {SPEEDS.map(s => (
        <button
          key={s}
          onClick={() => onSpeedChange(s)}
          style={{
            padding: "5px 10px",
            borderRadius: "4px",
            border: `1px solid ${speed === s ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.12)"}`,
            background: speed === s ? "rgba(255,255,255,0.12)" : "transparent",
            color: speed === s ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
            fontSize: "9px",
            letterSpacing: "0.1em",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {s}×
        </button>
      ))}

      <span style={{
        fontSize: "8px",
        color: "rgba(255,255,255,0.25)",
        letterSpacing: "0.15em",
        marginLeft: "4px",
      }}>
        YRS/SEC
      </span>
    </div>
  );
}
