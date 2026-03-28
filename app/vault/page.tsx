"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { decryptData, deriveKey, encryptData } from "@/lib/crypto";
import type { VaultData, VaultEntry } from "@/lib/types";
import { getServiceById } from "@/lib/services";

function sendVaultToExtension(vault: VaultData) {
  if (typeof window === "undefined") return;

  console.log("[Footprint] posting vault to extension", {
    count: vault?.entries?.length ?? 0,
    version: vault?.version,
    time: new Date().toISOString(),
  });

  window.postMessage(
    {
      source: "footprint",
      type: "VAULT_DECRYPTED",
      vault,
    },
    "*"
  );
}

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeString(x: any) {
  return typeof x === "string" ? x : "";
}

function extractDomain(input: string): string | undefined {
  const raw = (input ?? "").trim();
  if (!raw) return undefined;

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw);
  const maybeUrl = hasScheme ? raw : `https://${raw}`;

  try {
    const u = new URL(maybeUrl);
    let host = (u.hostname || "").toLowerCase();
    if (!host) return undefined;
    if (host.startsWith("www.")) host = host.slice(4);
    return host;
  } catch {
    const cleaned = raw.toLowerCase().replace(/^www\./, "");
    const m = cleaned.match(/([a-z0-9-]+\.)+[a-z]{2,}/);
    return m ? m[0] : undefined;
  }
}

function normalizeEntry(e: any): VaultEntry {
  const created = typeof e?.createdAt === "number" ? e.createdAt : Date.now();
  const updated = typeof e?.updatedAt === "number" ? e.updatedAt : created;

  const categoryRaw = normalizeString(e?.category).trim();
  const category = categoryRaw ? categoryRaw : undefined;

  const deletedAt =
    typeof e?.deletedAt === "number" && Number.isFinite(e.deletedAt) ? e.deletedAt : undefined;

  const site = normalizeString(e?.site);
  const domainFromExisting = normalizeString(e?.domain).trim();
  const domain = domainFromExisting || extractDomain(site) || undefined;

  return {
    id: String(e?.id ?? makeId()),
    site,
    username: normalizeString(e?.username),
    password: normalizeString(e?.password),
    notes: typeof e?.notes === "string" ? e.notes : undefined,
    tags: Array.isArray(e?.tags) ? e.tags.map((t: any) => String(t)).filter(Boolean) : [],
    category,
    deletedAt,
    favorite: Boolean(e?.favorite ?? false),
    createdAt: created,
    updatedAt: updated,
    domain,
  };
}

function normalizeVault(decrypted: any): VaultData {
  const entriesRaw = Array.isArray(decrypted?.entries) ? decrypted.entries : [];
  return {
    version: typeof decrypted?.version === "number" ? decrypted.version : 4,
    entries: entriesRaw.map(normalizeEntry),
  };
}

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function tagsToInput(tags?: string[]) {
  return (tags ?? []).join(", ");
}

type SortMode = "newest" | "oldest" | "az" | "za";

function passwordStrength(pw: string): { score: number; label: string } {
  const p = pw ?? "";
  if (!p) return { score: 0, label: "Empty" };

  let score = 0;
  const len = p.length;
  const hasLower = /[a-z]/.test(p);
  const hasUpper = /[A-Z]/.test(p);
  const hasNum = /\d/.test(p);
  const hasSym = /[^a-zA-Z0-9]/.test(p);

  if (len >= 8) score++;
  if (len >= 12) score++;
  if (hasLower && hasUpper) score++;
  if (hasNum) score++;
  if (hasSym) score++;

  score = Math.min(4, score);

  const label =
    score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";

  return { score, label };
}

function maskPassword(pw: string) {
  const n = Math.min(Math.max(pw?.length ?? 0, 8), 18);
  return "•".repeat(n);
}

function daysAgo(ts?: number) {
  if (!ts) return "unknown";
  const d = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function randomInt(maxExclusive: number) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % maxExclusive;
}

function generatePassword(opts: {
  length: number;
  lower: boolean;
  upper: boolean;
  numbers: boolean;
  symbols: boolean;
}) {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const nums = "0123456789";
  const syms = "!@#$%^&*()-_=+[]{};:,.?";

  const pools: string[] = [];
  if (opts.lower) pools.push(lower);
  if (opts.upper) pools.push(upper);
  if (opts.numbers) pools.push(nums);
  if (opts.symbols) pools.push(syms);

  if (pools.length === 0) return "";

  const required = pools.map((pool) => pool[randomInt(pool.length)]);
  const all = pools.join("");
  const remainingLen = Math.max(0, opts.length - required.length);
  const rest = Array.from({ length: remainingLen }, () => all[randomInt(all.length)]);

  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function safeFileName() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `footprint_backup_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}.json`;
}

function normKey(site: string, username: string) {
  return `${(site ?? "").trim().toLowerCase()}|${(username ?? "").trim().toLowerCase()}`;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const row: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cur.trim());
        cur = "";
        continue;
      }

      cur += ch;
    }
    row.push(cur.trim());
    rows.push(row);
  }

  return rows;
}

export default function VaultPage() {
  const { user, isLoaded } = useUser();

  const [masterPassword, setMasterPassword] = useState("");
  const [unlockClicks, setUnlockClicks] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const didLoadAfterUnlockRef = useRef(false);
  const [vault, setVault] = useState<VaultData>({ version: 4, entries: [] });
  const lastSentVaultSigRef = useRef<string>("");

  useEffect(() => {
    if (!unlocked || !user?.id) {
      lastSentVaultSigRef.current = "";
    }
  }, [unlocked, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (!unlocked) {
      didLoadAfterUnlockRef.current = false;
      return;
    }
    if (!key) return;
    if (didLoadAfterUnlockRef.current) return;
    didLoadAfterUnlockRef.current = true;

    (async () => {
      try {
        setStatus("Loading vault…");
        await loadVault(key);
        setStatus("Vault ready ✅");
      } catch (e: any) {
        setStatus(`Load failed: ${e?.message ?? String(e)}`);
      }
    })();
  }, [user?.id, unlocked, key]);

  useEffect(() => {
    if (!user?.id) return;
    if (!unlocked) return;

    const sig = JSON.stringify({
      version: vault?.version ?? null,
      count: vault?.entries?.length ?? 0,
    });

    if (lastSentVaultSigRef.current === sig) return;
    lastSentVaultSigRef.current = sig;

    sendVaultToExtension(vault);
  }, [user?.id, unlocked, vault]);

  const [status, setStatus] = useState("");

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [tagFilter, setTagFilter] = useState("__all__");
  const [categoryFilter, setCategoryFilter] = useState("__all__");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [showReusedOnly, setShowReusedOnly] = useState(false);
  const [showWeakOnly, setShowWeakOnly] = useState(false);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  const [view, setView] = useState<"active" | "trash">("active");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [site, setSite] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);

  const [revealMap, setRevealMap] = useState<Record<string, boolean>>({});
  const revealTimersRef = useRef<Record<string, number>>({});

  const [copyCountdown, setCopyCountdown] = useState<Record<string, number>>({});
  const countdownTimersRef = useRef<Record<string, number>>({});

  const [genLength, setGenLength] = useState(16);
  const [genLower, setGenLower] = useState(true);
  const [genUpper, setGenUpper] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genValue, setGenValue] = useState("");

  const [showReusedGroups, setShowReusedGroups] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addEntryRef = useRef<HTMLDivElement | null>(null);
  const pendingServiceNameRef = useRef<string | null>(null);
  const [importError, setImportError] = useState<string>("");
  const [importPreview, setImportPreview] = useState<{
    entriesCount: number;
    tagsCount: number;
    categoriesCount: number;
    reusedCount: number;
    weakCount: number;
    dupSiteUserCount: number;
  } | null>(null);
  const [importDecryptedVault, setImportDecryptedVault] = useState<VaultData | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "overwrite">("merge");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkTagsInput, setBulkTagsInput] = useState("");

  const [undoToast, setUndoToast] = useState<{ count: number; active: boolean } | null>(null);
  const lastTrashedRef = useRef<{ ids: string[]; timeoutId: number | null }>({
    ids: [],
    timeoutId: null,
  });

  const [idleLockEnabled, setIdleLockEnabled] = useState(true);
  const [idleMinutes, setIdleMinutes] = useState(5);
  const idleTimerRef = useRef<number | null>(null);

  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<{ rows: number; ok: number; bad: number } | null>(
    null
  );

  useEffect(() => {
    return () => {
      Object.values(countdownTimersRef.current).forEach((id) => window.clearInterval(id));
      countdownTimersRef.current = {};
      Object.values(revealTimersRef.current).forEach((id) => window.clearTimeout(id));
      revealTimersRef.current = {};

      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (lastTrashedRef.current.timeoutId) {
        window.clearTimeout(lastTrashedRef.current.timeoutId);
        lastTrashedRef.current.timeoutId = null;
      }
    };
  }, []);

  // Read ?service= query param once on mount and store the display name for post-unlock pre-fill.
  useEffect(() => {
    const serviceId = new URLSearchParams(window.location.search).get("service");
    if (serviceId) {
      const service = getServiceById(serviceId);
      if (service) pendingServiceNameRef.current = service.name;
    }
  }, []);

  // After the vault is unlocked, pre-fill the Add Entry form with the pending service name.
  useEffect(() => {
    if (!unlocked || !pendingServiceNameRef.current) return;
    setSite(pendingServiceNameRef.current);
    pendingServiceNameRef.current = null;
    setTimeout(() => {
      addEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, [unlocked]);

  const activeEntries = useMemo(() => vault.entries.filter((e) => !e.deletedAt), [vault.entries]);
  const trashEntries = useMemo(() => vault.entries.filter((e) => Boolean(e.deletedAt)), [vault.entries]);

  const dupSiteUserCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of activeEntries) {
      const k = normKey(e.site, e.username);
      if (!k || k === "|") continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [activeEntries]);

  const passwordCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of activeEntries) {
      const pw = e.password ?? "";
      if (!pw) continue;
      m.set(pw, (m.get(pw) ?? 0) + 1);
    }
    return m;
  }, [activeEntries]);

  const reusedEntriesCount = useMemo(() => {
    let count = 0;
    for (const e of activeEntries) {
      const c = passwordCounts.get(e.password ?? "") ?? 0;
      if (c > 1) count++;
    }
    return count;
  }, [activeEntries, passwordCounts]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of activeEntries) for (const t of e.tags ?? []) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeEntries]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const e of activeEntries) {
      const c = (e.category ?? "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeEntries]);

  const reusedGroups = useMemo(() => {
    const groups = new Map<string, VaultEntry[]>();
    for (const e of activeEntries) {
      const pw = e.password ?? "";
      if (!pw) continue;
      const c = passwordCounts.get(pw) ?? 0;
      if (c <= 1) continue;
      const arr = groups.get(pw) ?? [];
      arr.push(e);
      groups.set(pw, arr);
    }
    return Array.from(groups.entries())
      .map(([pw, entries]) => ({ pw, entries }))
      .sort((a, b) => b.entries.length - a.entries.length);
  }, [activeEntries, passwordCounts]);

  const weakCount = useMemo(() => {
    let n = 0;
    for (const e of activeEntries) {
      const s = passwordStrength(e.password ?? "");
      if (s.score <= 1) n++;
    }
    return n;
  }, [activeEntries]);

  const duplicateCount = useMemo(() => {
    let n = 0;
    for (const e of activeEntries) {
      const c = dupSiteUserCounts.get(normKey(e.site, e.username)) ?? 0;
      if (c > 1) n++;
    }
    return n;
  }, [activeEntries, dupSiteUserCounts]);

  const favoritesCount = useMemo(() => activeEntries.filter((e) => e.favorite).length, [activeEntries]);

  function resetImportState() {
    setImportError("");
    setImportPreview(null);
    setImportDecryptedVault(null);
    setImportMode("merge");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkCategory("");
    setBulkTagsInput("");
  }

  async function handleUnlock() {
    try {
      setStatus("");

      if (!isLoaded) {
        return setStatus("Loading your account… try again in a second.");
      }

      if (!user?.id) {
        return setStatus("Not signed in. Refresh and log in again.");
      }

      if (!masterPassword) {
        return setStatus("Enter master password.");
      }

      setStatus("Deriving key…");
      const derived = await deriveKey(masterPassword, user.id);

      setKey(derived);
      setUnlocked(true);
      await loadVault(derived);
      setStatus("Unlocked ✅");
      setGenValue("");
    } catch (e: any) {
      setStatus(`Unlock failed: ${e?.message ?? String(e)}`);
      setUnlocked(false);
      setKey(null);
    }
  }

  function handleLock() {
    setUnlocked(false);
    setKey(null);
    setMasterPassword("");
    setVault({ version: 4, entries: [] });
    setStatus("Locked 🔒");

    setEditingId(null);
    setSite("");
    setUsername("");
    setPassword("");
    setNotes("");
    setTagsInput("");
    setCategoryInput("");

    setSearch("");
    setSortMode("newest");
    setTagFilter("__all__");
    setCategoryFilter("__all__");
    setFavoritesOnly(false);
    setShowReusedOnly(false);
    setShowWeakOnly(false);
    setShowDuplicatesOnly(false);
    setView("active");

    setShowFormPassword(false);
    setRevealMap({});
    setShowReusedGroups(false);
    setExpandedId(null);

    setGenValue("");

    resetImportState();
    clearSelection();

    setUndoToast(null);
    lastTrashedRef.current.ids = [];
    if (lastTrashedRef.current.timeoutId) {
      window.clearTimeout(lastTrashedRef.current.timeoutId);
      lastTrashedRef.current.timeoutId = null;
    }

    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    setCsvText("");
    setCsvPreview(null);
  }

  useEffect(() => {
    if (!unlocked) return;

    const ms = Math.max(1, idleMinutes) * 60_000;

    function clearIdleTimer() {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    }

    function armIdleTimer() {
      clearIdleTimer();
      if (!idleLockEnabled) return;
      idleTimerRef.current = window.setTimeout(() => {
        handleLock();
      }, ms);
    }

    function onActivity() {
      armIdleTimer();
    }

    armIdleTimer();

    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });

    return () => {
      clearIdleTimer();
      window.removeEventListener("mousemove", onActivity as any);
      window.removeEventListener("keydown", onActivity as any);
      window.removeEventListener("click", onActivity as any);
      window.removeEventListener("scroll", onActivity as any);
      window.removeEventListener("touchstart", onActivity as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, idleLockEnabled, idleMinutes]);

  useEffect(() => {
    clearSelection();
    setShowReusedGroups(false);
    setExpandedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function loadVault(keyOverride?: CryptoKey) {
    try {
      setStatus("");
      const k = keyOverride ?? key;
      if (!user?.id || !k) return setStatus("Unlock first.");

      const res = await fetch("/api/vault", { method: "GET" });
      const data = await res.json();

      if (!res.ok) {
        return setStatus(data?.error ? `Load error: ${data.error}` : "Load error.");
      }

      if (!data?.vault) {
        setVault({ version: 4, entries: [] });
        setStatus("Loaded empty vault ✅");
        return;
      }

      const decrypted = await decryptData(k, data.vault);
      const normalizedVault = normalizeVault(decrypted);

      setVault(normalizedVault);
      sendVaultToExtension(normalizedVault);
      setStatus("Loaded + decrypted vault ✅");
    } catch (e: any) {
      setStatus(`Load error: ${e?.message ?? String(e)}`);
    }
  }

  async function saveVault(nextVault: VaultData) {
    try {
      setStatus("");
      if (!user?.id || !key) return setStatus("Unlock first.");

      const normalized: VaultData = {
        version: Math.max(nextVault.version ?? 4, 4),
        entries: nextVault.entries.map(normalizeEntry),
      };

      const encrypted = await encryptData(key, normalized);

      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vault: encrypted }),
      });

      const data = await res.json();
      if (!res.ok) {
        return setStatus(data?.error ? `Save error: ${data.error}` : "Save error.");
      }

      setVault(normalized);
      sendVaultToExtension(normalized);
      setStatus("Saved ✅");
    } catch (e: any) {
      setStatus(`Save error: ${e?.message ?? String(e)}`);
    }
  }

  function startEdit(entry: VaultEntry) {
    setEditingId(entry.id);
    setSite(entry.site);
    setUsername(entry.username);
    setPassword(entry.password);
    setNotes(entry.notes ?? "");
    setTagsInput(tagsToInput(entry.tags));
    setCategoryInput(entry.category ?? "");
    setShowFormPassword(false);
    setStatus("Editing…");
  }

  function cancelEdit() {
    setEditingId(null);
    setSite("");
    setUsername("");
    setPassword("");
    setNotes("");
    setTagsInput("");
    setCategoryInput("");
    setShowFormPassword(false);
    setStatus("");
  }

  const typedDupCount = useMemo(() => {
    const k = normKey(site, username);
    if (!k || k === "|") return 0;

    let count = 0;
    for (const e of activeEntries) {
      if (editingId && e.id === editingId) continue;
      if (normKey(e.site, e.username) === k) count++;
    }
    return count;
  }, [site, username, activeEntries, editingId]);

  const reuseForTypedPassword = useMemo(() => {
    const pw = password ?? "";
    if (!pw) return 0;

    let count = 0;
    for (const e of activeEntries) {
      if (editingId && e.id === editingId) continue;
      if (e.password === pw) count++;
    }
    return count;
  }, [password, activeEntries, editingId]);

  const strengthTyped = useMemo(() => passwordStrength(password), [password]);

  async function addOrUpdateEntry() {
    if (!unlocked || !key) return setStatus("Unlock first.");

    const s = site.trim();
    const u = username.trim();
    const p = password;

    if (!s || !u || !p) return setStatus("Site, Username, and Password are required.");

    const now = Date.now();
    const tags = parseTags(tagsInput);
    const cleanedNotes = notes.trim() ? notes.trim() : undefined;
    const cleanedCategory = categoryInput.trim() ? categoryInput.trim() : undefined;

    const computedDomain = extractDomain(s);

    const next: VaultData = editingId
      ? {
          ...vault,
          entries: vault.entries.map((e) =>
            e.id === editingId
              ? {
                  ...e,
                  site: s,
                  username: u,
                  password: p,
                  notes: cleanedNotes,
                  tags,
                  category: cleanedCategory,
                  updatedAt: now,
                  domain: computedDomain ?? e.domain,
                }
              : e
          ),
        }
      : {
          ...vault,
          entries: [
            {
              id: makeId(),
              site: s,
              username: u,
              password: p,
              notes: cleanedNotes,
              tags,
              category: cleanedCategory,
              favorite: false,
              createdAt: now,
              updatedAt: now,
              domain: computedDomain,
            },
            ...vault.entries,
          ],
        };

    await saveVault(next);
    cancelEdit();
  }

  function showUndoToastFor(ids: string[]) {
    if (lastTrashedRef.current.timeoutId) {
      window.clearTimeout(lastTrashedRef.current.timeoutId);
      lastTrashedRef.current.timeoutId = null;
    }
    lastTrashedRef.current.ids = ids;

    setUndoToast({ count: ids.length, active: true });

    lastTrashedRef.current.timeoutId = window.setTimeout(() => {
      setUndoToast(null);
      lastTrashedRef.current.ids = [];
      lastTrashedRef.current.timeoutId = null;
    }, 10_000);
  }

  async function undoLastTrash() {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const ids = lastTrashedRef.current.ids;
    if (!ids.length) return;

    const now = Date.now();
    const next = {
      ...vault,
      entries: vault.entries.map((e) =>
        ids.includes(e.id) ? { ...e, deletedAt: undefined, updatedAt: now } : e
      ),
    };

    await saveVault(next);
    setUndoToast(null);
    lastTrashedRef.current.ids = [];
    if (lastTrashedRef.current.timeoutId) {
      window.clearTimeout(lastTrashedRef.current.timeoutId);
      lastTrashedRef.current.timeoutId = null;
    }
    setStatus("Undo complete ✅");
  }

  async function moveToTrash(id: string) {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const ok = window.confirm("Move this entry to Trash?");
    if (!ok) return;

    const now = Date.now();
    const next = {
      ...vault,
      entries: vault.entries.map((e) =>
        e.id === id ? { ...e, deletedAt: now, updatedAt: now } : e
      ),
    };

    await saveVault(next);
    showUndoToastFor([id]);
    setStatus("Moved to Trash 🗑️");
  }

  async function restoreFromTrash(id: string) {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const now = Date.now();

    await saveVault({
      ...vault,
      entries: vault.entries.map((e) =>
        e.id === id ? { ...e, deletedAt: undefined, updatedAt: now } : e
      ),
    });

    setStatus("Restored ✅");
  }

  async function emptyTrash() {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const ok = window.confirm("Permanently delete ALL items in Trash? This cannot be undone.");
    if (!ok) return;

    await saveVault({
      ...vault,
      entries: vault.entries.filter((e) => !e.deletedAt),
    });

    setStatus("Trash emptied ✅");
  }

  async function deletePermanentlySelected(ids: string[]) {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const ok = window.confirm("Permanently delete selected items? This cannot be undone.");
    if (!ok) return;

    await saveVault({
      ...vault,
      entries: vault.entries.filter((e) => !ids.includes(e.id)),
    });

    clearSelection();
    setStatus("Deleted permanently ✅");
  }

  async function toggleFavorite(id: string) {
    if (!unlocked || !key) return setStatus("Unlock first.");
    await saveVault({
      ...vault,
      entries: vault.entries.map((e) => (e.id === id ? { ...e, favorite: !e.favorite } : e)),
    });
  }

  function toggleReveal(entryId: string) {
    setRevealMap((prev) => {
      const nextVal = !prev[entryId];

      if (revealTimersRef.current[entryId]) {
        window.clearTimeout(revealTimersRef.current[entryId]);
        delete revealTimersRef.current[entryId];
      }

      if (nextVal) {
        const t = window.setTimeout(() => {
          setRevealMap((p) => ({ ...p, [entryId]: false }));
          delete revealTimersRef.current[entryId];
        }, 10_000);
        revealTimersRef.current[entryId] = t;
      }

      return { ...prev, [entryId]: nextVal };
    });
  }

  async function handleCopy(entryId: string, field: "username" | "password", value: string) {
    try {
      if (!value) return;

      await navigator.clipboard.writeText(value);

      const k = `${entryId}:${field}`;

      if (countdownTimersRef.current[k]) {
        window.clearInterval(countdownTimersRef.current[k]);
        delete countdownTimersRef.current[k];
      }

      setCopyCountdown((prev) => ({ ...prev, [k]: 30 }));

      const intervalId = window.setInterval(() => {
        setCopyCountdown((prev) => {
          const cur = prev[k] ?? 0;
          return { ...prev, [k]: Math.max(0, cur - 1) };
        });
      }, 1000);

      countdownTimersRef.current[k] = intervalId;

      window.setTimeout(async () => {
        try {
          await navigator.clipboard.writeText("");
        } catch {
          // ignore
        } finally {
          if (countdownTimersRef.current[k]) {
            window.clearInterval(countdownTimersRef.current[k]);
            delete countdownTimersRef.current[k];
          }
          setCopyCountdown((prev) => ({ ...prev, [k]: 0 }));
        }
      }, 30_000);

      setStatus(field === "password" ? "Password copied ✅" : "Username copied ✅");
    } catch (e: any) {
      setStatus(`Copy failed: ${e?.message ?? String(e)}`);
    }
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied ✅`);
    } catch (e: any) {
      setStatus(`Copy failed: ${e?.message ?? String(e)}`);
    }
  }

  async function duplicateEntry(entry: VaultEntry) {
    if (!unlocked || !key) return setStatus("Unlock first.");

    const now = Date.now();
    const newEntry: VaultEntry = {
      id: makeId(),
      site: entry.site ? `${entry.site} (copy)` : "copy",
      username: entry.username ?? "",
      password: "",
      notes: entry.notes,
      tags: entry.tags ?? [],
      category: entry.category,
      favorite: false,
      createdAt: now,
      updatedAt: now,
      domain: extractDomain(entry.site) ?? entry.domain,
    };

    const next: VaultData = { ...vault, entries: [newEntry, ...vault.entries] };
    await saveVault(next);

    startEdit(newEntry);
    setStatus("Duplicated — set a new password 🔁");
  }

  function regenerate() {
    const pw = generatePassword({
      length: genLength,
      lower: genLower,
      upper: genUpper,
      numbers: genNumbers,
      symbols: genSymbols,
    });
    setGenValue(pw);
  }

  async function exportEncryptedBackup() {
    try {
      if (!key) return setStatus("Unlock first.");
      const encrypted = await encryptData(key, vault);

      const payload = {
        type: "footprint_backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        vault: encrypted,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = safeFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      setStatus("Encrypted backup downloaded ✅");
    } catch (e: any) {
      setStatus(`Export failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleImportFile(file: File) {
    setImportError("");
    setImportPreview(null);
    setImportDecryptedVault(null);
    setImportMode("merge");

    try {
      if (!key) {
        setImportError("Unlock first.");
        return;
      }

      const text = await file.text();
      const parsed = JSON.parse(text);

      const encrypted = parsed?.type === "footprint_backup" ? parsed?.vault : parsed;

      if (!encrypted || typeof encrypted !== "object" || !encrypted.iv || !encrypted.content) {
        setImportError("Import file format not recognized.");
        return;
      }

      const decrypted = await decryptData(key, encrypted);
      const normalized = normalizeVault(decrypted);

      const entriesCount = normalized.entries.length;

      const tagSet = new Set<string>();
      const catSet = new Set<string>();
      for (const e of normalized.entries) {
        for (const t of e.tags ?? []) tagSet.add(t);
        const c = (e.category ?? "").trim();
        if (c) catSet.add(c);
      }

      const counts = new Map<string, number>();
      for (const e of normalized.entries) {
        if (!e.password) continue;
        counts.set(e.password, (counts.get(e.password) ?? 0) + 1);
      }

      let reusedCount = 0;
      let weakCountLocal = 0;
      for (const e of normalized.entries) {
        const c = counts.get(e.password ?? "") ?? 0;
        if (c > 1) reusedCount++;
        const s = passwordStrength(e.password ?? "");
        if (s.score <= 1) weakCountLocal++;
      }

      const currentKeys = new Set<string>();
      for (const e of activeEntries) currentKeys.add(normKey(e.site, e.username));

      let dupSiteUserCount = 0;
      for (const e of normalized.entries) {
        if (e.deletedAt) continue;
        const k = normKey(e.site, e.username);
        if (k !== "|" && currentKeys.has(k)) dupSiteUserCount++;
      }

      setImportPreview({
        entriesCount,
        tagsCount: tagSet.size,
        categoriesCount: catSet.size,
        reusedCount,
        weakCount: weakCountLocal,
        dupSiteUserCount,
      });

      setImportDecryptedVault(normalized);
      setStatus("Import preview ready ✅");
    } catch (e: any) {
      setImportError(`Import failed: ${e?.message ?? String(e)}`);
    }
  }

  function mergeVaults(current: VaultData, incoming: VaultData): VaultData {
    const now = Date.now();

    const usedIds = new Set(current.entries.map((e) => e.id));
    const currentActiveKeys = new Set(
      current.entries.filter((e) => !e.deletedAt).map((e) => normKey(e.site, e.username))
    );

    const incomingNormalized = incoming.entries.map(normalizeEntry).map((e) => {
      let id = e.id;
      if (usedIds.has(id)) id = makeId();
      usedIds.add(id);

      if (!e.deletedAt) {
        const k = normKey(e.site, e.username);
        if (k !== "|" && currentActiveKeys.has(k)) {
          e = { ...e, site: e.site ? `${e.site} (import)` : "import" };
        }
      }

      const createdAt = typeof e.createdAt === "number" ? e.createdAt : now;
      const updatedAt = typeof e.updatedAt === "number" ? e.updatedAt : createdAt;

      return { ...e, id, createdAt, updatedAt, domain: extractDomain(e.site) ?? e.domain };
    });

    return {
      version: Math.max(current.version ?? 4, incoming.version ?? 4, 4),
      entries: [...incomingNormalized, ...current.entries],
    };
  }

  async function confirmImport() {
    try {
      if (!unlocked || !key) return setStatus("Unlock first.");
      if (!importDecryptedVault) return;

      if (importMode === "overwrite") {
        const ok = window.confirm(
          "Overwrite will replace your current vault with the imported vault. Continue?"
        );
        if (!ok) return;

        await saveVault(importDecryptedVault);
        setStatus("Import complete (overwrite) ✅");
        resetImportState();
        return;
      }

      const ok = window.confirm(
        "Merge will ADD imported entries. Collisions (same site+username) are labeled '(import)'. Continue?"
      );
      if (!ok) return;

      const merged = mergeVaults(vault, importDecryptedVault);
      await saveVault(merged);
      setStatus("Import complete (merge) ✅");
      resetImportState();
    } catch (e: any) {
      setStatus(`Import failed: ${e?.message ?? String(e)}`);
    }
  }

  function isSelected(id: string) {
    return selectedIds.has(id);
  }
  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll(ids: string[]) {
    setSelectedIds(new Set(ids));
  }
  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function bulkTrashSelected() {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const ok = window.confirm(
      `Move ${ids.length} selected entr${ids.length === 1 ? "y" : "ies"} to Trash?`
    );
    if (!ok) return;

    const now = Date.now();
    const next = {
      ...vault,
      entries: vault.entries.map((e) =>
        ids.includes(e.id) ? { ...e, deletedAt: now, updatedAt: now } : e
      ),
    };

    await saveVault(next);
    showUndoToastFor(ids);
    clearSelection();
    setStatus("Moved to Trash 🗑️");
  }

  async function bulkRestoreSelected() {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const now = Date.now();
    const next = {
      ...vault,
      entries: vault.entries.map((e) =>
        ids.includes(e.id) ? { ...e, deletedAt: undefined, updatedAt: now } : e
      ),
    };

    await saveVault(next);
    clearSelection();
    setStatus("Restored ✅");
  }

  async function bulkSetFavorite(value: boolean) {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const next = {
      ...vault,
      entries: vault.entries.map((e) => (ids.includes(e.id) ? { ...e, favorite: value } : e)),
    };

    await saveVault(next);
    clearSelection();
    setStatus(value ? "Favorited ✅" : "Unfavorited ✅");
  }

  async function bulkSetCategory() {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const cat = bulkCategory.trim();
    const category = cat ? cat : undefined;

    const now = Date.now();
    const next = {
      ...vault,
      entries: vault.entries.map((e) =>
        ids.includes(e.id) ? { ...e, category, updatedAt: now } : e
      ),
    };

    await saveVault(next);
    clearSelection();
    setBulkCategory("");
    setStatus("Category updated ✅");
  }

  async function bulkAddTags() {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    const add = parseTags(bulkTagsInput);
    if (add.length === 0) return setStatus("Enter tags to add.");

    const now = Date.now();
    const next = {
      ...vault,
      entries: vault.entries.map((e) => {
        if (!ids.includes(e.id)) return e;
        const existing = new Set((e.tags ?? []).map((t) => t));
        for (const t of add) existing.add(t);
        return { ...e, tags: Array.from(existing), updatedAt: now };
      }),
    };

    await saveVault(next);
    clearSelection();
    setBulkTagsInput("");
    setStatus("Tags added ✅");
  }

  function clickTagChip(tag: string) {
    setView("active");
    setTagFilter(tag);
    setStatus(`Filtered by tag: ${tag}`);
  }
  function clickCategoryChip(cat: string) {
    setView("active");
    setCategoryFilter(cat);
    setStatus(`Filtered by category: ${cat}`);
  }

  function clearFilters() {
    setSearch("");
    setTagFilter("__all__");
    setCategoryFilter("__all__");
    setFavoritesOnly(false);
    setShowReusedOnly(false);
    setShowWeakOnly(false);
    setShowDuplicatesOnly(false);
  }

  const filteredActiveEntries = useMemo(() => {
    const term = search.trim().toLowerCase();

    const base = activeEntries.filter((e) => {
      if (categoryFilter !== "__all__") {
        const c = (e.category ?? "").trim();
        if (c !== categoryFilter) return false;
      }

      if (tagFilter !== "__all__") {
        const tags = e.tags ?? [];
        if (!tags.includes(tagFilter)) return false;
      }

      if (favoritesOnly && !e.favorite) return false;

      if (showReusedOnly) {
        const c = passwordCounts.get(e.password ?? "") ?? 0;
        if (c <= 1) return false;
      }

      if (showWeakOnly) {
        const s = passwordStrength(e.password ?? "");
        if (s.score > 1) return false;
      }

      if (showDuplicatesOnly) {
        const c = dupSiteUserCounts.get(normKey(e.site, e.username)) ?? 0;
        if (c <= 1) return false;
      }

      if (!term) return true;

      const hay = [e.site, e.username, e.notes ?? "", e.category ?? "", ...(e.tags ?? []), e.domain ?? ""]
        .join(" ")
        .toLowerCase();

      return hay.includes(term);
    });

    const sorted = [...base].sort((a, b) => {
      const aTime = a.createdAt ?? 0;
      const bTime = b.createdAt ?? 0;

      switch (sortMode) {
        case "newest":
          return bTime - aTime;
        case "oldest":
          return aTime - bTime;
        case "az":
          return (a.site ?? "").localeCompare(b.site ?? "");
        case "za":
          return (b.site ?? "").localeCompare(a.site ?? "");
      }
    });

    sorted.sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
    return sorted;
  }, [
    activeEntries,
    search,
    sortMode,
    tagFilter,
    categoryFilter,
    favoritesOnly,
    showReusedOnly,
    showWeakOnly,
    showDuplicatesOnly,
    passwordCounts,
    dupSiteUserCounts,
  ]);

  const filteredTrashEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = trashEntries.filter((e) => {
      if (!term) return true;
      const hay = [e.site, e.username, e.notes ?? "", e.category ?? "", ...(e.tags ?? [])].join(" ").toLowerCase();
      return hay.includes(term);
    });
    return [...base].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  }, [trashEntries, search]);

  const listToRender = view === "active" ? filteredActiveEntries : filteredTrashEntries;
  const currentIds = useMemo(() => listToRender.map((e) => e.id), [listToRender]);

  useEffect(() => {
    if (!csvText.trim()) {
      setCsvPreview(null);
      return;
    }
    const rows = parseCsvRows(csvText);
    const maybeHeader = rows[0]?.map((c) => c.toLowerCase());
    const hasHeader =
      maybeHeader?.includes("site") && maybeHeader?.includes("username") && maybeHeader?.includes("password");

    const dataRows = hasHeader ? rows.slice(1) : rows;

    let ok = 0;
    let bad = 0;
    for (const r of dataRows) {
      const site = (r[0] ?? "").trim();
      const user = (r[1] ?? "").trim();
      const pass = (r[2] ?? "").trim();
      if (site && user && pass) ok++;
      else bad++;
    }

    setCsvPreview({ rows: dataRows.length, ok, bad });
  }, [csvText]);

  async function importCsvIntoVault() {
    if (!unlocked || !key) return setStatus("Unlock first.");
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) return setStatus("CSV is empty.");

    const header = rows[0].map((c) => c.toLowerCase());
    const hasHeader =
      header.includes("site") && header.includes("username") && header.includes("password");
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const now = Date.now();
    const newEntries: VaultEntry[] = [];

    for (const r of dataRows) {
      const site = (r[0] ?? "").trim();
      const username = (r[1] ?? "").trim();
      const password = (r[2] ?? "").trim();
      const notes = (r[3] ?? "").trim() || undefined;
      const category = (r[4] ?? "").trim() || undefined;
      const tags = parseTags((r[5] ?? "").trim());

      if (!site || !username || !password) continue;

      newEntries.push({
        id: makeId(),
        site,
        username,
        password,
        notes,
        category,
        tags,
        favorite: false,
        createdAt: now,
        updatedAt: now,
        domain: extractDomain(site),
      });
    }

    if (newEntries.length === 0) return setStatus("No valid CSV rows found.");

    const ok = window.confirm(
      `Import ${newEntries.length} entries from CSV into your vault? (They will be added to Active.)`
    );
    if (!ok) return;

    const next: VaultData = {
      version: Math.max(vault.version ?? 4, 4),
      entries: [...newEntries, ...vault.entries],
    };

    await saveVault(next);
    setCsvText("");
    setCsvPreview(null);
    setStatus("CSV import complete ✅");
  }

  async function copyAutofillJson() {
    try {
      if (!unlocked) return setStatus("Unlock first.");

      const items = activeEntries
        .map((e) => ({
          id: e.id,
          domain: e.domain ?? extractDomain(e.site) ?? "",
          site: e.site,
          username: e.username,
          password: e.password,
        }))
        .filter((x) => x.domain && x.username && x.password);

      const payload = {
        type: "footprint_autofill",
        version: 1,
        exportedAt: new Date().toISOString(),
        items,
      };

      if (typeof window !== "undefined" && (window as any).chrome?.storage?.local) {
        (window as any).chrome.storage.local.set({ footprint_autofill: payload });
      }
      localStorage.setItem("footprint_autofill", JSON.stringify(payload));

      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setStatus("Autofill ready for extension ✅");
    } catch (e: any) {
      setStatus(`Copy failed: ${e?.message ?? String(e)}`);
    }
  }

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-3xl font-bold">Vault</h1>

        {/* Unlock/Controls */}
        {!unlocked ? (
          <div className="space-y-2">
            <input
              type="password"
              placeholder="Master password"
              autoFocus
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUnlock();
              }}
              className="w-full p-2 bg-black border border-white/20 rounded-lg focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 transition"
            />
            <div className="text-xs opacity-70">pw length: {masterPassword.length}</div>
            <button
              type="button"
              onClick={() => { setUnlockClicks(c => c + 1); handleUnlock(); }}
              className="px-4 py-2 bg-white text-black rounded font-semibold"
            >
              Unlock ({unlockClicks})
            </button>
          </div>
        ) : (
          <div className="px-4 py-2 border border-white/20 rounded-lg flex flex-wrap gap-2 items-center">
            <button onClick={() => saveVault(vault)} className="px-4 py-2 border border-white/20 rounded">
              Save
            </button>
            <button onClick={handleLock} className="px-4 py-2 border border-white/20 rounded">
              Lock
            </button>

            <div className="ml-auto flex gap-2 flex-wrap items-center">
              <button
                onClick={copyAutofillJson}
                className="px-4 py-2 border border-white/20 rounded-lg hover:bg-white/10 active:scale-[0.98] transition cursor-pointer"
              >
                Copy Autofill JSON
              </button>

              <label className="text-sm flex items-center gap-2 border border-white/20 rounded px-3 py-2">
                <input
                  type="checkbox"
                  checked={idleLockEnabled}
                  onChange={(e) => setIdleLockEnabled(e.target.checked)}
                />
                auto-lock
              </label>
              <label className="text-sm flex items-center gap-2 border border-white/20 rounded px-3 py-2">
                minutes
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={idleMinutes}
                  onChange={(e) => setIdleMinutes(Number(e.target.value))}
                  className="w-20 p-1 bg-black border border-white/20 rounded"
                  disabled={!idleLockEnabled}
                />
              </label>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="text-sm opacity-80">
          {unlocked ? "Unlocked ✅" : "Locked 🔒"}
          {status && <span className="text-green-400 ml-2">{status}</span>}
        </div>

        {/* Health Dashboard */}
        {unlocked && (
          <div className="p-3 border border-white/20 rounded bg-white/5 space-y-2">
            <div className="font-semibold">Vault Health</div>

            <div className="text-sm opacity-90 flex flex-wrap gap-3">
              <span>Active: <span className="font-semibold">{activeEntries.length}</span></span>
              <span>Favorites: <span className="font-semibold">{favoritesCount}</span></span>
              <span>Weak: <span className="font-semibold">{weakCount}</span></span>
              <span>Reused: <span className="font-semibold">{reusedEntriesCount}</span></span>
              <span>Duplicates: <span className="font-semibold">{duplicateCount}</span></span>
              <span>Trash: <span className="font-semibold">{trashEntries.length}</span></span>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setView("active"); setShowWeakOnly(true); setShowReusedOnly(false); setShowDuplicatesOnly(false); setStatus("Showing weak passwords"); }} className="px-4 py-2 border border-white/20 rounded">Show Weak</button>
              <button onClick={() => { setView("active"); setShowReusedOnly(true); setShowWeakOnly(false); setShowDuplicatesOnly(false); setStatus("Showing reused passwords"); }} className="px-4 py-2 border border-white/20 rounded">Show Reused</button>
              <button onClick={() => { setView("active"); setShowDuplicatesOnly(true); setShowWeakOnly(false); setShowReusedOnly(false); setStatus("Showing duplicates (site+username)"); }} className="px-4 py-2 border border-white/20 rounded">Show Duplicates</button>
              <button onClick={() => { setView("trash"); setStatus("Viewing trash"); }} className="px-4 py-2 border border-white/20 rounded">View Trash</button>
              <button onClick={() => { clearFilters(); setStatus("Filters cleared"); }} className="px-4 py-2 border border-white/20 rounded">Clear Filters</button>
              <button onClick={() => setShowReusedGroups((v) => !v)} className="px-4 py-2 border border-white/20 rounded" disabled={reusedEntriesCount === 0}>
                {showReusedGroups ? "Hide reused groups" : "Show reused groups"}
              </button>
            </div>
          </div>
        )}

        {/* Reused groups */}
        {unlocked && view === "active" && showReusedGroups && reusedGroups.length > 0 && (
          <div className="p-3 border border-white/20 rounded bg-white/5 space-y-2">
            <div className="font-semibold">Reused groups</div>
            <div className="text-sm opacity-80">Groups are based on identical passwords. Best practice: edit each entry and generate a unique password.</div>
            <div className="space-y-2">
              {reusedGroups.map((g, idx) => (
                <div key={idx} className="p-3 border border-white/20 rounded bg-black/30">
                  <div className="text-sm opacity-80 mb-2">Group size: <span className="font-semibold">{g.entries.length}</span></div>
                  <div className="space-y-2">
                    {g.entries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold">{e.site}</div>
                          <div className="text-sm opacity-80">{e.username}</div>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          <button onClick={() => startEdit(e)} className="px-3 py-2 rounded border border-white/20">Edit</button>
                          <button onClick={() => duplicateEntry(e)} className="px-3 py-2 rounded border border-white/20">Duplicate</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* View Toggle */}
        {unlocked && (
          <div className="px-4 py-2 border border-white/20 rounded-lg flex flex-wrap gap-2 items-center">
            <button onClick={() => setView("active")} className={`px-4 py-2 rounded border border-white/20 ${view === "active" ? "bg-white text-black font-semibold" : ""}`}>
              Active ({activeEntries.length})
            </button>
            <button onClick={() => setView("trash")} className={`px-4 py-2 rounded border border-white/20 ${view === "trash" ? "bg-white text-black font-semibold" : ""}`}>
              Trash ({trashEntries.length})
            </button>
            {view === "trash" && trashEntries.length > 0 && (
              <button onClick={emptyTrash} className="px-4 py-2 rounded border border-white/20">Empty Trash</button>
            )}
            <div className="ml-auto flex gap-2 flex-wrap items-center">
              <button onClick={() => selectAll(listToRender.map((e) => e.id))} className="px-4 py-2 rounded border border-white/20" disabled={!listToRender.length}>Select all</button>
              <button onClick={deselectAll} className="px-4 py-2 rounded border border-white/20" disabled={selectedIds.size === 0}>Clear selection</button>
            </div>
          </div>
        )}

        {/* Bulk actions */}
        {unlocked && selectedIds.size > 0 && (
          <div className="p-3 border border-white/20 rounded bg-white/5 space-y-2">
            <div className="font-semibold">Bulk actions — {selectedIds.size} selected ({view})</div>
            {view === "active" ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={bulkTrashSelected} className="px-4 py-2 rounded border border-white/20">Trash selected</button>
                <button onClick={() => bulkSetFavorite(true)} className="px-4 py-2 rounded border border-white/20">Favorite</button>
                <button onClick={() => bulkSetFavorite(false)} className="px-4 py-2 rounded border border-white/20">Unfavorite</button>
                <input placeholder="Set category..." value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="p-2 bg-black border border-white/20 rounded" />
                <button onClick={bulkSetCategory} className="px-4 py-2 rounded border border-white/20">Apply category</button>
                <input placeholder="Add tags (comma separated)" value={bulkTagsInput} onChange={(e) => setBulkTagsInput(e.target.value)} className="p-2 bg-black border border-white/20 rounded" />
                <button onClick={bulkAddTags} className="px-4 py-2 rounded border border-white/20">Add tags</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button onClick={bulkRestoreSelected} className="px-4 py-2 rounded border border-white/20">Restore selected</button>
                <button onClick={() => deletePermanentlySelected(Array.from(selectedIds))} className="px-4 py-2 rounded border border-white/20">Delete permanently</button>
              </div>
            )}
          </div>
        )}

        {/* Backup */}
        <div className="p-3 border border-white/20 rounded bg-white/5 space-y-3">
          <div className="font-semibold">Backup</div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={exportEncryptedBackup} className="px-4 py-2 border border-white/20 rounded" disabled={!unlocked}>Export encrypted backup</button>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-white/20 rounded" disabled={!unlocked}>Choose import file</button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
          </div>

          {importError && <div className="text-sm p-2 border border-white/20 rounded bg-black/30">{importError}</div>}

          {importPreview && (
            <div className="p-3 border border-white/20 rounded bg-black/30 space-y-2">
              <div className="font-semibold">Import preview</div>
              <div className="text-sm opacity-90">
                Entries: <span className="font-semibold">{importPreview.entriesCount}</span> • Tags: <span className="font-semibold">{importPreview.tagsCount}</span> • Categories: <span className="font-semibold">{importPreview.categoriesCount}</span>
              </div>
              <div className="text-sm opacity-90">
                Reused: <span className="font-semibold">{importPreview.reusedCount}</span> • Weak: <span className="font-semibold">{importPreview.weakCount}</span>
                {importPreview.dupSiteUserCount > 0 && <span className="ml-2">• Collisions: <span className="font-semibold">{importPreview.dupSiteUserCount}</span></span>}
              </div>
              <div className="flex gap-2 flex-wrap items-center pt-1">
                <label className="text-sm opacity-80">Mode</label>
                <select value={importMode} onChange={(e) => setImportMode(e.target.value as any)} className="p-2 bg-black text-white border border-white/20 rounded" disabled={!unlocked}>
                  <option value="merge">Merge (recommended)</option>
                  <option value="overwrite">Overwrite</option>
                </select>
                <button onClick={confirmImport} className="px-4 py-2 bg-white text-black rounded font-semibold" disabled={!unlocked || !importDecryptedVault}>Confirm import</button>
                <button onClick={resetImportState} className="px-4 py-2 border border-white/20 rounded">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* CSV Import */}
        <div className="p-3 border border-white/20 rounded bg-white/5 space-y-2">
          <div className="font-semibold">CSV Import Helper</div>
          <div className="text-sm opacity-80">Format: <span className="font-mono">site,username,password,notes,category,tags</span></div>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={`Example:\nexample.com,robbie@email.com,MyPassword123!,my note,Finance,bank,personal`} className="w-full h-36 p-2 bg-black border border-white/20 rounded font-mono text-sm" disabled={!unlocked} />
          {csvPreview && <div className="text-sm opacity-90">Rows: <span className="font-semibold">{csvPreview.rows}</span> • OK: <span className="font-semibold">{csvPreview.ok}</span> • Bad: <span className="font-semibold">{csvPreview.bad}</span></div>}
          <div className="flex gap-2 flex-wrap">
            <button onClick={importCsvIntoVault} className="px-4 py-2 bg-white text-black rounded font-semibold" disabled={!unlocked || !csvText.trim()}>Import CSV</button>
            <button onClick={() => { setCsvText(""); setCsvPreview(null); }} className="px-4 py-2 border border-white/20 rounded" disabled={!unlocked || (!csvText.trim() && !csvPreview)}>Clear</button>
          </div>
        </div>

        {/* Password Generator */}
        <div className="p-3 border border-white/20 rounded bg-white/5 space-y-2">
          <div className="font-semibold">Password Generator</div>
          <div className="flex flex-wrap gap-4 items-center border border-white/20 rounded px-4 py-2">
            <label className="text-sm opacity-80">Length</label>
            <input type="range" min={8} max={40} value={genLength} onChange={(e) => setGenLength(Number(e.target.value))} disabled={!unlocked} />
            <div className="text-sm w-10">{genLength}</div>
            {[["lower", genLower, setGenLower, "lower"], ["upper", genUpper, setGenUpper, "UPPER"], ["numbers", genNumbers, setGenNumbers, "123"], ["symbols", genSymbols, setGenSymbols, "!@#"]].map(([, val, setter, label]: any) => (
              <label key={label} className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} disabled={!unlocked} />
                {label}
              </label>
            ))}
          </div>
          <input value={genValue} readOnly className="w-full p-2 bg-black border border-white/20 rounded font-mono" placeholder="Click Generate…" />
          <div className="flex gap-2 flex-wrap">
            <button onClick={regenerate} className="px-4 py-2 border border-white/20 rounded" disabled={!unlocked}>Generate</button>
            <button onClick={async () => { if (!genValue) return; await navigator.clipboard.writeText(genValue); setStatus("Generated password copied ✅"); }} className="px-4 py-2 border border-white/20 rounded" disabled={!unlocked || !genValue}>Copy</button>
            <button onClick={() => setPassword(genValue)} className="px-4 py-2 bg-white text-black rounded font-semibold" disabled={!unlocked || !genValue}>Use in form</button>
          </div>
        </div>

        {/* Add/Edit Entry */}
        <div ref={addEntryRef} className="p-3 border border-white/20 rounded bg-white/5 space-y-2">
          <div className="font-semibold">{editingId ? "Edit entry" : "Add entry"}</div>
          <input placeholder="Site (or URL)" value={site} onChange={(e) => setSite(e.target.value)} className="w-full p-2 bg-black border border-white/20 rounded-lg focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 transition" disabled={!unlocked} />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-2 bg-black border border-white/20 rounded-lg focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 transition" disabled={!unlocked} />

          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <input placeholder="Password" type={showFormPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 bg-black border border-white/20 rounded-lg focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 transition" disabled={!unlocked} />
              <button type="button" onClick={() => setShowFormPassword((v) => !v)} className="px-3 py-2 border border-white/20 rounded" disabled={!unlocked}>{showFormPassword ? "Hide" : "Show"}</button>
            </div>
            {unlocked && password.length > 0 && (
              <div className="text-sm opacity-90">
                Strength: <span className="font-semibold">{strengthTyped.label}</span> <span className="opacity-70">({strengthTyped.score}/4)</span>
                {strengthTyped.score <= 1 && <span className="ml-2">⚠ weak</span>}
              </div>
            )}
            {unlocked && password.length > 0 && reuseForTypedPassword > 0 && (
              <div className="text-sm">⚠ This password is already used in <span className="font-semibold">{reuseForTypedPassword}</span> other entr{reuseForTypedPassword === 1 ? "y" : "ies"}.</div>
            )}
            {unlocked && typedDupCount > 0 && (
              <div className="text-sm">⚠ Duplicate detected: an entry with the same <span className="font-semibold">site + username</span> already exists.</div>
            )}
            {unlocked && site.trim() && (
              <div className="text-sm opacity-80">Domain detected: <span className="font-semibold">{extractDomain(site.trim()) ?? "none"}</span></div>
            )}
          </div>

          <input placeholder="Category (e.g., Finance, Work, Gaming)" value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} className="w-full p-2 bg-black border border-white/20 rounded-lg focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 transition" disabled={!unlocked} />
          <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 bg-black border border-white/20 rounded-lg focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 transition" disabled={!unlocked} />
          <input placeholder="Tags (comma separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full p-2 bg-black border border-white/20 rounded-lg focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 transition" disabled={!unlocked} />

          <div className="flex gap-2 flex-wrap pt-1">
            <button onClick={addOrUpdateEntry} className={`px-4 py-2 rounded font-semibold ${unlocked ? "bg-white text-black" : "bg-white/20 text-white/60 cursor-not-allowed"}`} disabled={!unlocked}>
              {editingId ? "Save changes" : "Add entry"}
            </button>
            {editingId && <button onClick={cancelEdit} className="px-4 py-2 border border-white/20 rounded">Cancel</button>}
          </div>
        </div>

        {/* Search + Filters */}
        <div className="p-3 border border-white/20 rounded bg-white/5 space-y-2">
          <input placeholder={view === "trash" ? "Search Trash..." : "Search..."} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full p-2 bg-black border border-white/20 rounded-lg focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40 transition" disabled={!unlocked} />

          {view === "active" ? (
            <div className="flex flex-wrap gap-2">
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="p-2 bg-black text-white border border-white/20 rounded" disabled={!unlocked}>
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="az">Sort: A → Z</option>
                <option value="za">Sort: Z → A</option>
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="p-2 bg-black text-white border border-white/20 rounded" disabled={!unlocked}>
                <option value="__all__">Category: All</option>
                {allCategories.map((c) => <option key={c} value={c}>Category: {c}</option>)}
              </select>
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="p-2 bg-black text-white border border-white/20 rounded" disabled={!unlocked}>
                <option value="__all__">Tag: All</option>
                {allTags.map((t) => <option key={t} value={t}>Tag: {t}</option>)}
              </select>
              {[["favoritesOnly", favoritesOnly, setFavoritesOnly, "favorites only"], ["showReusedOnly", showReusedOnly, setShowReusedOnly, "reused only"], ["showWeakOnly", showWeakOnly, setShowWeakOnly, "weak only"], ["showDuplicatesOnly", showDuplicatesOnly, setShowDuplicatesOnly, "duplicates only"]].map(([key, val, setter, label]: any) => (
                <label key={key} className="text-sm flex items-center gap-2 border border-white/20 rounded px-3 py-2">
                  <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} disabled={!unlocked} />
                  {label}
                </label>
              ))}
              {(search || tagFilter !== "__all__" || categoryFilter !== "__all__" || favoritesOnly || showReusedOnly || showWeakOnly || showDuplicatesOnly) && (
                <button onClick={clearFilters} className="px-4 py-2 border border-white/20 rounded" disabled={!unlocked}>Clear</button>
              )}
            </div>
          ) : (
            <div className="text-sm opacity-80">Trash is searchable. Restore items you want to bring back.</div>
          )}

          <div className="text-sm opacity-80">
            {view === "active" ? `Showing ${filteredActiveEntries.length} of ${activeEntries.length} active entries` : `Showing ${filteredTrashEntries.length} of ${trashEntries.length} trashed entries`}
          </div>
        </div>

        {/* Entries */}
        <div className="space-y-3">
          {!unlocked ? (
            <div className="opacity-80">Unlock to view entries.</div>
          ) : listToRender.length === 0 ? (
            <div className="p-3 border border-white/20 rounded bg-white/5">{view === "trash" ? "Trash is empty." : "No results."}</div>
          ) : (
            listToRender.map((e) => {
              const userKey = `${e.id}:username`;
              const passKey = `${e.id}:password`;
              const userCd = copyCountdown[userKey] ?? 0;
              const passCd = copyCountdown[passKey] ?? 0;

              const entryStrength = passwordStrength(e.password ?? "");
              const isWeak = entryStrength.score <= 1;
              const revealed = Boolean(revealMap[e.id]);
              const ageLabel = daysAgo(e.updatedAt ?? e.createdAt);

              const reuseCount = view === "active" ? (passwordCounts.get(e.password ?? "") ?? 0) : 0;
              const isReused = view === "active" ? reuseCount > 1 : false;
              const dupCount = view === "active" ? (dupSiteUserCounts.get(normKey(e.site, e.username)) ?? 0) : 0;
              const isExpanded = expandedId === e.id;

              return (
                <div key={e.id} className="p-3 border border-white/20 rounded bg-white/5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-3 items-start">
                      <input type="checkbox" checked={isSelected(e.id)} onChange={() => toggleSelected(e.id)} className="mt-2" />
                      <button type="button" onClick={() => setExpandedId((cur) => (cur === e.id ? null : e.id))} className="text-left">
                        <div className="font-semibold text-lg">
                          {view === "active" && e.favorite ? "⭐ " : ""}
                          {e.site}
                          {view === "active" && dupCount > 1 && <span className="ml-2 text-sm px-2 py-1 rounded border border-white/20 bg-black/30">Duplicate</span>}
                        </div>
                        <div className="text-sm opacity-80">{e.username}</div>
                        <div className="text-sm opacity-80 mt-1">
                          Strength: <span className="font-semibold">{entryStrength.label}</span>
                          {isWeak && <span className="ml-2">⚠ weak</span>}
                          <span className="ml-2">• updated {ageLabel}</span>
                          {e.category && (
                            <span className="ml-2">• <span className="inline-block px-2 py-1 rounded border border-white/20 bg-black/30 cursor-pointer" onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); clickCategoryChip(e.category!); }}>{e.category}</span></span>
                          )}
                          {e.domain && <span className="ml-2">• domain {e.domain}</span>}
                        </div>
                        {view === "active" && isReused && (
                          <div className="text-sm mt-2">⚠ Reused password (used in <span className="font-semibold">{reuseCount}</span> entries)</div>
                        )}
                        <div className="text-sm opacity-70 mt-1">{isExpanded ? "▼ Details" : "▶ Details"}</div>
                      </button>
                    </div>

                    <div className="flex gap-2 flex-wrap justify-end">
                      {view === "active" ? (
                        <>
                          <button onClick={() => toggleFavorite(e.id)} className="px-3 py-2 rounded border border-white/20">{e.favorite ? "Unfavorite" : "Favorite"}</button>
                          <button onClick={() => startEdit(e)} className="px-3 py-2 rounded border border-white/20">Edit</button>
                          <button onClick={() => duplicateEntry(e)} className="px-3 py-2 rounded border border-white/20">Duplicate</button>
                          <button onClick={() => moveToTrash(e.id)} className="px-3 py-2 rounded border border-white/20">Trash</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => restoreFromTrash(e.id)} className="px-3 py-2 rounded border border-white/20">Restore</button>
                          <button onClick={() => deletePermanentlySelected([e.id])} className="px-3 py-2 rounded border border-white/20">Delete permanently</button>
                        </>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-3 border border-white/20 rounded bg-black/30 space-y-2">
                      {view === "active" ? (
                        <>
                          <div className="text-sm">
                            <span className="opacity-80">Password: </span>
                            <span className="font-mono">{revealed ? e.password : maskPassword(e.password)}</span>
                            {revealed && <span className="opacity-70 ml-2">(auto-hides in 10s)</span>}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleCopy(e.id, "username", e.username)} className="px-3 py-2 rounded border border-white/20">Copy Username{userCd > 0 ? ` (clearing in ${userCd}s)` : ""}</button>
                            <button onClick={() => handleCopy(e.id, "password", e.password)} className="px-3 py-2 rounded border border-white/20">Copy Password{passCd > 0 ? ` (clearing in ${passCd}s)` : ""}</button>
                            <button onClick={() => toggleReveal(e.id)} className="px-3 py-2 rounded border border-white/20">{revealed ? "Hide password" : "Reveal password"}</button>
                            <button onClick={() => copyText("Site", e.site)} className="px-3 py-2 rounded border border-white/20">Copy Site</button>
                            <button onClick={() => copyText("Site + Username", `${e.site} • ${e.username}`)} className="px-3 py-2 rounded border border-white/20">Copy Site+User</button>
                          </div>
                          {(e.tags?.length ?? 0) > 0 && (
                            <div className="text-sm mt-1 flex flex-wrap gap-2">
                              {e.tags!.map((t) => <button type="button" key={t} onClick={() => clickTagChip(t)} className="px-2 py-1 rounded border border-white/20 bg-black/30">{t}</button>)}
                            </div>
                          )}
                          {e.notes && <div className="text-sm opacity-90 whitespace-pre-wrap mt-2">{e.notes}</div>}
                          <div className="text-sm opacity-80">Created: <span className="font-semibold">{daysAgo(e.createdAt)}</span> • Updated: <span className="font-semibold">{daysAgo(e.updatedAt)}</span></div>
                        </>
                      ) : (
                        <div className="text-sm opacity-80">Trashed: {daysAgo(e.deletedAt)}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Undo Toast */}
        {unlocked && undoToast?.active && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(700px,calc(100%-24px))] p-3 border border-white/20 rounded bg-black/80 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">
                Moved <span className="font-semibold">{undoToast.count}</span> item{undoToast.count === 1 ? "" : "s"} to Trash.
                <span className="opacity-70 ml-2">(Undo available for 10s)</span>
              </div>
              <button onClick={undoLastTrash} className="px-4 py-2 bg-white text-black rounded font-semibold">Undo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}