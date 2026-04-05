"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { decryptData, deriveKey, encryptData } from "@/lib/crypto";
import type { VaultData, VaultEntry } from "@/lib/types";
import { getServiceById } from "@/lib/services";
import { passwordStrength, maskPassword, daysAgo, normKey } from "@/lib/vaultUtils";
import VaultRow from "@/src/components/vault/VaultRow";
import VaultSection from "@/src/components/vault/VaultSection";

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
  const [inputFocused, setInputFocused] = useState(false);
  const [unlockHovered, setUnlockHovered] = useState(false);
  const [unlockPressed, setUnlockPressed] = useState(false);
  const [unlockFading, setUnlockFading] = useState(false);
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

  async function handleUnlockWithFade() {
    if (unlockFading) return;
    setUnlockFading(true);
    await new Promise((r) => setTimeout(r, 220));
    await handleUnlock();
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
    <div
      className="min-h-screen text-[#e8e0d0]"
      style={{
        backgroundImage: "url(/bg-dashboard.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundColor: "#0a0a0a",
      }}
    >
      {/* ── Environment scrim ─────────────────────────────────────────── */}
      <div className="min-h-screen flex flex-col" style={{ background: "rgba(4,3,2,0.62)" }}>

        {/* ── Top navigation ────────────────────────────────────────────── */}
        <div
          style={{
            backdropFilter: "blur(20px)",
            background: "rgba(6,6,6,0.68)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            flexShrink: 0,
          }}
        >
          <div
            className="px-8 py-3 flex items-center gap-3 flex-wrap"
            style={{ maxWidth: 1600, margin: "0 auto" }}
          >
            <a href="/" style={{ display: "flex", alignItems: "center", gap: "0.55rem", textDecoration: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Footprint" style={{ height: 26, width: "auto", opacity: 0.82 }} />
              <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 9, letterSpacing: "0.22em", color: "rgba(255,255,255,0.70)", textTransform: "uppercase" }}>
                Footprint
              </span>
            </a>

            <div className="flex-1" />

            {unlocked && (
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  onClick={() => saveVault(vault)}
                  className="hover:brightness-125 transition-[filter]"
                  style={{ padding: "4px 12px", fontSize: 10, letterSpacing: "0.1em", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(232,224,208,0.50)", textTransform: "uppercase" }}
                >
                  Save
                </button>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", fontSize: 10, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(232,224,208,0.45)", cursor: "pointer" }}
                >
                  <input type="checkbox" checked={idleLockEnabled} onChange={(e) => setIdleLockEnabled(e.target.checked)} className="accent-white" />
                  auto-lock
                </label>
                {idleLockEnabled && (
                  <label style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", fontSize: 10, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(232,224,208,0.40)" }}>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={idleMinutes}
                      onChange={(e) => setIdleMinutes(Number(e.target.value))}
                      className="bg-transparent text-center"
                      style={{ width: 32, fontSize: 10, color: "rgba(232,224,208,0.60)" }}
                    />
                    min
                  </label>
                )}
                <button
                  onClick={copyAutofillJson}
                  className="hover:brightness-125 transition-[filter]"
                  style={{ padding: "4px 12px", fontSize: 10, letterSpacing: "0.1em", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(232,224,208,0.45)", textTransform: "uppercase" }}
                >
                  Autofill
                </button>
                <button
                  onClick={handleLock}
                  className="hover:brightness-125 transition-[filter]"
                  style={{ padding: "4px 12px", fontSize: 10, letterSpacing: "0.1em", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.50)", textTransform: "uppercase" }}
                >
                  Lock
                </button>
              </div>
            )}

            {status && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.36)", letterSpacing: "0.04em", marginLeft: 4 }}>
                {status}
              </span>
            )}
          </div>
        </div>

        {/* ── Environment body ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col">

          {/* ══════════════════════════════════════════════════════════════
              LOCKED — vault door environment
          ══════════════════════════════════════════════════════════════ */}
          {!unlocked && (
            <div
              className="flex-1 flex flex-col items-center justify-center text-center"
              style={{
                padding: "80px 40px 100px",
                position: "relative",
                opacity: unlockFading ? 0 : 1,
                transition: unlockFading ? "opacity 0.22s ease" : "none",
              }}
            >
              {/* Ambient spotlight — drifts slowly, barely perceptible */}
              <div
                aria-hidden
                className="vault-ambient-glow"
                style={{
                  position: "absolute",
                  top: "30%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 520,
                  height: 520,
                  background: "radial-gradient(ellipse at center, rgba(255,255,255,0.03) 0%, transparent 68%)",
                  pointerEvents: "none",
                }}
              />
              {/* Breathe overlay — slow opacity pulse over the center */}
              <div aria-hidden className="vault-breathe-overlay" />

              {/* Footprint logo */}
              <img
                src="/logo-transparent.png"
                alt="Footprint"
                style={{
                  height: 114,
                  width: "auto",
                  opacity: 0.92,
                  marginBottom: "1.25rem",
                }}
              />

              {/* Title */}
              <h1
                className="font-cinzel"
                style={{
                  fontSize: "clamp(1.4rem, 3vw, 2rem)",
                  letterSpacing: "0.38em",
                  color: "#e8e0d0",
                  textTransform: "uppercase",
                  marginBottom: "0.9rem",
                  fontWeight: 400,
                }}
              >
                Vault
              </h1>

              {/* Accent rule — cool white, matches inset highlights on account cards */}
              <div
                aria-hidden
                style={{
                  width: 36,
                  height: 1,
                  background: "linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)",
                  marginBottom: "1.5rem",
                }}
              />

              {/* Subtitle */}
              <p style={{ fontSize: 13, color: "rgba(232,224,208,0.42)", marginBottom: "2.75rem", maxWidth: 300, lineHeight: 1.75, letterSpacing: "0.01em" }}>
                Enter your master password to access your encrypted records.
              </p>

              {/* Input + button */}
              <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="password"
                  placeholder="Master password"
                  autoFocus
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setUnlockClicks((c) => c + 1);
                      handleUnlockWithFade();
                    }
                  }}
                  className="focus:outline-none"
                  style={{
                    width: "100%",
                    padding: "13px 18px",
                    fontSize: 14,
                    background: inputFocused ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
                    border: inputFocused
                      ? "1px solid rgba(255,255,255,0.22)"
                      : "1px solid rgba(255,255,255,0.10)",
                    color: "#e8e0d0",
                    boxShadow: inputFocused
                      ? "0 0 16px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.06)"
                      : "inset 0 1px 0 rgba(255,255,255,0.04)",
                    transition: "border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
                    letterSpacing: "0.02em",
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    setUnlockClicks((c) => c + 1);
                    handleUnlockWithFade();
                  }}
                  onMouseEnter={() => setUnlockHovered(true)}
                  onMouseLeave={() => { setUnlockHovered(false); setUnlockPressed(false); }}
                  onMouseDown={() => setUnlockPressed(true)}
                  onMouseUp={() => setUnlockPressed(false)}
                  className="font-cinzel"
                  style={{
                    width: "100%",
                    padding: "14px 0",
                    fontSize: 11,
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    border: unlockHovered
                      ? "1px solid rgba(255,255,255,0.24)"
                      : "1px solid rgba(255,255,255,0.14)",
                    color: unlockHovered
                      ? "rgba(255,255,255,0.88)"
                      : "rgba(255,255,255,0.68)",
                    background: unlockPressed
                      ? "rgba(255,255,255,0.07)"
                      : unlockHovered
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.03)",
                    boxShadow: unlockHovered
                      ? "0 0 20px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.10)"
                      : "inset 0 1px 0 rgba(255,255,255,0.06)",
                    transform: unlockPressed ? "translateY(1px) scale(0.99)" : "translateY(0) scale(1)",
                    transition: unlockPressed
                      ? "transform 0.08s ease, background 0.08s ease"
                      : "border-color 0.18s ease, color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
                    cursor: "pointer",
                  }}
                >
                  Unlock Vault
                </button>

                {status && (
                  <p style={{ fontSize: 12, color: "rgba(232,224,208,0.36)", textAlign: "center", marginTop: 2, letterSpacing: "0.02em" }}>{status}</p>
                )}
              </div>

              {/* Trust badges */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  marginTop: "3.5rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {["AES-256-GCM", "Zero Knowledge", "PBKDF2"].map((tag, i) => (
                  <React.Fragment key={tag}>
                    {i > 0 && (
                      <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 9, margin: "0 14px" }}>·</span>
                    )}
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.16em",
                        color: "rgba(232,224,208,0.24)",
                        textTransform: "uppercase",
                      }}
                    >
                      {tag}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              UNLOCKED — vault interior environment
          ══════════════════════════════════════════════════════════════ */}
          {unlocked && (
            <div className="flex-1 flex flex-col">

              {/* Ceiling light seam */}
              <div style={{ height: 1, flexShrink: 0, background: "linear-gradient(to right, transparent 0%, rgba(255,255,255,0.04) 20%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 80%, transparent 100%)" }} />

              {/* ── Interior header zone ─────────────────────────────────── */}
              <div
                style={{
                  padding: "40px 72px 28px",
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 32,
                  flexShrink: 0,
                  flexWrap: "wrap",
                }}
              >
                {/* Vault identity — like a plaque on the wall */}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <h1
                    className="font-cinzel"
                    style={{
                      fontSize: "clamp(0.6rem, 0.85vw, 0.75rem)",
                      letterSpacing: "0.42em",
                      textTransform: "uppercase",
                      color: "rgba(232,224,208,0.28)",
                      marginBottom: 7,
                      lineHeight: 1,
                    }}
                  >
                    Your Vault
                  </h1>
                  <p style={{ fontSize: 11, color: "rgba(232,224,208,0.15)", letterSpacing: "0.02em", lineHeight: 1.5 }}>
                    Your encrypted credentials, secured.
                  </p>
                </div>

                {/* Action cluster — embedded into environment */}
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    placeholder="Search records…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="focus:outline-none"
                    style={{
                      padding: "8px 14px",
                      fontSize: 12,
                      background: "rgba(0,0,0,0.52)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderBottom: "1px solid rgba(255,255,255,0.11)",
                      color: "#e8e0d0",
                      width: 200,
                      letterSpacing: "0.01em",
                      boxShadow: "inset 0 2px 6px rgba(0,0,0,0.40)",
                    }}
                  />
                  <button
                    onClick={() => addEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="font-cinzel hover:brightness-125 transition-[filter] shrink-0"
                    style={{
                      padding: "8px 22px",
                      fontSize: 10,
                      letterSpacing: "0.26em",
                      textTransform: "uppercase",
                      border: "1px solid rgba(255,255,255,0.16)",
                      color: "rgba(255,255,255,0.72)",
                      background: "rgba(255,255,255,0.03)",
                      boxShadow: "0 0 12px rgba(255,255,255,0.03)",
                    }}
                  >
                    + Add Account
                  </button>
                </div>
              </div>

              {/* ── Architectural floor seam ─────────────────────────────── */}
              <div style={{ height: 1, flexShrink: 0, margin: "0 72px", background: "linear-gradient(to right, rgba(255,255,255,0.00), rgba(255,255,255,0.05), rgba(255,255,255,0.00))" }} />

              {/* ── Open records floor ───────────────────────────────────── */}
              <div className="flex-1" style={{ padding: "0 32px 80px" }}>

                {/* Sort + view controls */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 0 22px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "rgba(232,224,208,0.18)", letterSpacing: "0.08em" }}>
                    {view === "active"
                      ? `${filteredActiveEntries.length} record${filteredActiveEntries.length !== 1 ? "s" : ""}`
                      : `${filteredTrashEntries.length} in trash`}
                  </span>
                  <div style={{ flex: 1 }} />
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="bg-transparent hover:brightness-125 transition-[filter]"
                    style={{ padding: "5px 10px", fontSize: 10, border: "1px solid rgba(255,255,255,0.06)", color: "rgba(232,224,208,0.32)", letterSpacing: "0.06em" }}
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="az">A → Z</option>
                    <option value="za">Z → A</option>
                  </select>
                  <div className="flex gap-px shrink-0">
                    {(["active", "trash"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className="hover:brightness-125 transition-[filter]"
                        style={{
                          padding: "5px 13px",
                          fontSize: 10,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          border: view === v ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.06)",
                          color: view === v ? "rgba(255,255,255,0.78)" : "rgba(232,224,208,0.28)",
                        }}
                      >
                        {v === "active" ? `Active${activeEntries.length > 0 ? ` (${activeEntries.length})` : ""}` : `Trash${trashEntries.length > 0 ? ` (${trashEntries.length})` : ""}`}
                      </button>
                    ))}
                  </div>
                  {view === "trash" && trashEntries.length > 0 && (
                    <button
                      onClick={emptyTrash}
                      className="hover:brightness-125 transition-[filter]"
                      style={{ padding: "5px 11px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(232,224,208,0.28)" }}
                    >
                      Empty trash
                    </button>
                  )}
                </div>

                {/* Bulk actions */}
                {selectedIds.size > 0 && (
                  <div
                    style={{
                      padding: "12px 20px",
                      marginBottom: 16,
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.02)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="font-cinzel" style={{ fontSize: 9, letterSpacing: "0.26em", color: "rgba(255,255,255,0.42)", textTransform: "uppercase" }}>
                      {selectedIds.size} selected
                    </span>
                    <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.08)" }} />
                    {view === "active" ? (
                      <>
                        <button onClick={bulkTrashSelected} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 10px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Trash</button>
                        <button onClick={() => bulkSetFavorite(true)} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 10px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Favorite</button>
                        <button onClick={() => bulkSetFavorite(false)} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 10px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Unfavorite</button>
                        <input placeholder="Set category…" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="focus:outline-none" style={{ padding: "4px 9px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "#e8e0d0", background: "rgba(255,255,255,0.04)" }} />
                        <button onClick={bulkSetCategory} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 10px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Apply</button>
                        <input placeholder="Add tags…" value={bulkTagsInput} onChange={(e) => setBulkTagsInput(e.target.value)} className="focus:outline-none" style={{ padding: "4px 9px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "#e8e0d0", background: "rgba(255,255,255,0.04)" }} />
                        <button onClick={bulkAddTags} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 10px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Add tags</button>
                      </>
                    ) : (
                      <>
                        <button onClick={bulkRestoreSelected} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 10px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Restore</button>
                        <button onClick={() => deletePermanentlySelected(Array.from(selectedIds))} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 10px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.35)" }}>Delete permanently</button>
                      </>
                    )}
                    <div style={{ flex: 1 }} />
                    <button onClick={deselectAll} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 8px", fontSize: 10, border: "1px solid rgba(255,255,255,0.07)", color: "rgba(232,224,208,0.28)" }}>✕ Deselect</button>
                  </div>
                )}

                {/* Records — empty state or list */}
                {listToRender.length === 0 ? (

                  /* Empty state — floating in the vault space */
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 440,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        border: "1px solid rgba(255,255,255,0.06)",
                        background: "rgba(255,255,255,0.015)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 28,
                        boxShadow: "0 0 40px rgba(0,0,0,0.40)",
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(232,224,208,0.18)" strokeWidth="1.3" strokeLinecap="square">
                        <rect x="3" y="11" width="18" height="11" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        <line x1="12" y1="15" x2="12" y2="17" />
                      </svg>
                    </div>
                    <p className="font-cinzel" style={{ fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(232,224,208,0.22)", marginBottom: 12 }}>
                      {view === "trash" ? "Trash is empty" : "Your vault is empty"}
                    </p>
                    {view === "active" && (
                      <>
                        <p style={{ fontSize: 12, color: "rgba(232,224,208,0.14)", lineHeight: 1.8, maxWidth: 260, marginBottom: 32 }}>
                          Add your first account to begin securing your digital footprint.
                        </p>
                        <button
                          onClick={() => addEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                          className="font-cinzel hover:brightness-125 transition-[filter]"
                          style={{ padding: "9px 24px", fontSize: 9, letterSpacing: "0.30em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.52)", background: "rgba(255,255,255,0.02)" }}
                        >
                          + Add Account
                        </button>
                      </>
                    )}
                  </div>

                ) : (

                  /* Record list — open floor */
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 20,
                        paddingBottom: 12,
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <span style={{ fontSize: 10, color: "rgba(232,224,208,0.20)", letterSpacing: "0.05em" }}>
                        {view === "active"
                          ? `${filteredActiveEntries.length} of ${activeEntries.length} records`
                          : `${filteredTrashEntries.length} trashed`}
                      </span>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => selectAll(currentIds)}
                        disabled={!listToRender.length}
                        className="hover:brightness-125 transition-[filter] disabled:opacity-30"
                        style={{ padding: "3px 9px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(232,224,208,0.28)" }}
                      >
                        Select all
                      </button>
                    </div>

                    {(() => {
                      const sectionMap = new Map<string, typeof listToRender>();
                      for (const e of listToRender) {
                        const key = e.category || "Uncategorized";
                        if (!sectionMap.has(key)) sectionMap.set(key, []);
                        sectionMap.get(key)!.push(e);
                      }
                      return [...sectionMap.entries()].map(([cat, entries]) => (
                        <VaultSection key={cat} title={cat}>
                          {entries.map((e) => (
                            <VaultRow
                              key={e.id}
                              entry={e}
                              view={view}
                              expandedId={expandedId}
                              setExpandedId={setExpandedId}
                              isSelected={isSelected}
                              toggleSelected={toggleSelected}
                              toggleFavorite={toggleFavorite}
                              startEdit={startEdit}
                              duplicateEntry={duplicateEntry}
                              moveToTrash={moveToTrash}
                              restoreFromTrash={restoreFromTrash}
                              deletePermanentlySelected={deletePermanentlySelected}
                              handleCopy={handleCopy}
                              copyText={copyText}
                              toggleReveal={toggleReveal}
                              clickTagChip={clickTagChip}
                              clickCategoryChip={clickCategoryChip}
                              copyCountdown={copyCountdown}
                              revealMap={revealMap}
                              passwordCounts={passwordCounts}
                              dupSiteUserCounts={dupSiteUserCounts}
                            />
                          ))}
                        </VaultSection>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* ── Add / Edit Entry form ─────────────────────────────────── */}
              <div
                ref={addEntryRef}
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  padding: "36px 72px 48px",
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.28) 100%)",
                  backdropFilter: "blur(4px)",
                  flexShrink: 0,
                }}
              >
                <div className="font-cinzel" style={{ fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 22 }}>
                  {editingId ? "Edit Record" : "Add Record"}
                </div>
                <div className="grid gap-3" style={{ maxWidth: 520 }}>
                  <input placeholder="Service / Site (or URL)" value={site} onChange={(e) => setSite(e.target.value)} className="focus:outline-none" style={{ padding: "10px 14px", fontSize: 13, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.11)", color: "#e8e0d0", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)" }} />
                  <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="focus:outline-none" style={{ padding: "10px 14px", fontSize: 13, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.11)", color: "#e8e0d0", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)" }} />
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input placeholder="Password" type={showFormPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="focus:outline-none flex-1" style={{ padding: "10px 14px", fontSize: 13, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.11)", color: "#e8e0d0", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)" }} />
                      <button type="button" onClick={() => setShowFormPassword((v) => !v)} className="hover:brightness-125 transition-[filter] shrink-0" style={{ padding: "10px 14px", fontSize: 11, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>{showFormPassword ? "Hide" : "Show"}</button>
                    </div>
                    {password.length > 0 && (
                      <div style={{ fontSize: 11, color: "rgba(232,224,208,0.38)" }}>
                        {strengthTyped.label}
                        {strengthTyped.score <= 1 && <span style={{ marginLeft: 8, color: "rgba(251,191,36,0.68)" }}>⚠ Weak</span>}
                        {reuseForTypedPassword > 0 && <span style={{ marginLeft: 8, color: "rgba(251,191,36,0.58)" }}>· Reused ({reuseForTypedPassword})</span>}
                        {typedDupCount > 0 && <span style={{ marginLeft: 8, color: "rgba(251,191,36,0.58)" }}>· Duplicate entry</span>}
                      </div>
                    )}
                    {site.trim() && <div style={{ fontSize: 10, color: "rgba(232,224,208,0.22)" }}>Domain: {extractDomain(site.trim()) ?? "—"}</div>}
                  </div>
                  <input placeholder="Category (optional)" value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} className="focus:outline-none" style={{ padding: "10px 14px", fontSize: 13, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.11)", color: "#e8e0d0", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)" }} />
                  <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="focus:outline-none" style={{ padding: "10px 14px", fontSize: 13, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.11)", color: "#e8e0d0", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)" }} />
                  <input placeholder="Tags (comma separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="focus:outline-none" style={{ padding: "10px 14px", fontSize: 13, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.11)", color: "#e8e0d0", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)" }} />
                  <div className="flex gap-2" style={{ paddingTop: 4 }}>
                    <button onClick={addOrUpdateEntry} className="font-cinzel hover:brightness-125 transition-[filter]" style={{ padding: "11px 24px", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.80)", background: "rgba(255,255,255,0.04)" }}>
                      {editingId ? "Save Changes" : "Add Entry"}
                    </button>
                    {editingId && (
                      <button onClick={cancelEdit} className="hover:brightness-125 transition-[filter]" style={{ padding: "11px 20px", fontSize: 11, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.38)" }}>Cancel</button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Secondary panels (Footprints + Security) ──────────────── */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.32)", backdropFilter: "blur(4px)", flexShrink: 0 }}>
                <div className="grid grid-cols-1 md:grid-cols-2">

                  {/* Footprints */}
                  <div style={{ padding: "32px 72px", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="font-cinzel" style={{ fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 18 }}>Footprints</div>
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "rgba(232,224,208,0.25)", textTransform: "uppercase" }}>Backup</div>
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={exportEncryptedBackup} className="hover:brightness-125 transition-[filter]" style={{ padding: "6px 13px", fontSize: 11, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Export encrypted</button>
                          <button onClick={() => fileInputRef.current?.click()} className="hover:brightness-125 transition-[filter]" style={{ padding: "6px 13px", fontSize: 11, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Import file</button>
                          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
                        </div>
                        {importError && <div style={{ fontSize: 11, color: "rgba(248,113,113,0.60)" }}>{importError}</div>}
                        {importPreview && (
                          <div style={{ padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }} className="space-y-2">
                            <div className="font-cinzel" style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(232,224,208,0.30)" }}>Preview</div>
                            <div style={{ fontSize: 11, color: "rgba(232,224,208,0.48)" }}>{importPreview.entriesCount} entries · {importPreview.tagsCount} tags · {importPreview.categoriesCount} categories</div>
                            <div style={{ fontSize: 11, color: "rgba(232,224,208,0.38)" }}>Reused: {importPreview.reusedCount} · Weak: {importPreview.weakCount}{importPreview.dupSiteUserCount > 0 && ` · Collisions: ${importPreview.dupSiteUserCount}`}</div>
                            <div className="flex gap-2 flex-wrap items-center" style={{ paddingTop: 4 }}>
                              <select value={importMode} onChange={(e) => setImportMode(e.target.value as any)} className="bg-transparent" style={{ padding: "5px 9px", fontSize: 11, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>
                                <option value="merge">Merge</option>
                                <option value="overwrite">Overwrite</option>
                              </select>
                              <button onClick={confirmImport} disabled={!importDecryptedVault} className="font-cinzel hover:brightness-125 transition-[filter] disabled:opacity-40" style={{ padding: "5px 14px", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.72)" }}>Confirm</button>
                              <button onClick={resetImportState} className="hover:brightness-125 transition-[filter]" style={{ padding: "5px 11px", fontSize: 11, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.35)" }}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "rgba(232,224,208,0.25)", textTransform: "uppercase" }}>CSV Import</div>
                        <div style={{ fontSize: 10, color: "rgba(232,224,208,0.22)" }}>Format: <span className="font-mono">site,username,password,notes,category,tags</span></div>
                        <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="example.com,user@email.com,Password123!" className="focus:outline-none font-mono" style={{ width: "100%", height: 80, padding: "8px 12px", fontSize: 11, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.62)", resize: "vertical" }} />
                        {csvPreview && <div style={{ fontSize: 11, color: "rgba(232,224,208,0.36)" }}>Rows: {csvPreview.rows} · OK: {csvPreview.ok} · Bad: {csvPreview.bad}</div>}
                        <div className="flex gap-2">
                          <button onClick={importCsvIntoVault} disabled={!csvText.trim()} className="font-cinzel hover:brightness-125 transition-[filter] disabled:opacity-40" style={{ padding: "6px 13px", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.70)" }}>Import CSV</button>
                          <button onClick={() => { setCsvText(""); setCsvPreview(null); }} disabled={!csvText.trim() && !csvPreview} className="hover:brightness-125 transition-[filter] disabled:opacity-40" style={{ padding: "6px 11px", fontSize: 11, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.35)" }}>Clear</button>
                        </div>
                      </div>
                      {view === "active" && showReusedGroups && reusedGroups.length > 0 && (
                        <div className="space-y-2">
                          <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "rgba(232,224,208,0.25)", textTransform: "uppercase" }}>Reused Groups</div>
                          {reusedGroups.map((g, idx) => (
                            <div key={idx} style={{ padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }} className="space-y-2">
                              <div style={{ fontSize: 10, color: "rgba(232,224,208,0.25)" }}>Group: {g.entries.length} entries</div>
                              {g.entries.map((e) => (
                                <div key={e.id} className="flex items-center justify-between gap-2">
                                  <div>
                                    <div style={{ fontSize: 12, color: "rgba(232,224,208,0.62)" }}>{e.site}</div>
                                    <div style={{ fontSize: 10, color: "rgba(232,224,208,0.32)" }}>{e.username}</div>
                                  </div>
                                  <button onClick={() => startEdit(e)} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 9px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.38)" }}>Edit</button>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Security */}
                  <div style={{ padding: "32px 72px" }}>
                    <div className="font-cinzel" style={{ fontSize: 9, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 18 }}>Security</div>
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "rgba(232,224,208,0.25)", textTransform: "uppercase" }}>Vault Health</div>
                        <div className="grid grid-cols-3 gap-2">
                          {([["Active", activeEntries.length], ["Favorites", favoritesCount], ["Weak", weakCount], ["Reused", reusedEntriesCount], ["Duplicates", duplicateCount], ["Trash", trashEntries.length]] as [string, number][]).map(([label, val]) => (
                            <div key={label} style={{ padding: "9px 11px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                              <div style={{ fontSize: 8, color: "rgba(232,224,208,0.22)", textTransform: "uppercase", letterSpacing: "0.18em" }}>{label}</div>
                              <div className="font-cinzel" style={{ fontSize: 19, color: "rgba(232,224,208,0.58)", marginTop: 2 }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {[["Weak", () => { setView("active"); clearFilters(); setShowWeakOnly(true); }], ["Reused", () => { setView("active"); clearFilters(); setShowReusedOnly(true); }], ["Duplicates", () => { setView("active"); clearFilters(); setShowDuplicatesOnly(true); }], ["Trash", () => setView("trash")], ["Clear", clearFilters]].map(([label, action]: any) => (
                            <button key={label} onClick={action} className="hover:brightness-125 transition-[filter]" style={{ padding: "4px 11px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.38)" }}>{label}</button>
                          ))}
                          <button onClick={() => setShowReusedGroups((v) => !v)} disabled={reusedEntriesCount === 0} className="hover:brightness-125 transition-[filter] disabled:opacity-30" style={{ padding: "4px 11px", fontSize: 10, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.38)" }}>
                            {showReusedGroups ? "Hide reused" : "Reused groups"}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "rgba(232,224,208,0.25)", textTransform: "uppercase" }}>Password Generator</div>
                        <div style={{ padding: "13px 15px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }} className="space-y-3">
                          <div className="flex items-center gap-3">
                            <span style={{ fontSize: 11, color: "rgba(232,224,208,0.35)", width: 42 }}>Length</span>
                            <input type="range" min={8} max={40} value={genLength} onChange={(e) => setGenLength(Number(e.target.value))} className="flex-1 accent-white" />
                            <span style={{ fontSize: 11, color: "rgba(232,224,208,0.52)", width: 18, textAlign: "right" }}>{genLength}</span>
                          </div>
                          <div className="flex flex-wrap gap-4">
                            {([["lower", genLower, setGenLower, "lower"], ["upper", genUpper, setGenUpper, "UPPER"], ["numbers", genNumbers, setGenNumbers, "123"], ["symbols", genSymbols, setGenSymbols, "!@#"]] as any[]).map(([key, val, setter, label]) => (
                              <label key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(232,224,208,0.38)", cursor: "pointer" }}>
                                <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} className="accent-white" />{label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <input value={genValue} readOnly className="focus:outline-none font-mono w-full" style={{ padding: "9px 13px", fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.68)" }} placeholder="Click Generate…" />
                        <div className="flex gap-2">
                          <button onClick={regenerate} className="hover:brightness-125 transition-[filter]" style={{ padding: "6px 13px", fontSize: 11, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Generate</button>
                          <button onClick={async () => { if (!genValue) return; await navigator.clipboard.writeText(genValue); setStatus("Generated password copied ✅"); }} disabled={!genValue} className="hover:brightness-125 transition-[filter] disabled:opacity-40" style={{ padding: "6px 13px", fontSize: 11, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(232,224,208,0.45)" }}>Copy</button>
                          <button onClick={() => setPassword(genValue)} disabled={!genValue} className="font-cinzel hover:brightness-125 transition-[filter] disabled:opacity-40" style={{ padding: "6px 13px", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.70)" }}>Use in form</button>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}

        </div>
        {/* ── Undo Toast ─────────────────────────────────────────────── */}
        {unlocked && undoToast?.active && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2"
            style={{
              width: "min(640px, calc(100% - 32px))",
              padding: "14px 20px",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(10,10,10,0.96)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 8px 48px rgba(0,0,0,0.70)",
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <span style={{ fontSize: 12, color: "rgba(232,224,208,0.55)" }}>
                Moved <span style={{ color: "#e8e0d0" }}>{undoToast.count}</span> item{undoToast.count === 1 ? "" : "s"} to Trash.{" "}
                <span style={{ color: "rgba(232,224,208,0.28)" }}>(Undo in 10s)</span>
              </span>
              <button
                onClick={undoLastTrash}
                className="font-cinzel hover:brightness-125 transition-[filter] shrink-0"
                style={{ padding: "6px 16px", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.78)" }}
              >
                Undo
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}