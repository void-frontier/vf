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
  ruined_stone: { name: "Raw Stone",         icon: "🪨", rarity: "common",    category: "raw",      flavor: "Brocken eingestürzter Strukturen. Überall hier." },
  // Salvaging materials
  scrap_metal:  { name: "Scrap Metal",      icon: "🔩", rarity: "common",    category: "raw",      flavor: "Salvaged from derelict hulls. Worth more melted down than intact." },
  // Crafted goods (future skill)
  repair_kit:   { name: "Basic Repair Kit", icon: "🛠", rarity: "common",    category: "crafted",  flavor: "Field repair kit. Better than nothing. Barely." },
  shield_cell:  { name: "Shield Cell",      icon: "🛡", rarity: "uncommon",  category: "crafted",  flavor: "Energy-absorbing cell. Standard issue on fighting ships." },
};


// Sectors (for mining) — "home" is Abandoned Planet, included so mining tick can find it
const SECTORS = [
  {
    id: "home",    name: "Abandoned Planet", region: "Outer Rim · Sektor 0",   icon: "🏠", color: "#9b59b6", reqWarp: 0,
    ambient: ["#c4763a", "#5a3070"],
    lore: "Deine Heimatbasis. Eingestürzte Strukturen, überall Schutt.",
    materials: [
      { id: "ruined_stone", time: 8, amount: 1 },
    ],
  },
  {
    id: "kepler",  name: "Kepler Belt",   region: "",  icon: "🪐", color: "#e8a838", reqWarp: 0,
    ambient: ["#e8a838", "#b36a1a"],
    lore: "The oldest asteroid field in the system. Every prospector starts here.",
    materials: [
      { id: "silicate", time: 10, amount: 1 },
      { id: "ferrite",  time: 16, amount: 1 },
    ],
  },
  {
    id: "cryon",   name: "Cryon Fields",  region: "",  icon: "❄️", color: "#4fc3f7", reqWarp: 1,
    ambient: ["#4fc3f7", "#1a3f5c"],
    lore: "A frozen graveyard at the edge of habitable space. Beautiful and deadly.",
    materials: [
      { id: "cryon",   time: 22, amount: 1 },
      { id: "ferrite", time: 16, amount: 2 },
    ],
  },
  {
    id: "void",    name: "Outer Void",    region: "Deep Space · Sector 17",   icon: "🌑", color: "#9b59b6", reqWarp: 2,
    ambient: ["#7b3fbf", "#1a0a2e"],
    lore: "Beyond charted space. Navigation here requires a modified warp drive and a steady nerve.",
    materials: [
      { id: "voidstone", time: 32, amount: 1 },
      { id: "cryon",     time: 22, amount: 2 },
    ],
  },
  {
    id: "neutron", name: "Neutron Rim",   region: "Dead Zone · Sector 31",    icon: "⭐", color: "#ff6b6b", reqWarp: 3,
    ambient: ["#ff4040", "#6b1a1a"],
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
  ambient: ["#c4763a", "#5a3070"],
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
];

const CRAFT_RECIPES = [
  { id: "repair_kit",  time: 20, reqLevel: 1, inputs: { scrap_metal: 2, ferrite_plate: 1 } },
  { id: "shield_cell", time: 40, reqLevel: 3, inputs: {} },
];

// Buildings (extensible)
const BUILDINGS = [
  {
    id: "refinery", name: "Refinery", icon: "🏭", color: "#5ec26a",
    desc: "Processes raw materials into tradeable goods.",
    available: true,
    levels: [
      { level: 1, label: "1 job parallel",  cost: null,                                                       time: 60  },
      { level: 2, label: "2 jobs parallel", cost: { credits: 200, ref_silicate: 5 },                          time: 360 },
      { level: 3, label: "3 jobs parallel", cost: { credits: 600, ferrite_plate: 4, cryon_cell: 1 },          time: 900 },
    ],
  },
  {
    id: "storage", name: "Storage", icon: "📦", color: "#e8a838",
    image: "/storage_facility.png",
    desc: "Expands your inventory capacity for resources and goods.",
    available: true,
    levels: [
      { level: 1, label: "50 slot capacity", cost: { ruined_stone: 15, scrap_metal: 5 },                      time: 90  },
      { level: 2, label: "75 slot capacity", cost: { ruined_stone: 40, scrap_metal: 20 },                     time: 300 },
      { level: 3, label: "100 slot capacity", cost: { ruined_stone: 80, scrap_metal: 60 },                    time: 600 },
    ],
  },
  {
    id: "command_post", name: "Command Post", icon: "📡", color: "#a78bfa",
    desc: "Central coordination hub. Unlocks advanced planetary operations.",
    available: false,
    unlockRequires: { building: "storage", level: 2 },
    unlockLabel: "Requires Storage Lv. 2",
    levels: [
      { level: 1, label: "Basic operations", cost: { ruined_stone: 60, scrap_metal: 60 },                     time: 600 },
    ],
  },
  {
    id: "lab", name: "Research Lab", icon: "🔬", color: "#3fa7d6",
    image: "/research_lab.png",
    desc: "Unlock new technologies and expand your capabilities.",
    available: true,
    unlockRequires: { building: "command_post", level: 1 },
    unlockLabel: "Requires Command Post Lv. 1",
    levels: [
      { level: 1, label: "1 research slot · speed 1×",    cost: { ruined_stone: 80, scrap_metal: 50 },        time: 120  },
      { level: 2, label: "2 research slots · speed 1.5×", cost: { credits: 200, ref_silicate: 5 },            time: 480  },
      { level: 3, label: "3 research slots · speed 2×",   cost: { credits: 600, ferrite_plate: 4 },           time: 1200 },
    ],
  },
  {
    id: "trade_post", name: "Trade Post", icon: "🏪", color: "#f59e0b",
    desc: "Buy and sell resources with passing traders.",
    available: false,
    unlockLabel: "Coming soon",
    levels: [
      { level: 1, label: "Basic trading", cost: null, time: 300 },
    ],
  },
  {
    id: "shipyard", name: "Shipyard", icon: "🚀", color: "#5bc4e8",
    desc: "Construct and upgrade spacecraft components.",
    available: false,
    unlockLabel: "Coming soon",
    levels: [
      { level: 1, label: "Basic construction", cost: null, time: 600 },
    ],
  },
];

const LAB_TECHNOLOGIES = [
  { id: "basic_refining", name: "Basic Refining",      icon: "⚗️", color: "#5ec26a", available: true,
    cost: { ruined_stone: 10, scrap_metal: 3 },
    desc: "Enables basic ore refining at the Abandoned Planet." },
  { id: "warp_tech",    name: "Warp Drive",          icon: "🌀", color: "#5bc4e8", available: true,
    desc: "Unlocks new star systems and exploration routes." },
  { id: "adv_refining", name: "Adv. Refining",        icon: "⚗️", color: "#5ec26a", available: true,
    desc: "Increases refining output by 25% per upgrade tier." },
  { id: "combat",       name: "Combat Systems",        icon: "⚔️", color: "#e84040", available: false,
    desc: "Unlocks combat encounters, weapon modules, and hostile sectors." },
  { id: "deep_scan",    name: "Deep Scan",             icon: "🔭", color: "#a855f7", available: false,
    desc: "Reveals hidden resources and anomalies in explored sectors." },
  { id: "quantum",      name: "Quantum Processing",    icon: "⚡", color: "#f97316", available: false,
    desc: "Reduces all research time by 20% per tier." },
];

// Ship upgrades
const SHIP_UPGRADES = [
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

/* Buildings grid: 2 cols mobile, 3 cols desktop */
.buildings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 6px 0 0; }
@media (min-width: 700px) { .buildings-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; } }

/* ── Hover interaction system ── */
/* nav:    .sidebar-nav-btn:hover (defined above) */
/* action: subtle bg lift for interactive rows */
.hover-action { transition: background 0.15s; }
.hover-action:hover { background: rgba(91,196,232,0.05); }
/* card:   elevation lift for larger clickable panels */
.hover-card { transition: transform 0.18s; }
.hover-card:hover { transform: translateY(-1px); }

/* ── Typography system ── */
.ty-page      { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 4px; color: rgba(255,255,255,0.92); }
.ty-section   { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: rgba(91,196,232,0.75); }
.ty-nav       { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; }
.ty-primary   { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: rgba(255,255,255,0.85); }
.ty-secondary { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.6); }
.ty-micro     { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; color: rgba(255,255,255,0.38); }

/* Sidebar navigation — desktop only */
.sidebar-desktop {
  width: 220px;
  flex-shrink: 0;
  background: rgba(5,9,19,0.75);
  backdrop-filter: blur(16px);
  border-right: 1px solid rgba(255,255,255,0.08);
  position: sticky;
  top: 44px;
  height: calc(100vh - 44px);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  z-index: 90;
}
@media (max-width: 1023px) { .sidebar-desktop { display: none; } }

.sidebar-section-label {
  font-size: 11px;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.38);
  padding: 18px 18px 6px;
}

.sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: calc(100% - 16px);
  margin: 1px 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  text-align: left;
  color: rgba(255,255,255,0.42);
  transition: color 0.15s, background 0.15s;
  outline: none;
  box-sizing: border-box;
}
.sidebar-nav-btn:hover {
  color: rgba(255,255,255,0.62);
  background: rgba(255,255,255,0.04);
}
.sidebar-nav-btn.is-active {
  color: rgba(255,255,255,0.92);
  background: rgba(255,255,255,0.08);
}

/* Bottom navigation — mobile only */
.bottom-nav-mobile { display: none; }
@media (max-width: 1023px) { .bottom-nav-mobile { display: flex; } }

/* ── Mobile layout fixes ── */
.content-column { padding-left: 52px; }
@media (max-width: 1023px) { .content-column { padding-left: 0; } }

/* Activities + Buildings grid: side-by-side on wide, stacked on narrow */
.ort-main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 700px) { .ort-main-grid { grid-template-columns: 1fr; } }

.content-wrapper { padding: 32px; }
@media (max-width: 600px)  { .content-wrapper { padding: 12px 12px 80px; } }
@media (min-width: 601px) and (max-width: 1023px) { .content-wrapper { padding: 20px 20px 80px; } }

/* Safe-area insets for notched/home-bar phones */
.bottom-nav-mobile {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
/* Larger touch targets on mobile nav buttons */
@media (max-width: 1023px) {
  .bottom-nav-mobile button { min-height: 56px; }
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


function SectionLabel({ children }) {
  return (
    <div style={{ padding: "10px 18px 6px", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 3, height: 12, background: "#5bc4e8", opacity: 0.7, borderRadius: 1, flexShrink: 0 }} />
      <span className="data-flicker ty-section" style={{ whiteSpace: "nowrap", textShadow: "0 0 8px rgba(91,196,232,0.5)" }}>// {children}</span>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(91,196,232,0.22), transparent)", boxShadow: "0 0 4px rgba(91,196,232,0.15)" }} />
    </div>
  );
}

function RowItem({ icon, name, level, locked, lockReason, active, badge, onClick, animDelay = 0, isSelected = false }) {
  return (
    <div
      onClick={onClick || undefined}
      className={onClick ? "hover-action" : undefined}
      style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid rgba(91,196,232,0.05)", cursor: onClick ? "pointer" : "default", opacity: locked ? 0.4 : 1, animation: `slideUp ${0.08 + animDelay}s ease`, background: isSelected ? "rgba(91,196,232,0.04)" : undefined, borderLeft: isSelected ? "2px solid rgba(91,196,232,0.3)" : "2px solid transparent" }}
    >
      <span style={{ fontSize: 18, width: 34, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1, color: locked ? "rgba(255,255,255,0.38)" : "#fff", textTransform: "uppercase" }}>{name}</span>
      </div>
      {active && !locked && (
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#5ec26a", boxShadow: "0 0 7px #5ec26a", animation: "pulseGlow 1.4s infinite", marginRight: 8, flexShrink: 0 }} />
      )}
      {badge && !locked && (
        <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "#5ec26a", letterSpacing: 0.5, marginRight: 8, flexShrink: 0 }}>{badge}</span>
      )}
      {level !== undefined && !locked && (
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-cyan)", background: "rgba(0,200,240,0.1)", padding: "1px 6px", borderRadius: 3, marginRight: 8, flexShrink: 0 }}>LV {level}</span>
      )}
      {locked ? (
        <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1.5, color: lockReason ? "rgba(224,82,82,0.75)" : "rgba(255,255,255,0.2)", background: lockReason ? "rgba(224,82,82,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${lockReason ? "rgba(224,82,82,0.2)" : "rgba(255,255,255,0.08)"}`, padding: "2px 8px", borderRadius: 2, flexShrink: 0, textTransform: "uppercase" }}>{lockReason || "LOCKED"}</span>
      ) : (
        <span style={{ fontSize: 14, color: isSelected ? "rgba(91,196,232,0.7)" : "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0 }}>→</span>
      )}
    </div>
  );
}


function BuildingGridCard({ building, level, onClick, isSelected }) {
  const [imgFailed, setImgFailed] = useState(false);
  const isLocked = !building.available;
  const hasImage = building.image && !imgFailed;


  return (
    <div
      onClick={onClick || undefined}
      className={onClick ? "hover-card" : undefined}
      style={{
        position: "relative", aspectRatio: "1", borderRadius: 5, overflow: "hidden",
        background: isSelected
          ? "linear-gradient(180deg, rgba(91,196,232,0.07) 0%, rgba(4,9,20,0.97) 100%)"
          : "rgba(4,9,20,0.8)",
        border: isSelected
          ? "1px solid rgba(91,196,232,0.4)"
          : `1px solid ${isLocked ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)"}`,
        boxShadow: isSelected ? "0 0 12px rgba(91,196,232,0.1)" : "none",
        cursor: onClick ? "pointer" : "default",
        filter: isLocked && !isSelected ? "saturate(0.25) brightness(0.65)" : "none",
        display: "flex", flexDirection: "column",
        animation: "fadeIn 0.2s ease",
        transition: "border 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease, background 0.15s ease",
      }}
    >
      {/* ── Image / icon area ── */}
      <div style={{
        flex: 1, position: "relative",
        background: "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.1) 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {building.image && <img src={building.image} onError={() => setImgFailed(true)} alt="" style={{ display: "none" }} />}
        {hasImage && <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${building.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
        {!hasImage && <span style={{ fontSize: 20, opacity: 0.55 }}>{building.icon}</span>}
        {hasImage && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(4,9,20,0.92) 0%, rgba(4,9,20,0.28) 55%, transparent 100%)" }} />}
        {isLocked && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, opacity: 0.4 }}>🔒</span>
          </div>
        )}
      </div>
      {/* ── Selected bottom accent ── */}
      {isSelected && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(91,196,232,0.7), transparent)" }} />
      )}
      {/* ── Footer ── */}
      <div style={{
        padding: "8px 8px 7px",
        borderTop: `1px solid ${isSelected ? "rgba(91,196,232,0.2)" : "rgba(255,255,255,0.05)"}`,
        background: isSelected ? "rgba(91,196,232,0.05)" : "rgba(0,0,0,0.42)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600,
            letterSpacing: 1,
            color: isLocked && !isSelected ? "rgba(255,255,255,0.26)" : "#fff",
            textTransform: "uppercase", lineHeight: 1.2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0,
          }}>
            {building.name}
          </div>
          {level > 0 && !isLocked && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-cyan)", background: "rgba(0,200,240,0.1)", padding: "1px 6px", borderRadius: 3, flexShrink: 0 }}>LV {level}</span>
          )}
          {level === 0 && !isLocked && (
            <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.32)", textTransform: "uppercase", flexShrink: 0 }}>BUILD</span>
          )}
          {isLocked && (
            <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 2, flexShrink: 0 }}>LOCKED</span>
          )}
        </div>
      </div>
    </div>
  );
}


// Dedicated sub-screens; all other built buildings fall back to generic buildingDetail
const BUILDING_ENTER_SCREEN = { refinery: "refinery" };
const getBuildingEnterScreen = (id) => BUILDING_ENTER_SCREEN[id] || "buildingDetail";

// Micro-label used inside the inspector
const InspectorLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2.5, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", marginBottom: 5 }}>
    {children}
  </div>
);

// Shared inspector shell — stable min-height prevents layout jumps on selection
const INSPECTOR_SHELL = { minHeight: 190, display: "flex", flexDirection: "column" };

// Shared placeholder state shown when nothing is selected
function InspectorPlaceholder({ text }) {
  return (
    <div style={INSPECTOR_SHELL}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <div style={{ fontSize: 16, opacity: 0.07, color: "#5bc4e8", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 4, userSelect: "none" }}>◈</div>
        <p style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.14)", textAlign: "center", lineHeight: 1.7, textTransform: "uppercase", margin: 0 }}>
          {text}
        </p>
      </div>
    </div>
  );
}

// Resource cost chip
const CostChip = ({ icon, label, have, ok }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    background: ok ? "rgba(255,255,255,0.04)" : "rgba(224,82,82,0.07)",
    border: `1px solid ${ok ? "rgba(255,255,255,0.09)" : "rgba(224,82,82,0.28)"}`,
    borderRadius: 3, padding: "3px 7px",
  }}>
    <span style={{ fontSize: 11 }}>{icon}</span>
    <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 0.5, color: ok ? "rgba(255,255,255,0.68)" : "#e05252" }}>{label}</span>
    <span style={{ fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", color: ok ? "rgba(255,255,255,0.28)" : "rgba(224,82,82,0.55)", letterSpacing: 0.5 }}>· {have}</span>
  </div>
);

function BuildingDetailsPanel({ building, buildingLevels, inventory, credits, onUpgrade, onNavigate, onClose }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!building) return <InspectorPlaceholder text="Select a building to inspect" />;

  const level       = buildingLevels[building.id] ?? 0;
  const isBuilt     = level >= 1;
  const currentData = isBuilt ? (building.levels?.find(l => l.level === level) || building.levels?.[0]) : null;
  const nextData    = building.levels?.find(l => l.level === level + 1);
  const isLocked    = building.unlockRequires
    ? (buildingLevels[building.unlockRequires.building] || 0) < building.unlockRequires.level
    : !building.available;

  const canAffordCost = (cost) => {
    if (!cost) return false;
    if (cost.credits && (credits || 0) < cost.credits) return false;
    for (const [k, v] of Object.entries(cost)) {
      if (k !== "credits" && (inventory?.[k] || 0) < v) return false;
    }
    return true;
  };
  const canAffordNext = !isLocked && nextData?.cost ? canAffordCost(nextData.cost) : false;

  const canEnter    = isBuilt;
  const enterScreen = getBuildingEnterScreen(building.id);

  const statusColor = isLocked ? "#e05252" : isBuilt ? "rgba(91,196,232,0.75)" : "rgba(255,255,255,0.3)";
  const statusLabel = isLocked ? "LOCKED" : isBuilt ? `LV ${level}` : "UNBUILT";

  const hasImage = building.image && !imgFailed;
  const fmtTime = (s) => {
    if (!s) return null;
    const m = Math.floor(s / 60); const sec = s % 60;
    if (m === 0) return `${sec}s`;
    if (sec === 0) return `${m}m`;
    return `${m}m ${sec}s`;
  };

  const divider = <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />;

  return (
    <div key={building.id} style={{ display: "flex", flexDirection: "column", animation: "fadeIn 0.15s ease" }}>

      {/* 1. Header — thumbnail · name+desc · badge · close */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        {/* Thumbnail */}
        <div style={{
          width: 88, height: 88, flexShrink: 0, borderRadius: 4, overflow: "hidden",
          position: "relative", background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {building.image && <img src={building.image} onError={() => setImgFailed(true)} alt="" style={{ display: "none" }} />}
          {hasImage && <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${building.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
          {!hasImage && <span style={{ fontSize: 22, opacity: 0.7 }}>{building.icon}</span>}
        </div>
        {/* Name + desc + controls */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1, color: "#fff", textTransform: "uppercase" }}>
              {building.name}
            </span>
            <span style={{
              fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2,
              color: statusColor,
              background: isLocked ? "rgba(224,82,82,0.08)" : isBuilt ? "rgba(91,196,232,0.08)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isLocked ? "rgba(224,82,82,0.2)" : isBuilt ? "rgba(91,196,232,0.18)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 2, padding: "2px 6px", whiteSpace: "nowrap", flexShrink: 0, textTransform: "uppercase",
            }}>{statusLabel}</span>
            {onClose && (
              <button onClick={onClose} className="ty-micro" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>← BACK</button>
            )}
          </div>
          <p className="ty-secondary" style={{ color: "rgba(255,255,255,0.42)", lineHeight: 1.4, margin: 0 }}>
            {building.desc}
          </p>
        </div>
      </div>

      {divider}

      {/* 2. State block — current / next effect */}
      {isBuilt && currentData && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: nextData?.label ? 4 : 0 }}>
          <span className="ty-micro" style={{ width: 36, flexShrink: 0 }}>Now</span>
          <span className="ty-secondary" style={{ color: "rgba(91,196,232,0.78)" }}>{currentData.label}</span>
        </div>
      )}
      {isBuilt && currentData?.label && nextData?.label && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ty-micro" style={{ width: 36, flexShrink: 0 }}>Next</span>
          <span className="ty-secondary" style={{ color: "rgba(255,255,255,0.28)" }}>{currentData.label}</span>
          <span className="ty-micro" style={{ padding: 0, color: "rgba(91,196,232,0.35)" }}>→</span>
          <span className="ty-secondary" style={{ color: "rgba(91,196,232,0.72)" }}>{nextData.label}</span>
        </div>
      )}
      {!isBuilt && nextData?.label && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ty-micro" style={{ width: 36, flexShrink: 0 }}>Lv 1</span>
          <span className="ty-secondary" style={{ color: "rgba(91,196,232,0.72)" }}>{nextData.label}</span>
        </div>
      )}
      {isBuilt && !nextData && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 2, height: 6, background: "rgba(91,196,232,0.3)", borderRadius: 1 }} />
          <span className="ty-micro" style={{ color: "rgba(91,196,232,0.4)" }}>Max level</span>
        </div>
      )}

      {/* Build time for next upgrade */}
      {nextData?.time && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span className="ty-micro" style={{ width: 36, flexShrink: 0 }}>Time</span>
          <span className="ty-secondary" style={{ color: "rgba(255,255,255,0.5)" }}>{fmtTime(nextData.time)}</span>
        </div>
      )}

      {/* Locked requirements */}
      {isLocked && (
        <>
          <InspectorLabel>Requires</InspectorLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {building.unlockRequires ? (() => {
              const reqB = BUILDINGS.find(b => b.id === building.unlockRequires.building);
              const have = buildingLevels[building.unlockRequires.building] || 0;
              const need = building.unlockRequires.level;
              return <CostChip icon={reqB?.icon} label={`${reqB?.name} Lv. ${need}`} have={`${have}/${need}`} ok={have >= need} />;
            })() : (
              <span className="ty-secondary" style={{ color: "rgba(255,255,255,0.2)" }}>
                {building.unlockLabel || "Coming soon"}
              </span>
            )}
          </div>
        </>
      )}

      {/* 3. Cost chips */}
      {!isLocked && nextData?.cost && (
        <>
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "12px 0 8px" }} />
          <div style={{ marginBottom: 2 }}>
            <InspectorLabel>{isBuilt ? `Cost — Lv. ${level + 1}` : "Build Cost"}</InspectorLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {nextData.cost.credits && (() => {
                const have = credits || 0; const ok = have >= nextData.cost.credits;
                return <CostChip key="cr" icon="💳" label={`${nextData.cost.credits} CR`} have={have} ok={ok} />;
              })()}
              {Object.entries(nextData.cost).filter(([k]) => k !== "credits").map(([k, v]) => {
                const item = ITEMS[k]; const have = inventory?.[k] || 0; const ok = have >= v;
                return <CostChip key={k} icon={item?.icon} label={`${v}× ${item?.name || k}`} have={have} ok={ok} />;
              })}
            </div>
          </div>
        </>
      )}
      {!isLocked && nextData && !nextData.cost && (
        <>
          {divider}
          <span className="ty-micro" style={{ color: "rgba(255,255,255,0.2)" }}>Free</span>
        </>
      )}

      {/* 4. Action row */}
      {divider}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {isLocked ? (
          <button disabled style={{
            flex: 1, padding: "9px 14px",
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 3, color: "rgba(255,255,255,0.18)",
            fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700,
            letterSpacing: 2, textTransform: "uppercase", cursor: "default",
          }}>🔒 Locked</button>
        ) : (!isBuilt || nextData) ? (
          <button
            onClick={canAffordNext ? onUpgrade : undefined}
            className={canAffordNext ? "btn-glow" : ""}
            style={{
              flex: 1, padding: "9px 14px",
              background: canAffordNext ? "rgba(91,196,232,0.11)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${canAffordNext ? "rgba(91,196,232,0.42)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 3, color: canAffordNext ? "rgba(91,196,232,0.9)" : "rgba(255,255,255,0.16)",
              fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: 2, textTransform: "uppercase",
              cursor: canAffordNext ? "pointer" : "default", transition: "all 0.15s",
            }}>
            {canAffordNext
              ? (isBuilt ? `Upgrade → Lv. ${level + 1}` : `Build ${building.name}`)
              : "Resources Needed"}
          </button>
        ) : null}

        {canEnter && (
          <button
            onClick={() => onNavigate(enterScreen, building.id)}
            style={{
              padding: "9px 16px", flexShrink: 0,
              background: "rgba(91,196,232,0.06)", border: "1px solid rgba(91,196,232,0.18)",
              borderRadius: 3, color: "rgba(91,196,232,0.62)",
              fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(91,196,232,0.1)"; e.currentTarget.style.color = "rgba(91,196,232,0.9)"; e.currentTarget.style.borderColor = "rgba(91,196,232,0.34)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(91,196,232,0.06)"; e.currentTarget.style.color = "rgba(91,196,232,0.62)"; e.currentTarget.style.borderColor = "rgba(91,196,232,0.18)"; }}
          >Enter →</button>
        )}

        {isBuilt && !nextData && !canEnter && (
          <span className="ty-micro" style={{ color: "rgba(255,255,255,0.12)" }}>No further actions</span>
        )}
      </div>

    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE OPERATIONS PANEL (compact strip: mining / salvaging status)
// ─────────────────────────────────────────────────────────────────────────────
function ActiveOperationsPanel({ mining, salvaging, refQueue = [], onStartMining, onStartSalvaging, onStopRefining }) {
  const ops = [];

  if (mining) {
    const sector = SECTORS.find(s => s.id === mining.sectorId);
    const matRef = sector?.materials.find(m => m.id === mining.matId);
    const item   = matRef ? ITEMS[matRef.id] : null;
    if (item && matRef) {
      const secsToNext = Math.max(0, Math.round(matRef.time * (1 - (mining.progress || 0))));
      ops.push({
        key: "mining", icon: item.icon, label: item.name, type: "Mining",
        color: "#e8a838", progress: mining.progress || 0,
        completions: mining.completions || 0, targetCompletions: mining.targetCompletions,
        secsToNext, queueNote: null, onStop: () => onStartMining(mining.sectorId, mining.matId),
      });
    }
  }

  if (salvaging) {
    const mat  = SALVAGING_MATS.find(m => m.id === salvaging.matId);
    const item = mat ? ITEMS[mat.id] : null;
    if (item && mat) {
      const secsToNext = Math.max(0, Math.round(mat.time * (1 - (salvaging.progress || 0))));
      ops.push({
        key: "salvaging", icon: item.icon, label: item.name, type: "Salvaging",
        color: "#3fa7d6", progress: salvaging.progress || 0,
        completions: salvaging.completions || 0, targetCompletions: salvaging.targetCompletions,
        secsToNext, queueNote: null, onStop: () => onStartSalvaging(salvaging.matId),
      });
    }
  }

  if (refQueue.length > 0) {
    const current = refQueue[0];
    const recipe  = RECIPES.find(r => r.id === current.recipeId);
    const item    = recipe ? ITEMS[recipe.id] : null;
    if (item && recipe) {
      const secsToNext = Math.max(0, Math.round(recipe.time * (1 - (current.progress || 0))));
      ops.push({
        key: "refining", icon: item.icon, label: item.name, type: "Refining",
        color: "#5ec26a", progress: current.progress || 0,
        completions: null, targetCompletions: null,
        secsToNext, queueNote: refQueue.length > 1 ? `+${refQueue.length - 1} queued` : null,
        onStop: onStopRefining,
      });
    }
  }

  return (
    <div style={{ background: "rgba(20,25,40,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="ty-section" style={{ marginBottom: 2 }}>Active Operations</div>
      {ops.length === 0 && (
        <div className="ty-micro" style={{ textAlign: "center", padding: "4px 0" }}>No current activity</div>
      )}
      {ops.map(op => (
        <div key={op.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Icon */}
          <div style={{ width: 32, height: 32, flexShrink: 0, background: `${op.color}18`, border: `1px solid ${op.color}30`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, position: "relative" }}>
            {op.icon}
            <div style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, borderRadius: "50%", background: op.color, border: "2px solid #070d1a", animation: "pulseGlow 1.2s infinite" }} />
          </div>
          {/* Label + bar */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 8, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2.5, color: op.color, textTransform: "uppercase" }}>{op.type}</span>
              <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, color: "rgba(255,255,255,0.72)", letterSpacing: 0.5 }}>{op.label}</span>
              {op.targetCompletions ? (
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)" }}>{op.completions}/{op.targetCompletions}</span>
              ) : op.completions > 0 ? (
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)" }}>×{op.completions}</span>
              ) : null}
              {op.queueNote && (
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.28)" }}>{op.queueNote}</span>
              )}
              <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.28)" }}>{op.secsToNext}s</span>
            </div>
            <Bar value={op.progress} color={op.color} height={3} glow />
          </div>
          {/* Stop */}
          <button className="btn-stop" onClick={op.onStop} style={{ flexShrink: 0, fontSize: 10, padding: "5px 10px" }}>STOP</button>
        </div>
      ))}
    </div>
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
// SECTOR TAB  (direct sector selection — no activity picker needed yet)
// ─────────────────────────────────────────────────────────────────────────────
function SectorTab({ mining, miningXP, warpLevel, onSelectSector }) {
  const level     = getLevel(miningXP);

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

      {/* Sector cards */}
      <div style={{ padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleSectors.map((sector, i) => {
          const locked    = sector.reqWarp > warpLevel;
          const isActive  = mining?.sectorId === sector.id;
          const activeMat = isActive ? sector.materials.find(m => m.id === mining.matId) : null;
          const activeItm = activeMat ? ITEMS[activeMat.id] : null;
          const clickable = !locked;
          return (
            <div key={sector.id}
              onClick={() => clickable && onSelectSector(sector)}
              className={clickable ? "hover-card" : undefined}
              style={{ background: isActive ? `linear-gradient(135deg, rgba(3,8,18,0.98), ${sector.color}0d)` : "rgba(3,8,18,0.78)", border: `1px solid ${isActive ? sector.color + "40" : locked ? "rgba(91,196,232,0.05)" : "rgba(91,196,232,0.11)"}`, borderLeft: `3px solid ${isActive ? sector.color + "99" : locked ? "rgba(91,196,232,0.07)" : "rgba(91,196,232,0.2)"}`, borderRadius: 3, padding: "15px", cursor: clickable ? "pointer" : "default", opacity: locked ? 0.36 : 1, transition: "all 0.18s", animation: `slideUp ${0.08 + i * 0.06}s ease`, boxShadow: isActive ? `0 0 18px ${sector.color}12` : "none" }}
              onMouseEnter={e => { if (clickable) e.currentTarget.style.borderColor = sector.color + "55"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isActive ? sector.color + "40" : locked ? "rgba(91,196,232,0.05)" : "rgba(91,196,232,0.11)"; }}
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

function SectorScreen({ sector, mining, onStartMining }) {
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

      <SectionLabel>AVAILABLE MATERIALS</SectionLabel>
      {sector.materials.map((matRef, i) => {
        const item = ITEMS[matRef.id];
        const rar = RARITY[item?.rarity || "common"];
        const isActive = mining?.sectorId === sector.id && mining?.matId === matRef.id;
        return (
          <div key={matRef.id}
            onClick={() => onStartMining(sector.id, matRef.id)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", cursor: "pointer", background: isActive ? `${sector.color}0e` : "transparent", borderBottom: "1px solid rgba(91,196,232,0.06)", borderLeft: `3px solid ${isActive ? sector.color : "transparent"}`, transition: "background 0.15s", position: "relative", overflow: "hidden", animation: `slideUp ${0.1 + i * 0.08}s ease` }}
            onMouseEnter={e => { e.currentTarget.style.background = isActive ? `${sector.color}16` : "rgba(91,196,232,0.05)"; }}
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

function BaseScreen({ refQueue, buildingLevels, onOpenBuilding }) {
  const activeRecipe = refQueue.length > 0 ? RECIPES.find(r => r.id === refQueue[0]?.recipeId) : null;
  const activeItem   = activeRecipe ? ITEMS[activeRecipe.id] : null;

  const isBuildingAvailable = (b) => {
    if (b.unlockRequires) {
      return (buildingLevels[b.unlockRequires.building] || 0) >= b.unlockRequires.level;
    }
    return b.available;
  };

  // 1-away rule: show all available + next 1 locked only; rest become teaser count
  const availableBuildings = BUILDINGS.filter(b => isBuildingAvailable(b));
  const nextLocked  = BUILDINGS.find(b => !isBuildingAvailable(b));
  const hiddenCount = BUILDINGS.filter(b => !isBuildingAvailable(b)).length - (nextLocked ? 1 : 0);
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
          const clickable = isBuildingAvailable(b);
          return (
            <div key={b.id}
              onClick={() => clickable && onOpenBuilding(b.id)}
              className={clickable ? "hover-card" : undefined}
              style={{ background: isActive ? `linear-gradient(135deg, rgba(3,8,18,0.98), ${b.color}0d)` : "rgba(3,8,18,0.78)", border: `1px solid ${isActive ? b.color + "40" : clickable ? "rgba(91,196,232,0.11)" : "rgba(91,196,232,0.05)"}`, borderLeft: `3px solid ${isActive ? b.color + "99" : clickable ? "rgba(91,196,232,0.2)" : "rgba(91,196,232,0.07)"}`, borderRadius: 3, padding: "15px", cursor: clickable ? "pointer" : "default", opacity: clickable ? 1 : 0.38, transition: "all 0.18s", animation: `slideUp ${0.08 + i * 0.07}s ease`, boxShadow: isActive ? `0 0 24px ${b.color}14` : "none" }}
              onMouseEnter={e => { if (clickable) e.currentTarget.style.borderColor = b.color + "55"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isActive ? b.color + "40" : clickable ? "rgba(91,196,232,0.11)" : "rgba(91,196,232,0.05)"; }}
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
                  {!clickable && b.unlockLabel && (
                    <div style={{ fontSize: 10, color: "rgba(91,196,232,0.28)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, marginTop: 3 }}>
                      🔒 {b.unlockLabel}
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

function RefineryScreen({ inventory, refQueue, moduleLevel, onQueue, onSell }) {
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
// GALAXY SCREEN  (Star map navigation)
// ─────────────────────────────────────────────────────────────────────────────

// Fixed node positions as % of the map area
const GALAXY_NODE_POS = {
  home:    { x: 11, y: 50 },
  kepler:  { x: 31, y: 42 },
  cryon:   { x: 52, y: 21 },
  void:    { x: 71, y: 63 },
  neutron: { x: 88, y: 33 },
};

// Travel route connections
const GALAXY_EDGES = [
  ["home",   "kepler"],
  ["kepler", "cryon"],
  ["kepler", "void"],
  ["void",   "neutron"],
];

// All map locations
const GALAXY_LOCS = [HOME_LOCATION, ...SECTORS.filter(s => s.id !== "home")];

function ShipScreen({ warpLevel, currentLocation, travelling, onTravel }) {
  const [selected, setSelected] = useState(currentLocation);

  const isLocLocked  = (loc) => loc.reqWarp > warpLevel;
  const isCurrentLoc = (id)  => id === currentLocation;
  const isTravDest   = (id)  => travelling?.destId === id;

  const selectedLoc    = GALAXY_LOCS.find(l => l.id === selected) || null;
  const selectedLocked = selectedLoc ? isLocLocked(selectedLoc) : false;
  const isSelCurrent   = selectedLoc ? isCurrentLoc(selectedLoc.id) : false;
  const canTravel      = !!(selectedLoc && !selectedLocked && !isSelCurrent && !travelling);

  const cardStyle = { background: "rgba(20,25,40,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.2s ease" }}>

      {/* ── Cover card ── */}
      <div style={cardStyle}>
        <div style={{ padding: "22px 24px 18px", background: "linear-gradient(135deg, rgba(91,196,232,0.07) 0%, rgba(91,196,232,0.02) 60%, transparent 100%)" }}>
          <div className="ty-micro" style={{ color: "rgba(91,196,232,0.4)", marginBottom: 8 }}>🌌 NAVIGATION</div>
          <div className="font-display" style={{ fontSize: 28, letterSpacing: 5, color: "rgba(255,255,255,0.88)", lineHeight: 1 }}>GALAXY MAP</div>
          <div className="ty-micro" style={{ color: "rgba(255,255,255,0.28)", marginTop: 6, letterSpacing: 0.5, textTransform: "none" }}>Outer Rim · Known Space</div>
        </div>
        <div style={{ height: 34, display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(3,8,18,0.55)" }}>
          <span className="ty-micro" style={{ color: "rgba(255,255,255,0.25)" }}>Navigation</span>
          <span style={{ color: "rgba(91,196,232,0.25)", fontSize: 12 }}>›</span>
          <span className="ty-micro" style={{ color: "rgba(255,255,255,0.55)" }}>Galaxy Map</span>
        </div>
      </div>

      {/* ── Galaxy map card ── */}
      <div style={cardStyle}>

        {/* Card header */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="ty-section" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 12, background: "#5bc4e8", opacity: 0.7, borderRadius: 1 }} />
            SECTOR CHART
          </div>
          <div className="ty-micro" style={{ color: "rgba(255,255,255,0.28)" }}>
            📍 {isCurrentLoc("home") ? HOME_LOCATION.name : SECTORS.find(s => s.id === currentLocation)?.name || "Unknown"}
          </div>
        </div>

        {/* ── Star map ── */}
        <div style={{ position: "relative", height: 400, overflow: "hidden", background: "linear-gradient(160deg, rgba(5,10,22,0.97) 0%, rgba(3,7,16,0.99) 100%)" }}>

          {/* Nebula hazes */}
          <div style={{ position: "absolute", left: "20%", top: "5%", width: "60%", height: "90%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(91,196,232,0.035) 0%, transparent 65%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: "55%", top: "35%", width: "50%", height: "65%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(155,89,182,0.03) 0%, transparent 65%)", pointerEvents: "none" }} />

          {/* Grid */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(91,196,232,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(91,196,232,0.028) 1px, transparent 1px)", backgroundSize: "72px 72px", pointerEvents: "none" }} />

          {/* Background stars */}
          {[...Array(32)].map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${((i * 43 + 11) % 93) + 2}%`,
              top:  `${((i * 31 + 9)  % 86) + 3}%`,
              width:  i % 8 === 0 ? 2 : 1,
              height: i % 8 === 0 ? 2 : 1,
              borderRadius: "50%", background: "#fff",
              opacity: 0.06 + (i % 6) * 0.05, pointerEvents: "none",
            }} />
          ))}

          {/* SVG connection lines */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} overflow="visible">
            <defs>
              <filter id="gxLineGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {GALAXY_EDGES.map(([fromId, toId]) => {
              const from    = GALAXY_NODE_POS[fromId];
              const to      = GALAXY_NODE_POS[toId];
              if (!from || !to) return null;
              const fromLoc    = GALAXY_LOCS.find(l => l.id === fromId);
              const toLoc      = GALAXY_LOCS.find(l => l.id === toId);
              const edgeLocked = isLocLocked(fromLoc) || isLocLocked(toLoc);
              return (
                <line key={`${fromId}-${toId}`}
                  x1={`${from.x}%`} y1={`${from.y}%`}
                  x2={`${to.x}%`}   y2={`${to.y}%`}
                  stroke={edgeLocked ? "rgba(255,255,255,0.055)" : "rgba(91,196,232,0.16)"}
                  strokeWidth="1"
                  strokeDasharray={edgeLocked ? "2 9" : "5 11"}
                  filter={!edgeLocked ? "url(#gxLineGlow)" : undefined}
                />
              );
            })}
          </svg>

          {/* Map nodes */}
          {GALAXY_LOCS.map(loc => {
            const pos      = GALAXY_NODE_POS[loc.id];
            if (!pos) return null;
            const locked    = isLocLocked(loc);
            const current   = isCurrentLoc(loc.id);
            const isSel     = selected === loc.id;
            const inTransit = isTravDest(loc.id);
            const color     = loc.color || "#5bc4e8";
            const outerSize = current ? 46 : isSel ? 36 : 28;
            const dotSize   = current ? 14 : locked ? 6 : isSel ? 10 : 8;

            return (
              <div
                key={loc.id}
                onClick={() => setSelected(loc.id)}
                style={{
                  position: "absolute",
                  left: `${pos.x}%`, top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
                  cursor: "pointer", zIndex: 2, userSelect: "none",
                }}
              >
                {/* Node marker */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: outerSize, height: outerSize }}>
                  {/* Wide selection halo */}
                  {isSel && !locked && (
                    <div style={{ position: "absolute", inset: -7, borderRadius: "50%", border: `1px solid ${color}1e` }} />
                  )}
                  {/* Primary ring */}
                  {!locked && (
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: "50%",
                      border: `1px solid ${isSel ? color + "99" : current ? color + "55" : color + "2e"}`,
                      boxShadow: current
                        ? `0 0 18px ${color}44, inset 0 0 8px ${color}11`
                        : isSel ? `0 0 10px ${color}33` : "none",
                      animation: current ? "pulseGlow 2.5s ease-in-out infinite" : "none",
                      transition: "all 0.2s",
                    }} />
                  )}
                  {/* Core dot */}
                  <div style={{
                    width: dotSize, height: dotSize, borderRadius: "50%",
                    background: locked ? "rgba(255,255,255,0.1)"
                      : current ? color : isSel ? color + "cc" : color + "77",
                    boxShadow: locked ? "none" : `0 0 ${current ? 14 : isSel ? 8 : 4}px ${color}${current ? "88" : isSel ? "66" : "44"}`,
                    transition: "all 0.2s", position: "relative", zIndex: 1, flexShrink: 0,
                  }} />
                  {/* Transit pulse */}
                  {inTransit && (
                    <div style={{
                      position: "absolute", inset: -5, borderRadius: "50%",
                      border: `1px solid ${color}`, animation: "pulseGlow 0.8s ease-in-out infinite",
                    }} />
                  )}
                </div>

                {/* Label */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 10, fontWeight: 600, letterSpacing: 1,
                    textTransform: "uppercase", whiteSpace: "nowrap",
                    color: locked ? "rgba(255,255,255,0.17)"
                      : current || isSel ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.42)",
                    textShadow: !locked && current ? `0 0 10px ${color}77` : "none",
                    transition: "color 0.2s",
                  }}>{loc.name}</span>
                  {locked && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: 0.5, color: "rgba(255,255,255,0.13)" }}>WARP {loc.reqWarp}</span>
                  )}
                  {current && !locked && (
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, letterSpacing: 0.8, color, opacity: 0.75 }}>◉ HERE</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* In-transit status bar */}
          {travelling && (() => {
            const dest = travelling.destId === "home" ? HOME_LOCATION : SECTORS.find(s => s.id === travelling.destId);
            return (
              <div style={{ position: "absolute", bottom: 14, left: 16, right: 16, zIndex: 10 }}>
                <div style={{ padding: "8px 14px", background: "rgba(3,7,18,0.9)", border: "1px solid rgba(91,196,232,0.16)", borderRadius: 6, backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="ty-micro" style={{ color: "rgba(91,196,232,0.7)", flexShrink: 0 }}>⏳ IN TRANSIT</span>
                  <div style={{ flex: 1 }}><Bar value={travelling.progress} color="#5bc4e8" height={2} glow /></div>
                  <span className="ty-secondary" style={{ fontSize: 11, flexShrink: 0 }}>{dest?.name} · {Math.ceil(TRAVEL_SECS * (1 - travelling.progress))}s</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Selected location detail panel ── */}
        {selectedLoc && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px", background: "rgba(3,6,14,0.45)", display: "flex", alignItems: "flex-start", gap: 16 }}>

            {/* Icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 8, flexShrink: 0,
              background: selectedLocked ? "rgba(255,255,255,0.03)" : `${selectedLoc.color}16`,
              border: `1px solid ${selectedLocked ? "rgba(255,255,255,0.08)" : selectedLoc.color + "44"}`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              boxShadow: !selectedLocked && isSelCurrent ? `0 0 16px ${selectedLoc.color}33` : "none",
            }}>{selectedLoc.icon}</div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span className="ty-primary" style={{ fontSize: 15, letterSpacing: 1.5, textTransform: "uppercase" }}>{selectedLoc.name}</span>
                {isSelCurrent && (
                  <span className="ty-micro" style={{ color: selectedLoc.color, background: selectedLoc.color + "18", border: `1px solid ${selectedLoc.color}44`, padding: "2px 8px", borderRadius: 2 }}>CURRENT</span>
                )}
                {selectedLocked && (
                  <span className="ty-micro" style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 2 }}>WARP {selectedLoc.reqWarp}</span>
                )}
                {isTravDest(selectedLoc.id) && (
                  <span className="ty-micro" style={{ color: "#5bc4e8", background: "rgba(91,196,232,0.08)", border: "1px solid rgba(91,196,232,0.28)", padding: "2px 8px", borderRadius: 2 }}>IN TRANSIT</span>
                )}
              </div>
              {selectedLoc.region && (
                <div className="ty-micro" style={{ color: "rgba(255,255,255,0.25)", marginBottom: 7, letterSpacing: 0.5, textTransform: "none", fontSize: 10 }}>{selectedLoc.region}</div>
              )}
              {!selectedLocked && selectedLoc.lore && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.55, margin: "0 0 10px", fontStyle: "italic" }}>{selectedLoc.lore}</p>
              )}
              {selectedLocked && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", lineHeight: 1.55, margin: "0 0 10px" }}>Requires Warp Drive level {selectedLoc.reqWarp} to reach this sector.</p>
              )}
              {!selectedLocked && selectedLoc.materials && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {selectedLoc.materials.map(m => {
                    const item = ITEMS[m.id];
                    return item ? (
                      <span key={m.id} className="ty-micro" style={{ color: "rgba(255,255,255,0.38)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "2px 9px", borderRadius: 3, letterSpacing: 0.5, textTransform: "none", fontSize: 10 }}>
                        {item.icon} {item.name}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            {/* Travel action */}
            {!isSelCurrent && !selectedLocked && (
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <button
                  onClick={() => canTravel && onTravel(selectedLoc.id)}
                  className={canTravel ? "hover-card" : ""}
                  style={{
                    padding: "8px 18px",
                    background: canTravel ? selectedLoc.color + "20" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${canTravel ? selectedLoc.color + "55" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 4,
                    color: canTravel ? selectedLoc.color : "rgba(255,255,255,0.22)",
                    cursor: canTravel ? "pointer" : "default",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
                    textTransform: "uppercase", transition: "all 0.15s",
                  }}
                >
                  {isTravDest(selectedLoc.id)
                    ? `${Math.ceil(TRAVEL_SECS * (1 - (travelling?.progress || 0)))}s`
                    : travelling ? "UNDERWAY" : "TRAVEL"}
                </button>
                <span className="ty-micro" style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textTransform: "none" }}>{TRAVEL_SECS}s transit</span>
              </div>
            )}

          </div>
        )}
      </div>

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

function MiningPanel({ mining, onStartMining }) {
  const [modalResource, setModalResource] = useState(null);
  const sector = SECTORS.find(s => s.id === "home");
  if (!sector) return null;
  return (
    <div style={{ animation: "fadeIn 0.15s ease" }}>
      {sector.materials.map((matRef, i) => {
        const item     = ITEMS[matRef.id];
        const isActive = mining?.sectorId === sector.id && mining?.matId === matRef.id;
        const canClick = !isActive;
        if (!item) return null;
        return (
          <div key={matRef.id}
            className={canClick ? "hover-action" : undefined}
            onClick={() => canClick && setModalResource({ sectorId: sector.id, matId: matRef.id, icon: item.icon, name: item.name, rarity: item.rarity || "common", timeSeconds: matRef.time, xpPerAction: Math.round(matRef.time * 0.8) })}
            style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid rgba(91,196,232,0.05)", borderLeft: isActive ? `2px solid ${sector.color}70` : "2px solid transparent", background: isActive ? `${sector.color}08` : undefined, cursor: canClick ? "pointer" : "default", animation: `slideUp ${0.08 + i * 0.05}s ease` }}
          >
            <span style={{ fontSize: 18, width: 34, flexShrink: 0, lineHeight: 1, position: "relative" }}>
              {item.icon}
              {isActive && <div style={{ position: "absolute", top: -3, right: -2, width: 7, height: 7, borderRadius: "50%", background: sector.color, border: "2px solid #070d1a", animation: "pulseGlow 1.2s infinite" }} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: isActive ? 6 : 0 }}>
                <span style={{ fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1, color: "#fff", textTransform: "uppercase" }}>{item.name}</span>
                <RarityBadge rarity={item.rarity} />
                {matRef.amount > 1 && <Tag color={sector.color}>×{matRef.amount}</Tag>}
              </div>
              {isActive && <Bar value={mining.progress || 0} color={sector.color} height={3} glow />}
            </div>
            {isActive ? (
              <button className="btn-stop" onClick={e => { e.stopPropagation(); onStartMining(sector.id, matRef.id); }} style={{ flexShrink: 0 }}>STOP</button>
            ) : (
              <span style={{ fontSize: 14, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0 }}>→</span>
            )}
          </div>
        );
      })}
      {modalResource && (
        <ResourceModal
          resource={modalResource}
          onStart={(res, qty) => onStartMining(res.sectorId, res.matId, qty)}
          onClose={() => setModalResource(null)}
        />
      )}
    </div>
  );
}

function SalvagingPanel({ salvaging, onStartSalvaging }) {
  const [modalResource, setModalResource] = useState(null);
  const color = "#3fa7d6";
  return (
    <div style={{ animation: "fadeIn 0.15s ease" }}>
      {SALVAGING_MATS.map((mat, i) => {
        const item     = ITEMS[mat.id];
        const isActive = salvaging?.matId === mat.id;
        const canClick = !isActive;
        if (!item) return null;
        return (
          <div key={mat.id}
            className={canClick ? "hover-action" : undefined}
            onClick={() => canClick && setModalResource({ matId: mat.id, icon: item.icon, name: item.name, rarity: item.rarity || "common", timeSeconds: mat.time, xpPerAction: Math.round(mat.time * 0.2) })}
            style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: "1px solid rgba(91,196,232,0.05)", borderLeft: isActive ? `2px solid ${color}70` : "2px solid transparent", background: isActive ? `${color}08` : undefined, cursor: canClick ? "pointer" : "default", animation: `slideUp ${0.08 + i * 0.05}s ease` }}
          >
            <span style={{ fontSize: 18, width: 34, flexShrink: 0, lineHeight: 1, position: "relative" }}>
              {item.icon}
              {isActive && <div style={{ position: "absolute", top: -3, right: -2, width: 7, height: 7, borderRadius: "50%", background: color, border: "2px solid #070d1a", animation: "pulseGlow 1.2s infinite" }} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: isActive ? 6 : 0 }}>
                <span style={{ fontSize: 14, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1, color: "#fff", textTransform: "uppercase" }}>{item.name}</span>
                <RarityBadge rarity={item.rarity} />
              </div>
              {isActive && <Bar value={salvaging.progress || 0} color={color} height={3} glow />}
            </div>
            {isActive ? (
              <button className="btn-stop" onClick={e => { e.stopPropagation(); onStartSalvaging(mat.id); }} style={{ flexShrink: 0 }}>STOP</button>
            ) : (
              <span style={{ fontSize: 14, color: "rgba(91,196,232,0.3)", fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0 }}>→</span>
            )}
          </div>
        );
      })}
      {modalResource && (
        <ResourceModal
          resource={modalResource}
          onStart={(res, qty) => onStartSalvaging(res.matId, qty)}
          onClose={() => setModalResource(null)}
        />
      )}
    </div>
  );
}

function OrtScreen({ mining, salvaging, refQueue, buildingLevels, researchedTechs, currentLocation, miningXP, salvagingXP, refiningXP, onNavigate, inventory, credits, onUpgrade, onStartMining, onStartSalvaging, onStopRefining }) {
  const isMiningActive    = !!mining;
  const isSalvagingActive = !!salvaging;
  const isRefiningActive  = refQueue.length > 0;
  const miningLevel    = getLevel(miningXP   || 0);
  const salvagingLevel = getLevel(salvagingXP || 0);
  const refiningLevel  = getLevel(refiningXP  || 0);

  const isLabBuilt         = (buildingLevels["lab"] ?? 0) >= 1;
  const isRefiningUnlocked = !!researchedTechs?.["basic_refining"];

  // Refinery badge: "läuft · Xs"
  const activeRefRecipe = isRefiningActive ? RECIPES.find(r => r.id === refQueue[0]?.recipeId) : null;
  const refTimeSec      = activeRefRecipe ? Math.ceil(activeRefRecipe.time * (1 - (refQueue[0]?.progress || 0))) : 0;
  const refBadge        = isRefiningActive ? `läuft · ${refTimeSec}s` : null;

  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [storageOpen, setStorageOpen] = useState(false);

  const handleNavigate = (screen, data) => {
    if (data === "storage") { setStorageOpen(true); setSelectedBuildingId(null); return; }
    onNavigate(screen, data);
  };

  const handleSkillClick = (id) => {
    if (id === "mining" || id === "salvaging") {
      setSelectedActivityId(prev => prev === id ? null : id);
      return;
    }
    if (id === "refining") onNavigate("refiningDetail");
  };

  const isBuildingAvailable = (b) => {
    if (b.unlockRequires) return (buildingLevels[b.unlockRequires.building] || 0) >= b.unlockRequires.level;
    return b.available;
  };

  const visibleBuildings = BUILDINGS.filter(b => b.id !== "refinery");

  const selectedBuilding = selectedBuildingId
    ? (() => { const b = BUILDINGS.find(x => x.id === selectedBuildingId); return b ? { ...b, available: isBuildingAvailable(b) } : null; })()
    : null;

  // Dynamic location
  const isHome    = currentLocation === "home";
  const sector    = !isHome ? SECTORS.find(s => s.id === currentLocation) : null;
  const locName   = isHome ? HOME_LOCATION.name   : (sector?.name   || "Unbekannt");
  const locRegion = isHome ? HOME_LOCATION.region : (sector?.region || "");
  const locColor  = isHome ? HOME_LOCATION.color  : (sector?.color  || "#5bc4e8");

  const cardStyle = { background: "rgba(20,25,40,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" };
  const cardInner = { padding: 20 };
  const cardHeader = { marginBottom: 12, display: "flex", alignItems: "center", gap: 8 };
  const cardHeaderAccent = { width: 3, height: 12, background: "#5bc4e8", opacity: 0.7, borderRadius: 1, flexShrink: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.2s ease" }}>

      {/* ── Planet Info Card ── */}
      <div style={cardStyle}>
        {isHome ? (
          <HeroBanner variant="abandoned" name={locName} />
        ) : (
          <div style={{ padding: "20px", background: `linear-gradient(180deg, ${locColor}0a 0%, transparent 100%)` }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "rgba(91,196,232,0.38)", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", marginBottom: 8 }}>
              📍 Location
            </div>
            <div style={{ fontSize: 28, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: locColor, textShadow: `0 0 24px ${locColor}40`, textTransform: "uppercase", lineHeight: 1, marginBottom: 6 }}>
              {locName}
            </div>
            {locRegion && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5 }}>
                {locRegion}
              </div>
            )}
          </div>
        )}
        <ScreenBreadcrumb label={locName} />
      </div>

      {/* ── Active Operations ── */}
      <ActiveOperationsPanel
        mining={mining}
        salvaging={salvaging}
        refQueue={refQueue}
        onStartMining={onStartMining}
        onStartSalvaging={onStartSalvaging}
        onStopRefining={onStopRefining}
      />

      {/* ── Storage panel (inline, replaces grid) ── */}
      {storageOpen && (
        <div style={cardStyle}>
          <div style={cardInner}>
            <div style={{ ...cardHeader, marginBottom: 12 }}>
              <div style={cardHeaderAccent} />
              <span className="ty-section">STORAGE</span>
              <button onClick={() => setStorageOpen(false)} className="ty-micro" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0 }}>← BACK</button>
            </div>
            {(() => {
              const raw = Object.entries(inventory)
                .filter(([k, v]) => v > 0 && ITEMS[k]?.category === "raw")
                .sort((a, b) => {
                  const order = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
                  return (order[ITEMS[a[0]]?.rarity] ?? 9) - (order[ITEMS[b[0]]?.rarity] ?? 9);
                });
              if (raw.length === 0) return (
                <div className="ty-micro" style={{ textAlign: "center", padding: "24px 0" }}>// Cargo hold empty</div>
              );
              return raw.map(([k, v]) => {
                const item = ITEMS[k]; const rar = RARITY[item.rarity] || RARITY.common;
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 3, background: rar.color + "18", border: `1px solid ${rar.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1, color: "#fff", textTransform: "uppercase", lineHeight: 1.2 }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: rar.color, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, marginTop: 2 }}>{rar.label}</div>
                    </div>
                    <span style={{ fontSize: 16, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>×{v}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ── Activities + Buildings (hidden when storage open) ── */}
      {!storageOpen && <div className="ort-main-grid">

        {/* Activities Card — list state / resource selection state */}
        <div style={cardStyle}>
          <div style={cardInner}>

            {/* Section header — always visible */}
            <div style={{ ...cardHeader, marginBottom: 12 }}>
              <div style={cardHeaderAccent} />
              <span className="ty-section">ACTIVITIES</span>
              {selectedActivityId && (
                <button
                  onClick={() => setSelectedActivityId(null)}
                  className="ty-micro"
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >← BACK</button>
              )}
            </div>

            {/* Content: activity list or resource panel */}
            {!selectedActivityId ? (
              <>
                {ORT_SKILLS.filter(s => s.id !== "crafting").map((skill, i) => {
                  const refiningLocked = skill.id === "refining" && (!isLabBuilt || !isRefiningUnlocked);
                  const active   = (skill.id === "mining" && isMiningActive) || (skill.id === "salvaging" && isSalvagingActive) || (skill.id === "refining" && isRefiningActive && isRefiningUnlocked);
                  const isLocked = !!skill.locked || refiningLocked;
                  const badge    = skill.id === "refining" && isRefiningUnlocked ? refBadge : null;
                  const level    = skill.id === "mining" ? miningLevel : skill.id === "salvaging" ? salvagingLevel : skill.id === "refining" ? refiningLevel : 1;
                  const lockReason = refiningLocked ? "RESEARCH LAB" : undefined;
                  return (
                    <RowItem key={skill.id} icon={skill.icon} name={skill.name} level={level}
                      locked={isLocked} lockReason={lockReason} active={active} badge={badge}
                      onClick={!isLocked ? () => handleSkillClick(skill.id) : null} animDelay={i * 0.05}
                      isSelected={false} />
                  );
                })}
              </>
            ) : selectedActivityId === "mining" ? (
              <MiningPanel mining={mining} onStartMining={onStartMining} />
            ) : selectedActivityId === "salvaging" ? (
              <SalvagingPanel salvaging={salvaging} onStartSalvaging={onStartSalvaging} />
            ) : null}

          </div>
        </div>

        {/* Buildings Card — grid state / selected-building state */}
        <div style={cardStyle}>
          <div style={cardInner}>

            {/* Section header — always visible; breadcrumb + ← BACK in detail state */}
            <div style={{ ...cardHeader, marginBottom: 12 }}>
              <div style={cardHeaderAccent} />
              <span className="ty-section">BUILDINGS</span>
              {selectedBuilding && (
                <button
                  onClick={() => setSelectedBuildingId(null)}
                  className="ty-micro"
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >← BACK</button>
              )}
            </div>

            {/* Content area: grid always in DOM for stable card size; detail panel overlaid */}
            <div style={{ position: "relative" }}>
              <div className="buildings-grid" style={{ visibility: selectedBuilding ? "hidden" : "visible" }}>
                {visibleBuildings.map((b) => {
                  const available = isBuildingAvailable(b);
                  return (
                    <BuildingGridCard
                      key={b.id}
                      building={{ ...b, available }}
                      level={buildingLevels[b.id] ?? 0}
                      isSelected={selectedBuildingId === b.id}
                      onClick={() => {
                        setSelectedBuildingId(prev => prev === b.id ? null : b.id);
                      }}
                    />
                  );
                })}
              </div>
              {selectedBuilding && (
                <div style={{ position: "absolute", inset: 0, overflow: "auto", animation: "fadeIn 0.15s ease" }}>
                  <BuildingDetailsPanel
                    building={selectedBuilding}
                    buildingLevels={buildingLevels}
                    inventory={inventory}
                    credits={credits}
                    onUpgrade={() => onUpgrade(selectedBuildingId)}
                    onNavigate={handleNavigate}
                    onClose={null}
                  />
                </div>
              )}
            </div>

          </div>
        </div>

      </div>}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COST TAG ROW (shared: green if have enough, red if missing)
// ─────────────────────────────────────────────────────────────────────────────
function CostTagRow({ cost, inventory, credits }) {
  if (!cost) return null;
  const tags = [];
  if (cost.credits) {
    const have = credits || 0;
    const ok   = have >= cost.credits;
    tags.push(
      <Tag key="credits" color={ok ? "rgba(255,255,255,0.45)" : "#e05252"}>
        💳 {cost.credits} CR <span style={{ opacity: 0.5, marginLeft: 3 }}>({have})</span>
      </Tag>
    );
  }
  for (const [k, v] of Object.entries(cost)) {
    if (k === "credits") continue;
    const item = ITEMS[k];
    const have = inventory?.[k] || 0;
    const ok   = have >= v;
    tags.push(
      <Tag key={k} color={ok ? "rgba(255,255,255,0.45)" : "#e05252"}>
        {item?.icon} {v}× {item?.name || k} <span style={{ opacity: 0.5, marginLeft: 3 }}>({have})</span>
      </Tag>
    );
  }
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>{tags}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAB SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function LabScreen({ buildingLevels, inventory, credits, onUpgrade, researchedTechs, onResearch, onBack, locationName }) {
  const [selectedTech, setSelectedTech] = useState(null);

  const lab     = BUILDINGS.find(b => b.id === "lab");
  const level   = buildingLevels?.["lab"] ?? 0;
  const isBuilt = level >= 1;

  const nextData    = lab.levels?.find(l => l.level === level + 1);
  const currentData = isBuilt ? (lab.levels?.find(l => l.level === level) || lab.levels?.[0]) : null;

  const canAffordCost = (cost) => {
    if (!cost) return false;
    if (cost.credits && (credits || 0) < cost.credits) return false;
    for (const [k, v] of Object.entries(cost)) {
      if (k !== "credits" && (inventory?.[k] || 0) < v) return false;
    }
    return true;
  };

  const canAffordBuild = nextData?.cost ? canAffordCost(nextData.cost) : false;

  const handleTechClick = (tech) => {
    setSelectedTech(prev => (prev?.id === tech.id ? null : tech));
  };

  const techIsDone   = selectedTech ? !!researchedTechs?.[selectedTech.id] : false;
  const canAffordTech = selectedTech?.cost ? canAffordCost(selectedTech.cost) : false;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>

      {/* ── Hero image (always visible) ── */}
      <div style={{ position: "relative", width: "100%", height: 130, flexShrink: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url(/research_lab.png)", backgroundSize: "cover", backgroundPosition: "center" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #070d1a 0%, rgba(7,13,26,0.55) 45%, transparent 100%)" }} />
      </div>
      <ScreenBreadcrumb label="Research Lab" parent={locationName} onBack={onBack} />

      {/* ── Title + description (always visible) ── */}
      <div style={{ padding: "14px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 20, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: "#fff", textTransform: "uppercase", lineHeight: 1, marginBottom: 4 }}>
          Research Lab
        </div>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: isBuilt ? "#3fa7d6" : "rgba(255,255,255,0.3)", letterSpacing: 1, marginBottom: 8 }}>
          {isBuilt ? `Level ${level}` : "NOT BUILT"}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'Barlow',sans-serif", lineHeight: 1.5 }}>
          {isBuilt ? "Increases research speed and unlocks advanced technology tiers." : "Build this facility to unlock research and new technologies."}
        </div>
      </div>

      {/* ── Switchable zone: tech detail OR build/upgrade (fixed min-height to prevent grid jump) ── */}
      <div style={{ minHeight: 130, flexShrink: 0 }}>
        {selectedTech ? (
          /* Tech detail panel */
          <div style={{ padding: "14px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", animation: "fadeIn 0.15s ease" }}>
            {/* Header: icon + name + status + close */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0, background: selectedTech.color + "18", border: `1px solid ${selectedTech.color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 0 12px ${selectedTech.color}22` }}>
                {selectedTech.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: "#fff", textTransform: "uppercase", lineHeight: 1, marginBottom: 4 }}>
                  {selectedTech.name}
                </div>
                <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: techIsDone ? "#5ec26a" : selectedTech.color }}>
                  {techIsDone ? "✓ RESEARCHED" : selectedTech.available ? "AVAILABLE" : "LOCKED"}
                </div>
              </div>
              <button
                onClick={() => setSelectedTech(null)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", borderRadius: 2, width: 24, height: 24, fontSize: 12, cursor: "pointer", flexShrink: 0, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              >✕</button>
            </div>
            {/* Description */}
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow',sans-serif", lineHeight: 1.55, marginBottom: 10 }}>
              {selectedTech.desc}
            </div>
            {/* Cost tags */}
            {!techIsDone && selectedTech.cost && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                {Object.entries(selectedTech.cost).map(([k, v]) => {
                  const item = ITEMS[k];
                  const have = inventory?.[k] || 0;
                  const ok   = have >= v;
                  return (
                    <Tag key={k} color={ok ? "rgba(255,255,255,0.4)" : "#e05252"}>
                      {item?.icon} {v}× {item?.name || k}
                      <span style={{ opacity: 0.5, marginLeft: 3 }}>({have})</span>
                    </Tag>
                  );
                })}
              </div>
            )}
            {/* Action */}
            {techIsDone ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 10, background: "#5ec26a", opacity: 0.5, borderRadius: 1 }} />
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "#5ec26a", letterSpacing: 2, textTransform: "uppercase" }}>RESEARCH COMPLETE</span>
              </div>
            ) : selectedTech.cost ? (
              <button
                onClick={canAffordTech ? () => { onResearch(selectedTech.id); setSelectedTech(null); } : undefined}
                className={canAffordTech ? "btn-glow" : ""}
                style={{ padding: "10px 0", background: canAffordTech ? selectedTech.color + "1a" : "rgba(255,255,255,0.02)", border: `1px solid ${canAffordTech ? selectedTech.color + "50" : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: canAffordTech ? selectedTech.color : "rgba(255,255,255,0.2)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: canAffordTech ? "pointer" : "default", transition: "all 0.15s", width: "100%" }}
              >
                {canAffordTech ? "RESEARCH" : "INSUFFICIENT RESOURCES"}
              </button>
            ) : (
              <button style={{ padding: "10px 0", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3, color: "rgba(255,255,255,0.2)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "default", width: "100%" }}>
                COMING SOON
              </button>
            )}
          </div>
        ) : (
          /* Build / Upgrade section */
          <>
            {!isBuilt && nextData ? (
              <>
                <SectionLabel>BUILD RESEARCH LAB</SectionLabel>
                <div style={{ padding: "8px 18px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>Cost</div>
                  <CostTagRow cost={nextData.cost} inventory={inventory} credits={credits} />
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Unlocks</span>
                    <span style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", color: "#3fa7d6", letterSpacing: 0.5 }}>{nextData.label}</span>
                  </div>
                  <button
                    onClick={canAffordBuild ? onUpgrade : undefined}
                    className={canAffordBuild ? "btn-glow" : ""}
                    style={{ marginTop: 8, padding: "11px 0", background: canAffordBuild ? "#3fa7d61a" : "rgba(255,255,255,0.02)", border: `1px solid ${canAffordBuild ? "#3fa7d650" : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: canAffordBuild ? "#3fa7d6" : "rgba(255,255,255,0.2)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: canAffordBuild ? "pointer" : "default", transition: "all 0.15s", width: "100%" }}
                  >
                    {canAffordBuild ? "BUILD RESEARCH LAB" : "INSUFFICIENT RESOURCES"}
                  </button>
                </div>
              </>
            ) : isBuilt && nextData ? (
              <>
                <SectionLabel>UPGRADE TO LV. {level + 1}</SectionLabel>
                <div style={{ padding: "8px 18px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>Cost</div>
                  <CostTagRow cost={nextData.cost} inventory={inventory} credits={credits} />
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Unlocks</span>
                    <span style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", color: "#3fa7d6", letterSpacing: 0.5 }}>{nextData.label}</span>
                  </div>
                  <button
                    onClick={canAffordBuild ? onUpgrade : undefined}
                    className={canAffordBuild ? "btn-glow" : ""}
                    style={{ marginTop: 8, padding: "11px 0", background: canAffordBuild ? "#3fa7d61a" : "rgba(255,255,255,0.02)", border: `1px solid ${canAffordBuild ? "#3fa7d650" : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: canAffordBuild ? "#3fa7d6" : "rgba(255,255,255,0.2)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: canAffordBuild ? "pointer" : "default", transition: "all 0.15s", width: "100%" }}
                  >
                    {canAffordBuild ? `UPGRADE → LV. ${level + 1}` : "INSUFFICIENT RESOURCES"}
                  </button>
                  {currentData && (
                    <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(91,196,232,0.4)", letterSpacing: 0.5 }}>
                      Current: {currentData.label}
                    </div>
                  )}
                </div>
              </>
            ) : isBuilt ? (
              <div style={{ padding: "18px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 10, background: "#3fa7d6", opacity: 0.5, borderRadius: 1 }} />
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "#3fa7d6", letterSpacing: 2, textTransform: "uppercase" }}>MAX LEVEL REACHED</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* ── Technologies grid (only when built) ── */}
      {isBuilt && (
        <>
          <SectionLabel>TECHNOLOGIES</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "8px 16px 24px" }}>
            {LAB_TECHNOLOGIES.map(tech => {
              const isDone     = !!researchedTechs?.[tech.id];
              const isSelected = selectedTech?.id === tech.id;
              return (
                <div
                  key={tech.id}
                  style={{ borderRadius: 7, boxShadow: isSelected ? "0 0 0 2px rgba(91,196,232,0.75)" : "none", transition: "box-shadow 0.15s" }}
                >
                  <BuildingGridCard
                    building={{ ...tech, available: tech.available }}
                    level={isDone ? 1 : 0}
                    onClick={tech.available ? () => handleTechClick(tech) : null}
                  />
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
// ─────────────────────────────────────────────────────────────────────────────
// STORAGE FACILITY SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function StorageFacilityScreen({ inventory, mining, salvaging, refQueue, onStartMining, onStartSalvaging, onStopRefining, onBack, locationName }) {
  const raw = Object.entries(inventory)
    .filter(([k, v]) => v > 0 && ITEMS[k]?.category === "raw")
    .sort((a, b) => {
      const order = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
      return (order[ITEMS[a[0]]?.rarity] ?? 9) - (order[ITEMS[b[0]]?.rarity] ?? 9);
    });

  const cardStyle = { background: "rgba(20,25,40,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>
      <HeroBanner variant="abandoned" name="Storage" />
      <ScreenBreadcrumb label="Storage" parent={locationName} onBack={onBack} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 16px 32px" }}>

        <ActiveOperationsPanel
          mining={mining}
          salvaging={salvaging}
          refQueue={refQueue}
          onStartMining={onStartMining}
          onStartSalvaging={onStartSalvaging}
          onStopRefining={onStopRefining}
        />

        <div style={cardStyle}>
          <div style={{ padding: "14px 20px 4px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 12, background: "#5bc4e8", opacity: 0.7, borderRadius: 1, flexShrink: 0 }} />
            <span className="ty-section">Raw Materials</span>
          </div>
          <div style={{ padding: "4px 20px 12px" }}>
            {raw.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, color: "rgba(255,255,255,0.18)", textTransform: "uppercase" }}>
                // Cargo hold empty
              </div>
            ) : raw.map(([k, v]) => {
              const item = ITEMS[k];
              const rar  = RARITY[item.rarity] || RARITY.common;
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
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDING DETAIL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function BuildingDetailScreen({ buildingId, buildingLevels, inventory, credits, onUpgrade, onBack, locationName }) {
  const [imgFailed, setImgFailed] = useState(false);
  const building    = BUILDINGS.find(b => b.id === buildingId);
  if (!building) return null;

  const level       = buildingLevels[buildingId] ?? 0;
  const isBuilt     = level >= 1;
  const currentData = isBuilt ? (building.levels?.find(l => l.level === level) || building.levels?.[0]) : null;
  const nextData    = building.levels?.find(l => l.level === level + 1);

  // Is this building locked by unlock requirements?
  const isLocked = building.unlockRequires
    ? (buildingLevels[building.unlockRequires.building] || 0) < building.unlockRequires.level
    : !building.available;

  const canAffordCost = (cost) => {
    if (!cost) return false;
    if (cost.credits && (credits || 0) < cost.credits) return false;
    for (const [k, v] of Object.entries(cost)) {
      if (k !== "credits" && (inventory[k] || 0) < v) return false;
    }
    return true;
  };
  const canAffordNext = !isLocked && nextData?.cost ? canAffordCost(nextData.cost) : false;

  const ActionBtn = ({ canDo, onPress, labelOk, labelNo }) => (
    <button
      onClick={canDo ? onPress : undefined}
      className={canDo ? "btn-glow" : ""}
      style={{ marginTop: 8, padding: "11px 0", background: canDo ? building.color + "1a" : "rgba(255,255,255,0.02)", border: `1px solid ${canDo ? building.color + "50" : "rgba(255,255,255,0.08)"}`, borderRadius: 3, color: canDo ? building.color : "rgba(255,255,255,0.2)", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: canDo ? "pointer" : "default", transition: "all 0.15s", width: "100%" }}
    >
      {canDo ? labelOk : labelNo}
    </button>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>

      {/* ── Cover hero ── */}
      {building.image && !imgFailed ? (
        <div style={{ position: "relative", width: "100%", height: 130, flexShrink: 0, overflow: "hidden" }}>
          <img src={building.image} onError={() => setImgFailed(true)} alt="" style={{ display: "none" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${building.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #070d1a 0%, rgba(7,13,26,0.55) 45%, transparent 100%)" }} />
        </div>
      ) : (
        <div style={{ position: "relative", width: "100%", height: 100, flexShrink: 0, overflow: "hidden", background: `linear-gradient(135deg, ${building.color}22 0%, rgba(7,13,26,0.9) 100%)` }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, opacity: 0.18 }}>{building.icon}</div>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #070d1a 0%, transparent 70%)" }} />
        </div>
      )}
      <ScreenBreadcrumb label={building.name || buildingId} parent={locationName} onBack={onBack} />

      {/* ── Title + status ── */}
      <div style={{ padding: "14px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 20, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, color: "#fff", textTransform: "uppercase", lineHeight: 1, marginBottom: 4 }}>
          {building.name}
        </div>
        <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, marginBottom: 8, color: isLocked ? "#e05252" : isBuilt ? building.color : "rgba(255,255,255,0.3)" }}>
          {isLocked ? "🔒 LOCKED" : isBuilt ? `Level ${level} · ${currentData?.label}` : "NOT BUILT"}
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'Barlow',sans-serif", lineHeight: 1.5 }}>
          {building.desc}
        </div>
      </div>

      {/* ── Action zone ── */}
      <div style={{ flexShrink: 0 }}>
        {isLocked ? (
          <>
            <SectionLabel>LOCKED</SectionLabel>
            <div style={{ padding: "8px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {building.unlockRequires ? (() => {
                const reqB = BUILDINGS.find(b => b.id === building.unlockRequires.building);
                const have = buildingLevels[building.unlockRequires.building] || 0;
                const need = building.unlockRequires.level;
                return (
                  <div>
                    <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Requires</div>
                    <Tag color={have >= need ? "rgba(255,255,255,0.45)" : "#e05252"}>
                      {reqB?.icon} {reqB?.name} Lv. {need}
                      <span style={{ opacity: 0.5, marginLeft: 4 }}>({have}/{need})</span>
                    </Tag>
                  </div>
                );
              })() : building.unlockLabel ? (
                <div>
                  <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Status</div>
                  <Tag color="rgba(255,255,255,0.25)">{building.unlockLabel}</Tag>
                </div>
              ) : null}
              <button style={{ marginTop: 4, padding: "11px 0", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, color: "#e0525266", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "default", width: "100%" }}>
                🔒 LOCKED
              </button>
            </div>
          </>
        ) : !isBuilt && nextData ? (
          <>
            <SectionLabel>BUILD {building.name.toUpperCase()}</SectionLabel>
            <div style={{ padding: "8px 18px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>Cost</div>
              <CostTagRow cost={nextData.cost} inventory={inventory} credits={credits} />
              <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginTop: 2 }}>
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Unlocks</span>
                <span style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", color: building.color, letterSpacing: 0.5 }}>{nextData.label}</span>
              </div>
              <ActionBtn canDo={canAffordNext} onPress={onUpgrade} labelOk={`BUILD ${building.name.toUpperCase()}`} labelNo="INSUFFICIENT RESOURCES" />
            </div>
          </>
        ) : isBuilt && nextData ? (
          <>
            <SectionLabel>UPGRADE TO LV. {level + 1}</SectionLabel>
            <div style={{ padding: "8px 18px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>Cost</div>
              <CostTagRow cost={nextData.cost} inventory={inventory} credits={credits} />
              <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginTop: 2 }}>
                <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: 1.5, textTransform: "uppercase", flexShrink: 0 }}>Unlocks</span>
                <span style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", color: building.color, letterSpacing: 0.5 }}>{nextData.label}</span>
              </div>
              <ActionBtn canDo={canAffordNext} onPress={onUpgrade} labelOk={`UPGRADE → LV. ${level + 1}`} labelNo="INSUFFICIENT RESOURCES" />
              {currentData && (
                <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: `${building.color}55`, letterSpacing: 0.5 }}>
                  Current: {currentData.label}
                </div>
              )}
            </div>
          </>
        ) : isBuilt ? (
          <div style={{ padding: "18px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 10, background: building.color, opacity: 0.5, borderRadius: 1 }} />
            <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", color: building.color, letterSpacing: 2, textTransform: "uppercase" }}>MAX LEVEL REACHED</span>
          </div>
        ) : null}
      </div>
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
// SCREEN BREADCRUMB (back nav below hero banner on detail screens)
// ─────────────────────────────────────────────────────────────────────────────
function ScreenBreadcrumb({ label, parent, onBack }) {
  const crumbStyle = { height: 34, display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(3,8,18,0.55)", flexShrink: 0 };
  const sep = <span style={{ color: "rgba(91,196,232,0.25)", fontSize: 12 }}>›</span>;
  return (
    <div style={crumbStyle}>
      <span className="ty-micro" style={{ color: "rgba(255,255,255,0.25)" }}>Sector</span>
      {parent && <>{sep}{onBack ? (
        <button onClick={onBack} className="ty-micro" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "rgba(91,196,232,0.55)", transition: "color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(91,196,232,0.9)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(91,196,232,0.55)"}
        >{parent}</button>
      ) : (
        <span className="ty-micro" style={{ color: "rgba(255,255,255,0.35)" }}>{parent}</span>
      )}</>}
      {sep}
      <span className="ty-micro" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOURCE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ResourceModal({ resource, onStart, onClose }) {
  const [quantity, setQuantity] = useState(10);

  const setQ = (val) => setQuantity(Math.max(1, val));

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
            onChange={e => setQ(parseInt(e.target.value) || 1)}
          />
          <button className="qty-btn" onClick={() => setQ(quantity + 1)}>+</button>
        </div>

        <div className="modal-estimate">
          Dauer: <strong>{formatTime(totalSeconds)}</strong>
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
function MiningSkillScreen({ mining, miningXP, onStartMining, onBack, locationName }) {
  const [modalResource, setModalResource] = useState(null);
  const level = getLevel(miningXP || 0);

  // Only show home sector (Raw Stone)
  const homeSector = SECTORS.find(s => s.id === "home");
  const entries = homeSector ? homeSector.materials.map(matRef => ({ sector: homeSector, matRef, locked: false })) : [];

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
      <HeroBanner variant="mining" icon="⛏" name="Mining" level={level} xp={miningXP || 0} />
      <ScreenBreadcrumb label="Mining" parent={locationName} onBack={onBack} />

      <SectionLabel>VERFÜGBARE RESSOURCEN</SectionLabel>

      <div style={{ padding: "0 16px 28px" }}>
        {entries.map(({ sector, matRef, locked }, i) => {
          const item     = ITEMS[matRef.id];
          const isActive = mining?.sectorId === sector.id && mining?.matId === matRef.id;
          const canClick = !locked && !isActive;

          return (
            <div key={`${sector.id}-${matRef.id}`}
              className="item-row"
              onClick={() => canClick && item && openModal(sector, matRef, item)}
              style={{
                opacity: locked ? 0.35 : 1,
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
                <span style={{ fontSize: 11, color: canClick ? "var(--accent-cyan)" : "var(--text-muted)", opacity: canClick ? 0.7 : 1, flexShrink: 0 }}>▶</span>
              )}
            </div>
          );
        })}
      </div>

      {modalResource && (
        <ResourceModal
          resource={modalResource}
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
function SalvagingSkillScreen({ salvaging, salvagingXP, onStartSalvaging, onBack, locationName }) {
  const [modalResource, setModalResource] = useState(null);
  const level = getLevel(salvagingXP || 0);

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
      <HeroBanner variant="salvaging" icon="🔍" name="Salvaging" level={level} xp={salvagingXP || 0} />
      <ScreenBreadcrumb label="Salvaging" parent={locationName} onBack={onBack} />

      <SectionLabel>VERFÜGBARE RESSOURCEN</SectionLabel>

      <div style={{ padding: "0 16px 28px" }}>
        {SALVAGING_MATS.map((mat, i) => {
          const item     = ITEMS[mat.id];
          const isActive = salvaging?.matId === mat.id;
          const canClick = !isActive;

          return (
            <div key={mat.id}
              className="item-row"
              onClick={() => canClick && item && openModal(mat, item)}
              style={{
                opacity: 1,
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
                <span style={{ fontSize: 11, color: "var(--accent-cyan)", opacity: 0.7, flexShrink: 0 }}>▶</span>
              )}
            </div>
          );
        })}
      </div>

      {modalResource && (
        <ResourceModal
          resource={modalResource}
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
function RefiningSkillScreen({ inventory, refQueue, moduleLevel, refiningXP, onQueue, onSell, onBack, locationName }) {
  const activeRecipe = refQueue.length > 0 ? RECIPES.find(r => r.id === refQueue[0]?.recipeId) : null;
  const activeItem   = activeRecipe ? ITEMS[activeRecipe.id] : null;
  const visible      = RECIPES.filter(r => r.reqModule <= moduleLevel + 1);
  const hiddenCount  = RECIPES.filter(r => r.reqModule > moduleLevel + 1).length;
  const level        = getLevel(refiningXP || 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>
      <HeroBanner variant="refining" icon="⚗" name="Refining" level={level} xp={refiningXP || 0} />
      <ScreenBreadcrumb label="Refining" parent={locationName} onBack={onBack} />

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
function CraftingSkillScreen({ onBack, locationName }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>
      <HeroBanner variant="crafting" icon="🔧" name="Crafting" level={1} />
      <ScreenBreadcrumb label="Crafting" parent={locationName} onBack={onBack} />
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
// PROFIL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function ProfilScreen({ miningXP, rank, inventory, credits, currentLocation, playSeconds }) {
  const totalItems = Object.values(inventory).reduce((a, v) => a + v, 0);

  const h = Math.floor(playSeconds / 3600);
  const m = Math.floor((playSeconds % 3600) / 60);
  const s = playSeconds % 60;
  const timeStr = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;

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
// INVENTORY SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function InventoryScreen({ inventory }) {
  const rarOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
  const invEntries = Object.entries(inventory)
    .filter(([, v]) => v > 0)
    .sort((a, b) => (rarOrder[ITEMS[a[0]]?.rarity] ?? 9) - (rarOrder[ITEMS[b[0]]?.rarity] ?? 9));

  const byCategory = (cat) => invEntries.filter(([k]) => ITEMS[k]?.category === cat);
  const raw     = byCategory("raw");
  const refined = byCategory("refined");
  const crafted = byCategory("crafted");

  const cardStyle = { background: "rgba(20,25,40,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" };

  const Section = ({ label, entries }) => entries.length === 0 ? null : (
    <div style={cardStyle}>
      <div style={{ padding: "14px 20px 4px", fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2.5, color: "rgba(91,196,232,0.4)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 12, background: "#5bc4e8", opacity: 0.7, borderRadius: 1, flexShrink: 0 }} />
        {label}
      </div>
      <div style={{ padding: "4px 20px 12px" }}>
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
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeIn 0.2s ease", paddingBottom: 32 }}>
      {invEntries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", fontSize: 11, color: "rgba(255,255,255,0.18)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2 }}>
          // CARGO HOLD EMPTY · MINE MATERIALS
        </div>
      ) : (
        <>
          <Section label="Raw Materials"    entries={raw} />
          <Section label="Refined Goods"    entries={refined} />
          <Section label="Crafted Items"    entries={crafted} />
        </>
      )}
    </div>
  );
}

function CallsignInput({ onConfirm }) {
  const [val, setVal] = useState("");
  const valid = val.trim().length >= 2;
  return (
    <>
      <input type="text" placeholder="Commander Name..." value={val} maxLength={20}
        autoFocus
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && valid && onConfirm(val.trim())}
        style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", background: "rgba(255,255,255,0.07)", border: valid ? "1px solid rgba(91,196,232,0.4)" : "1px solid rgba(255,255,255,0.16)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "'Barlow',sans-serif", marginBottom: 10, outline: "none" }}
      />
      <button onClick={() => valid && onConfirm(val.trim())} disabled={!valid}
        style={{ width: "100%", padding: "12px", background: valid ? "rgba(91,196,232,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${valid ? "rgba(91,196,232,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: valid ? "#7dd4f0" : "rgba(255,255,255,0.25)", fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1.5, cursor: valid ? "pointer" : "default", transition: "all 0.15s" }}>
        CONFIRM
      </button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE SUMMARY MODAL
// ─────────────────────────────────────────────────────────────────────────────
function OfflineSummaryModal({ summary, username, onDismiss }) {
  const totalSecs = summary.elapsedSec;
  const hours     = Math.floor(totalSecs / 3600);
  const mins      = Math.floor((totalSecs % 3600) / 60);
  const timeStr   = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const entries   = Object.entries(summary.gathered || {});

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.25s ease" }}>
      <div style={{ width: "100%", maxWidth: 360, background: "rgba(5,12,25,0.98)", border: "1px solid rgba(91,196,232,0.25)", borderTop: "2px solid rgba(91,196,232,0.6)", borderRadius: 12, overflow: "hidden", boxShadow: "0 0 80px rgba(91,196,232,0.1), 0 24px 64px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid rgba(91,196,232,0.1)" }}>
          <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 3, color: "rgba(91,196,232,0.5)", marginBottom: 8 }}>// WELCOME BACK</div>
          <div style={{ fontSize: 20, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1, color: "#fff", marginBottom: 4 }}>
            Commander <span style={{ color: "#5bc4e8" }}>{username}</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow',sans-serif" }}>
            You were offline for <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{timeStr}</span>. Here's what happened:
          </div>
        </div>

        {/* Gathered items */}
        <div style={{ padding: "14px 24px 18px" }}>
          {entries.length > 0 ? (
            <>
              <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2.5, color: "rgba(91,196,232,0.45)", marginBottom: 10 }}>RESOURCES GATHERED</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {entries.map(([itemId, amount]) => {
                  const item = ITEMS[itemId];
                  if (!item) return null;
                  const rar = RARITY[item.rarity || "common"];
                  return (
                    <div key={itemId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(91,196,232,0.04)", border: `1px solid ${rar.color}18`, borderLeft: `2px solid ${rar.color}55`, borderRadius: 4 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                      <span style={{ flex: 1, fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 0.5, color: "rgba(255,255,255,0.85)" }}>{item.name}</span>
                      <span style={{ fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: rar.color }}>+{amount}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0", fontSize: 13, color: "rgba(255,255,255,0.35)", fontFamily: "'Barlow',sans-serif" }}>
              No active tasks were running while offline.
            </div>
          )}

          {summary.refiningDone > 0 && (
            <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(94,194,106,0.06)", border: "1px solid rgba(94,194,106,0.2)", borderLeft: "2px solid rgba(94,194,106,0.5)", borderRadius: 4, fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "'Barlow Condensed',sans-serif" }}>
              ⚗️ Refinery completed <span style={{ color: "#5ec26a", fontWeight: 700 }}>{summary.refiningDone}</span> job{summary.refiningDone !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ padding: "0 24px 24px" }}>
          <button
            onClick={onDismiss}
            style={{ width: "100%", padding: "13px", background: "rgba(91,196,232,0.12)", border: "1px solid rgba(91,196,232,0.4)", borderRadius: 8, color: "#7dd4f0", fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, cursor: "pointer", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(91,196,232,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(91,196,232,0.12)"}
          >
            CONTINUE
          </button>
        </div>
      </div>
    </div>
  );
}

// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function LoginScreen({ onBeforeLogin }) {
  const [tab, setTab]         = useState("email"); // "email" | "guest"
  const [username, setUsername] = useState("");
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const usernameValid = username.trim().length >= 2;

  const features = [
    "Automate asteroid mining",
    "Optimize production chains",
    "Expand across star systems",
    "Trade rare cosmic resources",
  ];

  const handleEmailLogin = async () => {
    if (!email) { setError("Bitte gib deine E-Mail-Adresse ein."); return; }
    setLoading(true);
    setError("");
    const { error: authErr } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    });
    setLoading(false);
    if (authErr) setError(authErr.message || "Login fehlgeschlagen. Versuche es erneut.");
    else setSent(true);
  };

  const handleGuest = async () => {
    if (!usernameValid) { setError("Bitte gib einen Benutzernamen ein (min. 2 Zeichen)."); return; }
    setLoading(true);
    setError("");
    onBeforeLogin(username.trim());
    const { error: authErr } = await supabase.auth.signInAnonymously();
    setLoading(false);
    if (authErr) setError("Gastzugang momentan nicht verfügbar.");
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "'Barlow',sans-serif",
    marginBottom: 10, outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative", zIndex: 1, overflowY: "auto", boxSizing: "border-box" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
          <h1 className="font-display" style={{ fontSize: "clamp(56px, 11vw, 88px)", letterSpacing: 8, color: "#5bc4e8", textShadow: "0 0 40px rgba(91,196,232,0.51), 0 0 80px rgba(91,196,232,0.21)", margin: 0, lineHeight: 1 }}>VOID FRONTIER</h1>
          <span style={{ position: "absolute", top: -10, right: -58, fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, color: "#ffd060", border: "1px solid rgba(255,208,96,0.5)", borderRadius: 3, padding: "3px 8px", background: "rgba(255,208,96,0.1)", textShadow: "0 0 10px rgba(255,208,96,0.6)", whiteSpace: "nowrap" }}>ALPHA</span>
        </div>
        <p style={{ fontSize: 22, color: "rgba(255,255,255,0.93)", fontFamily: "'Barlow',sans-serif", maxWidth: 380, margin: "0 auto 12px", lineHeight: 1.5, fontWeight: 600 }}>
          Build. Automate. Expand. Repeat.
        </p>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.62)", fontFamily: "'Barlow',sans-serif", maxWidth: 340, margin: "0 auto", lineHeight: 1.65, fontWeight: 400 }}>
          A space idle game built around long-term automation and persistent growth.
        </p>
      </div>

      {/* CTA card */}
      <div style={{ width: "100%", maxWidth: 400, marginBottom: 28 }}>
        {sent ? (
          <div style={{ background: "rgba(5,12,25,0.92)", border: "1px solid rgba(91,196,232,0.2)", borderTop: "2px solid rgba(91,196,232,0.5)", borderRadius: 16, overflow: "hidden", boxShadow: "0 0 60px rgba(91,196,232,0.07)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 198 }}>
            <div style={{ textAlign: "center", padding: "28px 24px" }}>
              <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 10, color: "#fff" }}>Check your inbox</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: 0 }}>
                We sent a login link to <strong style={{ color: "rgba(255,255,255,0.85)" }}>{email}</strong>.<br />Click it to enter the game.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ background: "rgba(5,12,25,0.92)", border: "1px solid rgba(91,196,232,0.2)", borderTop: "2px solid rgba(91,196,232,0.5)", borderRadius: 16, overflow: "hidden", boxShadow: "0 0 60px rgba(91,196,232,0.07)" }}>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {[{ id: "email", label: "WITH EMAIL" }, { id: "guest", label: "AS GUEST" }].map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setError(""); }}
                  style={{ flex: 1, padding: "13px", background: tab === t.id ? "rgba(91,196,232,0.08)" : "transparent", border: "none", borderBottom: `2px solid ${tab === t.id ? "#5bc4e8" : "transparent"}`, color: tab === t.id ? "#5bc4e8" : "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, cursor: "pointer", transition: "all 0.15s", marginBottom: -1 }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "24px" }}>
              {/* Fixed-height description — same for both tabs to prevent layout jump */}
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow',sans-serif", marginBottom: 14, lineHeight: 1.5, height: "2em" }}>
                {tab === "email" ? "Save progress permanently. No password needed." : "Play instantly without an account."}
              </div>

              {tab === "email" ? (
                <>
                  <input type="email" placeholder="you@example.com" value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleEmailLogin()}
                    style={inputStyle} autoFocus={tab === "email"}
                  />
                  <button onClick={handleEmailLogin} disabled={loading}
                    style={{ width: "100%", padding: "13px", background: "rgba(91,196,232,0.15)", border: "1px solid rgba(91,196,232,0.4)", borderRadius: 8, color: "#7dd4f0", fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1.5, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
                    {loading ? "SENDING..." : "SEND LOGIN LINK"}
                  </button>
                </>
              ) : (
                <>
                  <input type="text" placeholder="Your commander name..." value={username} maxLength={20}
                    onChange={e => { setUsername(e.target.value); setError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleGuest()}
                    style={{ ...inputStyle, border: usernameValid ? "1px solid rgba(91,196,232,0.35)" : "1px solid rgba(255,255,255,0.16)" }}
                    autoFocus={tab === "guest"}
                  />
                  <button onClick={handleGuest} disabled={loading} className="cta-pulse"
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.animationPlayState = "paused"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.animationPlayState = "running"; }}
                    style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, rgba(91,196,232,0.28), rgba(91,196,232,0.11))", border: "1px solid rgba(91,196,232,0.55)", borderRadius: 8, color: "#c8eef8", fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 2, cursor: "pointer", opacity: loading ? 0.6 : 1, transition: "transform 0.15s" }}>
                    {loading ? "LAUNCHING..." : "PLAY NOW"}
                  </button>
                </>
              )}

              {error && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#ff8080", fontFamily: "'Barlow',sans-serif", textAlign: "center" }}>{error}</div>
              )}
            </div>
          </div>
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

  const [username, setUsername]         = useState("Commander");
  const [offlineSummary, setOfflineSummary] = useState(null);

  const [inventory, setInventory] = useState({});
  const [credits, setCredits]     = useState(0);
  const [miningXP, setMiningXP]       = useState(0);
  const [salvagingXP, setSalvagingXP] = useState(0);
  const [refiningXP, setRefiningXP]   = useState(0);
  const [installed, setInstalled]     = useState({});
  const [mining, setMining]               = useState(null);
  const [salvaging, setSalvaging]         = useState(null);
  const [refQueue, setRefQueue]           = useState([]);
  const [buildingLevels, setBuildingLevels] = useState({ refinery: 1 });
  const [researchedTechs, setResearchedTechs] = useState({});
  const [toasts, setToasts]           = useState([]);
  const [currentLocation, setCurrentLocation] = useState("home");
  const [travelling, setTravelling]           = useState(null);
  const [playSeconds, setPlaySeconds]         = useState(0);
  const [navDir, setNavDir]                   = useState("tab");

  const timerRef          = useRef(null);
  const salvagingTimerRef = useRef(null);
  const refTimerRef       = useRef(null);
  const travelTimerRef    = useRef(null);
  const toastId           = useRef(0);
  const pendingUsername   = useRef(null); // username entered on login screen before auth completes
  const gameLoaded        = useRef(false); // loadGame runs exactly once per page load

  // ── AUTH ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        // Only null out session on explicit sign-out — NOT during token-refresh
        // sequences where Supabase briefly fires SIGNED_OUT then SIGNED_IN,
        // which unmounts the game component and wipes all React state.
        setSession(null);
        gameLoaded.current = false;
        return;
      }
      if (!session) return;
      setSession(session);
      // Load game state exactly once per page load.
      if (!gameLoaded.current && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        gameLoaded.current = true;
        loadGame(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── LOAD GAME ──────────────────────────────────────────────────────────
  const loadGame = async (userId) => {
    const { data } = await supabase.from("game_saves").select("save_data").eq("user_id", userId).single();

    // Pick up username from ref (guest) or localStorage (magic link page reload)
    const lsUsername = localStorage.getItem("vf_pending_username");
    const resolvedPending = pendingUsername.current || lsUsername || null;
    if (lsUsername) localStorage.removeItem("vf_pending_username");
    pendingUsername.current = null;

    if (!data?.save_data) {
      // New account — apply username chosen on login screen
      if (resolvedPending) setUsername(resolvedPending);
      return;
    }

    const s = data.save_data;

    // Username: prefer saved value, fall back to what was entered on login screen
    setUsername(s.username || resolvedPending || "Commander");

    // Base state
    let inv   = s.inventory || {};
    let mXP   = s.miningXP   || 0;
    let salXP = s.salvagingXP || 0;
    let refXP = s.refiningXP  || 0;
    if (s.credits)         setCredits(s.credits);
    if (s.installed)       setInstalled(s.installed);
    if (s.buildingLevels)  setBuildingLevels(s.buildingLevels);
    if (s.researchedTechs) setResearchedTechs(s.researchedTechs);

    // ── Offline progress ──────────────────────────────────────────────
    const elapsedSec = s.savedAt
      ? Math.min((Date.now() - s.savedAt) / 1000, 8 * 3600) // cap 8 h
      : 0;

    // Track what was gathered offline for the summary modal
    const offlineGathered = {};

    // Mining
    let newMining = s.mining || null;
    if (newMining && elapsedSec > 0) {
      const sec  = SECTORS.find(x => x.id === newMining.sectorId);
      const mRef = sec?.materials.find(m => m.id === newMining.matId);
      if (mRef) {
        const timeLeft = mRef.time * (1 - (newMining.progress || 0));
        if (elapsedSec >= timeLeft) {
          const extra      = elapsedSec - timeLeft;
          const maxNew     = newMining.targetCompletions ? newMining.targetCompletions - (newMining.completions || 0) : Infinity;
          const totalNew   = Math.min(1 + Math.floor(extra / mRef.time), maxNew);
          const newProg    = totalNew < maxNew ? (extra % mRef.time) / mRef.time : 0;
          const totalDone  = (newMining.completions || 0) + totalNew;
          const gained     = totalNew * mRef.amount;
          inv  = { ...inv, [mRef.id]: (inv[mRef.id] || 0) + gained };
          mXP += totalNew * mRef.time * 0.8;
          offlineGathered[mRef.id] = (offlineGathered[mRef.id] || 0) + gained;
          newMining = (newMining.targetCompletions && totalDone >= newMining.targetCompletions)
            ? null
            : { ...newMining, progress: newProg, completions: totalDone };
        } else {
          newMining = { ...newMining, progress: (newMining.progress || 0) + elapsedSec / mRef.time };
        }
      }
    }

    // Salvaging
    let newSalvaging = s.salvaging || null;
    if (newSalvaging && elapsedSec > 0) {
      const mat = SALVAGING_MATS.find(m => m.id === newSalvaging.matId);
      if (mat) {
        const timeLeft = mat.time * (1 - (newSalvaging.progress || 0));
        if (elapsedSec >= timeLeft) {
          const extra      = elapsedSec - timeLeft;
          const maxNew     = newSalvaging.targetCompletions ? newSalvaging.targetCompletions - (newSalvaging.completions || 0) : Infinity;
          const totalNew   = Math.min(1 + Math.floor(extra / mat.time), maxNew);
          const newProg    = totalNew < maxNew ? (extra % mat.time) / mat.time : 0;
          const totalDone  = (newSalvaging.completions || 0) + totalNew;
          const gained     = totalNew * mat.amount;
          inv   = { ...inv, [mat.id]: (inv[mat.id] || 0) + gained };
          salXP += totalNew * mat.time * 0.2;
          offlineGathered[mat.id] = (offlineGathered[mat.id] || 0) + gained;
          newSalvaging = (newSalvaging.targetCompletions && totalDone >= newSalvaging.targetCompletions)
            ? null
            : { ...newSalvaging, progress: newProg, completions: totalDone };
        } else {
          newSalvaging = { ...newSalvaging, progress: (newSalvaging.progress || 0) + elapsedSec / mat.time };
        }
      }
    }

    // Refining queue
    let newRefQueue = [...(s.refQueue || [])];
    let refiningDone = 0;
    if (newRefQueue.length > 0 && elapsedSec > 0) {
      let t = elapsedSec;
      const remaining = [];
      for (const item of newRefQueue) {
        if (t <= 0) { remaining.push(item); continue; }
        const recipe  = RECIPES.find(r => r.id === item.recipeId);
        if (!recipe)  { remaining.push(item); continue; }
        const timeLeft = recipe.time * (1 - (item.progress || 0));
        if (t >= timeLeft) {
          inv   = { ...inv, [recipe.id]: (inv[recipe.id] || 0) + 1 };
          refXP += recipe.time;
          t    -= timeLeft;
          refiningDone++;
          offlineGathered[recipe.id] = (offlineGathered[recipe.id] || 0) + 1;
        } else {
          remaining.push({ ...item, progress: (item.progress || 0) + t / recipe.time });
          t = 0;
        }
      }
      newRefQueue = remaining;
    }

    // Apply everything
    setInventory(inv);
    setMiningXP(mXP);
    setSalvagingXP(salXP);
    setRefiningXP(refXP);
    setMining(newMining);
    setSalvaging(newSalvaging);
    setRefQueue(newRefQueue);

    // Show offline summary if meaningful time passed
    if (elapsedSec > 60) {
      setOfflineSummary({ elapsedSec, gathered: offlineGathered, refiningDone });
    }
  };

  // ── SAVE GAME (auto every 30s) ─────────────────────────────────────────
  const saveGame = useCallback(async () => {
    if (!session?.user) return;
    const saveData = {
      username,
      inventory, credits, miningXP, salvagingXP, refiningXP,
      installed, buildingLevels, researchedTechs,
      mining, salvaging, refQueue,
      savedAt: Date.now(),
    };
    const now = new Date().toISOString();
    // Try update first; if no row exists yet, insert.
    const { data: updated } = await supabase
      .from("game_saves")
      .update({ save_data: saveData, updated_at: now })
      .eq("user_id", session.user.id)
      .select("user_id");
    if (!updated || updated.length === 0) {
      await supabase.from("game_saves").insert({ user_id: session.user.id, save_data: saveData, updated_at: now });
    }
  }, [session, username, inventory, credits, miningXP, salvagingXP, refiningXP, installed, mining, salvaging, refQueue]);

  // Keep a ref to the latest saveGame so the interval always calls the current version
  // without restarting every time game state changes (which would prevent it from ever firing).
  const saveGameRef = useRef(saveGame);
  useEffect(() => { saveGameRef.current = saveGame; }, [saveGame]);
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => saveGameRef.current(), 30000);
    return () => clearInterval(id);
  }, [session]);

  // Save immediately when the tab is hidden (user switches away or closes the game)
  useEffect(() => {
    if (!session) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveGameRef.current();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [session]);

  const warpLevel   = Math.max(0, ...SHIP_UPGRADES.filter(u => u.cat === "warp"   && installed[u.id]).map(u => u.effect.warp),   0);
  const moduleLevel = Math.max(0, ...SHIP_UPGRADES.filter(u => u.cat === "module" && installed[u.id]).map(u => u.effect.module), 0);
  const miningLevel = getLevel(miningXP);
  const totalLevel  = miningLevel;

  // Ambient colors for the current location
  const currentSector = SECTORS.find(s => s.id === currentLocation) || HOME_LOCATION;
  const locName = currentLocation === "home" ? HOME_LOCATION.name : (currentSector?.name || "Unknown");
  const [ambC1, ambC2] = currentSector.ambient || ["#5bc4e8", "#5bc4e8"];
  const rank        = getRank(totalLevel);


  const addToast = useCallback((msg, icon, color = "#e8a838") => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-3), { id, msg, icon, color }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const addLog = () => {};

  // Mining tick — time-based so throttled background tabs catch up on return
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!mining) return;
    const sector = SECTORS.find(s => s.id === mining.sectorId);
    const matRef = sector?.materials.find(m => m.id === mining.matId);
    if (!matRef) return;

    let lastTick = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick) / 1000; // real seconds since last tick
      lastTick = now;

      setMining(m => {
        if (!m) return null;
        const timeLeft = matRef.time * (1 - (m.progress || 0));
        if (dt < timeLeft) return { ...m, progress: (m.progress || 0) + dt / matRef.time };

        // One or more completions fit in dt
        const extra      = dt - timeLeft;
        const totalNew   = 1 + Math.floor(extra / matRef.time);
        const newProg    = (extra % matRef.time) / matRef.time;
        const totalDone  = (m.completions || 0) + totalNew;
        setInventory(inv => ({ ...inv, [matRef.id]: (inv[matRef.id] || 0) + totalNew * matRef.amount }));
        setMiningXP(x => {
          const next = x + totalNew * matRef.time * 0.8;
          if (getLevel(next) > getLevel(x)) addToast(`Mining reached Level ${getLevel(next)}!`, "🎉", "#e8a838");
          return next;
        });
        if (m.targetCompletions && totalDone >= m.targetCompletions) {
          addToast(`${totalDone}× ${ITEMS[matRef.id]?.name} mined!`, "✅", "#e8a838");
          return null;
        }
        return { ...m, progress: newProg, completions: totalDone };
      });
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [mining?.sectorId, mining?.matId]);

  // Salvaging tick — time-based
  useEffect(() => {
    clearInterval(salvagingTimerRef.current);
    if (!salvaging) return;
    const mat = SALVAGING_MATS.find(m => m.id === salvaging.matId);
    if (!mat) return;

    let lastTick = Date.now();
    salvagingTimerRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick) / 1000;
      lastTick = now;

      setSalvaging(s => {
        if (!s) return null;
        const timeLeft = mat.time * (1 - (s.progress || 0));
        if (dt < timeLeft) return { ...s, progress: (s.progress || 0) + dt / mat.time };

        const extra     = dt - timeLeft;
        const totalNew  = 1 + Math.floor(extra / mat.time);
        const newProg   = (extra % mat.time) / mat.time;
        const totalDone = (s.completions || 0) + totalNew;
        setInventory(inv => ({ ...inv, [mat.id]: (inv[mat.id] || 0) + totalNew * mat.amount }));
        setSalvagingXP(x => {
          const next = x + totalNew * mat.time * 0.2;
          if (getLevel(next) > getLevel(x)) addToast(`Salvaging reached Level ${getLevel(next)}!`, "🎉", "#3fa7d6");
          return next;
        });
        if (s.targetCompletions && totalDone >= s.targetCompletions) {
          addToast(`${totalDone}× ${ITEMS[mat.id]?.name} salvaged!`, "✅", "#3fa7d6");
          return null;
        }
        return { ...s, progress: newProg, completions: totalDone };
      });
    }, 50);
    return () => clearInterval(salvagingTimerRef.current);
  }, [salvaging?.matId]);

  // Refinery tick — time-based
  useEffect(() => {
    clearInterval(refTimerRef.current);
    if (refQueue.length === 0) return;

    let lastTick = Date.now();
    refTimerRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick) / 1000;
      lastTick = now;

      setRefQueue(q => {
        if (q.length === 0) return q;
        let remaining = dt;
        const newQ = [...q];
        while (newQ.length > 0 && remaining > 0) {
          const head   = newQ[0];
          const recipe = RECIPES.find(r => r.id === head.recipeId);
          if (!recipe) { newQ.shift(); continue; }
          const timeLeft = recipe.time * (1 - (head.progress || 0));
          if (remaining >= timeLeft) {
            remaining -= timeLeft;
            newQ.shift();
            setInventory(inv => ({ ...inv, [recipe.id]: (inv[recipe.id] || 0) + 1 }));
            setRefiningXP(x => {
              const next = x + recipe.time;
              if (getLevel(next) > getLevel(x)) addToast(`Refining reached Level ${getLevel(next)}!`, "🎉", "#5ec26a");
              return next;
            });
            if (newQ.length === 0) addToast("Refinery queue complete.", "⚗️", "#5ec26a");
          } else {
            newQ[0] = { ...head, progress: (head.progress || 0) + remaining / recipe.time };
            remaining = 0;
          }
        }
        return newQ;
      });
    }, 50);
    return () => clearInterval(refTimerRef.current);
  }, [refQueue.length]);

  // Travel tick — time-based so throttled background tabs catch up on return
  useEffect(() => {
    clearInterval(travelTimerRef.current);
    if (!travelling) return;
    let lastTick = Date.now();
    travelTimerRef.current = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick) / 1000;
      lastTick = now;
      setTravelling(t => {
        if (!t) return null;
        const p = (t.progress || 0) + dt / TRAVEL_SECS;
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
    setSalvaging(null);
    setMining({ sectorId, matId, progress: 0, completions: 0, targetCompletions: quantity });
    const s = SECTORS.find(s => s.id === sectorId), m = s?.materials.find(m => m.id === matId);
    const item = ITEMS[m?.id];
    addLog(`▶ Mining: ${item?.icon} ${item?.name} in ${s?.name}${quantity ? ` (×${quantity})` : ""}`);
  };

  const startSalvaging = (matId, quantity = null) => {
    if (salvaging?.matId === matId) { setSalvaging(null); addLog("⏹ Salvaging stopped"); return; }
    setMining(null);
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

  const upgradeBuilding = (buildingId) => {
    const building = BUILDINGS.find(b => b.id === buildingId);
    const curLevel = buildingLevels[buildingId] ?? 0;
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

  const researchTech = (techId) => {
    const tech = LAB_TECHNOLOGIES.find(t => t.id === techId);
    if (!tech?.cost || researchedTechs[techId]) return;
    const cost = tech.cost;
    for (const [k, v] of Object.entries(cost)) {
      if ((inventory[k] || 0) < v) { addToast("Nicht genug Materialien.", "❌", "#e05252"); return; }
    }
    setInventory(inv => { const n = { ...inv }; for (const [k, v] of Object.entries(cost)) n[k] = (n[k] || 0) - v; return n; });
    setResearchedTechs(rt => ({ ...rt, [techId]: true }));
    addToast(`${tech.name} researched!`, tech.icon, tech.color);
  };


  const BOTTOM_NAV = [
    { id: "ort",    label: "SECTOR", icon: "📍" },
    { id: "ship",   label: "GALAXY", icon: "🌌" },
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
      <LoginScreen onBeforeLogin={(uname) => { pendingUsername.current = uname; }} />
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <Toast toasts={toasts} />
      {offlineSummary && (
        <OfflineSummaryModal
          summary={offlineSummary}
          username={username}
          onDismiss={() => setOfflineSummary(null)}
        />
      )}
      {!offlineSummary && username === "Commander" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 340, background: "rgba(5,12,25,0.98)", border: "1px solid rgba(91,196,232,0.25)", borderTop: "2px solid rgba(91,196,232,0.6)", borderRadius: 12, padding: "28px 24px", boxShadow: "0 0 80px rgba(91,196,232,0.1)" }}>
            <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 3, color: "rgba(91,196,232,0.5)", marginBottom: 10 }}>// WELCOME</div>
            <div style={{ fontSize: 18, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: "#fff", marginBottom: 6 }}>Choose your callsign</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow',sans-serif", marginBottom: 18, marginTop: 0 }}>What should your commander be called?</p>
            <CallsignInput onConfirm={(name) => { setUsername(name); saveGame(); }} />
          </div>
        </div>
      )}

      {/* Background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "linear-gradient(160deg, #0a1628 0%, #06080f 45%, #110820 100%)" }}>
        {/* Ambient location color bleed */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 45% at 30% 0%, ${ambC1}22 0%, transparent 70%), radial-gradient(ellipse 65% 38% at 75% 0%, ${ambC2}1a 0%, transparent 65%)`, transition: "background 1.5s ease", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "-10%", left: "50%", width: "80%", height: "60%", background: "radial-gradient(ellipse, rgba(91,196,232,0.10) 0%, transparent 65%)", animation: "nebulaDrift 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "5%", right: "5%", width: "50%", height: "50%", background: "radial-gradient(ellipse, rgba(110,60,220,0.09) 0%, transparent 70%)", animation: "nebulaDrift 24s ease-in-out infinite reverse" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(91,196,232,0.055) 1px, transparent 1px)", backgroundSize: "28px 28px", animation: "gridDrift 80s linear infinite" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)" }} />
      </div>

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>

        {/* ── PERSISTENT TOP HEADER ── */}
        <div style={{ height: 44, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(91,196,232,0.1)", background: "rgba(5,12,25,0.92)", backdropFilter: "blur(12px)", flexShrink: 0, position: "sticky", top: 0, zIndex: 100 }}>
          <div />
          <span className="font-display" onClick={() => { setTab("ort"); setScreen(null); setScreenData(null); }} style={{ fontSize: 18, letterSpacing: 5, color: "#5bc4e8", textShadow: "0 0 20px rgba(91,196,232,0.5)", position: "absolute", left: "50%", transform: "translateX(-50%)", cursor: "pointer", userSelect: "none" }}>VOID FRONTIER</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'Barlow Condensed',sans-serif" }}>
              <span style={{ fontSize: 11, color: "#f1c40f", letterSpacing: 0.5 }}>{fmt(credits)} CR</span>
            </div>
            <button onClick={() => saveGame().then(() => addToast("Gespeichert!", "💾", "#5ec26a"))} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", borderRadius: 2, padding: "4px 8px", fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", cursor: "pointer", letterSpacing: 1 }}>💾</button>
            <button onClick={() => { saveGame(); supabase.auth.signOut(); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", borderRadius: 2, padding: "4px 8px", fontSize: 9, fontFamily: "'Barlow Condensed',sans-serif", cursor: "pointer", letterSpacing: 1 }}>⏻</button>
          </div>
        </div>

        {/* ── BODY ROW ── */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-start" }}>

        {/* ── SIDEBAR (desktop only) ── */}
        <div className="sidebar-desktop">

          {/* Player profile */}
          <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${rank.color}44, ${rank.color}0d)`, border: `1px solid ${rank.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🧑‍🚀</div>
              <div style={{ minWidth: 0 }}>
                <div className="ty-primary" style={{ lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{username}</div>
                <div className="ty-micro" style={{ color: rank.color, lineHeight: 1.3, opacity: 0.85 }}>{rank.title}</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="sidebar-section-label">Navigate</div>
          <nav>
            {BOTTOM_NAV.map(t => {
              const isActive = activeNavTab === t.id;
              return (
                <button key={t.id}
                  className={`sidebar-nav-btn${isActive ? " is-active" : ""}`}
                  onClick={() => { setNavDir("tab"); setScreen(null); setScreenData(null); setTab(t.id); }}
                >
                  <span style={{ fontSize: 15, width: 18, textAlign: "center", flexShrink: 0, lineHeight: 1 }}>{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </nav>



        </div>

        {/* ── CONTENT COLUMN ── */}
        <div className="content-column" style={{ flex: 1, minWidth: 0 }}>

        {/* ── BREADCRUMB (always visible → no layout jump) ── */}
        <div style={{ height: (tab === "ort" && (!screen || screen.endsWith("Detail"))) || tab === "ship" ? 0 : 34, overflow: "hidden", padding: (tab === "ort" && (!screen || screen.endsWith("Detail"))) || tab === "ship" ? 0 : "0 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(91,196,232,0.08)", background: "rgba(3,8,18,0.72)", flexShrink: 0, position: "sticky", top: 44, zIndex: 99 }}>
          {screen ? (
            <>
              <button
                onClick={() => {
                  setNavDir("back");
                  if (screen === "sectorList" || screen === "base") setScreen(null);
                  else if (screen === "sectorDetail") setScreen("sectorList");
                  else if (screen === "refinery") setScreen(null);
                  else if (screen === "miningDetail" || screen === "refiningDetail" ||
                           screen === "salvagingDetail" || screen === "craftingDetail" ||
                           screen === "buildingDetail") setScreen(null);
                }}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "rgba(91,196,232,0.5)", cursor: "pointer", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, padding: 0, textTransform: "uppercase", transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = "rgba(91,196,232,0.85)"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(91,196,232,0.5)"}
              >
                ← {screen === "sectorDetail" ? "SECTORS" : "SECTOR"}
              </button>
              <span style={{ color: "rgba(91,196,232,0.2)", fontSize: 10, userSelect: "none" }}>/</span>
              <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>
                {
                  screen === "sectorList"      ? "SECTORS"      :
                  screen === "sectorDetail"    ? (screenData?.name || "").toUpperCase() :
                  screen === "base"            ? "BASE"          :
                  screen === "refinery"        ? "REFINERY"      :
                  screen === "miningDetail"    ? "MINING"        :
                  screen === "refiningDetail"  ? "REFINING"      :
                  screen === "salvagingDetail" ? "SALVAGING"     :
                  screen === "craftingDetail"  ? "CRAFTING"      :
                  screen === "buildingDetail"  ? (BUILDINGS.find(b => b.id === screenData)?.name || "BUILDING").toUpperCase() : ""
                }
              </span>
            </>
          ) : (
            <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
              {tab === "ort" ? "SECTOR" : tab === "ship" ? "GALAXY" : tab === "inv" ? "CARGO" : "PROFILE"}
            </span>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex: 1 }}>
        <div key={`${tab}-${screen || "root"}`} className={`content-wrapper ${navDir === "fwd" ? "screen-fwd" : navDir === "back" ? "screen-back" : "screen-tab"}`} style={{ maxWidth: 1200, margin: "0 auto", boxSizing: "border-box" }}>

          {/* ORT screens */}
          {tab === "ort" && screen === "sectorList" && (
            <SectorTab mining={mining} miningXP={miningXP} warpLevel={warpLevel}
              onSelectSector={s => { setScreen("sectorDetail"); setScreenData(s); }} />
          )}
          {tab === "ort" && screen === "sectorDetail" && screenData && (
            <SectorScreen sector={screenData} mining={mining}
              onStartMining={startMining} />
          )}
          {tab === "ort" && screen === "base" && (
            <BaseScreen
              refQueue={refQueue}
              buildingLevels={buildingLevels}
              onOpenBuilding={id => {
                setNavDir("fwd");
                if (id === "refinery") { setScreen("refinery"); return; }
                setScreen("buildingDetail"); setScreenData(id);
              }}
            />
          )}
          {tab === "ort" && screen === "refinery" && (
            <RefineryScreen inventory={inventory} credits={credits} refQueue={refQueue} moduleLevel={moduleLevel}
              onQueue={queueRecipe} onSell={sellAll} />
          )}
          {tab === "ort" && screen === "miningDetail" && (
            <MiningSkillScreen mining={mining} miningXP={miningXP} onStartMining={startMining} onBack={() => { setNavDir("back"); setScreen(null); }} locationName={locName} />
          )}
          {tab === "ort" && screen === "refiningDetail" && (
            <RefiningSkillScreen inventory={inventory} refQueue={refQueue} moduleLevel={moduleLevel}
              refiningXP={refiningXP} onQueue={queueRecipe} onSell={sellAll} onBack={() => { setNavDir("back"); setScreen(null); }} locationName={locName} />
          )}
          {tab === "ort" && screen === "salvagingDetail" && (
            <SalvagingSkillScreen salvaging={salvaging} salvagingXP={salvagingXP} onStartSalvaging={startSalvaging} onBack={() => { setNavDir("back"); setScreen(null); }} locationName={locName} />
          )}
          {tab === "ort" && screen === "craftingDetail" && <CraftingSkillScreen onBack={() => { setNavDir("back"); setScreen(null); }} locationName={locName} />}
          {tab === "ort" && screen === "buildingDetail" && screenData === "lab" && (
            <LabScreen
              buildingLevels={buildingLevels}
              inventory={inventory}
              credits={credits}
              onUpgrade={() => upgradeBuilding("lab")}
              researchedTechs={researchedTechs}
              onResearch={researchTech}
              onBack={() => { setNavDir("back"); setScreen(null); }}
              locationName={locName}
            />
          )}
          {tab === "ort" && screen === "buildingDetail" && screenData === "storage" && (
            <StorageFacilityScreen
              inventory={inventory}
              mining={mining} salvaging={salvaging} refQueue={refQueue}
              onStartMining={startMining} onStartSalvaging={startSalvaging}
              onStopRefining={() => setRefQueue([])}
              onBack={() => { setNavDir("back"); setScreen(null); }}
              locationName={locName}
            />
          )}
          {tab === "ort" && screen === "buildingDetail" && screenData && screenData !== "lab" && screenData !== "storage" && (
            <BuildingDetailScreen
              buildingId={screenData} buildingLevels={buildingLevels}
              inventory={inventory} credits={credits}
              onUpgrade={() => upgradeBuilding(screenData)}
              onBack={() => { setNavDir("back"); setScreen(null); }}
              locationName={locName}
            />
          )}
          {tab === "ort" && !screen && (
            <OrtScreen
              mining={mining} salvaging={salvaging} refQueue={refQueue} buildingLevels={buildingLevels}
              researchedTechs={researchedTechs}
              currentLocation={currentLocation} miningXP={miningXP} salvagingXP={salvagingXP} refiningXP={refiningXP}
              inventory={inventory} credits={credits}
              onUpgrade={upgradeBuilding}
              onStartMining={startMining}
              onStartSalvaging={startSalvaging}
              onStopRefining={() => setRefQueue([])}
              onNavigate={(screenName, data) => { setNavDir("fwd"); setScreen(screenName); if (data !== undefined) setScreenData(data); }}
            />
          )}

          {/* SHIP screen */}
          {tab === "ship" && (
            <ShipScreen
              warpLevel={warpLevel} currentLocation={currentLocation}
              travelling={travelling} onTravel={startTravel}
            />
          )}

          {/* CARGO (inventory) screen */}
          {tab === "inv" && (
            <InventoryScreen inventory={inventory} />
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
        </div>

        </div>{/* end content column */}
        </div>{/* end body row */}

        {/* ── STICKY FOOTER: activity bar + bottom nav ── */}
        <div style={{ position: "sticky", bottom: 0, zIndex: 100 }}>

        {/* ── PERSISTENT BOTTOM NAV (mobile only) ── */}
        <div className="bottom-nav-mobile" style={{ background: "rgba(4,8,18,0.97)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(91,196,232,0.12)", flexShrink: 0 }}>
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

        </div>{/* end sticky footer */}

      </div>


    </>
  );
}