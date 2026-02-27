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
};

// Activity types (extensible)
const ACTIVITY_TYPES = [
  {
    id: "mining",
    name: "Asteroid Mining",
    icon: "⛏️",
    color: "#e8a838",
    location: "Kepler System",
    tagline: "Extract raw materials from drifting asteroid fields across multiple sectors.",
    available: true,
  },
  {
    id: "combat",
    name: "Pirate Hunting",
    icon: "⚔️",
    color: "#e05252",
    location: "Frontier Zone",
    tagline: "Hunt down wanted pirates and collect bounties from the Stellar Authority.",
    available: false,
  },
  {
    id: "scanning",
    name: "Deep Space Recon",
    icon: "🔭",
    color: "#3fa7d6",
    location: "Uncharted Space",
    tagline: "Chart unknown regions of the void and sell navigation data to cartographers.",
    available: false,
  },
];

// Sectors (for mining)
const SECTORS = [
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

// Refinery recipes
const RECIPES = [
  { id: "ref_silicate",   time: 8,  sellPrice: 18,  reqModule: 0, inputs: { silicate: 4 } },
  { id: "ferrite_plate",  time: 14, sellPrice: 35,  reqModule: 0, inputs: { ferrite: 3 } },
  { id: "cryon_cell",     time: 24, sellPrice: 95,  reqModule: 1, inputs: { cryon: 3, ferrite_plate: 1 } },
  { id: "void_crystal",   time: 40, sellPrice: 280, reqModule: 2, inputs: { voidstone: 2, cryon_cell: 1 } },
  { id: "neutrite_core",  time: 60, sellPrice: 800, reqModule: 2, inputs: { neutrite: 2, void_crystal: 1 } },
];

// Buildings (extensible)
const BUILDINGS = [
  {
    id: "refinery", name: "Refinery",       icon: "⚗️",  color: "#5ec26a",
    desc: "Refine raw materials into tradeable commodities.",
    available: true,
  },
  {
    id: "market",   name: "Black Market",   icon: "🖤",  color: "#9b59b6",
    desc: "Trade rare goods with criminal factions. High risk, higher reward.",
    available: false,
  },
  {
    id: "lab",      name: "Research Lab",   icon: "🔬",  color: "#3fa7d6",
    desc: "Research lost technologies from ancient civilizations.",
    available: false,
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
const STARS = Array.from({ length: 100 }, () => ({ x: Math.random()*100, y: Math.random()*100, s: Math.random()*2+0.3, o: Math.random()*0.45+0.08, d: Math.random()*6+2 }));
const fmt = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(Math.floor(n));

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Barlow+Condensed:wght@400;500;600;700&display=swap');
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #07090f; color: #c8d4e0; font-family: 'Barlow', sans-serif; min-height: 100%; }
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }

/* Keyframes */
@keyframes twinkle { 0%,100% { opacity: 0.08; } 50% { opacity: 0.7; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
@keyframes pulseGlow { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes toastSlide { from { opacity: 0; transform: translateY(-14px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes breathe { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
@keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }

/* Fonts */
.font-display { font-family: 'Cinzel', serif; }
.font-ui      { font-family: 'Barlow Condensed', sans-serif; }
.font-body    { font-family: 'Barlow', sans-serif; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function RarityBadge({ rarity }) {
  const r = RARITY[rarity];
  return (
    <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1.5, color: r.color, background: r.color + "18", border: `1px solid ${r.color}30`, borderRadius: 3, padding: "1px 7px", textTransform: "uppercase" }}>
      {r.label}
    </span>
  );
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
    <div style={{ height, background: "rgba(255,255,255,0.05)", borderRadius: height, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(value * 100, 100)}%`, background: glow ? `linear-gradient(90deg, ${color}66, ${color})` : color, borderRadius: height, transition: "width 0.12s linear", boxShadow: glow ? `0 0 10px ${color}66` : "none" }} />
    </div>
  );
}

function Divider({ color = "rgba(255,255,255,0.06)" }) {
  return <div style={{ height: 1, background: color, margin: "0" }} />;
}

function SectionLabel({ children }) {
  return (
    <div style={{ padding: "14px 18px 8px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
      <span style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 3, color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap" }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

function BackButton({ onBack, label }) {
  return (
    <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1.5, cursor: "pointer", padding: "14px 18px 0", transition: "color 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>‹</span> {label}
    </button>
  );
}

function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none", width: "90%", maxWidth: 340 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: "rgba(7,9,15,0.98)", backdropFilter: "blur(24px)", border: `1px solid ${t.color}33`, borderLeft: `3px solid ${t.color}`, padding: "10px 16px", borderRadius: 6, fontSize: 13, animation: "toastSlide 0.25s ease", display: "flex", alignItems: "center", gap: 12, boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03)` }}>
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
    <div style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${rar.color}28`, borderTop: `2px solid ${rar.color}55`, borderRadius: 8, padding: "14px", animation: "fadeIn 0.2s ease", transition: "border-color 0.2s" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: rar.color + "15", border: `1px solid ${rar.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: rar.glow ? `0 0 16px ${rar.color}30` : "none" }}>
          {item.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, color: "#fff" }}>{item.name}</span>
            <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", color: rar.color, flexShrink: 0 }}>{quantity}</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <RarityBadge rarity={item.rarity} />
            <Tag color="rgba(255,255,255,0.25)">{item.category === "raw" ? "Raw Material" : "Refined Good"}</Tag>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic", lineHeight: 1.5 }}>{item.flavor}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY SCREENS
// ─────────────────────────────────────────────────────────────────────────────

function ActivitiesScreen({ mining, onOpen }) {
  return (
    <div style={{ flex: 1, padding: "0 16px 32px" }}>
      <SectionLabel>AVAILABLE ACTIVITIES</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ACTIVITY_TYPES.map((act, i) => {
          const isRunning = act.id === "mining" && !!mining;
          return (
            <div key={act.id}
              onClick={() => act.available && onOpen(act.id)}
              style={{ background: isRunning ? `linear-gradient(135deg, rgba(14,18,28,0.98) 0%, ${act.color}0c 100%)` : "rgba(255,255,255,0.025)", border: `1px solid ${isRunning ? act.color + "44" : act.available ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`, borderRadius: 10, padding: "18px", cursor: act.available ? "pointer" : "default", opacity: act.available ? 1 : 0.35, transition: "all 0.2s", animation: `slideUp ${0.1 + i * 0.06}s ease`, boxShadow: isRunning ? `0 0 28px ${act.color}14` : "none" }}
              onMouseEnter={e => { if (act.available) { e.currentTarget.style.borderColor = act.color + "55"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isRunning ? act.color + "44" : act.available ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 50, height: 50, borderRadius: 10, background: `${act.color}15`, border: `1px solid ${act.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, position: "relative" }}>
                  {act.icon}
                  {isRunning && <div style={{ position: "absolute", top: -4, right: -4, width: 12, height: 12, borderRadius: "50%", background: act.color, border: "2px solid #07090f", animation: "pulseGlow 1.4s infinite" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, color: "#fff" }}>{act.name}</span>
                    {!act.available && <Tag color="rgba(255,255,255,0.2)">LOCKED</Tag>}
                    {isRunning && <Tag color={act.color}>ACTIVE</Tag>}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: act.color, letterSpacing: 1, marginBottom: 6 }}>📍 {act.location}</div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>{act.tagline}</p>
                </div>
                {act.available && <span style={{ color: isRunning ? act.color : "rgba(255,255,255,0.15)", fontSize: 22, alignSelf: "center" }}>›</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiningScreen({ mining, warpLevel, miningXP, maxCargo, cargo, onSelectSector, onBack }) {
  const level = getLevel(miningXP);
  const cargoFull = cargo >= maxCargo;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease" }}>
      <BackButton onBack={onBack} label="ACTIVITIES" />

      {/* Skill header */}
      <div style={{ padding: "12px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg, rgba(232,168,56,0.06) 0%, transparent 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: "rgba(232,168,56,0.14)", border: "1px solid rgba(232,168,56,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⛏️</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, marginBottom: 3 }}>Asteroid Mining</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Tag color="#e8a838">Level {level}</Tag>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>{xpToNext(miningXP)} XP to next level</span>
            </div>
          </div>
        </div>
        <Bar value={getLvlProg(miningXP)} color="#e8a838" height={5} glow />
      </div>

      {cargoFull && (
        <div style={{ margin: "12px 18px 0", padding: "10px 14px", background: "rgba(232,168,56,0.07)", border: "1px solid rgba(232,168,56,0.28)", borderRadius: 8, fontSize: 13, color: "#e8a838", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5 }}>
          ⚠️ Cargo hold full — return to base to unload
        </div>
      )}

      <SectionLabel>SELECT SECTOR</SectionLabel>
      <div style={{ flex: 1, padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {SECTORS.map((sector, i) => {
          const locked = sector.reqWarp > warpLevel;
          const isActive = mining?.sectorId === sector.id;
          const activeMat = isActive ? sector.materials.find(m => m.id === mining.matId) : null;
          const activeItem = activeMat ? ITEMS[activeMat.id] : null;
          return (
            <div key={sector.id}
              onClick={() => !locked && !cargoFull && onSelectSector(sector)}
              style={{ background: isActive ? `linear-gradient(135deg, rgba(14,18,28,0.98), ${sector.color}0c)` : "rgba(255,255,255,0.025)", border: `1px solid ${isActive ? sector.color + "44" : locked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "16px", cursor: locked || cargoFull ? "not-allowed" : "pointer", opacity: locked ? 0.38 : cargoFull && !isActive ? 0.5 : 1, transition: "all 0.2s", animation: `slideUp ${0.1 + i * 0.06}s ease`, boxShadow: isActive ? `0 0 20px ${sector.color}14` : "none" }}
              onMouseEnter={e => { if (!locked && !cargoFull) { e.currentTarget.style.borderColor = sector.color + "55"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isActive ? sector.color + "44" : locked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 10, background: `${sector.color}15`, border: `1px solid ${sector.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, position: "relative", flexShrink: 0 }}>
                  {locked ? "🔒" : sector.icon}
                  {isActive && <div style={{ position: "absolute", top: -4, right: -4, width: 10, height: 10, borderRadius: "50%", background: sector.color, border: "2px solid #07090f", animation: "pulseGlow 1.4s infinite" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, color: "#fff" }}>{sector.name}</span>
                    <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1.5, color: isActive ? "#07090f" : sector.color, background: isActive ? sector.color : "transparent", border: `1px solid ${sector.color}`, padding: "3px 10px", borderRadius: 4 }}>
                      {locked ? `WARP ${sector.reqWarp}` : isActive ? "ACTIVE" : "ENTER"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, marginBottom: 6 }}>📍 {sector.region}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: isActive ? 12 : 0 }}>
                    {sector.materials.map(m => { const it = ITEMS[m.id]; const r = RARITY[it?.rarity || "common"]; return <Tag key={m.id} color={r.color}>{it?.icon} {it?.name}</Tag>; })}
                  </div>
                  {isActive && activeItem && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: 0.5, marginBottom: 6 }}>
                        <span>{activeItem.icon} {activeItem.name}</span>
                        <span>✓ {mining.completions || 0} completed</span>
                      </div>
                      <Bar value={mining.progress || 0} color={sector.color} height={4} glow />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectorScreen({ sector, mining, cargo, maxCargo, onStartMining, onBack }) {
  const cargoFull = cargo >= maxCargo;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease" }}>
      <BackButton onBack={onBack} label="ASTEROID MINING" />
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
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", cursor: cargoFull ? "not-allowed" : "pointer", background: isActive ? `${sector.color}0d` : "transparent", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s", position: "relative", overflow: "hidden", animation: `slideUp ${0.1 + i * 0.08}s ease`, opacity: cargoFull && !isActive ? 0.4 : 1 }}
            onMouseEnter={e => { if (!cargoFull) e.currentTarget.style.background = isActive ? `${sector.color}16` : "rgba(255,255,255,0.025)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = isActive ? `${sector.color}0d` : "transparent"; }}
          >
            {isActive && <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(mining.progress || 0) * 100}%`, background: `${sector.color}09`, pointerEvents: "none", transition: "width 0.12s linear" }} />}
            <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 10, background: rar.color + "15", border: `1px solid ${isActive ? rar.color + "55" : rar.color + "28"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, position: "relative", boxShadow: rar.glow && isActive ? `0 0 16px ${rar.color}33` : "none" }}>
              {item?.icon}
              {isActive && <div style={{ position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: "50%", background: sector.color, border: "2px solid #07090f", animation: "pulseGlow 1.2s infinite" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.3, color: "#fff" }}>{item?.name}</span>
                <RarityBadge rarity={item?.rarity} />
                {isActive && <Tag color={sector.color}>MINING</Tag>}
                {matRef.amount > 1 && <Tag color={rar.color}>×{matRef.amount} per run</Tag>}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", fontStyle: "italic", lineHeight: 1.4, marginBottom: 8 }}>{item?.flavor}</p>
              <div style={{ display: "flex", gap: 6 }}>
                <Tag color="rgba(255,255,255,0.25)">⏱ {matRef.time}s</Tag>
                {isActive && mining.completions > 0 && <Tag color="rgba(255,255,255,0.25)">✓ {mining.completions} runs</Tag>}
              </div>
              {isActive && <div style={{ marginTop: 8 }}><Bar value={mining.progress || 0} color={sector.color} height={3} glow /></div>}
            </div>
            <span style={{ color: isActive ? sector.color : "rgba(255,255,255,0.12)", fontSize: 22, flexShrink: 0 }}>›</span>
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
  const activeItem = activeRecipe ? ITEMS[activeRecipe.id] : null;
  return (
    <div style={{ flex: 1, padding: "0 16px 32px" }}>
      <SectionLabel>HOMEBASE FACILITIES</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {BUILDINGS.map((b, i) => {
          const isActive = b.id === "refinery" && refQueue.length > 0;
          return (
            <div key={b.id}
              onClick={() => b.available && onOpenBuilding(b.id)}
              style={{ background: isActive ? `linear-gradient(135deg, rgba(14,18,28,0.98), ${b.color}0c)` : "rgba(255,255,255,0.025)", border: `1px solid ${isActive ? b.color + "44" : b.available ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`, borderRadius: 10, padding: "18px", cursor: b.available ? "pointer" : "default", opacity: b.available ? 1 : 0.35, transition: "all 0.2s", animation: `slideUp ${0.1 + i * 0.07}s ease`, boxShadow: isActive ? `0 0 24px ${b.color}12` : "none" }}
              onMouseEnter={e => { if (b.available) { e.currentTarget.style.borderColor = b.color + "55"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = isActive ? b.color + "44" : b.available ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 50, height: 50, borderRadius: 10, background: `${b.color}15`, border: `1px solid ${b.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, position: "relative" }}>
                  {b.icon}
                  {isActive && <div style={{ position: "absolute", top: -4, right: -4, width: 12, height: 12, borderRadius: "50%", background: b.color, border: "2px solid #07090f", animation: "pulseGlow 1.4s infinite" }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 17, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, color: "#fff" }}>{b.name}</span>
                    {!b.available && <Tag color="rgba(255,255,255,0.2)">LOCKED</Tag>}
                    {isActive && <Tag color={b.color}>PROCESSING</Tag>}
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: isActive ? 12 : 0 }}>{b.desc}</p>
                  {isActive && activeItem && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: 0.5, marginBottom: 6 }}>
                        <span>{activeItem.icon} {activeItem.name}</span>
                        <span>Queue: {refQueue.length}</span>
                      </div>
                      <Bar value={refQueue[0]?.progress || 0} color={b.color} height={3} glow />
                    </>
                  )}
                </div>
                {b.available && <span style={{ color: isActive ? b.color : "rgba(255,255,255,0.12)", fontSize: 22, alignSelf: "center" }}>›</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RefineryScreen({ inventory, credits, refQueue, moduleLevel, onQueue, onSell, onBack }) {
  const activeRecipe = refQueue.length > 0 ? RECIPES.find(r => r.id === refQueue[0]?.recipeId) : null;
  const activeItem = activeRecipe ? ITEMS[activeRecipe.id] : null;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", animation: "slideIn 0.2s ease" }}>
      <BackButton onBack={onBack} label="BASE" />
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
      {RECIPES.map((recipe, i) => {
        const locked = recipe.reqModule > moduleLevel;
        const item = ITEMS[recipe.id];
        const rar = RARITY[item?.rarity || "common"];
        const hasInputs = Object.entries(recipe.inputs).every(([k, v]) => (inventory[k] || 0) >= v);
        const qty = inventory[recipe.id] || 0;
        return (
          <div key={recipe.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "16px 18px", opacity: locked ? 0.28 : 1, animation: `slideUp ${0.1 + i * 0.05}s ease` }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 50, height: 50, flexShrink: 0, borderRadius: 10, background: locked ? "rgba(255,255,255,0.04)" : rar.color + "15", border: `1px solid ${locked ? "rgba(255,255,255,0.06)" : rar.color + "33"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                {locked ? "🔒" : item?.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.3, color: "#fff" }}>{item?.name}</span>
                  {!locked && <RarityBadge rarity={item?.rarity} />}
                  {qty > 0 && <Tag color={rar.color}>In stock: {qty}</Tag>}
                  {locked && <Tag color="#666">Module {recipe.reqModule} required</Tag>}
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic", lineHeight: 1.4, marginBottom: 10 }}>{item?.flavor}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {Object.entries(recipe.inputs).map(([k, v]) => {
                    const it = ITEMS[k]; const have = inventory[k] || 0; const ok = have >= v;
                    return <Tag key={k} color={ok ? "rgba(255,255,255,0.4)" : "#e05252"}>{it?.icon} {v}× {it?.name} ({have})</Tag>;
                  })}
                  <Tag color="rgba(255,255,255,0.2)">⏱ {recipe.time}s</Tag>
                  <Tag color="#f1c40f">💰 {recipe.sellPrice} CR each</Tag>
                </div>
                {!locked && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => onQueue(recipe.id)} disabled={!hasInputs} style={{ padding: "7px 16px", background: hasInputs ? "rgba(94,194,106,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${hasInputs ? "rgba(94,194,106,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: hasInputs ? "#5ec26a" : "rgba(255,255,255,0.18)", fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, cursor: hasInputs ? "pointer" : "not-allowed", transition: "all 0.15s" }}>
                      + REFINE
                    </button>
                    {qty > 0 && (
                      <button onClick={() => onSell(recipe.id)} style={{ padding: "7px 16px", background: "rgba(241,196,15,0.08)", border: "1px solid rgba(241,196,15,0.28)", borderRadius: 6, color: "#f1c40f", fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, cursor: "pointer" }}>
                        SELL ALL (+{qty * recipe.sellPrice} CR)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function InventoryScreen({ inventory }) {
  const entries = Object.entries(inventory).filter(([, v]) => v > 0).sort((a, b) => {
    const rarOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    return (rarOrder[ITEMS[a[0]]?.rarity] ?? 9) - (rarOrder[ITEMS[b[0]]?.rarity] ?? 9);
  });
  const raw = entries.filter(([k]) => ITEMS[k]?.category === "raw");
  const refined = entries.filter(([k]) => ITEMS[k]?.category === "refined");

  if (entries.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", color: "rgba(255,255,255,0.15)" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🎒</div>
        <div style={{ fontSize: 18, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, marginBottom: 8 }}>Inventory Empty</div>
        <p style={{ fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>Start an activity to collect materials.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: "0 16px 32px" }}>
      {raw.length > 0 && (
        <>
          <SectionLabel>RAW MATERIALS</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {raw.map(([k, v]) => <ItemCard key={k} itemId={k} quantity={v} />)}
          </div>
        </>
      )}
      {refined.length > 0 && (
        <>
          <SectionLabel>REFINED GOODS</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {refined.map(([k, v]) => <ItemCard key={k} itemId={k} quantity={v} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIP SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function ShipScreen({ credits, inventory, installed, onBuy }) {
  const canAfford = (upg) => {
    if (credits < (upg.cost.credits || 0)) return false;
    for (const [k, v] of Object.entries(upg.cost)) { if (k !== "credits" && (inventory[k] || 0) < v) return false; }
    return true;
  };
  const groups = [
    { cat: "cargo",  label: "CARGO BAY UPGRADES" },
    { cat: "warp",   label: "WARP DRIVE UPGRADES" },
    { cat: "module", label: "REFINERY MODULES" },
  ];
  return (
    <div style={{ flex: 1, padding: "0 0 32px" }}>
      {groups.map(group => (
        <div key={group.cat}>
          <SectionLabel>{group.label}</SectionLabel>
          {SHIP_UPGRADES.filter(u => u.cat === group.cat).map((upg, i) => {
            const done = installed[upg.id];
            const reqMet = Object.keys(upg.req).every(k => installed[k]);
            const affordable = canAfford(upg);
            return (
              <div key={upg.id} style={{ display: "flex", gap: 14, padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: !reqMet && !done ? 0.3 : 1, animation: `slideUp ${0.1 + i * 0.06}s ease` }}>
                <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 10, background: done ? "rgba(94,194,106,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${done ? "rgba(94,194,106,0.35)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {done ? "✓" : upg.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.3, color: done ? "#5ec26a" : "#fff" }}>{upg.name}</span>
                    {done && <Tag color="#5ec26a">INSTALLED</Tag>}
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginBottom: 10 }}>{upg.desc}</p>
                  {!done && reqMet && (
                    <>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                        {Object.entries(upg.cost).map(([k, v]) => {
                          const have = k === "credits" ? credits : (inventory[k] || 0);
                          const it = ITEMS[k];
                          return <Tag key={k} color={have >= v ? "rgba(255,255,255,0.35)" : "#e05252"}>{k === "credits" ? "💰" : it?.icon} {v} {k === "credits" ? "Credits" : it?.name}</Tag>;
                        })}
                      </div>
                      <button onClick={() => onBuy(upg)} style={{ padding: "7px 20px", background: affordable ? "rgba(94,194,106,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${affordable ? "rgba(94,194,106,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: 6, color: affordable ? "#5ec26a" : "rgba(255,255,255,0.18)", fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, cursor: affordable ? "pointer" : "not-allowed" }}>
                        {affordable ? "INSTALL" : "INSUFFICIENT RESOURCES"}
                      </button>
                    </>
                  )}
                  {!done && !reqMet && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>Previous upgrade required</div>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", zIndex: 1 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 5, color: "rgba(255,255,255,0.18)", marginBottom: 6 }}>◆ STELLAR COMMAND ◆</div>
        <h1 className="font-display" style={{ fontSize: 36, fontWeight: 700, letterSpacing: 4, color: "#5bc4e8", textShadow: "0 0 48px rgba(91,196,232,0.3)" }}>VOID FRONTIER</h1>
      </div>
      <div style={{ width: "100%", maxWidth: 360, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "32px 28px" }}>
        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", marginBottom: 10 }}>Check your email</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>We sent a login link to <strong style={{ color: "#fff" }}>{email}</strong>. Click it to enter the game.</p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5, marginBottom: 6 }}>Enter the Void</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 24 }}>No password needed. Enter your email and we'll send you a magic login link.</p>
            <input type="email" placeholder="your@email.com" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, fontFamily: "'Barlow',sans-serif", marginBottom: 14, outline: "none" }}
            />
            <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "12px", background: "rgba(91,196,232,0.12)", border: "1px solid rgba(91,196,232,0.35)", borderRadius: 8, color: "#5bc4e8", fontSize: 13, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1.5, cursor: "pointer" }}>
              {loading ? "SENDING..." : "SEND LOGIN LINK"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]   = useState(undefined); // undefined = loading
  const [tab, setTab]           = useState("activities");
  const [screen, setScreen]     = useState(null);
  const [screenData, setScreenData] = useState(null);

  const [inventory, setInventory] = useState({});
  const [credits, setCredits]     = useState(0);
  const [miningXP, setMiningXP]   = useState(0);
  const [cargo, setCargo]         = useState(0);
  const [installed, setInstalled] = useState({});
  const [mining, setMining]       = useState(null);
  const [refQueue, setRefQueue]   = useState([]);
  const [actLog, setActLog]       = useState([]);
  const [toasts, setToasts]       = useState([]);

  const timerRef    = useRef(null);
  const refTimerRef = useRef(null);
  const toastId     = useRef(0);
  const saveTimer   = useRef(null);

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
      if (s.inventory) setInventory(s.inventory);
      if (s.credits)   setCredits(s.credits);
      if (s.miningXP)  setMiningXP(s.miningXP);
      if (s.cargo)     setCargo(s.cargo);
      if (s.installed) setInstalled(s.installed);
    }
  };

  // ── SAVE GAME (auto every 30s) ─────────────────────────────────────────
  const saveGame = useCallback(async () => {
    if (!session?.user) return;
    await supabase.from("game_saves").upsert({
      user_id: session.user.id,
      save_data: { inventory, credits, miningXP, cargo, installed },
      updated_at: new Date().toISOString()
    });
  }, [session, inventory, credits, miningXP, cargo, installed]);

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
        addLog(`⛏️ ${item?.icon} ${item?.name} +${matRef.amount}`);
        return { ...m, progress: 0, completions: (m.completions || 0) + 1 };
      });
    }, 50);
    return () => clearInterval(timerRef.current);
  }, [mining?.sectorId, mining?.matId, maxCargo]);

  useEffect(() => { if (cargo >= maxCargo && mining) { setMining(null); } }, [cargo, maxCargo]);

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

  const startMining = (sectorId, matId) => {
    if (mining?.sectorId === sectorId && mining?.matId === matId) { setMining(null); addLog("⏹ Mining stopped"); return; }
    setMining({ sectorId, matId, progress: 0, completions: 0 });
    const s = SECTORS.find(s => s.id === sectorId), m = s?.materials.find(m => m.id === matId);
    const item = ITEMS[m?.id];
    addLog(`▶ Mining: ${item?.icon} ${item?.name} in ${s?.name}`);
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

  const activeMat    = mining ? SECTORS.find(s => s.id === mining.sectorId)?.materials.find(m => m.id === mining.matId) : null;
  const activeSector = mining ? SECTORS.find(s => s.id === mining.sectorId) : null;
  const activeItem   = activeMat ? ITEMS[activeMat.id] : null;
  const cargoFull    = cargo >= maxCargo;

  const TABS = [
    { id: "activities", label: "Activities", icon: "🛸" },
    { id: "base",       label: "Base",       icon: "🏭" },
    { id: "inventory",  label: "Inventory",  icon: "🎒" },
    { id: "ship",       label: "Ship",       icon: "🚀" },
  ];

  // Auth gates
  if (session === undefined) return (
    <>
      <style>{CSS}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {STARS.map((s, i) => <div key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, borderRadius: "50%", background: "white", opacity: s.o, animation: `twinkle ${s.d}s ease-in-out infinite` }} />)}
      </div>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 2, fontSize: 12 }}>LOADING...</div>
    </>
  );

  if (!session) return (
    <>
      <style>{CSS}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {STARS.map((s, i) => <div key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, borderRadius: "50%", background: "white", opacity: s.o, animation: `twinkle ${s.d}s ease-in-out infinite` }} />)}
      </div>
      <LoginScreen />
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <Toast toasts={toasts} />

      {/* Stars */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {STARS.map((s, i) => (
          <div key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, borderRadius: "50%", background: "white", opacity: s.o, animation: `twinkle ${s.d}s ease-in-out infinite`, animationDelay: `${(i * 0.11) % 5}s` }} />
        ))}
      </div>

      <div style={{ minHeight: "100vh", maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>

        {/* ── HEADER ── */}
        {!screen && (
          <div style={{ padding: "24px 18px 0" }}>
            {/* Game title */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 5, color: "rgba(255,255,255,0.18)", marginBottom: 6 }}>◆ STELLAR COMMAND ◆</div>
              <h1 className="font-display" style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4, color: "#5bc4e8", textShadow: "0 0 48px rgba(91,196,232,0.3)", lineHeight: 1 }}>VOID FRONTIER</h1>
            </div>

            {/* Character card */}
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${rank.color}44, ${rank.color}0d)`, border: `2px solid ${rank.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0, boxShadow: `0 0 20px ${rank.color}33` }}>🧑‍🚀</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span className="font-display" style={{ fontSize: 16, fontWeight: 600, letterSpacing: 1, color: "#fff" }}>Commander Nova</span>
                  <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1.5, color: rank.color }}>{rank.title}</span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", color: "#f1c40f", letterSpacing: 0.5 }}>💰 {fmt(credits)} CR</span>
                  <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)" }} />
                  <span style={{ fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", color: cargoFull ? "#e8a838" : "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>📦 {cargo}/{maxCargo}</span>
                  {mining && (
                    <>
                      <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)" }} />
                      <span style={{ fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", color: "#e8a838", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e8a838", display: "inline-block", animation: "pulseGlow 1.5s infinite" }} />
                        Mining active
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {cargoFull && (
                  <button onClick={() => { setCargo(0); addLog("📦 Cargo manually unloaded"); addToast("Cargo unloaded.", "📦", "#e8a838"); }} style={{ background: "rgba(232,168,56,0.1)", border: "1px solid rgba(232,168,56,0.3)", color: "#e8a838", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", cursor: "pointer", letterSpacing: 1 }}>
                    UNLOAD
                  </button>
                )}
                <button onClick={() => { saveGame(); supabase.auth.signOut(); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontFamily: "'Barlow Condensed',sans-serif", cursor: "pointer", letterSpacing: 1 }}>
                  LOGOUT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TABS ── */}
        {!screen && (
          <div style={{ display: "flex", margin: "12px 18px 0", background: "rgba(255,255,255,0.025)", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 4px 8px", background: tab === t.id ? "rgba(255,255,255,0.07)" : "transparent", border: "none", borderBottom: `2px solid ${tab === t.id ? "#5bc4e8" : "transparent"}`, cursor: "pointer", color: tab === t.id ? "#fff" : "rgba(255,255,255,0.28)", fontSize: 10, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, letterSpacing: 1.5, transition: "all 0.15s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 17 }}>{t.icon}</span>
                {t.label.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* ── SCREENS ── */}
        {screen === "mining" && (
          <MiningScreen mining={mining} warpLevel={warpLevel} miningXP={miningXP} maxCargo={maxCargo} cargo={cargo}
            onSelectSector={s => { setScreen("sector"); setScreenData(s); }}
            onBack={() => { setScreen(null); setTab("activities"); }} />
        )}
        {screen === "sector" && screenData && (
          <SectorScreen sector={screenData} mining={mining} cargo={cargo} maxCargo={maxCargo}
            onStartMining={startMining}
            onBack={() => setScreen("mining")} />
        )}
        {screen === "refinery" && (
          <RefineryScreen inventory={inventory} credits={credits} refQueue={refQueue} moduleLevel={moduleLevel}
            onQueue={queueRecipe} onSell={sellAll}
            onBack={() => { setScreen(null); setTab("base"); }} />
        )}

        {/* ── TAB CONTENT ── */}
        {!screen && tab === "activities" && <ActivitiesScreen mining={mining} onOpen={id => { if (id === "mining") setScreen("mining"); }} />}
        {!screen && tab === "base"       && <BaseScreen refQueue={refQueue} onOpenBuilding={id => { if (id === "refinery") setScreen("refinery"); }} />}
        {!screen && tab === "inventory"  && <InventoryScreen inventory={inventory} />}
        {!screen && tab === "ship"       && <ShipScreen credits={credits} inventory={inventory} installed={installed} onBuy={buyUpgrade} />}

        {/* ── ACTIVITY BAR (persistent bottom bar when mining) ── */}
        {mining && !screen && (
          <div style={{ position: "sticky", bottom: 0, background: "rgba(7,9,15,0.97)", backdropFilter: "blur(20px)", borderTop: `1px solid ${activeSector?.color || "#e8a838"}33`, padding: "10px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${activeSector?.color}15`, border: `1px solid ${activeSector?.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
              {activeItem?.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.3 }}>{activeItem?.name}</span>
                <span style={{ fontSize: 11, color: activeSector?.color, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 0.5 }}>{activeSector?.name} · ✓ {mining.completions || 0}</span>
              </div>
              <Bar value={mining.progress || 0} color={activeSector?.color || "#e8a838"} height={4} glow />
            </div>
            <button onClick={() => { setMining(null); addLog("⏹ Mining stopped"); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, cursor: "pointer", flexShrink: 0 }}>
              STOP
            </button>
          </div>
        )}
      </div>
    </>
  );
}