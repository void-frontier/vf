import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DATA
// ─────────────────────────────────────────────────────────────────────────────

const RANKS = [
  { minLevel: 1,   title: "Drifter",       color: "#8899aa" },
  { minLevel: 10,  title: "Scout Pilot",   color: "#5ec26a" },
  { minLevel: 25,  title: "Navigator",     color: "#3fa7d6" },
  { minLevel: 50,  title: "Commander",     color: "#e8a838" },
  { minLevel: 80,  title: "Void Admiral",  color: "#c678dd" },
  { minLevel: 120, title: "Star Legend",   color: "#ff6b6b" },
];
function getRank(totalLevel) {
  return [...RANKS].reverse().find(r => totalLevel >= r.minLevel) || RANKS[0];
}

// Item rarity
const RARITY = {
  common:    { label: "Common",    color: "#8899aa", glow: false },
  uncommon:  { label: "Uncommon",  color: "#5ec26a", glow: false },
  rare:      { label: "Rare",      color: "#3fa7d6", glow: true  },
  legendary: { label: "Legendary", color: "#ff6b6b", glow: true  },
};

// All inventory items (raw + refined)
const ITEMS = {
  // Raw materials
  silicate:     { name: "Silicate Dust",    icon: "🪔", rarity: "common",    category: "raw",      flavor: "The most abundant mineral in known space. Worthless alone, essential in bulk." },
  ferrite:      { name: "Ferrite Chunks",   icon: "🟤", rarity: "common",    category: "raw",      flavor: "Dense structural metal torn from shattered planetoids." },
  cryon:        { name: "Cryon Shards",     icon: "💎", rarity: "uncommon",  category: "raw",      flavor: "Ice crystals formed at near-absolute-zero. They hum faintly in your hand." },
  voidstone:    { name: "Voidstone",        icon: "⬛", rarity: "rare",      category: "raw",      flavor: "A black mineral of unknown origin. It absorbs light. Scientists argue about what it is." },
  neutrite:     { name: "Neutrite Ore",     icon: "🔴", rarity: "legendary", category: "raw",      flavor: "Condensed matter from a neutron star. A fragment bends gravity around itself." },
  // Refined
  ref_silicate: { name: "Refined Silicate", icon: "✨", rarity: "common",    category: "refined",  flavor: "Purified silicate. The bedrock of all ship construction." },
  ferrite_plate:{ name: "Ferrite Plate",    icon: "🔶", rarity: "common",    category: "refined",  flavor: "Cold-pressed plates. Solid enough to stop a plasma bolt. Almost." },
  cryon_cell:   { name: "Cryon Cell",       icon: "🔷", rarity: "uncommon",  category: "refined",  flavor: "A sealed energy cell. The heartbeat of modern spacecraft." },
  void_crystal: { name: "Void Crystal",     icon: "💜", rarity: "rare",      category: "refined",  flavor: "Stabilized voidstone. Factions will pay anything for it. Don't ask why." },
  neutrite_core:{ name: "Neutrite Core",    icon: "💥", rarity: "legendary", category: "refined",  flavor: "The most valuable object you can carry. Handle with extreme caution." },
  // Mining – Abandoned Planet
  ruined_stone: { name: "Ruined Stone",     icon: "🪨", rarity: "common",    category: "raw",      flavor: "Brocken eingestürzter Strukturen. Überall hier." },
  // Salvaging materials
  scrap_metal:  { name: "Scrap Metal",      icon: "🔩", rarity: "common",    category: "raw",      flavor: "Salvaged from derelict hulls. Worth more melted down than intact." },
  wiring:       { name: "Frayed Wiring",    icon: "🔌", rarity: "common",    category: "raw",      flavor: "Zerfranste Kabel aus dem alten Kontrollzentrum." },
  // Crafted goods (future skill)
  repair_kit:   { name: "Basic Repair Kit", icon: "🛠", rarity: "common",    category: "crafted",  flavor: "Field repair kit. Better than nothing. Barely." },
  shield_cell:  { name: "Shield Cell",      icon: "🛡", rarity: "uncommon",  category: "crafted",  flavor: "Energy-absorbing cell. Standard issue on fighting ships." },
};


// Sectors (for mining) — "home" is Abandoned Planet, included so mining tick can find it
const SECTORS = [
  {
    id: "home",    name: "Abandoned Planet", region: "Outer Rim · Sektor 0",   icon: "🏠", color: "#9b59b6", reqWarp: 0,
    lore: "Deine Heimatbasis. Eingestürzte Strukturen, überall Schutt.",
    materials: [
      { id: "ruined_stone", time: 8, amount: 1 },
    ],
  },
  {
    id: "kepler",  name: "Kepler Belt",   region: "Inner System · Sector 4",  icon: "🪐", color: "#e8a838", reqWarp: 0,
    lore: "The oldest asteroid field in the system. Every prospector starts here.",
    materials: [
      { id: "silicate", time: 10, amount: 1 },
      { id: "ferrite",  time: 16, amount: 1 },
    ],
  },
  {
    id: "cryon",   name: "Cryon Fields",  region: "Outer System · Sector 9",  icon: "❄️", color: "#4fc3f7", reqWarp: 1,
    lore: "A frozen graveyard at the edge of habitable space. Beautiful and deadly.",
    materials: [
      { id: "cryon",   time: 22, amount: 1 },
      { id: "ferrite", time: 16, amount: 2 },
    ],
  },
  {
    id: "void",    name: "Outer Void",    region: "Deep Space · Sector 17",   icon: "🌑", color: "#9b59b6", reqWarp: 2,
    lore: "Beyond charted space. Navigation here requires a modified warp drive and a steady nerve.",
    materials: [
      { id: "voidstone", time: 32, amount: 1 },
      { id: "cryon",     time: 22, amount: 2 },
    ],
  },
  {
    id: "neutron", name: "Neutron Rim",   region: "Dead Zone · Sector 31",    icon: "⭐", color: "#ff6b6b", reqWarp: 3,
    lore: "The collapsed remnant of a star. Most pilots who come here don't come back.",
    materials: [
      { id: "neutrite",  time: 48, amount: 1 },
      { id: "voidstone", time: 32, amount: 2 },
    ],
  },
];

// Home base (always available, not a sector)
const HOME_LOCATION = {
  id: "home", name: "Abandoned Planet", region: "Outer Rim · Sektor 0 · Deine Heimatbasis",
  icon: "🏠", color: "#9b59b6", reqWarp: 0,
};
const TRAVEL_SECS = 15;

// Refinery recipes
const RECIPES = [
  { id: "ref_silicate",   time: 8,  sellPrice: 18,  reqModule: 0, inputs: { silicate: 4 } },
  { id: "ferrite_plate",  time: 14, sellPrice: 35,  reqModule: 0, inputs: { ferrite: 3 } },
  { id: "cryon_cell",     time: 24, sellPrice: 95,  reqModule: 1, inputs: { cryon: 3, ferrite_plate: 1 } },
  { id: "void_crystal",   time: 40, sellPrice: 280, reqModule: 2, inputs: { voidstone: 2, cryon_cell: 1 } },
  { id: "neutrite_core",  time: 60, sellPrice: 800, reqModule: 2, inputs: { neutrite: 2, void_crystal: 1 } },
];

const SALVAGING_MATS = [
  { id: "scrap_metal", time: 10, amount: 1 },
  { id: "wiring",      time: 14, amount: 1 },
];

const CRAFT_RECIPES = [
  { id: "repair_kit",  time: 20, reqLevel: 1, inputs: { scrap_metal: 2, ferrite_plate: 1 } },
  { id: "shield_cell", time: 40, reqLevel: 3, inputs: {} },
];

// Buildings (extensible)
const BUILDINGS = [
  {
    id: "refinery", name: "Raffinerie", icon: "🏭", color: "#5ec26a",
    desc: "Verarbeitet Rohmaterialien zu handelbaren Gütern.",
    available: true,
    levels: [
      { level: 1, label: "1 Job parallel",  cost: null },
      { level: 2, label: "2 Jobs parallel", cost: { credits: 200, ref_silicate: 5 } },
      { level: 3, label: "3 Jobs parallel", cost: { credits: 600, ferrite_plate: 4, cryon_cell: 1 } },
    ],
  },
  {
    id: "market", name: "Market", icon: "💰", color: "#e8a838",
    desc: "Verkaufe Ressourcen · Handle Waren.",
    available: false,
    unlockLabel: "50× Refined Silicate",
    levels: [
      { level: 1, label: "Basis-Marktplatz", cost: null },
    ],
  },
  {
    id: "lab", name: "Research Lab", icon: "🔬", color: "#3fa7d6",
    desc: "Erforsche verlorene Technologien alter Zivilisationen.",
    available: false,
    unlockLabel: null,
    levels: [
      { level: 1, label: "Tech Tree", cost: null },
    ],
  },
];

// Ship upgrades
const SHIP_UPGRADES = [
  { id: "cargo_1",  cat: "cargo",  name: "Cargo Expansion I",   icon: "📦", desc: "+25 cargo capacity",                    effect: { cargo: 25  }, cost: { credits: 120 },                               req: {} },
  { id: "cargo_2",  cat: "cargo",  name: "Cargo Expansion II",  icon: "📦", desc: "+50 cargo capacity",                    effect: { cargo: 50  }, cost: { credits: 450,  ref_silicate: 5 },             req: { cargo_1: true } },
  { id: "cargo_3",  cat: "cargo",  name: "Cargo Expansion III", icon: "📦", desc: "+100 cargo capacity",                   effect: { cargo: 100 }, cost: { credits: 1400, ferrite_plate: 4 },            req: { cargo_2: true } },
  { id: "warp_1",   cat: "warp",   name: "Warp Drive I",        icon: "🌀", desc: "Unlocks Cryon Fields",                  effect: { warp: 1    }, cost: { credits: 300,  ref_silicate: 8 },             req: {} },
  { id: "warp_2",   cat: "warp",   name: "Warp Drive II",       icon: "🌀", desc: "Unlocks Outer Void",                    effect: { warp: 2    }, cost: { credits: 900,  ferrite_plate: 3, cryon_cell: 1 }, req: { warp_1: true } },
  { id: "warp_3",   cat: "warp",   name: "Warp Drive III",      icon: "🌀", desc: "Unlocks Neutron Rim",                   effect: { warp: 3    }, cost: { credits: 2500, cryon_cell: 3, void_crystal: 1 }, req: { warp_2: true } },
  { id: "module_1", cat: "module", name: "Refinery Module I",   icon: "⚗️", desc: "Unlocks Cryon Cell recipe",             effect: { module: 1  }, cost: { credits: 400,  ferrite_plate: 2 },            req: {} },
  { id: "module_2", cat: "module", name: "Refinery Module II",  icon: "⚗️", desc: "Unlocks Void Crystal & Neutrite Core",  effect: { module: 2  }, cost: { credits: 1200, cryon_cell: 2 },               req: { module_1: true } },
];

// ─────────────────────────────────────────────────────────────────────────────
// XP
// ─────────────────────────────────────────────────────────────────────────────
const XP_TABLE = Array.from({ length: 100 }, (_, i) => Math.floor(83 * Math.pow(1.18, i)));
function getLevel(xp) { let l = 1; for (let i = 0; i < XP_TABLE.length; i++) { if (xp >= XP_TABLE[i]) l = i + 1; else break; } return Math.min(l, 99); }
function getLvlProg(xp) { const l = getLevel(xp); if (l >= 99) return 1; const c = XP_TABLE[l-1]||0, n = XP_TABLE[l]||1; return Math.max(0, Math.min(1, (xp-c)/(n-c))); }
function xpToNext(xp) { const l = getLevel(xp); return l >= 99 ? 0 : Math.ceil(XP_TABLE[l] - xp); }

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(Math.floor(n));

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Barlow+Condensed:wght@400;500;600;700&display=swap');
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #07090f; color: #c8d4e0; font-family: 'Barlow', sans-serif; min-height: 100%; }
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }

/* Keyframes */
@keyframes twinkle { 0%,100% { opacity: 0.08; } 50% { opacity: 0.7; } }
@keyframes slideUp      { from { opacity: 0; transform: translateY(12px);  } to { opacity: 1; transform: translateY(0); } }
@keyframes slideIn      { from { opacity: 0; transform: translateX(20px);  } to { opacity: 1; transform: translateX(0); } }
@keyframes screenFwd    { from { opacity: 0; transform: translateX(28px);  } to { opacity: 1; transform: translateX(0); } }
@keyframes screenBack   { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
@keyframes screenTab    { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulseGlow { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes toastSlide { from { opacity: 0; transform: translateY(-14px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes breathe { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
@keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
@keyframes ctaGlow { 0%,100% { box-shadow: 0 0 24px rgba(91,196,232,0.2); } 50% { box-shadow: 0 0 52px rgba(91,196,232,0.55), 0 0 90px rgba(91,196,232,0.15); } }
@keyframes nebulaDrift { 0%,100% { transform: translateX(-50%) translateY(0) scale(1); } 50% { transform: translateX(-50%) translateY(-4%) scale(1.06); } }
@keyframes hudScan { 0% { top: -2px; opacity: 0.7; } 100% { top: 100%; opacity: 0; } }
@keyframes dataFlicker { 0%,94%,100% { opacity: 1; } 95%,99% { opacity: 0.6; } }
@keyframes gridDrift { 0% { background-position: 0 0; } 100% { background-position: 40px 40px; } }
@keyframes starFloat { 0%,100% { transform: translateY(0px) scale(1); opacity: var(--so); } 50% { transform: translateY(-20px) scale(1.05); opacity: calc(var(--so) * 1.6); } }

/* Fonts */
.font-display { font-family: 'Bebas Neue', sans-serif; }
.font-ui      { font-family: 'Barlow Condensed', sans-serif; }
.font-body    { font-family: 'Barlow', sans-serif; }
.cta-pulse    { animation: ctaGlow 5s ease-in-out infinite; }
.data-flicker { animation: dataFlicker 10s ease-in-out infinite; }
.hud-panel    { position: relative; overflow: visible; }
.hud-scanline { position: relative; overflow: hidden; }
.hud-scanline::after { content: ''; position: absolute; left: 0; right: 0; top: -2px; height: 2px; background: linear-gradient(90deg, transparent, rgba(91,196,232,0.4), transparent); animation: hudScan 5s linear infinite; pointer-events: none; }

/* Screen transition classes */
.screen-fwd  { animation: screenFwd  0.2s cubic-bezier(0.22,1,0.36,1) both; }
.screen-back { animation: screenBack 0.2s cubic-bezier(0.22,1,0.36,1) both; }
.screen-tab  { animation: screenTab  0.15s ease both; }

/* Active button glow */
.btn-glow {
  box-shadow: 0 0 12px rgba(0,200,255,0.35), 0 0 4px rgba(0,200,255,0.15);
  transition: box-shadow 0.2s ease, background 0.15s ease;
}
.btn-glow:hover { box-shadow: 0 0 20px rgba(0,200,255,0.5), 0 0 6px rgba(0,200,255,0.2); }

/* Desktop panel frame */
@media (min-width: 700px) {
  .app-panel {
    border-left:  1px solid rgba(91,196,232,0.07);
    border-right: 1px solid rgba(91,196,232,0.07);
    box-shadow: 0 0 120px rgba(0,0,0,0.85);
  }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function RarityBadge({ rarity }) {
  return <span className={`badge badge--${rarity || "common"}`}>{RARITY[rarity]?.label || rarity}</span>;
}

function Tag({ children, color = "rgba(255,255,255,0.3)" }) {
  return (
    <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 500, letterSpacing: 1, color, background: color + "15", border: `1px solid ${color}28`, borderRadius: 3, padding: "1px 8px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Bar({ value, color, height = 4, glow }) {
  return (
    <div style={{ height, background: "rgba(91,196,232,0.07)", borderRadius: 1, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(value * 100, 100)}%`, background: glow ? `linear-gradient(90deg, ${color}88, ${color})` : color, borderRadius: 1, transition: "width 0.12s linear", boxShadow: glow ? `0 0 8px ${color}, 0 0 2px ${color}99` : "none", filter: glow ? "brightness(1.15)" : "none" }} />
    </div>
  );
}

function Divider({ color = "rgba(255,255,255,0.06)" }) {
  return <div style={{ height: 1, background: color, margin: "0" }} />;
}

function SectionLabel({ children }) {
  return (
    <div style={{ padding: "10px 18px 6px", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 3, height: 12, background: "#5bc4e8", opacity: 0.7, borderRadius: 1, flexShrink: 0 }} />
      <span className="data-flicker" style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 3, color: "rgba(91,196,232,0.75)", whiteSpace: "nowrap", textShadow: "0 0 8px rgba(91,196,232,0.5)" }}>// {children}</span>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(91,196,232,0.22), transparent)", boxShadow: "0 0 4px rgba(91,196,232,0.15)" }} />
    </div>
  );
}

function RowItem({ icon, name, locked, active, badge, onClick, animDelay = 0 }) {
  return (
    <div
      onClick={onClick || undefined}
      style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid rgba(91,196,232,0.05)", cursor: onClick ? "pointer" : "default", opacity: locked ? 0.4 : 1, transition: "background 0.15s", animation: `slideUp ${0.08 + animDelay}s ease` }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = "rgba(91,196,232,0.04)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 18, width: 34, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1, color: locked ? "rgba(255,255,255,0.38)" : "#fff", textTransform: "uppercase" }}>{name}</span>
      {active && !locked && (
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#5ec26a", boxShadow: "0 0 7px #5ec26a", animation: "pulseGlow 1.4s infinite", marginRight: badge ? 6 : 12, flexShrink: 0 }} />
      )}
      {badge && !locked && (
        <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "#5ec26a", letterSpacing: 0.5, marginRight: 8, flexShrink: 0 }}>{badge}</span>
      )}
      {locked ? (
        <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 2, flexShrink: 0 }}>LOCKED</span>
      ) : (
        <span style={{ fontSize: 14, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0 }}>→</span>
      )}
    </div>
  );
}

function BuildingCard({ building, level, active, badge, onClick, animDelay = 0 }) {
  const isLocked      = !building.available;
  const levelData     = building.levels?.find(l => l.level === level) || building.levels?.[0];
  const hasNextLevel  = building.levels?.some(l => l.level === level + 1);

  return (
    <div
      onClick={!isLocked && onClick ? onClick : undefined}
      style={{ margin: "0 16px 10px", padding: "14px 16px", background: isLocked ? "rgba(3,8,18,0.35)" : "rgba(3,8,18,0.65)", border: `1px solid ${isLocked ? "rgba(255,255,255,0.06)" : building.color + "28"}`, borderLeft: `3px solid ${isLocked ? "rgba(255,255,255,0.08)" : building.color + "70"}`, borderRadius: 4, cursor: !isLocked && onClick ? "pointer" : "default", opacity: isLocked ? 0.4 : 1, transition: "background 0.15s", animation: `slideUp ${0.08 + animDelay}s ease` }}
      onMouseEnter={e => { if (!isLocked && onClick) e.currentTarget.style.background = "rgba(91,196,232,0.05)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = isLocked ? "rgba(3,8,18,0.35)" : "rgba(3,8,18,0.65)"; }}
    >
      {/* ── Header row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{building.icon}</span>
        <span style={{ flex: 1, fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1.5, color: isLocked ? "rgba(255,255,255,0.35)" : "#fff", textTransform: "uppercase" }}>{building.name}</span>
        {active && !isLocked && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#5ec26a", boxShadow: "0 0 7px #5ec26a", animation: "pulseGlow 1.4s infinite", flexShrink: 0 }} />}
        {badge && !isLocked && <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "#5ec26a", letterSpacing: 0.5, flexShrink: 0 }}>{badge}</span>}
        {isLocked ? (
          <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 2, flexShrink: 0 }}>LOCKED</span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: building.color, letterSpacing: 1 }}>Lv. {level}</span>
            {hasNextLevel && <span style={{ fontSize: 10, color: "rgba(91,196,232,0.35)", fontFamily: "'Barlow Condensed',sans-serif" }}>▲</span>}
            <span style={{ fontSize: 14, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif" }}>→</span>
          </div>
        )}
      </div>
      {/* ── Detail rows ── */}
      <div style={{ paddingLeft: 30 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.36)", fontFamily: "'Barlow',sans-serif", lineHeight: 1.4 }}>{building.desc}</div>
        {!isLocked && levelData && (
          <div style={{ fontSize: 11, color: building.color + "99", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, marginTop: 4 }}>
            Kapazität: {levelData.label}
          </div>
        )}
        {isLocked && building.unlockLabel && (
          <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(91,196,232,0.35)", letterSpacing: 0.5, marginTop: 4 }}>
            // Unlock: {building.unlockLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function BackButton({ onBack, label }) {
  return (
    <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "rgba(91,196,232,0.45)", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, cursor: "pointer", padding: "14px 18px 0", transition: "color 0.15s", textTransform: "uppercase" }}
      onMouseEnter={e => e.currentTarget.style.color = "rgba(91,196,232,0.85)"}
      onMouseLeave={e => e.currentTarget.style.color = "rgba(91,196,232,0.45)"}
    >
      [←] {label}
    </button>
  );
}

function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none", width: "90%", maxWidth: 340 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: "rgba(4,8,18,0.98)", backdropFilter: "blur(24px)", border: `1px solid ${t.color}33`, borderTop: `1px solid ${t.color}55`, borderLeft: `3px solid ${t.color}`, padding: "10px 16px", borderRadius: 3, fontSize: 13, animation: "toastSlide 0.25s ease", display: "flex", alignItems: "center", gap: 12, boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 20px ${t.color}1a` }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
          <span style={{ color: "rgba(255,255,255,0.82)", lineHeight: 1.4, fontFamily: "'Barlow',sans-serif" }}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY ITEM CARD
// ─────────────────────────────────────────────────────────────────────────────
function ItemCard({ itemId, quantity }) {
  const item = ITEMS[itemId];
  if (!item) return null;
  const rar = RARITY[item.rarity];
  return (
    <div style={{ background: "rgba(3,8,18,0.78)", border: `1px solid ${rar.color}30`, borderLeft: `3px solid ${rar.color}60`, borderRadius: 3, padding: "14px", animation: "fadeIn 0.2s ease", transition: "border-color 0.2s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 4, background: rar.color + "18", border: `1px solid ${rar.color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: rar.glow ? `0 0 16px ${rar.color}40` : "none" }}>
          {item.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, color: "#fff", textTransform: "uppercase" }}>{item.name}</span>
            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", color: rar.color, flexShrink: 0 }}>×{quantity}</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <RarityBadge rarity={item.rarity} />
            <Tag color="rgba(91,196,232,0.3)">{item.category === "raw" ? "RAW MAT" : "REF GOOD"}</Tag>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic", lineHeight: 1.5 }}>{item.flavor}</p>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTOR TAB  (direct sector selection — no activity picker needed yet)
// ─────────────────────────────────────────────────────────────────────────────
function SectorTab({ mining, miningXP, warpLevel, maxCargo, cargo, onSelectSector }) {
  const level     = getLevel(miningXP);
  const cargoFull = cargo >= maxCargo;

  // 1-away rule: show unlocked + the very next locked tier only
  const visibleSectors = SECTORS.filter(s => s.reqWarp <= warpLevel + 1);
  const hasMoreHidden  = SECTORS.some(s => s.reqWarp > warpLevel + 1);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>

      {/* ── 1-line skill info ── */}
      <div style={{ padding: "10px 18px 9px", display: "flex", alignItems: "center", gap: 7, borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
        <div style={{ width: 2, height: 10, background: "#e8a838", opacity: 0.55, borderRadius: 1, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 3, color: "rgba(91,196,232,0.45)", textTransform: "uppercase", whiteSpace: "nowrap" }}>SELECT SECTOR</span>
        <span style={{ color: "rgba(91,196,232,0.18)", fontSize: 10, userSelect: "none" }}>·</span>
        <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "#e8a838", letterSpacing: 1, whiteSpace: "nowrap" }}>⛏ Asteroid Mining LV{level}</span>
        <span style={{ color: "rgba(91,196,232,0.18)", fontSize: 10, userSelect: "none" }}>·</span>
        <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.28)", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{xpToNext(miningXP)} XP to LV{Math.min(level + 1, 99)}</span>
        <div style={{ flex: 1, minWidth: 20, height: 1, background: "linear-gradient(90deg, rgba(91,196,232,0.1), transparent)" }} />
      </div>

      {/* Cargo full warning */}
      {cargoFull && (
        <div style={{ margin: "8px 16px 0", padding: "8px 12px", background: "rgba(232,168,56,0.06)", border: "1px solid rgba(232,168,56,0.22)", borderLeft: "3px solid rgba(232,168,56,0.55)", borderRadius: 3, fontSize: 11, color: "#e8a838", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>
          CARGO FULL — unload at base before mining
        </div>
      )}

      {/* Sector cards */}
      <div style={{ padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleSectors.map((sector, i) => {
          const locked    = sector.reqWarp > warpLevel;
          const isActive  = mining?.sectorId === sector.id;
          const activeMat = isActive ? sector.materials.find(m => m.id === mining.matId) : null;
          const activeItm = activeMat ? ITEMS[activeMat.id] : null;
          const clickable = !locked && !cargoFull;
          return (
            <div key={sector.id}
              onClick={() => clickable && onSelectSector(sector)}
              style={{ background: isActive ? `linear-gradient(135deg, rgba(3,8,18,0.98), ${sector.color}0d)` : "rgba(3,8,18,0.78)", border: `1px solid ${isActive ? sector.color + "40" : locked ? "rgba(91,196,232,0.05)" : "rgba(91,196,232,0.11)"}`, borderLeft: `3px solid ${isActive ? sector.color + "99" : locked ? "rgba(91,196,232,0.07)" : "rgba(91,196,232,0.2)"}`, borderRadius: 3, padding: "15px", cursor: clickable ? "pointer" : "default", opacity: locked ? 0.36 : cargoFull && !isActive ? 0.5 : 1, transition: "all 0.18s", animation: `slideUp ${0.08 + i * 0.06}s ease`, boxShadow: isActive ? `0 0 18px ${sector.color}12` : "none" }}
              onMouseEnter={e => { if (clickable) { e.currentTarget.style.borderColor = sector.color + "55"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isActive ? sector.color + "40" : locked ? "rgba(91,196,232,0.05)" : "rgba(91,196,232,0.11)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
                {/* Icon */}
                <div style={{ width: 44, height: 44, borderRadius: 4, background: locked ? "rgba(255,255,255,0.03)" : `${sector.color}16`, border: `1px solid ${locked ? "rgba(255,255,255,0.07)" : sector.color + "3a"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, position: "relative", boxShadow: isActive ? `0 0 12px ${sector.color}28` : "none" }}>
                  {locked ? "🔒" : sector.icon}
                  {isActive && <div style={{ position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: "50%", background: sector.color, border: "2px solid #030812", animation: "pulseGlow 1.4s infinite", boxShadow: `0 0 7px ${sector.color}` }} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "#fff", textTransform: "uppercase" }}>{sector.name}</span>
                    <span style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: isActive ? "#030812" : locked ? "rgba(255,255,255,0.3)" : sector.color, background: isActive ? sector.color : "transparent", border: `1px solid ${locked ? "rgba(255,255,255,0.12)" : sector.color + "88"}`, padding: "2px 8px", borderRadius: 2, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {locked ? `WARP ${sector.reqWarp}` : isActive ? "ACTIVE" : "ENTER →"}
                    </span>
                  </div>
                  {/* Region */}
                  <div style={{ fontSize: 10, color: "rgba(91,196,232,0.38)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, marginBottom: 7 }}>{sector.region}</div>
                  {/* Materials */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: isActive ? 10 : 0 }}>
                    {sector.materials.map(m => { const it = ITEMS[m.id]; const r = RARITY[it?.rarity || "common"]; return <Tag key={m.id} color={r.color}>{it?.icon} {it?.name}</Tag>; })}
                  </div>
                  {/* Active mining progress */}
                  {isActive && activeItm && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(91,196,232,0.4)", letterSpacing: 1, marginBottom: 5 }}>
                        <span>{activeItm.icon} {activeItm.name}</span>
                        <span>RUNS: {mining.completions || 0}</span>
                      </div>
                      <Bar value={mining.progress || 0} color={sector.color} height={4} glow />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {hasMoreHidden && (
          <div style={{ padding: "10px 14px", border: "1px dashed rgba(91,196,232,0.1)", borderRadius: 3, textAlign: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5 }}>
              // Weitere Sektoren freischaltbar mit höherem Warp Drive
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SectorScreen({ sector, mining, cargo, maxCargo, onStartMining }) {
  const cargoFull = cargo >= maxCargo;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease" }}>
      <div style={{ padding: "12px 18px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: `linear-gradient(180deg, ${sector.color}0a 0%, transparent 100%)` }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: `${sector.color}15`, border: `1px solid ${sector.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: `0 0 24px ${sector.color}22`, flexShrink: 0 }}>{sector.icon}</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, marginBottom: 3, color: "#fff" }}>{sector.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>📍 {sector.region}</div>
          </div>
        </div>
        <p style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.4)", fontStyle: "italic", lineHeight: 1.6 }}>{sector.lore}</p>
      </div>

      {cargoFull && (
        <div style={{ margin: "12px 18px 0", padding: "10px 14px", background: "rgba(232,168,56,0.07)", border: "1px solid rgba(232,168,56,0.28)", borderRadius: 8, fontSize: 13, color: "#e8a838" }}>
          ⚠️ Cargo hold full — return to base
        </div>
      )}

      <SectionLabel>AVAILABLE MATERIALS</SectionLabel>
      {sector.materials.map((matRef, i) => {
        const item = ITEMS[matRef.id];
        const rar = RARITY[item?.rarity || "common"];
        const isActive = mining?.sectorId === sector.id && mining?.matId === matRef.id;
        return (
          <div key={matRef.id}
            onClick={() => !cargoFull && onStartMining(sector.id, matRef.id)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", cursor: cargoFull ? "not-allowed" : "pointer", background: isActive ? `${sector.color}0e` : "transparent", borderBottom: "1px solid rgba(91,196,232,0.06)", borderLeft: `3px solid ${isActive ? sector.color : "transparent"}`, transition: "background 0.15s", position: "relative", overflow: "hidden", animation: `slideUp ${0.1 + i * 0.08}s ease`, opacity: cargoFull && !isActive ? 0.4 : 1 }}
            onMouseEnter={e => { if (!cargoFull) e.currentTarget.style.background = isActive ? `${sector.color}16` : "rgba(91,196,232,0.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = isActive ? `${sector.color}0e` : "transparent"; }}
          >
            {isActive && <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(mining.progress || 0) * 100}%`, background: `${sector.color}0a`, pointerEvents: "none", transition: "width 0.12s linear" }} />}
            <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 4, background: rar.color + "18", border: `1px solid ${isActive ? rar.color + "60" : rar.color + "30"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, position: "relative", boxShadow: rar.glow && isActive ? `0 0 16px ${rar.color}44` : "none" }}>
              {item?.icon}
              {isActive && <div style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%", background: sector.color, border: "2px solid #030812", animation: "pulseGlow 1.2s infinite", boxShadow: `0 0 6px ${sector.color}` }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, color: "#fff", textTransform: "uppercase" }}>{item?.name}</span>
                <RarityBadge rarity={item?.rarity} />
                {isActive && <Tag color={sector.color}>MINING</Tag>}
                {matRef.amount > 1 && <Tag color={rar.color}>×{matRef.amount} per run</Tag>}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic", lineHeight: 1.4, marginBottom: 8 }}>{item?.flavor}</p>
              <div style={{ display: "flex", gap: 6 }}>
                <Tag color="rgba(91,196,232,0.35)">T: {matRef.time}s</Tag>
                {isActive && mining.completions > 0 && <Tag color="rgba(91,196,232,0.35)">RUNS: {mining.completions}</Tag>}
              </div>
              {isActive && <div style={{ marginTop: 8 }}><Bar value={mining.progress || 0} color={sector.color} height={3} glow /></div>}
            </div>
            <span style={{ color: isActive ? sector.color : "rgba(91,196,232,0.22)", fontSize: 13, flexShrink: 0, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>[→]</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE SCREENS
// ─────────────────────────────────────────────────────────────────────────────

function BaseScreen({ refQueue, onOpenBuilding }) {
  const activeRecipe = refQueue.length > 0 ? RECIPES.find(r => r.id === refQueue[0]?.recipeId) : null;
  const activeItem   = activeRecipe ? ITEMS[activeRecipe.id] : null;

  // 1-away rule: show all available + next 1 locked only; rest become teaser count
  const availableBuildings = BUILDINGS.filter(b => b.available);
  const nextLocked  = BUILDINGS.find(b => !b.available);
  const hiddenCount = BUILDINGS.filter(b => !b.available).length - (nextLocked ? 1 : 0);
  const visible     = nextLocked ? [...availableBuildings, nextLocked] : availableBuildings;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>

      {/* Section header */}
      <div style={{ padding: "10px 18px 9px", display: "flex", alignItems: "center", gap: 7, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ width: 2, height: 10, background: "#5ec26a", opacity: 0.55, borderRadius: 1, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 3, color: "rgba(91,196,232,0.45)", textTransform: "uppercase" }}>HOMEBASE FACILITIES</span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(91,196,232,0.1), transparent)", marginLeft: 4 }} />
      </div>

      <div style={{ padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((b, i) => {
          const isActive  = b.id === "refinery" && refQueue.length > 0;
          const clickable = b.available;
          return (
            <div key={b.id}
              onClick={() => clickable && onOpenBuilding(b.id)}
              style={{ background: isActive ? `linear-gradient(135deg, rgba(3,8,18,0.98), ${b.color}0d)` : "rgba(3,8,18,0.78)", border: `1px solid ${isActive ? b.color + "40" : clickable ? "rgba(91,196,232,0.11)" : "rgba(91,196,232,0.05)"}`, borderLeft: `3px solid ${isActive ? b.color + "99" : clickable ? "rgba(91,196,232,0.2)" : "rgba(91,196,232,0.07)"}`, borderRadius: 3, padding: "15px", cursor: clickable ? "pointer" : "default", opacity: clickable ? 1 : 0.38, transition: "all 0.18s", animation: `slideUp ${0.08 + i * 0.07}s ease`, boxShadow: isActive ? `0 0 24px ${b.color}14` : "none" }}
              onMouseEnter={e => { if (clickable) { e.currentTarget.style.borderColor = b.color + "55"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isActive ? b.color + "40" : clickable ? "rgba(91,196,232,0.11)" : "rgba(91,196,232,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                {/* Icon */}
                <div style={{ width: 44, height: 44, borderRadius: 4, background: clickable ? `${b.color}16` : "rgba(255,255,255,0.03)", border: `1px solid ${clickable ? b.color + "3a" : "rgba(255,255,255,0.07)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0, position: "relative", boxShadow: isActive ? `0 0 14px ${b.color}28` : "none" }}>
                  {b.icon}
                  {isActive && <div style={{ position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: "50%", background: b.color, border: "2px solid #030812", animation: "pulseGlow 1.4s infinite", boxShadow: `0 0 7px ${b.color}` }} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "#fff", textTransform: "uppercase" }}>{b.name}</span>
                      {isActive && <Tag color={b.color}>PROCESSING</Tag>}
                    </div>
                    {clickable && (
                      <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, color: isActive ? b.color + "99" : "rgba(91,196,232,0.28)", flexShrink: 0 }}>[ → ]</span>
                    )}
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5, margin: 0, marginBottom: isActive ? 10 : 0 }}>{b.desc}</p>

                  {/* Active refinery progress */}
                  {isActive && activeItem && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(91,196,232,0.4)", letterSpacing: 1, marginBottom: 5 }}>
                        <span>{activeItem.icon} {activeItem.name}</span>
                        <span>QUEUE: {refQueue.length}</span>
                      </div>
                      <Bar value={refQueue[0]?.progress || 0} color={b.color} height={4} glow />
                    </>
                  )}

                  {/* Locked: unlock hint */}
                  {!clickable && (
                    <div style={{ fontSize: 10, color: "rgba(91,196,232,0.28)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, marginTop: 3 }}>
                      // Freischaltbar · Operation ausbauen
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Teaser for hidden buildings (>1-away) */}
        {hiddenCount > 0 && (
          <div style={{ padding: "10px 14px", border: "1px dashed rgba(91,196,232,0.1)", borderRadius: 3, textAlign: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5 }}>
              // {hiddenCount} weitere{hiddenCount === 1 ? "s Gebäude" : " Gebäude"} freischaltbar – Operation ausbauen
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function RefineryScreen({ inventory, credits, refQueue, moduleLevel, onQueue, onSell }) {
  const activeRecipe = refQueue.length > 0 ? RECIPES.find(r => r.id === refQueue[0]?.recipeId) : null;
  const activeItem = activeRecipe ? ITEMS[activeRecipe.id] : null;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease" }}>
      <div style={{ padding: "12px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg, rgba(94,194,106,0.06) 0%, transparent 100%)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: activeRecipe ? 14 : 0 }}>
          <div style={{ width: 46, height: 46, borderRadius: 10, background: "rgba(94,194,106,0.14)", border: "1px solid rgba(94,194,106,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⚗️</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, marginBottom: 3 }}>Refinery</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>Refine materials · Sell commodities</div>
          </div>
        </div>
        {activeRecipe && activeItem && (
          <div style={{ padding: "12px 14px", background: "rgba(94,194,106,0.06)", border: "1px solid rgba(94,194,106,0.18)", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.4)", letterSpacing: 0.5, marginBottom: 7 }}>
              <span>{activeItem.icon} {activeItem.name}</span>
              <span>Queue: {refQueue.length}</span>
            </div>
            <Bar value={refQueue[0]?.progress || 0} color="#5ec26a" height={5} glow />
          </div>
        )}
      </div>

      <SectionLabel>RECIPES</SectionLabel>
      {(() => {
        // 1-away rule: available + next tier only; everything beyond → teaser
        const visible = RECIPES.filter(r => r.reqModule <= moduleLevel + 1);
        const hiddenCount = RECIPES.filter(r => r.reqModule > moduleLevel + 1).length;
        return (
          <>
            {visible.map((recipe, i) => {
              const locked    = recipe.reqModule > moduleLevel;
              const item      = ITEMS[recipe.id];
              const rar       = RARITY[item?.rarity || "common"];
              const hasInputs = !locked && Object.entries(recipe.inputs).every(([k, v]) => (inventory[k] || 0) >= v);
              const qty       = inventory[recipe.id] || 0;
              return (
                <div key={recipe.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "16px 18px", opacity: locked ? 0.35 : 1, animation: `slideUp ${0.1 + i * 0.05}s ease` }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 50, height: 50, flexShrink: 0, borderRadius: 10, background: locked ? "rgba(255,255,255,0.04)" : rar.color + "15", border: `1px solid ${locked ? "rgba(255,255,255,0.06)" : rar.color + "33"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                      {locked ? "🔒" : item?.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.3, color: "#fff" }}>{item?.name}</span>
                        {!locked && <RarityBadge rarity={item?.rarity} />}
                        {qty > 0 && <Tag color={rar.color}>In stock: {qty}</Tag>}
                        {locked && <Tag color="rgba(255,255,255,0.18)">Module {recipe.reqModule} required</Tag>}
                      </div>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic", lineHeight: 1.4, marginBottom: locked ? 0 : 10 }}>{item?.flavor}</p>
                      {!locked && (
                        <>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                            {Object.entries(recipe.inputs).map(([k, v]) => {
                              const it = ITEMS[k]; const have = inventory[k] || 0; const ok = have >= v;
                              return <Tag key={k} color={ok ? "rgba(255,255,255,0.4)" : "#e05252"}>{it?.icon} {v}× {it?.name} ({have})</Tag>;
                            })}
                            <Tag color="rgba(91,196,232,0.35)">T: {recipe.time}s</Tag>
                            <Tag color="#f1c40f">VAL: {recipe.sellPrice} CR</Tag>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={() => onQueue(recipe.id)} disabled={!hasInputs} style={{ padding: "7px 16px", background: hasInputs ? "rgba(94,194,106,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${hasInputs ? "rgba(94,194,106,0.5)" : "rgba(255,255,255,0.08)"}`, borderRadius: 2, color: hasInputs ? "#5ec26a" : "rgba(255,255,255,0.18)", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, cursor: hasInputs ? "pointer" : "not-allowed", transition: "all 0.15s", textTransform: "uppercase" }}>
                              + REFINE
                            </button>
                            {qty > 0 && (
                              <button onClick={() => onSell(recipe.id)} style={{ padding: "7px 16px", background: "rgba(241,196,15,0.08)", border: "1px solid rgba(241,196,15,0.35)", borderRadius: 2, color: "#f1c40f", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, cursor: "pointer", textTransform: "uppercase" }}>
                                SELL ALL (+{qty * recipe.sellPrice} CR)
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {hiddenCount > 0 && (
              <div style={{ padding: "10px 18px 16px" }}>
                <div style={{ padding: "10px 14px", border: "1px dashed rgba(91,196,232,0.1)", borderRadius: 3, textAlign: "center" }}>
                  <span style={{ fontSize: 10, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5 }}>
                    // Weitere Rezepte freischaltbar – Raffinerie ausbauen
                  </span>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIP SCREEN  (Map + Tech Tree)
// ─────────────────────────────────────────────────────────────────────────────

function ShipScreen({ credits, inventory, installed, warpLevel, currentLocation, travelling, onBuy, onTravel }) {

  const canAfford = (upg) => {
    if (credits < (upg.cost.credits || 0)) return false;
    for (const [k, v] of Object.entries(upg.cost)) { if (k !== "credits" && (inventory[k] || 0) < v) return false; }
    return true;
  };

  const formatCost = (cost) => {
    const parts = [];
    if (cost.credits) parts.push(`${cost.credits} CR`);
    for (const [k, v] of Object.entries(cost)) {
      if (k === "credits") continue;
      parts.push(`${v}× ${ITEMS[k]?.name || k}`);
    }
    return parts.join(" + ");
  };

  // Current position data
  const isHome   = currentLocation === "home";
  const atSector = !isHome ? SECTORS.find(s => s.id === currentLocation) : null;
  const locName  = isHome ? HOME_LOCATION.name   : (atSector?.name   || "Unbekannt");
  const locRegion = isHome ? HOME_LOCATION.region : (atSector?.region || "");

  // Map destinations: all sectors with 1-away rule, skip current; add home if away
  const destinations = [];
  if (!isHome) destinations.push(HOME_LOCATION);
  SECTORS.forEach(s => {
    if (s.id === "home") return;          // home is handled by HOME_LOCATION above
    if (s.id === currentLocation) return;
    if (s.reqWarp <= warpLevel + 1) destinations.push(s);
  });
  const hasMoreDest = SECTORS.some(s => s.id !== "home" && s.id !== currentLocation && s.reqWarp > warpLevel + 1);

  // Tech tree — warp drives (primary, unlock new locations)
  const warpUpgs       = SHIP_UPGRADES.filter(u => u.cat === "warp");
  const installedWarp  = warpUpgs.filter(u => installed[u.id]);
  const nextWarp       = warpUpgs.find(u => !installed[u.id] && Object.keys(u.req).every(k => installed[k]));
  const hasLockedWarp  = warpUpgs.some(u => !installed[u.id] && Object.keys(u.req).some(k => !installed[k]));

  // Secondary upgrades — cargo + module (show next installable only)
  const secUpgs = ["cargo", "module"].map(cat => ({
    cat,
    next: SHIP_UPGRADES.filter(u => u.cat === cat).find(u => !installed[u.id] && Object.keys(u.req).every(k => installed[k])),
    installedCount: SHIP_UPGRADES.filter(u => u.cat === cat && installed[u.id]).length,
  })).filter(x => x.next);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease", paddingBottom: 32 }}>

      {/* ── Current Position ── */}
      <div style={{ padding: "20px 18px 16px", background: "linear-gradient(180deg, rgba(91,196,232,0.06) 0%, transparent 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "rgba(91,196,232,0.38)", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", marginBottom: 8 }}>
          📍 Aktuelle Position
        </div>
        <div style={{ fontSize: 24, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: "#5bc4e8", textTransform: "uppercase", lineHeight: 1, marginBottom: 5 }}>
          {locName}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5 }}>
          {locRegion}
        </div>

        {/* ── Travel progress bar ── */}
        {travelling && (() => {
          const dest = travelling.destId === "home" ? HOME_LOCATION : SECTORS.find(s => s.id === travelling.destId);
          return (
            <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(91,196,232,0.05)", border: "1px solid rgba(91,196,232,0.15)", borderLeft: "3px solid rgba(91,196,232,0.4)", borderRadius: 3 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(91,196,232,0.8)", letterSpacing: 1.5 }}>
                  ⏳ REISE ZU {(dest?.name || travelling.destId).toUpperCase()}
                </span>
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>
                  {Math.ceil(TRAVEL_SECS * (1 - travelling.progress))}s
                </span>
              </div>
              <Bar value={travelling.progress} color="#5bc4e8" height={3} glow />
            </div>
          );
        })()}
      </div>

      {/* ── Map / Destinations ── */}
      <SectionLabel>ERREICHBARE ORTE</SectionLabel>
      <div style={{ paddingTop: 8, paddingBottom: 4 }}>
        {destinations.map((dest, i) => {
          const locked      = dest.reqWarp > warpLevel;
          const isTravDest  = travelling?.destId === dest.id;
          const sector      = dest.id !== "home" ? dest : null;
          const destColor   = dest.color || "#5bc4e8";
          return (
            <div
              key={dest.id}
              style={{ margin: "0 16px 10px", padding: "14px 16px", background: locked ? "rgba(3,8,18,0.35)" : "rgba(3,8,18,0.65)", border: `1px solid ${locked ? "rgba(255,255,255,0.06)" : destColor + "28"}`, borderLeft: `3px solid ${locked ? "rgba(255,255,255,0.08)" : destColor + "55"}`, borderRadius: 4, opacity: locked ? 0.4 : 1, animation: `slideUp ${0.08 + i * 0.06}s ease` }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 20, lineHeight: 1.3, flexShrink: 0 }}>{dest.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1.5, color: locked ? "rgba(255,255,255,0.3)" : "#fff", textTransform: "uppercase" }}>{dest.name}</span>
                    {/* LOCKED badge */}
                    {locked && (
                      <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 2, flexShrink: 0 }}>
                        WARP {dest.reqWarp}
                      </span>
                    )}
                    {/* REISEN button */}
                    {!locked && !isTravDest && (
                      <button
                        onClick={() => !travelling && onTravel(dest.id)}
                        className={!travelling ? "btn-glow" : ""}
                        style={{ padding: "4px 12px", background: travelling ? "rgba(255,255,255,0.03)" : destColor + "18", border: `1px solid ${travelling ? "rgba(255,255,255,0.08)" : destColor + "55"}`, borderRadius: 2, color: travelling ? "rgba(255,255,255,0.18)" : destColor, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, cursor: travelling ? "default" : "pointer", textTransform: "uppercase", flexShrink: 0, transition: "all 0.15s" }}
                      >
                        {travelling ? "UNTERWEGS" : "REISEN"}
                      </button>
                    )}
                    {/* In-progress indicator */}
                    {isTravDest && (
                      <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "#5bc4e8", letterSpacing: 1, flexShrink: 0 }}>
                        ⏳ {Math.ceil(TRAVEL_SECS * (1 - (travelling?.progress || 0)))}s
                      </span>
                    )}
                  </div>
                  {/* Region */}
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, marginBottom: !locked && sector ? 6 : 0 }}>{dest.region}</div>
                  {/* Materials preview */}
                  {!locked && sector?.materials && (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      {sector.materials.map(m => {
                        const item = ITEMS[m.id];
                        return <span key={m.id} style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: 0.3 }}>{item?.icon} {item?.name}</span>;
                      })}
                    </div>
                  )}
                  {/* Lock reason */}
                  {locked && (
                    <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: 0.5 }}>
                      LOCKED – Warp Drive {dest.reqWarp} erforderlich
                    </div>
                  )}
                  {/* Travel time */}
                  {!locked && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5 }}>Reisezeit: {TRAVEL_SECS}s</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {hasMoreDest && (
          <div style={{ padding: "4px 18px 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: 1.5, whiteSpace: "nowrap" }}>// Weitere Orte freischaltbar mit höherem Schiff-Tier</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
          </div>
        )}
      </div>

      {/* ── Warp Drive Tech Tree ── */}
      <SectionLabel>SCHIFF UPGRADES</SectionLabel>
      <div style={{ paddingTop: 4 }}>
        {/* Installed warp drives — compact rows */}
        {installedWarp.map(u => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", opacity: 0.4 }}>
            <span style={{ fontSize: 14 }}>{u.icon}</span>
            <span style={{ flex: 1, fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, color: "#5ec26a", textTransform: "uppercase" }}>{u.name}</span>
            <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "#5ec26a", letterSpacing: 1.5 }}>✓ INSTALLIERT</span>
          </div>
        ))}

        {/* Next warp upgrade card */}
        {nextWarp && (() => {
          const affordable = canAfford(nextWarp);
          return (
            <div style={{ margin: "4px 16px 10px", padding: "14px 16px", background: "rgba(3,8,18,0.65)", border: "1px solid rgba(63,167,214,0.22)", borderLeft: "3px solid rgba(63,167,214,0.5)", borderRadius: 4, animation: "slideUp 0.12s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{nextWarp.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1.5, color: "#fff", textTransform: "uppercase", lineHeight: 1, marginBottom: 3 }}>{nextWarp.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", fontFamily: "'Barlow',sans-serif" }}>{nextWarp.desc}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.45)", letterSpacing: 0.5, marginBottom: 10 }}>{formatCost(nextWarp.cost)}</div>
              <button
                onClick={affordable ? () => onBuy(nextWarp) : undefined}
                className={affordable ? "btn-glow" : ""}
                style={{ width: "100%", padding: "10px 0", background: affordable ? "rgba(63,167,214,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${affordable ? "rgba(63,167,214,0.45)" : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: affordable ? "#3fa7d6" : "rgba(255,255,255,0.2)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: affordable ? "pointer" : "default", transition: "all 0.15s" }}
              >
                {affordable ? "INSTALLIEREN" : "BAUEN – INSUFFICIENT RESOURCES"}
              </button>
            </div>
          );
        })()}

        {/* Teaser for locked warp tiers */}
        {hasLockedWarp && nextWarp && (
          <div style={{ padding: "2px 18px 4px" }}>
            <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.15)", letterSpacing: 1.5 }}>// Tier {nextWarp.effect.warp + 1}+ ausgeblendet bis installiert</span>
          </div>
        )}
        {!nextWarp && warpUpgs.every(u => installed[u.id]) && (
          <div style={{ padding: "8px 18px" }}>
            <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "#5ec26a", letterSpacing: 2 }}>// WARP DRIVE — MAX TIER</span>
          </div>
        )}
      </div>

      {/* ── Secondary Upgrades (Cargo + Module) ── */}
      {secUpgs.length > 0 && (
        <>
          <SectionLabel>WEITERE UPGRADES</SectionLabel>
          <div style={{ paddingTop: 4 }}>
            {secUpgs.map(({ cat, next, installedCount }) => {
              const affordable = canAfford(next);
              const catColor   = cat === "cargo" ? "#e8a838" : "#5ec26a";
              return (
                <div key={cat} style={{ margin: "0 16px 10px", padding: "12px 14px", background: "rgba(3,8,18,0.55)", border: `1px solid ${catColor}18`, borderLeft: `3px solid ${catColor}40`, borderRadius: 3, animation: "slideUp 0.15s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{next.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1, color: "#fff", textTransform: "uppercase" }}>{next.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow',sans-serif" }}>{next.desc}</div>
                    </div>
                    {installedCount > 0 && (
                      <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: catColor, letterSpacing: 1, flexShrink: 0 }}>LV {installedCount}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.38)", letterSpacing: 0.5, marginBottom: 8 }}>{formatCost(next.cost)}</div>
                  <button
                    onClick={affordable ? () => onBuy(next) : undefined}
                    className={affordable ? "btn-glow" : ""}
                    style={{ width: "100%", padding: "8px 0", background: affordable ? catColor + "10" : "rgba(255,255,255,0.02)", border: `1px solid ${affordable ? catColor + "40" : "rgba(255,255,255,0.07)"}`, borderRadius: 2, color: affordable ? catColor : "rgba(255,255,255,0.18)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: affordable ? "pointer" : "default", transition: "all 0.15s" }}
                  >
                    {affordable ? "INSTALLIEREN" : "INSUFFICIENT RESOURCES"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORT SCREEN (Location overview — skills + buildings)
// ─────────────────────────────────────────────────────────────────────────────

const ORT_SKILLS = [
  { id: "mining",    icon: "⛏", name: "Mining"                  },
  { id: "salvaging", icon: "🔩", name: "Salvaging"              },
  { id: "refining",  icon: "⚗", name: "Refining"                },
  { id: "crafting",  icon: "🔧", name: "Crafting", locked: true  },
];

const PROFIL_SKILLS = [
  { id: "mining",    icon: "⛏", name: "Mining",    color: "#e8a838" },
  { id: "salvaging", icon: "🔩", name: "Salvaging", color: "#3fa7d6" },
  { id: "refining",  icon: "⚗", name: "Refining",  color: "#5ec26a" },
  { id: "crafting",  icon: "🔧", name: "Crafting",  color: "#9b59b6", locked: true },
  { id: "combat",    icon: "⚔", name: "Combat",    color: "#e05252", locked: true },
];

function OrtScreen({ mining, salvaging, refQueue, buildingLevels, currentLocation, onNavigate }) {
  const isMiningActive    = !!mining;
  const isSalvagingActive = !!salvaging;
  const isRefiningActive  = refQueue.length > 0;

  // Refinery badge: "läuft · Xs"
  const activeRefRecipe = isRefiningActive ? RECIPES.find(r => r.id === refQueue[0]?.recipeId) : null;
  const refTimeSec      = activeRefRecipe ? Math.ceil(activeRefRecipe.time * (1 - (refQueue[0]?.progress || 0))) : 0;
  const refBadge        = isRefiningActive ? `läuft · ${refTimeSec}s` : null;

  const handleSkillClick = (id) => {
    if (id === "mining")    onNavigate("miningDetail");
    if (id === "salvaging") onNavigate("salvagingDetail");
    if (id === "refining")  onNavigate("refiningDetail");
  };

  // 1-away rule: show all available buildings + the first locked one only
  const availableBuildings = BUILDINGS.filter(b => b.available);
  const firstLocked        = BUILDINGS.find(b => !b.available);
  const hasMoreHidden      = BUILDINGS.filter(b => !b.available).length > 1;
  const visibleBuildings   = firstLocked ? [...availableBuildings, firstLocked] : availableBuildings;

  // Dynamic location
  const isHome    = currentLocation === "home";
  const sector    = !isHome ? SECTORS.find(s => s.id === currentLocation) : null;
  const locName   = isHome ? HOME_LOCATION.name   : (sector?.name   || "Unbekannt");
  const locRegion = isHome ? HOME_LOCATION.region : (sector?.region || "");
  const locColor  = isHome ? HOME_LOCATION.color  : (sector?.color  || "#5bc4e8");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>

      {/* ── Location header / Hero Banner ── */}
      {isHome ? (
        <div style={{ padding: "16px 16px 0" }}>
          <HeroBanner variant="abandoned" icon="🏠" name="Abandoned Planet" />
          <div style={{ marginTop: -12, marginBottom: 8, padding: "0 2px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5 }}>
              {HOME_LOCATION.region}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "20px 18px 16px", background: "linear-gradient(180deg, rgba(91,196,232,0.06) 0%, transparent 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "rgba(91,196,232,0.38)", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", marginBottom: 8 }}>
            📍 Standort
          </div>
          <div style={{ fontSize: 28, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: locColor, textShadow: `0 0 24px ${locColor}40`, textTransform: "uppercase", lineHeight: 1, marginBottom: 6 }}>
            {locName}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5 }}>
            {locRegion}
          </div>
        </div>
      )}

      {/* ── Skills ── */}
      <SectionLabel>SKILLS</SectionLabel>
      {ORT_SKILLS.map((skill, i) => {
        const active   = (skill.id === "mining" && isMiningActive) || (skill.id === "salvaging" && isSalvagingActive) || (skill.id === "refining" && isRefiningActive);
        const isLocked = !!skill.locked;
        const badge    = skill.id === "refining" ? refBadge : null;
        return (
          <RowItem
            key={skill.id}
            icon={skill.icon}
            name={skill.name}
            locked={isLocked}
            active={active}
            badge={badge}
            onClick={!isLocked ? () => handleSkillClick(skill.id) : null}
            animDelay={i * 0.05}
          />
        );
      })}

      {/* ── Buildings ── */}
      <SectionLabel>GEBÄUDE</SectionLabel>
      <div style={{ paddingTop: 8, paddingBottom: 4 }}>
        {visibleBuildings.map((b, i) => {
          const active = b.id === "refinery" && isRefiningActive;
          const badge  = b.id === "refinery" ? refBadge : null;
          const level  = buildingLevels[b.id] || 1;
          return (
            <BuildingCard
              key={b.id}
              building={b}
              level={level}
              active={active}
              badge={badge}
              onClick={b.available ? () => onNavigate("buildingDetail", b.id) : null}
              animDelay={(ORT_SKILLS.length + i) * 0.05}
            />
          );
        })}
        {hasMoreHidden && (
          <div style={{ padding: "6px 18px 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
            <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: 1.5, whiteSpace: "nowrap" }}>// Weitere Gebäude freischaltbar</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
          </div>
        )}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// BUILDING DETAIL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function BuildingDetailScreen({ buildingId, buildingLevels, inventory, credits, onUpgrade }) {
  const building     = BUILDINGS.find(b => b.id === buildingId);
  if (!building) return null;
  const level        = buildingLevels[buildingId] || 1;
  const currentData  = building.levels?.find(l => l.level === level) || building.levels?.[0];
  const nextData     = building.levels?.find(l => l.level === level + 1);

  const formatCost = (cost) => {
    if (!cost) return "—";
    const parts = [];
    if (cost.credits) parts.push(`${cost.credits} CR`);
    for (const [k, v] of Object.entries(cost)) {
      if (k === "credits") continue;
      const item = ITEMS[k];
      parts.push(`${v}× ${item?.name || k}`);
    }
    return parts.join(" + ");
  };

  const canAfford = nextData?.cost ? (() => {
    const cost = nextData.cost;
    if (cost.credits && credits < cost.credits) return false;
    for (const [k, v] of Object.entries(cost)) {
      if (k !== "credits" && (inventory[k] || 0) < v) return false;
    }
    return true;
  })() : false;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>

      {/* ── Building header ── */}
      <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg, rgba(91,196,232,0.04) 0%, transparent 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 4, background: building.color + "18", border: `1px solid ${building.color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: `0 0 16px ${building.color}22` }}>
            {building.icon}
          </div>
          <div>
            <div style={{ fontSize: 18, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: "#fff", textTransform: "uppercase", lineHeight: 1 }}>
              {building.name}
            </div>
            <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: building.color, letterSpacing: 1, marginTop: 4 }}>
              Level {level} · {currentData?.label}
            </div>
          </div>
        </div>
      </div>

      {/* ── Upgrade section ── */}
      {nextData ? (
        <>
          <SectionLabel>UPGRADE AUF LV. {level + 1}</SectionLabel>
          <div style={{ padding: "4px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Kosten</span>
              <span style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.65)", letterSpacing: 0.5 }}>{formatCost(nextData.cost)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Effekt</span>
              <span style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", color: building.color, letterSpacing: 0.5 }}>{nextData.label}</span>
            </div>
            <button
              onClick={canAfford ? onUpgrade : undefined}
              className={canAfford ? "btn-glow" : ""}
              style={{ marginTop: 6, padding: "11px 0", background: canAfford ? building.color + "1a" : "rgba(255,255,255,0.02)", border: `1px solid ${canAfford ? building.color + "50" : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: canAfford ? building.color : "rgba(255,255,255,0.2)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: canAfford ? "pointer" : "default", transition: "all 0.15s", width: "100%" }}
            >
              {canAfford ? `UPGRADE → LV. ${level + 1}` : "UPGRADE – INSUFFICIENT RESOURCES"}
            </button>
          </div>
        </>
      ) : (
        <div style={{ padding: "18px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 10, background: building.color, opacity: 0.5, borderRadius: 1 }} />
          <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: building.color, letterSpacing: 2, textTransform: "uppercase" }}>MAX LEVEL ERREICHT</span>
        </div>
      )}
    </div>
  );
}

// HERO BANNER (atmospheric header for all skill detail screens)
// ─────────────────────────────────────────────────────────────────────────────
function HeroBanner({ variant, icon, name, level, xp, extra }) {
  const xpPercent = xp !== undefined ? getLvlProg(xp) * 100 : 0;
  const xpNext    = xp !== undefined && level !== undefined ? xpToNext(xp) : null;
  return (
    <div className={`hero-banner hero-banner--${variant}`}>
      <div className="hero-banner-content">
        <div className="hero-banner-title">
          {icon} {name}
          {level !== undefined && <span className="hero-banner-level">LV {level}</span>}
          {extra && <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{extra}</span>}
        </div>
        {xpNext !== null && (
          <div className="hero-banner-xp-row">
            <div className="hero-banner-xp-bar">
              <div className="hero-banner-xp-fill" style={{ width: `${xpPercent}%` }} />
            </div>
            <span className="hero-banner-xp-text">{xpNext} XP to LV {level + 1}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ResourceModal({ resource, onStart, onClose, cargoFree }) {
  const maxActions = Math.max(1, cargoFree);
  const [quantity, setQuantity] = useState(Math.min(10, maxActions));

  const setQ = (val) => setQuantity(Math.min(maxActions, Math.max(1, val)));

  const formatTime = (s) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60), r = s % 60;
    return `${m}m${r > 0 ? ` ${r}s` : ""}`;
  };

  const totalSeconds = quantity * resource.timeSeconds;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <span>{resource.icon} {resource.name.toUpperCase()}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-info-row">
          <div className="modal-icon">{resource.icon}</div>
          <div className="modal-stats">
            <span className={`badge badge--${resource.rarity.toLowerCase()}`}>{resource.rarity}</span>
            <div className="text-detail" style={{ marginTop: 8 }}>⏱ {resource.timeSeconds}s pro Aktion</div>
            <div className="text-detail" style={{ color: "var(--accent-cyan)" }}>+{resource.xpPerAction} XP pro Aktion</div>
          </div>
        </div>

        <div className="modal-divider" />

        <div className="modal-qty-label">ANZAHL AKTIONEN</div>

        <div className="modal-qty-row">
          <button className="qty-btn" onClick={() => setQ(1)}>MIN</button>
          <button className="qty-btn" onClick={() => setQ(quantity - 1)}>−</button>
          <input
            className="qty-input"
            type="number"
            value={quantity}
            min={1}
            max={maxActions}
            onChange={e => setQ(parseInt(e.target.value) || 1)}
          />
          <button className="qty-btn" onClick={() => setQ(quantity + 1)}>+</button>
          <button className="qty-btn" onClick={() => setQ(maxActions)}>MAX</button>
        </div>

        <div className="modal-estimate">
          Dauer: <strong>{formatTime(totalSeconds)}</strong>
          &nbsp;·&nbsp;
          Cargo: {quantity} / {cargoFree} frei
        </div>

        <button
          className="btn-primary"
          style={{ width: "100%", marginTop: 4 }}
          onClick={() => { onStart(resource, quantity); onClose(); }}
        >
          ▶ {quantity} AKTIONEN STARTEN
        </button>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MINING SKILL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function MiningSkillScreen({ miningXP, warpLevel, mining, cargo, maxCargo, onStartMining }) {
  const level     = getLevel(miningXP);
  const cargoFull = cargo >= maxCargo;
  const cargoFree = maxCargo - cargo;
  const [modalResource, setModalResource] = useState(null);

  // Flat list of all material+sector entries (1-away rule)
  const entries = [];
  SECTORS.forEach(sector => {
    if (sector.reqWarp > warpLevel + 1) return;
    sector.materials.forEach(matRef => entries.push({ sector, matRef, locked: sector.reqWarp > warpLevel }));
  });

  const openModal = (sector, matRef, item) => {
    setModalResource({
      sectorId: sector.id,
      matId: matRef.id,
      icon: item.icon,
      name: item.name,
      rarity: item.rarity || "common",
      timeSeconds: matRef.time,
      xpPerAction: Math.round(matRef.time * 0.8),
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>
      <div style={{ padding: "16px 16px 0" }}>
        <HeroBanner variant="mining" icon="⛏" name="Mining" level={level} xp={miningXP} />
      </div>

      {cargoFull && (
        <div style={{ margin: "8px 16px 0", padding: "8px 12px", background: "rgba(232,168,56,0.06)", border: "1px solid rgba(232,168,56,0.22)", borderLeft: "3px solid rgba(232,168,56,0.55)", borderRadius: 3, fontSize: 11, color: "#e8a838", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>
          CARGO VOLL — Raffinerie nutzen oder Waren verkaufen
        </div>
      )}

      <SectionLabel>VERFÜGBARE RESSOURCEN</SectionLabel>

      <div style={{ padding: "0 16px 28px" }}>
        {entries.map(({ sector, matRef, locked }, i) => {
          const item     = ITEMS[matRef.id];
          const isActive = mining?.sectorId === sector.id && mining?.matId === matRef.id;
          const canClick = !locked && !cargoFull && !isActive;

          return (
            <div key={`${sector.id}-${matRef.id}`}
              className="item-row"
              onClick={() => canClick && item && openModal(sector, matRef, item)}
              style={{
                opacity: locked ? 0.35 : cargoFull && !isActive ? 0.5 : 1,
                animation: `slideUp ${0.08 + i * 0.05}s ease`,
                background: isActive ? `${sector.color}12` : undefined,
                borderColor: isActive ? `${sector.color}50` : undefined,
                cursor: canClick ? "pointer" : "default",
              }}>
              <div className="item-row-icon" style={{ position: "relative" }}>
                {item?.icon}
                {isActive && <div style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: sector.color, border: "2px solid #030812", animation: "pulseGlow 1.2s infinite" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span className="text-item-name">{item?.name}</span>
                  <RarityBadge rarity={item?.rarity} />
                  {matRef.amount > 1 && <Tag color={RARITY[item?.rarity || "common"].color}>×{matRef.amount}</Tag>}
                </div>
                <div className="text-detail" style={{ marginBottom: isActive ? 8 : 0 }}>
                  {sector.name}
                  {!locked && <span style={{ color: "var(--accent-cyan)", opacity: 0.6, marginLeft: 8 }}>T: {matRef.time}s</span>}
                  {locked && <span style={{ marginLeft: 8 }}>Warp {sector.reqWarp} erforderlich</span>}
                </div>
                {isActive && <Bar value={mining.progress || 0} color={sector.color} height={3} glow />}
              </div>
              {locked ? (
                <span className="badge badge--common" style={{ flexShrink: 0 }}>WARP {sector.reqWarp}</span>
              ) : isActive ? (
                <button className="btn-stop" onClick={e => { e.stopPropagation(); onStartMining(sector.id, matRef.id); }} style={{ flexShrink: 0 }}>STOP</button>
              ) : (
                <span style={{ fontSize: 11, color: canClick ? "var(--accent-cyan)" : "var(--text-muted)", opacity: canClick ? 0.7 : 1, flexShrink: 0 }}>
                  {cargoFull ? "FULL" : "▶"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {modalResource && (
        <ResourceModal
          resource={modalResource}
          cargoFree={cargoFree}
          onStart={(res, qty) => onStartMining(res.sectorId, res.matId, qty)}
          onClose={() => setModalResource(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SALVAGING SKILL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function SalvagingSkillScreen({ salvagingXP, salvaging, cargo, maxCargo, onStartSalvaging }) {
  const level     = getLevel(salvagingXP);
  const cargoFull = cargo >= maxCargo;
  const cargoFree = maxCargo - cargo;
  const [modalResource, setModalResource] = useState(null);

  const openModal = (mat, item) => {
    setModalResource({
      matId: mat.id,
      icon: item.icon,
      name: item.name,
      rarity: item.rarity || "common",
      timeSeconds: mat.time,
      xpPerAction: Math.round(mat.time * 0.2),
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>
      <div style={{ padding: "16px 16px 0" }}>
        <HeroBanner variant="salvaging" icon="🔩" name="Salvaging" level={level} xp={salvagingXP} />
      </div>

      {cargoFull && (
        <div style={{ margin: "8px 16px 0", padding: "8px 12px", background: "rgba(232,168,56,0.06)", border: "1px solid rgba(232,168,56,0.22)", borderLeft: "3px solid rgba(232,168,56,0.55)", borderRadius: 3, fontSize: 11, color: "#e8a838", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>
          CARGO VOLL — Raffinerie nutzen oder Waren verkaufen
        </div>
      )}

      <SectionLabel>VERFÜGBARE RESSOURCEN</SectionLabel>

      <div style={{ padding: "0 16px 28px" }}>
        {SALVAGING_MATS.map((mat, i) => {
          const item     = ITEMS[mat.id];
          const isActive = salvaging?.matId === mat.id;
          const canClick = !cargoFull && !isActive;

          return (
            <div key={mat.id}
              className="item-row"
              onClick={() => canClick && item && openModal(mat, item)}
              style={{
                opacity: cargoFull && !isActive ? 0.5 : 1,
                animation: `slideUp ${0.08 + i * 0.05}s ease`,
                background: isActive ? "rgba(63,167,214,0.1)" : undefined,
                borderColor: isActive ? "rgba(63,167,214,0.35)" : undefined,
                cursor: canClick ? "pointer" : "default",
              }}>
              <div className="item-row-icon" style={{ position: "relative" }}>
                {item?.icon}
                {isActive && <div style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#3fa7d6", border: "2px solid #030812", animation: "pulseGlow 1.2s infinite" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span className="text-item-name">{item?.name}</span>
                  <RarityBadge rarity={item?.rarity} />
                </div>
                <div className="text-detail" style={{ marginBottom: isActive ? 8 : 0 }}>
                  Abandoned Planet
                  <span style={{ color: "var(--accent-cyan)", opacity: 0.6, marginLeft: 8 }}>T: {mat.time}s</span>
                </div>
                {isActive && <Bar value={salvaging.progress || 0} color="#3fa7d6" height={3} glow />}
              </div>
              {isActive ? (
                <button className="btn-stop" onClick={e => { e.stopPropagation(); onStartSalvaging(mat.id); }} style={{ flexShrink: 0 }}>STOP</button>
              ) : (
                <span style={{ fontSize: 11, color: canClick ? "var(--accent-cyan)" : "var(--text-muted)", opacity: canClick ? 0.7 : 1, flexShrink: 0 }}>
                  {cargoFull ? "FULL" : "▶"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {modalResource && (
        <ResourceModal
          resource={modalResource}
          cargoFree={cargoFree}
          onStart={(res, qty) => onStartSalvaging(res.matId, qty)}
          onClose={() => setModalResource(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REFINING SKILL SCREEN (passive — runs parallel)
// ─────────────────────────────────────────────────────────────────────────────
function RefiningSkillScreen({ inventory, refQueue, moduleLevel, onQueue, onSell }) {
  const activeRecipe = refQueue.length > 0 ? RECIPES.find(r => r.id === refQueue[0]?.recipeId) : null;
  const activeItem   = activeRecipe ? ITEMS[activeRecipe.id] : null;
  const visible      = RECIPES.filter(r => r.reqModule <= moduleLevel + 1);
  const hiddenCount  = RECIPES.filter(r => r.reqModule > moduleLevel + 1).length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>
      <div style={{ padding: "16px 16px 0" }}>
        <HeroBanner variant="refining" icon="⚗" name="Refining" extra="· Passiv" />
      </div>

      {activeRecipe && activeItem && (
        <div style={{ margin: "10px 16px 0", padding: "10px 12px", background: "rgba(94,194,106,0.06)", border: "1px solid rgba(94,194,106,0.2)", borderLeft: "3px solid rgba(94,194,106,0.5)", borderRadius: 3 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: "#5ec26a", letterSpacing: 1, marginBottom: 6 }}>
            <span>⚗ {activeItem.name}</span>
            {refQueue.length > 1 && <span>+{refQueue.length - 1} in Queue</span>}
          </div>
          <Bar value={refQueue[0]?.progress || 0} color="#5ec26a" height={3} glow />
        </div>
      )}

      <SectionLabel>REZEPTE</SectionLabel>

      {visible.map((recipe, i) => {
        const locked     = recipe.reqModule > moduleLevel;
        const item       = ITEMS[recipe.id];
        const rar        = RARITY[item?.rarity || "common"];
        const hasInputs  = !locked && Object.entries(recipe.inputs).every(([k, v]) => (inventory[k] || 0) >= v);
        const qty        = inventory[recipe.id] || 0;
        const inputSummary = Object.entries(recipe.inputs).map(([k, v]) => `${v}× ${ITEMS[k]?.name || k}`).join(" · ");

        return (
          <div key={recipe.id} style={{ padding: "13px 18px", borderBottom: "1px solid rgba(91,196,232,0.05)", opacity: locked ? 0.35 : 1, animation: `slideUp ${0.08 + i * 0.05}s ease` }}>
            {locked ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20, width: 42, textAlign: "center", flexShrink: 0 }}>🔒</span>
                <div>
                  <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{item?.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>// Modul {recipe.reqModule} erforderlich</div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 4, background: rar.color + "15", border: `1px solid ${rar.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{item?.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 0.5, color: "#fff" }}>{item?.name}</span>
                    {qty > 0 && <Tag color={rar.color}>×{qty}</Tag>}
                  </div>
                  <div style={{ fontSize: 10, color: hasInputs ? "rgba(255,255,255,0.35)" : "rgba(232,80,80,0.6)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5 }}>
                    {inputSummary} → T: {recipe.time}s · {recipe.sellPrice} CR
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => onQueue(recipe.id)} disabled={!hasInputs}
                    className="btn-primary" style={{ padding: "7px 12px", fontSize: 11 }}>
                    + REFINE
                  </button>
                  {qty > 0 && (
                    <button onClick={() => onSell(recipe.id)}
                      style={{ padding: "5px 12px", background: "rgba(241,196,15,0.08)", border: "1px solid rgba(241,196,15,0.3)", borderRadius: 4, color: "#f1c40f", fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, cursor: "pointer", textTransform: "uppercase" }}>
                      SELL ×{qty}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <div style={{ padding: "10px 18px" }}>
          <div style={{ padding: "10px 14px", border: "1px dashed rgba(91,196,232,0.1)", borderRadius: 3, textAlign: "center" }}>
            <span style={{ fontSize: 10, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5 }}>
              // Weitere Rezepte freischaltbar – Modul upgraden
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CRAFTING SKILL SCREEN (placeholder — skill locked)
// ─────────────────────────────────────────────────────────────────────────────
function CraftingSkillScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>
      <div style={{ padding: "16px 16px 0" }}>
        <HeroBanner variant="crafting" icon="🔧" name="Crafting" level={1} />
      </div>
      <SectionLabel>REZEPTE</SectionLabel>
      {CRAFT_RECIPES.map((recipe, i) => {
        const item    = ITEMS[recipe.id];
        const locked  = recipe.reqLevel > 1;
        const rar     = item ? RARITY[item.rarity || "common"] : null;
        const inputSummary = Object.entries(recipe.inputs).map(([k, v]) => `${v}× ${ITEMS[k]?.name || k}`).join(" + ");
        return (
          <div key={recipe.id} style={{ padding: "13px 18px", borderBottom: "1px solid rgba(91,196,232,0.05)", opacity: locked ? 0.35 : 1, animation: `slideUp ${0.08 + i * 0.05}s ease` }}>
            {locked ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20, width: 42, textAlign: "center", flexShrink: 0 }}>🔒</span>
                <div>
                  <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>{item?.name || "???"}</div>
                  <div style={{ fontSize: 10, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>// Crafting LV {recipe.reqLevel} erforderlich</div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {rar && <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 4, background: rar.color + "15", border: `1px solid ${rar.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{item?.icon}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: "#fff", marginBottom: 4 }}>{item?.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed',sans-serif" }}>{inputSummary} → T: {recipe.time}s</div>
                </div>
                <button disabled style={{ padding: "6px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, color: "rgba(255,255,255,0.2)", fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, cursor: "not-allowed", flexShrink: 0 }}>HERSTELLEN</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COCKPIT SCREEN (Home — Live Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

// Stable star field generated once at module load
const COCKPIT_STARS = Array.from({ length: 185 }, () => ({
  left:    `${(Math.random() * 98 + 1).toFixed(2)}%`,
  top:     `${(Math.random() * 98 + 1).toFixed(2)}%`,
  size:    Math.random() < 0.72 ? 1 : 2,
  opacity: +(0.1 + Math.random() * 0.55).toFixed(2),
  delay:   `${(Math.random() * 40).toFixed(1)}s`,
  dur:     `${(50 + Math.random() * 30).toFixed(1)}s`,
}));

function CockpitScreen({ credits, cargo, maxCargo, mining, activeSector, activeItem, refQueue, onStopMining, onUnload }) {
  const refActive   = refQueue.length > 0;
  const cargoRatio  = cargo / maxCargo;
  const cargoAlmost = cargoRatio >= 0.8 && cargo < maxCargo;
  const cargoFull   = cargo >= maxCargo;
  const cargoColor  = cargoFull ? "#ff6b6b" : cargoAlmost ? "#e8a838" : "#5bc4e8";

  // Time remaining calculations
  const miningMat     = mining ? SECTORS.find(s => s.id === mining.sectorId)?.materials.find(m => m.id === mining.matId) : null;
  const miningTimeSec = miningMat ? Math.ceil(miningMat.time * (1 - (mining.progress || 0))) : 0;

  const activeRecipe = refActive ? RECIPES.find(r => r.id === refQueue[0]?.recipeId) : null;
  const refTimeSec   = activeRecipe ? Math.ceil(activeRecipe.time * (1 - (refQueue[0]?.progress || 0))) : 0;
  const refItem      = activeRecipe ? ITEMS[activeRecipe.id] : null;

  const hasProcess = mining || refActive || cargoAlmost || cargoFull;

  return (
    <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>

      {/* ── STAR FIELD ── */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "#050d1a", zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {COCKPIT_STARS.map((s, i) => (
          <div key={i} style={{
            position: "absolute", left: s.left, top: s.top,
            width: s.size, height: s.size, borderRadius: "50%",
            background: "#fff", opacity: s.opacity,
            animation: `starFloat ${s.dur} ease-in-out ${s.delay} infinite`,
          }} />
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "22px 18px 28px", display: "flex", flexDirection: "column", gap: 22, animation: "fadeIn 0.3s ease" }}>

        {/* Location */}
        <div>
          <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 3, color: "rgba(91,196,232,0.38)", marginBottom: 7, textTransform: "uppercase" }}>Standort</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 12 }}>📍</span>
            <span style={{ fontSize: 26, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: mining && activeSector ? activeSector.color : "#5bc4e8", textShadow: mining && activeSector ? `0 0 24px ${activeSector.color}55` : "0 0 24px rgba(91,196,232,0.28)" }}>
              {mining && activeSector ? activeSector.name : "OPEN SPACE"}
            </span>
            {mining && (
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: activeSector?.color || "#e8a838", animation: "pulseGlow 1.4s infinite", boxShadow: `0 0 8px ${activeSector?.color || "#e8a838"}`, flexShrink: 0, display: "inline-block" }} />
            )}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, paddingLeft: 22 }}>
            {mining && activeSector ? activeSector.region : "Schiff geparkt · Kein aktiver Auftrag"}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Credits */}
          <div style={{ background: "rgba(4,10,22,0.88)", border: "1px solid rgba(91,196,232,0.11)", borderRadius: 4, padding: "13px 15px", backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2.5, color: "rgba(91,196,232,0.38)", marginBottom: 7, textTransform: "uppercase" }}>Credits</div>
            <div style={{ fontSize: 22, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: "#f1c40f", letterSpacing: 0.5 }}>
              {fmt(credits)} <span style={{ fontSize: 11, color: "rgba(241,196,15,0.45)", fontWeight: 400 }}>CR</span>
            </div>
          </div>

          {/* Cargo with progress bar */}
          <div style={{ background: "rgba(4,10,22,0.88)", border: `1px solid ${cargoColor}22`, borderRadius: 4, padding: "13px 15px", backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2.5, color: "rgba(91,196,232,0.38)", marginBottom: 7, textTransform: "uppercase" }}>Cargo Hold</div>
            <div style={{ marginBottom: 7 }}>
              <Bar value={cargoRatio} color={cargoColor} height={5} glow={cargoRatio >= 0.8} />
            </div>
            <div style={{ fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, color: cargoColor, letterSpacing: 0.5 }}>
              {cargo} <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400, fontSize: 12 }}>/ {maxCargo}</span>
            </div>
          </div>
        </div>

        {/* Active processes */}
        <div>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 2, height: 11, background: "#5bc4e8", opacity: 0.45, borderRadius: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 3, color: "rgba(91,196,232,0.45)", textTransform: "uppercase" }}>Aktive Vorgänge</span>
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(91,196,232,0.14), transparent)" }} />
          </div>

          {/* State A: nothing */}
          {!hasProcess && (
            <div style={{ paddingLeft: 10 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.22)", fontFamily: "'Barlow',sans-serif", marginBottom: 5 }}>Keine aktiven Aufträge.</div>
              <div style={{ fontSize: 11, color: "rgba(91,196,232,0.28)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>Starte eine Mission im SECTOR-Tab.</div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>

            {/* State B: Mining */}
            {mining && activeSector && (
              <div style={{ background: "rgba(3,8,18,0.82)", border: `1px solid ${activeSector.color}28`, borderLeft: `3px solid ${activeSector.color}77`, borderRadius: 3, padding: "12px 14px", animation: "slideUp 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1 }}>⛏</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, color: "#fff", letterSpacing: 0.3 }}>{activeItem?.name}</div>
                    <div style={{ fontSize: 10, color: activeSector.color, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, marginTop: 2 }}>
                      {activeSector.name} · {miningTimeSec}s verbleibend
                    </div>
                  </div>
                  <button onClick={onStopMining}
                    style={{ background: "none", border: "none", color: "rgba(232,80,80,0.38)", fontSize: 14, cursor: "pointer", padding: 0, flexShrink: 0, lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = "rgba(232,80,80,0.78)"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(232,80,80,0.38)"}
                    title="Mining stoppen"
                  >⏹</button>
                </div>
                <Bar value={mining.progress || 0} color={activeSector.color} height={4} glow />
              </div>
            )}

            {/* State C: Refinery */}
            {refActive && refItem && (
              <div style={{ background: "rgba(3,8,18,0.82)", border: "1px solid rgba(94,194,106,0.22)", borderLeft: "3px solid rgba(94,194,106,0.65)", borderRadius: 3, padding: "12px 14px", animation: "slideUp 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1 }}>⚗</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, color: "#fff", letterSpacing: 0.3 }}>{refItem.name}</div>
                    <div style={{ fontSize: 10, color: "#5ec26a", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, marginTop: 2 }}>
                      fertig in {refTimeSec}s{refQueue.length > 1 ? ` · +${refQueue.length - 1} in Queue` : ""}
                    </div>
                  </div>
                </div>
                <Bar value={refQueue[0]?.progress || 0} color="#5ec26a" height={4} glow />
              </div>
            )}

            {/* State D: Cargo warning */}
            {(cargoAlmost || cargoFull) && (
              <div style={{ background: "rgba(3,8,18,0.82)", border: `1px solid ${cargoColor}28`, borderLeft: `3px solid ${cargoColor}70`, borderRadius: 3, padding: "12px 14px", animation: "slideUp 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1 }}>⚠</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, color: cargoColor }}>
                      {cargoFull ? `Cargo voll (${cargo}/${maxCargo})` : `Cargo fast voll (${cargo}/${maxCargo})`}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "'Barlow',sans-serif", marginTop: 3 }}>
                      {cargoFull ? "Mining pausiert — Cargo entladen." : "Raffinerie nutzen oder Waren verkaufen."}
                    </div>
                  </div>
                  {cargoFull && (
                    <button onClick={onUnload}
                      style={{ background: `${cargoColor}12`, border: `1px solid ${cargoColor}44`, borderRadius: 2, padding: "6px 12px", color: cargoColor, fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, cursor: "pointer", flexShrink: 0, textTransform: "uppercase", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = `${cargoColor}22`}
                      onMouseLeave={e => e.currentTarget.style.background = `${cargoColor}12`}
                    >ENTLADEN</button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// PROFIL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function ProfilScreen({ miningXP, rank, inventory, credits, currentLocation, playSeconds }) {
  const totalItems = Object.values(inventory).reduce((a, v) => a + v, 0);

  const h = Math.floor(playSeconds / 3600);
  const m = Math.floor((playSeconds % 3600) / 60);
  const s = playSeconds % 60;
  const timeStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;

  const rarOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
  const invEntries = Object.entries(inventory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => (rarOrder[ITEMS[a[0]]?.rarity] ?? 9) - (rarOrder[ITEMS[b[0]]?.rarity] ?? 9));

  const isHome   = currentLocation === "home";
  const locName  = isHome ? "Heimatplanet" : (SECTORS.find(s => s.id === currentLocation)?.name || "Unbekannt");

  const getSkillXP = (id) => id === "mining" ? miningXP : 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease", paddingBottom: 32 }}>

      {/* ── Character header ── */}
      <div style={{ padding: "20px 18px 18px", background: `linear-gradient(180deg, ${rank.color}0d 0%, transparent 100%)`, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${rank.color}44, ${rank.color}0d)`, border: `2px solid ${rank.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, boxShadow: `0 0 24px ${rank.color}22` }}>
            🧑‍🚀
          </div>
          <div>
            <div style={{ fontSize: 20, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: "#fff", lineHeight: 1, textTransform: "uppercase" }}>Commander Nova</div>
            <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, color: rank.color, marginTop: 5 }}>{rank.title.toUpperCase()}</div>
            <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.28)", letterSpacing: 1, marginTop: 3 }}>📍 {locName}</div>
          </div>
        </div>
      </div>

      {/* ── Skills ── */}
      <SectionLabel>SKILLS</SectionLabel>
      <div style={{ padding: "6px 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {PROFIL_SKILLS.map(skill => {
          const xp   = getSkillXP(skill.id);
          const lv   = getLevel(xp);
          const prog = getLvlProg(xp);
          const xpNxt = xpToNext(xp);
          return (
            <div key={skill.id} style={{ opacity: skill.locked ? 0.4 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 14, width: 22, textAlign: "center", flexShrink: 0, lineHeight: 1 }}>{skill.icon}</span>
                <span style={{ flex: 1, fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1.5, color: "#fff", textTransform: "uppercase" }}>{skill.name}</span>
                <span style={{ fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: skill.locked ? "rgba(255,255,255,0.25)" : skill.color, letterSpacing: 1, flexShrink: 0 }}>LV {lv}</span>
              </div>
              <div style={{ paddingLeft: 30, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Bar value={prog} color={skill.color} height={3} glow={!skill.locked && prog > 0} />
                </div>
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.22)", letterSpacing: 0.5, whiteSpace: "nowrap", flexShrink: 0, minWidth: 100, textAlign: "right" }}>
                  {skill.locked ? "LOCKED" : `${xpNxt} XP to LV ${Math.min(lv + 1, 99)}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Inventar ── */}
      <SectionLabel>INVENTAR</SectionLabel>
      <div style={{ padding: "4px 18px 16px" }}>
        {invEntries.length === 0 ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, padding: "8px 0" }}>// Leer</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {invEntries.map(([k, v]) => {
              const item = ITEMS[k];
              if (!item) return null;
              const rar  = RARITY[item.rarity];
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1, fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, color: rar.color }}>{item.name}</span>
                  <span style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 1 }}>×{v}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Statistiken ── */}
      <SectionLabel>STATISTIKEN</SectionLabel>
      <div style={{ padding: "8px 18px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
        {[
          { label: "Items im Inventar", value: String(totalItems) },
          { label: "Credits",           value: `${fmt(credits)} CR` },
          { label: "Zeit gespielt",     value: timeStr },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.28)", letterSpacing: 0.5 }}>{label}</span>
            <span style={{ fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: 1 }}>{value}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY OVERLAY  (slide-up sheet, accessible via 🎒 header icon)
// ─────────────────────────────────────────────────────────────────────────────
function InventoryOverlay({ inventory, onClose }) {
  const rarOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
  const invEntries = Object.entries(inventory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => (rarOrder[ITEMS[a[0]]?.rarity] ?? 9) - (rarOrder[ITEMS[b[0]]?.rarity] ?? 9));

  const byCategory = (cat) => invEntries.filter(([k]) => ITEMS[k]?.category === cat);
  const raw      = byCategory("raw");
  const refined  = byCategory("refined");
  const crafted  = byCategory("crafted");

  const Section = ({ label, entries }) => entries.length === 0 ? null : (
    <>
      <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2.5, color: "rgba(91,196,232,0.4)", textTransform: "uppercase", padding: "12px 0 4px" }}>{label}</div>
      {entries.map(([k, v]) => {
        const item = ITEMS[k];
        if (!item) return null;
        const rar  = RARITY[item.rarity];
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 3, background: rar.color + "18", border: `1px solid ${rar.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {item.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1, color: "#fff", textTransform: "uppercase", lineHeight: 1.2 }}>{item.name}</div>
              <div style={{ fontSize: 10, color: rar.color, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, marginTop: 2 }}>{rar.label}</div>
            </div>
            <span style={{ fontSize: 16, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>×{v}</span>
          </div>
        );
      })}
    </>
  );

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", zIndex: 800, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#0b1020", borderTop: "1px solid rgba(91,196,232,0.12)", borderRadius: "14px 14px 0 0", maxHeight: "72vh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 48px rgba(0,0,0,0.8)", animation: "slideUp 0.22s ease" }}
      >
        {/* Sheet handle + header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🎒</span>
            <span style={{ fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>Inventar</span>
            {invEntries.length > 0 && (
              <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(91,196,232,0.5)", letterSpacing: 1 }}>· {invEntries.length} Items</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", borderRadius: 3, width: 28, height: 28, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 }}>×</button>
        </div>
        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "0 18px 28px" }}>
          {invEntries.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.18)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2 }}>
              // INVENTAR LEER · MINE MATERIALIEN
            </div>
          ) : (
            <>
              <Section label="Rohmaterialien"  entries={raw} />
              <Section label="Raffinierte Güter" entries={refined} />
              <Section label="Hergestellte Items" entries={crafted} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [sent, setSent]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [guestError, setGuestError] = useState("");

  const handleLogin = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    setLoading(false);
    if (!error) setSent(true);
  };

  const handleGuest = async () => {
    setLoading(true);
    setGuestError("");
    const { error } = await supabase.auth.signInAnonymously();
    setLoading(false);
    if (error) setGuestError("Gastzugang momentan nicht verfügbar.");
  };

  const features = [
    "Automate asteroid mining",
    "Optimize production chains",
    "Expand across star systems",
    "Trade rare cosmic resources",
  ];

  return (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative", zIndex: 1, overflowY: "auto", boxSizing: "border-box" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>

        {/* Title — centered independently; badge floats absolutely */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
          <h1 className="font-display" style={{ fontSize: "clamp(56px, 11vw, 88px)", letterSpacing: 8, color: "#5bc4e8", textShadow: "0 0 40px rgba(91,196,232,0.51), 0 0 80px rgba(91,196,232,0.21)", margin: 0, lineHeight: 1 }}>VOID FRONTIER</h1>
          {/* Alpha badge — absolute, doesn't disturb title centering */}
          <span style={{ position: "absolute", top: -10, right: -58, fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, color: "#ffd060", border: "1px solid rgba(255,208,96,0.5)", borderRadius: 3, padding: "3px 8px", background: "rgba(255,208,96,0.1)", textShadow: "0 0 10px rgba(255,208,96,0.6)", whiteSpace: "nowrap" }}>ALPHA</span>
        </div>

        {/* Hook — automation / long-term growth */}
        <p style={{ fontSize: 22, color: "rgba(255,255,255,0.93)", fontFamily: "'Barlow',sans-serif", maxWidth: 380, margin: "0 auto 12px", lineHeight: 1.5, fontWeight: 600 }}>
          Build. Automate. Expand. Repeat.
        </p>

        {/* Sub-hook */}
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", fontFamily: "'Barlow',sans-serif", maxWidth: 350, margin: "0 auto", lineHeight: 1.65, fontWeight: 400 }}>
          A space idle game built around long-term automation and persistent growth.
        </p>
      </div>

      {/* CTA area */}
      <div style={{ width: "100%", maxWidth: 400, marginBottom: 32 }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "28px 24px", background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 10, color: "#fff" }}>Check your inbox</div>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.65, margin: 0 }}>We sent a login link to <strong style={{ color: "#fff" }}>{email}</strong>. Click it to enter the game.</p>
          </div>
        ) : showEmail ? (
          <div style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 16, padding: "28px 24px" }}>
            <button onClick={() => setShowEmail(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, cursor: "pointer", padding: 0, marginBottom: 20 }}>← BACK</button>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, marginBottom: 6, color: "#fff" }}>Sign in with email</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.65, marginBottom: 20, marginTop: 0 }}>No password needed — we'll send you a magic link.</p>
            <input type="email" placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "'Barlow',sans-serif", marginBottom: 12, outline: "none" }}
            />
            <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "12px", background: "rgba(91,196,232,0.15)", border: "1px solid rgba(91,196,232,0.45)", borderRadius: 8, color: "#7dd4f0", fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1.5, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "SENDING..." : "SEND LOGIN LINK"}
            </button>
          </div>
        ) : (
          <>
            {/* Primary CTA — pulsing glow */}
            <button
              onClick={handleGuest}
              disabled={loading}
              className="cta-pulse"
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.animationPlayState = "paused"; e.currentTarget.style.boxShadow = "0 0 56px rgba(91,196,232,0.55), 0 8px 32px rgba(0,0,0,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.animationPlayState = "running"; e.currentTarget.style.boxShadow = ""; }}
              style={{ width: "100%", padding: "18px 24px", background: "linear-gradient(135deg, rgba(91,196,232,0.28), rgba(91,196,232,0.11))", border: "1px solid rgba(91,196,232,0.6)", borderRadius: 12, color: "#c8eef8", fontSize: 16, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, cursor: "pointer", opacity: loading ? 0.6 : 1, transition: "transform 0.15s, box-shadow 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}
            >
              <span>{loading ? "LAUNCHING..." : "LAUNCH INSTANTLY"}</span>
              <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1, color: "rgba(200,238,248,0.82)" }}>No account required</span>
            </button>

            {guestError && <div style={{ fontSize: 12, color: "#ff6b6b", textAlign: "center", marginTop: 8 }}>{guestError}</div>}

            {/* Email — secondary, but clearly explained */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "0 0 8px", fontFamily: "'Barlow',sans-serif", lineHeight: 1.5 }}>
                Want to keep your progress between sessions?
              </p>
              <button onClick={() => setShowEmail(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.82)", fontSize: 13, fontFamily: "'Barlow',sans-serif", cursor: "pointer", textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.35)", padding: 0, fontWeight: 500 }}>
                Sign in with email
              </button>
            </div>
          </>
        )}
      </div>

      {/* Features — 2x2 grid */}
      <div style={{ width: "100%", maxWidth: 400, marginBottom: 20 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", margin: "0 0 10px", textAlign: "center" }}>Core mechanics</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {features.map((label) => (
            <div key={label} style={{ padding: "10px 14px", background: "rgba(91,196,232,0.04)", border: "1px solid rgba(91,196,232,0.15)", borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", fontFamily: "'Barlow',sans-serif", fontWeight: 500, lineHeight: 1.4 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Alpha note */}
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "'Barlow',sans-serif", textAlign: "center", margin: 0, fontWeight: 400 }}>
        Early alpha — game data may be wiped at any time.
      </p>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]   = useState(undefined); // undefined = loading
  const [tab, setTab]           = useState("ort");
  const [screen, setScreen]     = useState(null);
  const [screenData, setScreenData] = useState(null);

  const [inventory, setInventory] = useState({});
  const [credits, setCredits]     = useState(0);
  const [miningXP, setMiningXP]       = useState(0);
  const [salvagingXP, setSalvagingXP] = useState(0);
  const [cargo, setCargo]             = useState(0);
  const [installed, setInstalled]     = useState({});
  const [mining, setMining]               = useState(null);
  const [salvaging, setSalvaging]         = useState(null);
  const [refQueue, setRefQueue]           = useState([]);
  const [buildingLevels, setBuildingLevels] = useState({ refinery: 1 });
  const [actLog, setActLog]           = useState([]);
  const [toasts, setToasts]           = useState([]);
  const [currentLocation, setCurrentLocation] = useState("home");
  const [travelling, setTravelling]           = useState(null);
  const [playSeconds, setPlaySeconds]         = useState(0);
  const [inventoryOpen, setInventoryOpen]     = useState(false);
  const [navDir, setNavDir]                   = useState("tab");

  const timerRef         = useRef(null);
  const salvagingTimerRef = useRef(null);
  const refTimerRef      = useRef(null);
  const travelTimerRef   = useRef(null);
  const toastId          = useRef(0);
  const saveTimer        = useRef(null);

  // ── AUTH ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadGame(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── LOAD GAME ──────────────────────────────────────────────────────────
  const loadGame = async (userId) => {
    const { data } = await supabase.from("game_saves").select("save_data").eq("user_id", userId).single();
    if (data?.save_data) {
      const s = data.save_data;
      if (s.inventory)      setInventory(s.inventory);
      if (s.credits)        setCredits(s.credits);
      if (s.miningXP)       setMiningXP(s.miningXP);
      if (s.salvagingXP)    setSalvagingXP(s.salvagingXP);
      if (s.cargo)          setCargo(s.cargo);
      if (s.installed)      setInstalled(s.installed);
      if (s.buildingLevels) setBuildingLevels(s.buildingLevels);
    }
  };

  // ── SAVE GAME (auto every 30s) ─────────────────────────────────────────
  const saveGame = useCallback(async () => {
    if (!session?.user) return;
    await supabase.from("game_saves").upsert({
      user_id: session.user.id,
      save_data: { inventory, credits, miningXP, salvagingXP, cargo, installed, buildingLevels },
      updated_at: new Date().toISOString()
    });
  }, [session, inventory, credits, miningXP, salvagingXP, cargo, installed]);

  useEffect(() => {
    if (!session) return;
    saveTimer.current = setInterval(saveGame, 30000);
    return () => clearInterval(saveTimer.current);
  }, [saveGame, session]);

  const warpLevel   = Math.max(0, ...SHIP_UPGRADES.filter(u => u.cat === "warp"   && installed[u.id]).map(u => u.effect.warp),   0);
  const moduleLevel = Math.max(0, ...SHIP_UPGRADES.filter(u => u.cat === "module" && installed[u.id]).map(u => u.effect.module), 0);
  const maxCargo    = 20 + SHIP_UPGRADES.filter(u => u.cat === "cargo" && installed[u.id]).reduce((a, u) => a + u.effect.cargo, 0);
  const miningLevel = getLevel(miningXP);
  const totalLevel  = miningLevel;
  const rank        = getRank(totalLevel);

  const activeTask = (() => {
    if (mining) {
      const sector = SECTORS.find(s => s.id === mining.sectorId);
      const matRef = sector?.materials.find(m => m.id === mining.matId);
      const item   = ITEMS[mining.matId];
      if (!item || !matRef) return null;
      return { icon: item.icon, name: item.name, secondsLeft: Math.ceil(matRef.time * (1 - (mining.progress || 0))) };
    }
    if (salvaging) {
      const mat  = SALVAGING_MATS.find(m => m.id === salvaging.matId);
      const item = ITEMS[salvaging.matId];
      if (!item || !mat) return null;
      return { icon: item.icon, name: item.name, secondsLeft: Math.ceil(mat.time * (1 - (salvaging.progress || 0))) };
    }
    if (refQueue.length > 0) {
      const recipe = RECIPES.find(r => r.id === refQueue[0].recipeId);
      const item   = ITEMS[recipe?.id];
      if (!item || !recipe) return null;
      return { icon: item.icon, name: item.name, secondsLeft: Math.ceil(recipe.time * (1 - (refQueue[0].progress || 0))) };
    }
    return null;
  })();

  const addToast = useCallback((msg, icon, color = "#e8a838") => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-3), { id, msg, icon, color }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const addLog = useCallback((msg) => {
    setActLog(l => [{ id: Date.now() + Math.random(), msg, time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...l.slice(0, 99)]);
  }, []);

  // Mining tick
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!mining) return;
    const sector = SECTORS.find(s => s.id === mining.sectorId);
    const matRef = sector?.materials.find(m => m.id === mining.matId);
    if (!matRef) return;

    timerRef.current = setInterval(() => {
      setMining(m => {
        if (!m) return null;
        const p = (m.progress || 0) + (0.05 / matRef.time);
        if (p < 1) return { ...m, progress: p };

        // Check cargo
        let stopped = false;
        setCargo(c => {
          const nc = c + matRef.amount;
          if (nc > maxCargo) { stopped = true; return c; }
          return nc;
        });
        if (stopped) {
          addToast("Cargo hold full!", "📦", "#e8a838");
          addLog("📦 Cargo full — mining stopped");
          return null;
        }

        setInventory(inv => ({ ...inv, [matRef.id]: (inv[matRef.id] || 0) + matRef.amount }));
        setMiningXP(x => {
          const next = x + matRef.time * 0.8;
          if (getLevel(next) > getLevel(x)) addToast(`Mining reached Level ${getLevel(next)}!`, "🎉", "#e8a838");
          return next;
        });
        const item = ITEMS[matRef.id];
        const newCompletions = (m.completions || 0) + 1;
        addLog(`⛏️ ${item?.icon} ${item?.name} +${matRef.amount}`);
        if (m.targetCompletions && newCompletions >= m.targetCompletions) {
          addToast(`${newCompletions}× ${item?.name} abgebaut!`, "✅", "#e8a838");
          addLog(`✅ Mining abgeschlossen – ${newCompletions} Aktionen`);
          return null;
        }
        return { ...m, progress: 0, completions: newCompletions };
      });
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [mining?.sectorId, mining?.matId, maxCargo]);

  useEffect(() => { if (cargo >= maxCargo && mining)    { setMining(null); }    }, [cargo, maxCargo]);
  useEffect(() => { if (cargo >= maxCargo && salvaging) { setSalvaging(null); } }, [cargo, maxCargo]);

  // Salvaging tick
  useEffect(() => {
    clearInterval(salvagingTimerRef.current);
    if (!salvaging) return;
    const mat = SALVAGING_MATS.find(m => m.id === salvaging.matId);
    if (!mat) return;

    salvagingTimerRef.current = setInterval(() => {
      setSalvaging(s => {
        if (!s) return null;
        const p = (s.progress || 0) + (0.05 / mat.time);
        if (p < 1) return { ...s, progress: p };

        // Check cargo
        let stopped = false;
        setCargo(c => {
          const nc = c + mat.amount;
          if (nc > maxCargo) { stopped = true; return c; }
          return nc;
        });
        if (stopped) {
          addToast("Cargo hold full!", "📦", "#e8a838");
          addLog("📦 Cargo full — salvaging stopped");
          return null;
        }

        setInventory(inv => ({ ...inv, [mat.id]: (inv[mat.id] || 0) + mat.amount }));
        setSalvagingXP(x => {
          const next = x + mat.time * 0.2;
          if (getLevel(next) > getLevel(x)) addToast(`Salvaging reached Level ${getLevel(next)}!`, "🎉", "#3fa7d6");
          return next;
        });

        const item = ITEMS[mat.id];
        const newCompletions = (s.completions || 0) + 1;
        addLog(`🔩 ${item?.icon} ${item?.name} +${mat.amount}`);
        if (s.targetCompletions && newCompletions >= s.targetCompletions) {
          addToast(`${newCompletions}× ${item?.name} salvaged!`, "✅", "#3fa7d6");
          addLog(`✅ Salvaging abgeschlossen – ${newCompletions} Aktionen`);
          return null;
        }
        return { ...s, progress: 0, completions: newCompletions };
      });
    }, 50);
    return () => clearInterval(salvagingTimerRef.current);
  }, [salvaging?.matId, maxCargo]);

  // Refinery tick
  useEffect(() => {
    clearInterval(refTimerRef.current);
    if (refQueue.length === 0) return;
    refTimerRef.current = setInterval(() => {
      setRefQueue(q => {
        if (q.length === 0) return q;
        const [head, ...rest] = q;
        const recipe = RECIPES.find(r => r.id === head.recipeId);
        if (!recipe) return rest;
        const p = (head.progress || 0) + (0.05 / recipe.time);
        if (p >= 1) {
          const item = ITEMS[recipe.id];
          setInventory(inv => ({ ...inv, [recipe.id]: (inv[recipe.id] || 0) + 1 }));
          addLog(`⚗️ ${item?.icon} ${item?.name} completed`);
          if (rest.length === 0) addToast("Refinery queue complete.", "⚗️", "#5ec26a");
          return rest;
        }
        return [{ ...head, progress: p }, ...rest];
      });
    }, 50);
    return () => clearInterval(refTimerRef.current);
  }, [refQueue.length]);

  // Travel tick
  useEffect(() => {
    clearInterval(travelTimerRef.current);
    if (!travelling) return;
    travelTimerRef.current = setInterval(() => {
      setTravelling(t => {
        if (!t) return null;
        const p = (t.progress || 0) + (0.05 / TRAVEL_SECS);
        if (p >= 1) {
          const dest = t.destId === "home" ? HOME_LOCATION : SECTORS.find(s => s.id === t.destId);
          setCurrentLocation(t.destId);
          addToast(`Angekommen: ${dest?.name || t.destId}`, dest?.icon || "🚀", "#5bc4e8");
          addLog(`🚀 Angekommen: ${dest?.name || t.destId}`);
          return null;
        }
        return { ...t, progress: p };
      });
    }, 50);
    return () => clearInterval(travelTimerRef.current);
  }, [travelling?.destId]);

  // Play-time ticker (starts when session is established)
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setPlaySeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [!!session]);

  const startTravel = (destId) => {
    if (travelling) return;
    if (mining) { setMining(null); addLog("⏹ Mining gestoppt – Abflug"); }
    setTravelling({ destId, progress: 0 });
    const dest = destId === "home" ? HOME_LOCATION : SECTORS.find(s => s.id === destId);
    addLog(`🚀 Reise zu ${dest?.name || destId} gestartet`);
  };

  const startMining = (sectorId, matId, quantity = null) => {
    if (mining?.sectorId === sectorId && mining?.matId === matId) { setMining(null); addLog("⏹ Mining stopped"); return; }
    setMining({ sectorId, matId, progress: 0, completions: 0, targetCompletions: quantity });
    const s = SECTORS.find(s => s.id === sectorId), m = s?.materials.find(m => m.id === matId);
    const item = ITEMS[m?.id];
    addLog(`▶ Mining: ${item?.icon} ${item?.name} in ${s?.name}${quantity ? ` (×${quantity})` : ""}`);
  };

  const startSalvaging = (matId, quantity = null) => {
    if (salvaging?.matId === matId) { setSalvaging(null); addLog("⏹ Salvaging stopped"); return; }
    setSalvaging({ matId, progress: 0, completions: 0, targetCompletions: quantity });
    const mat = SALVAGING_MATS.find(m => m.id === matId);
    const item = ITEMS[mat?.id];
    addLog(`▶ Salvaging: ${item?.icon} ${item?.name}${quantity ? ` (×${quantity})` : ""}`);
  };

  const queueRecipe = (recipeId) => {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe || !Object.entries(recipe.inputs).every(([k, v]) => (inventory[k] || 0) >= v)) { addToast("Not enough materials.", "❌", "#e05252"); return; }
    setInventory(inv => { const n = { ...inv }; for (const [k, v] of Object.entries(recipe.inputs)) n[k] = (n[k] || 0) - v; return n; });
    setRefQueue(q => [...q, { recipeId, progress: 0 }]);
    const item = ITEMS[recipeId]; addLog(`⚗️ ${item?.icon} ${item?.name} queued`);
  };

  const sellAll = (recipeId) => {
    const recipe = RECIPES.find(r => r.id === recipeId); const qty = inventory[recipeId] || 0;
    if (!recipe || qty === 0) return;
    const earned = qty * recipe.sellPrice;
    setInventory(inv => ({ ...inv, [recipeId]: 0 })); setCredits(c => c + earned);
    addLog(`💰 ${qty}× ${ITEMS[recipeId]?.name} sold → +${earned} CR`);
    addToast(`+${fmt(earned)} Credits`, "💰", "#f1c40f");
  };

  const buyUpgrade = (upg) => {
    if (installed[upg.id] || !Object.keys(upg.req).every(k => installed[k])) return;
    if (credits < (upg.cost.credits || 0)) { addToast("Not enough credits.", "❌", "#e05252"); return; }
    for (const [k, v] of Object.entries(upg.cost)) { if (k !== "credits" && (inventory[k] || 0) < v) { addToast("Not enough materials.", "❌", "#e05252"); return; } }
    setCredits(c => c - (upg.cost.credits || 0));
    setInventory(inv => { const n = { ...inv }; for (const [k, v] of Object.entries(upg.cost)) { if (k !== "credits") n[k] = (n[k] || 0) - v; } return n; });
    setInstalled(i => ({ ...i, [upg.id]: true }));
    addToast(`${upg.name} installed!`, upg.icon, "#5ec26a");
    addLog(`🔧 ${upg.name} installed`);
  };

  const upgradeBuilding = (buildingId) => {
    const building = BUILDINGS.find(b => b.id === buildingId);
    const curLevel = buildingLevels[buildingId] || 1;
    const nextData = building?.levels?.find(l => l.level === curLevel + 1);
    if (!nextData?.cost) return;
    const cost = nextData.cost;
    if (cost.credits && credits < cost.credits) { addToast("Nicht genug Credits.", "❌", "#e05252"); return; }
    for (const [k, v] of Object.entries(cost)) { if (k !== "credits" && (inventory[k] || 0) < v) { addToast("Nicht genug Materialien.", "❌", "#e05252"); return; } }
    if (cost.credits) setCredits(c => c - cost.credits);
    setInventory(inv => { const n = { ...inv }; for (const [k, v] of Object.entries(cost)) { if (k !== "credits") n[k] = (n[k] || 0) - v; } return n; });
    setBuildingLevels(bl => ({ ...bl, [buildingId]: curLevel + 1 }));
    addToast(`${building.name} auf Level ${curLevel + 1} aufgewertet!`, building.icon, building.color);
    addLog(`🏗 ${building.name} → Level ${curLevel + 1}`);
  };

  const activeMat    = mining ? SECTORS.find(s => s.id === mining.sectorId)?.materials.find(m => m.id === mining.matId) : null;
  const activeSector = mining ? SECTORS.find(s => s.id === mining.sectorId) : null;
  const activeItem   = activeMat ? ITEMS[activeMat.id] : null;

  const BOTTOM_NAV = [
    { id: "ort",    label: "ORT",    icon: "📍" },
    { id: "ship",   label: "SHIP",   icon: "🚀" },
    { id: "profil", label: "PROFIL", icon: "👤" },
  ];

  // Bottom nav: active tab always matches current tab (sub-screens stay in their parent tab)
  const activeNavTab = tab;

  // Auth gates
  if (session === undefined) return (
    <>
      <style>{CSS}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "linear-gradient(160deg, #0d1117 0%, #090c14 50%, #0d0a18 100%)" }} />
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, fontSize: 12, position: "relative", zIndex: 1 }}>LOADING...</div>
    </>
  );

  if (!session) return (
    <>
      <style>{CSS}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "linear-gradient(160deg, #0a1628 0%, #06080f 45%, #110820 100%)", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-10%", left: "50%", width: "80%", height: "60%", background: "radial-gradient(ellipse, rgba(91,196,232,0.18) 0%, transparent 65%)", animation: "nebulaDrift 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "5%", right: "5%", width: "50%", height: "50%", background: "radial-gradient(ellipse, rgba(110,60,220,0.14) 0%, transparent 70%)", animation: "nebulaDrift 24s ease-in-out infinite reverse" }} />
      </div>
      <LoginScreen />
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <Toast toasts={toasts} />

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "linear-gradient(160deg, #0a1628 0%, #06080f 45%, #110820 100%)" }}>
        <div style={{ position: "absolute", top: "-10%", left: "50%", width: "80%", height: "60%", background: "radial-gradient(ellipse, rgba(91,196,232,0.10) 0%, transparent 65%)", animation: "nebulaDrift 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "5%", right: "5%", width: "50%", height: "50%", background: "radial-gradient(ellipse, rgba(110,60,220,0.09) 0%, transparent 70%)", animation: "nebulaDrift 24s ease-in-out infinite reverse" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(91,196,232,0.055) 1px, transparent 1px)", backgroundSize: "28px 28px", animation: "gridDrift 80s linear infinite" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)" }} />
      </div>

      <div className="app-panel" style={{ height: "100vh", maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", position: "relative", zIndex: 1, overflow: "hidden" }}>

        {/* ── PERSISTENT TOP HEADER ── */}
        <div className="hud-scanline" style={{ height: 44, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(91,196,232,0.1)", background: "rgba(5,12,25,0.92)", backdropFilter: "blur(12px)", flexShrink: 0, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${rank.color}44, ${rank.color}0d)`, border: `1px solid ${rank.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🧑‍🚀</div>
            <div>
              <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 0.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.2 }}>Commander Nova</div>
              <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: rank.color, lineHeight: 1.2 }}>{rank.title.toUpperCase()}</div>
            </div>
          </div>
          <span className="font-display" onClick={() => { setTab("ort"); setScreen(null); setScreenData(null); }} style={{ fontSize: 18, letterSpacing: 5, color: "#5bc4e8", textShadow: "0 0 20px rgba(91,196,232,0.5)", position: "absolute", left: "50%", transform: "translateX(-50%)", cursor: "pointer", userSelect: "none" }}>VF</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeTask && (
              <div className="header-active-task">
                <span>{activeTask.icon}</span>
                <span className="header-task-name">{activeTask.name}</span>
                <span className="header-task-timer">{activeTask.secondsLeft}s</span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'Barlow Condensed',sans-serif" }}>
              <span onClick={() => setInventoryOpen(true)} style={{ fontSize: 11, color: cargo >= maxCargo ? "#ff6b6b" : cargo / maxCargo >= 0.8 ? "#e8a838" : "rgba(91,196,232,0.55)", letterSpacing: 0.3, cursor: "pointer" }}>🎒 {cargo}/{maxCargo}</span>
              <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 10 }}>·</span>
              <span style={{ fontSize: 11, color: "#f1c40f", letterSpacing: 0.5 }}>{fmt(credits)} CR</span>
            </div>
            <button onClick={() => { saveGame(); supabase.auth.signOut(); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", borderRadius: 2, padding: "4px 8px", fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", cursor: "pointer", letterSpacing: 1 }}>⏻</button>
          </div>
        </div>

        {/* ── BREADCRUMB (sub-screens only) ── */}
        {screen && (
          <div style={{ height: 34, padding: "0 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(91,196,232,0.08)", background: "rgba(3,8,18,0.72)", flexShrink: 0 }}>
            <button
              onClick={() => {
                setNavDir("back");
                if (screen === "sectorList" || screen === "base") setScreen(null);
                else if (screen === "sectorDetail") { setScreen("sectorList"); }
                else if (screen === "refinery") setScreen(null);
                else if (screen === "miningDetail" || screen === "refiningDetail" ||
                         screen === "salvagingDetail" || screen === "craftingDetail" ||
                         screen === "buildingDetail") setScreen(null);
              }}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "rgba(91,196,232,0.5)", cursor: "pointer", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, padding: 0, textTransform: "uppercase", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(91,196,232,0.85)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(91,196,232,0.5)"}
            >
              ← {
                screen === "sectorList"      ? "ORT"       :
                screen === "sectorDetail"    ? "SECTOR"    :
                screen === "base"            ? "ORT"       :
                screen === "refinery"        ? "ORT"       :
                screen === "miningDetail"    ? "ORT"       :
                screen === "refiningDetail"  ? "ORT"       :
                screen === "salvagingDetail" ? "ORT"       :
                screen === "craftingDetail"  ? "ORT"       :
                screen === "buildingDetail" ? "ORT"       : "ZURÜCK"
              }
            </button>
            <span style={{ color: "rgba(91,196,232,0.2)", fontSize: 10, userSelect: "none" }}>/</span>
            <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
              {
                screen === "sectorList"      ? "SECTOR"       :
                screen === "sectorDetail"    ? (screenData?.name || "").toUpperCase() :
                screen === "base"            ? "BASIS"         :
                screen === "refinery"        ? "RAFFINERIE"   :
                screen === "miningDetail"    ? "MINING"        :
                screen === "refiningDetail"  ? "REFINING"      :
                screen === "salvagingDetail" ? "SALVAGING"     :
                screen === "craftingDetail"  ? "CRAFTING"      :
                screen === "buildingDetail" ? (BUILDINGS.find(b => b.id === screenData)?.name || "GEBÄUDE").toUpperCase() : ""
              }
            </span>
          </div>
        )}

        {/* ── SCROLLABLE CONTENT ── */}
        <div key={`${tab}-${screen || "root"}`} className={navDir === "fwd" ? "screen-fwd" : navDir === "back" ? "screen-back" : "screen-tab"} style={{ flex: 1, overflowY: "auto" }}>

          {/* ORT screens */}
          {tab === "ort" && screen === "sectorList" && (
            <SectorTab mining={mining} miningXP={miningXP} warpLevel={warpLevel} maxCargo={maxCargo} cargo={cargo}
              onSelectSector={s => { setScreen("sectorDetail"); setScreenData(s); }} />
          )}
          {tab === "ort" && screen === "sectorDetail" && screenData && (
            <SectorScreen sector={screenData} mining={mining} cargo={cargo} maxCargo={maxCargo}
              onStartMining={startMining} />
          )}
          {tab === "ort" && screen === "base" && (
            <BaseScreen refQueue={refQueue} onOpenBuilding={id => { if (id === "refinery") setScreen("refinery"); }} />
          )}
          {tab === "ort" && screen === "refinery" && (
            <RefineryScreen inventory={inventory} credits={credits} refQueue={refQueue} moduleLevel={moduleLevel}
              onQueue={queueRecipe} onSell={sellAll} />
          )}
          {tab === "ort" && screen === "miningDetail" && (
            <MiningSkillScreen miningXP={miningXP} warpLevel={warpLevel} mining={mining}
              cargo={cargo} maxCargo={maxCargo} onStartMining={startMining} />
          )}
          {tab === "ort" && screen === "refiningDetail" && (
            <RefiningSkillScreen inventory={inventory} refQueue={refQueue} moduleLevel={moduleLevel}
              onQueue={queueRecipe} onSell={sellAll} />
          )}
          {tab === "ort" && screen === "salvagingDetail" && (
            <SalvagingSkillScreen salvagingXP={salvagingXP} salvaging={salvaging}
              cargo={cargo} maxCargo={maxCargo} onStartSalvaging={startSalvaging} />
          )}
          {tab === "ort" && screen === "craftingDetail" && <CraftingSkillScreen />}
          {tab === "ort" && screen === "buildingDetail" && screenData && (
            <BuildingDetailScreen
              buildingId={screenData} buildingLevels={buildingLevels}
              inventory={inventory} credits={credits}
              onUpgrade={() => upgradeBuilding(screenData)}
            />
          )}
          {tab === "ort" && !screen && (
            <OrtScreen
              mining={mining} salvaging={salvaging} refQueue={refQueue} buildingLevels={buildingLevels}
              currentLocation={currentLocation}
              onNavigate={(screenName, data) => { setNavDir("fwd"); setScreen(screenName); if (data !== undefined) setScreenData(data); }}
            />
          )}

          {/* SHIP screen */}
          {tab === "ship" && (
            <ShipScreen
              credits={credits} inventory={inventory} installed={installed} warpLevel={warpLevel}
              currentLocation={currentLocation} travelling={travelling}
              onBuy={buyUpgrade} onTravel={startTravel}
            />
          )}

          {/* PROFIL screen */}
          {tab === "profil" && (
            <ProfilScreen
              miningXP={miningXP} rank={rank} inventory={inventory}
              credits={credits} currentLocation={currentLocation}
              playSeconds={playSeconds}
            />
          )}

        </div>

        {/* ── MINING ACTIVITY BAR (SHIP + PROFIL tabs when mining is active) ── */}
        {mining && tab !== "ort" && (
          <div style={{ background: "rgba(4,8,18,0.98)", backdropFilter: "blur(20px)", borderTop: `2px solid ${activeSector?.color || "#e8a838"}66`, padding: "10px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 -4px 24px rgba(0,0,0,0.6)", position: "relative", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${activeSector?.color || "#e8a838"}99, transparent)`, pointerEvents: "none" }} />
            <div style={{ width: 36, height: 36, borderRadius: 3, background: `${activeSector?.color}18`, border: `1px solid ${activeSector?.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
              {activeItem?.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, textTransform: "uppercase" }}>MINING: {activeItem?.name}</span>
                <span style={{ fontSize: 10, color: activeSector?.color, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5 }}>{activeSector?.name} · RUNS: {mining.completions || 0}</span>
              </div>
              <Bar value={mining.progress || 0} color={activeSector?.color || "#e8a838"} height={4} glow />
            </div>
            <button onClick={() => { setMining(null); addLog("⏹ Mining stopped"); }} style={{ background: "rgba(232,80,80,0.07)", border: "1px solid rgba(232,80,80,0.28)", color: "rgba(232,80,80,0.75)", borderRadius: 2, padding: "7px 14px", fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, cursor: "pointer", flexShrink: 0, textTransform: "uppercase" }}>
              STOP
            </button>
          </div>
        )}

        {/* ── PERSISTENT BOTTOM NAV ── */}
        <div style={{ background: "rgba(4,8,18,0.97)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(91,196,232,0.12)", display: "flex", flexShrink: 0 }}>
          {BOTTOM_NAV.map(t => {
            const isActive = activeNavTab === t.id;
            return (
              <button key={t.id}
                onClick={() => { setNavDir("tab"); setScreen(null); setScreenData(null); setTab(t.id); }}
                style={{ flex: 1, padding: "10px 4px 8px", background: isActive ? "rgba(91,196,232,0.09)" : "transparent", border: "none", borderTop: `2px solid ${isActive ? "#5bc4e8" : "transparent"}`, cursor: "pointer", color: isActive ? "#fff" : "rgba(91,196,232,0.32)", fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.15s", boxShadow: isActive ? "0 -4px 18px rgba(91,196,232,0.12) inset, 0 0 8px rgba(91,196,232,0.06)" : "none" }}>
                <span style={{ fontSize: 17, filter: isActive ? "drop-shadow(0 0 6px rgba(91,196,232,0.7))" : "none", transition: "filter 0.15s" }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

      </div>

      {/* ── INVENTORY OVERLAY ── */}
      {inventoryOpen && <InventoryOverlay inventory={inventory} onClose={() => setInventoryOpen(false)} />}

    </>
  );
}