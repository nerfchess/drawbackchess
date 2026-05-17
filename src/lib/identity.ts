// Lightweight per-browser identity. We don't run a full auth system yet —
// this is enough to give each player a stable id (for lobby presence and
// challenge routing) and a chosen display name. Real auth can be layered
// on later by replacing what `getIdentity` returns.

const ID_KEY = "dc:identity:id";
const NAME_KEY = "dc:identity:name";

export interface Identity {
  id: string;
  name: string;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "u_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function randomName(): string {
  const adj = [
    "Cursed", "Hidden", "Silent", "Veiled", "Crimson", "Gilded", "Cryptic",
    "Frostbitten", "Restless", "Forgotten", "Phantom", "Echoing", "Shadow",
    "Velvet", "Ironclad", "Twilight",
  ];
  const noun = [
    "Bishop", "Rook", "Knight", "Pawn", "Wraith", "Reliquary", "Codex",
    "Crucible", "Sigil", "Augur", "Heretic", "Lantern", "Oracle", "Scribe",
    "Wanderer", "Veil",
  ];
  return adj[Math.floor(Math.random() * adj.length)] + " " + noun[Math.floor(Math.random() * noun.length)];
}

export function getIdentity(): Identity {
  if (typeof window === "undefined") return { id: "ssr", name: "Anonymous" };
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(ID_KEY, id);
  }
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    name = randomName();
    localStorage.setItem(NAME_KEY, name);
  }
  return { id, name };
}

export function setDisplayName(name: string): Identity {
  const clean = name.trim().slice(0, 24) || randomName();
  const id = getIdentity().id;
  if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, clean);
  return { id, name: clean };
}
