// PolyCalc — Shared UI components

const C = {
  bg: "#050b14", surface: "#090f1d", card: "#0c1422",
  border: "#132033", border2: "#1a2d44", dimmed: "#243348",
  green: "#00e676", blue: "#2979ff", amber: "#ffab00",
  red: "#ff1744", purple: "#d500f9", teal: "#00b0ff", pink: "#f50057",
  text: "#c8daf0", muted: "#4a6080",
};
export { C };

const mono = "'IBM Plex Mono', monospace";
const syne = "'Syne', sans-serif";

export function Card({ children, accent = C.blue, style = {} }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: 20, position: "relative", overflow: "hidden", ...style,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${accent}55, transparent)`,
      }} />
      {children}
    </div>
  );
}

export function Lbl({ children, style = {} }) {
  return (
    <div style={{
      fontFamily: syne, fontSize: 10, color: C.muted,
      letterSpacing: 2, textTransform: "uppercase", marginBottom: 5, ...style,
    }}>
      {children}
    </div>
  );
}

export function Mono({ children, size = 13, color = C.text, style = {} }) {
  return (
    <span style={{ fontFamily: mono, fontSize: size, color, ...style }}>
      {children}
    </span>
  );
}

export function Metric({ label, value, color = C.green, sub, size = 16, style = {} }) {
  return (
    <div style={{
      padding: "12px 14px", background: C.surface, borderRadius: 8,
      border: `1px solid ${C.border}`, ...style,
    }}>
      <Lbl>{label}</Lbl>
      <Mono size={size} color={color}>{value}</Mono>
      {sub && (
        <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function MultTag({ label, value, color, active }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "9px 12px", borderRadius: 7,
      background: active ? `${color}12` : C.surface,
      border: `1px solid ${active ? color + "44" : C.border}`,
      opacity: active ? 1 : 0.4,
    }}>
      <span style={{ fontFamily: syne, fontSize: 11, color: active ? C.text : C.muted }}>
        {label}
      </span>
      <Mono size={13} color={active ? color : C.muted} style={{ fontWeight: 700 }}>
        {value}
      </Mono>
    </div>
  );
}

export function Toggle({ label, checked, onChange, color = C.green }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
      <span style={{ fontFamily: syne, fontSize: 11, color: C.text }}>{label}</span>
      <div
        role="switch" aria-checked={checked} tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: checked ? color : C.dimmed, cursor: "pointer",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: checked ? 18 : 3,
          width: 14, height: 14, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s",
        }} />
      </div>
    </div>
  );
}

export function Slider({ label, value, min, max, step, fmt, onChange, color = C.green }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 17 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <Lbl style={{ marginBottom: 0 }}>{label}</Lbl>
        <Mono size={11} color={color}>{fmt(value)}</Mono>
      </div>
      <div style={{ position: "relative", height: 22, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: C.dimmed, borderRadius: 2 }} />
        <div style={{
          position: "absolute", left: 0, width: `${pct}%`, height: 3,
          background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 2,
        }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", zIndex: 3 }}
        />
        <div style={{
          position: "absolute", left: `${pct}%`, width: 13, height: 13,
          borderRadius: "50%", background: color, border: "2px solid #050b14",
          transform: "translateX(-50%)", boxShadow: `0 0 8px ${color}`,
          pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}

export function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{
      display: "flex", gap: 3, background: C.surface, padding: 4,
      borderRadius: 8, border: `1px solid ${C.border}`, flexWrap: "wrap",
    }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            background: active === t.id ? C.card : "transparent",
            border: active === t.id ? `1px solid ${C.border2}` : "1px solid transparent",
            borderRadius: 5, padding: "6px 14px", cursor: "pointer",
            fontFamily: syne, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
            color: active === t.id ? C.green : C.muted, transition: "all 0.15s",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ScoreBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <Mono size={10} color={C.muted}>{label}</Mono>
        <Mono size={10} color={color}>{value.toFixed(1)}</Mono>
      </div>
      <div style={{ height: 3, background: C.dimmed, borderRadius: 2 }}>
        <div style={{
          height: "100%", width: `${Math.min(value, 100)}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 2, transition: "width 0.6s",
        }} />
      </div>
    </div>
  );
}

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#0c1422", border: "1px solid #132033",
    borderRadius: 6, fontFamily: mono, fontSize: 11, color: "#c8daf0",
  },
};
