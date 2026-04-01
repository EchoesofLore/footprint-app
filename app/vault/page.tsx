"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
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
      {/* Scrim so panels read as embedded, not floating */}
      <div className="min-h-screen" style={{ background: "rgba(10,10,10,0.75)" }}>

        {/* ── Control bar ─────────────────────────────────────────────── */}
        <div className="border-b border-white/5 px-6 py-3" style={{ background: "rgba(10,10,10,0.6)", backdropFilter: "blur(12px)" }}>
          <div className="max-w-[1400px] mx-auto flex flex-wrap gap-3 items-center">
            <span className="font-cinzel text-[#c8922a] text-xs tracking-[0.2em] uppercase mr-2">Footprint</span>

            {!unlocked ? (
              <>
                <input
                  type="password"
                  placeholder="Master password"
                  autoFocus
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setUnlockClicks(c => c + 1); handleUnlock(); } }}
                  className="px-3 py-1.5 text-sm text-[#e8e0d0] placeholder-[#e8e0d0]/30 border border-white/10 focus:outline-none focus:border-white/20"
                  style={{ background: "rgba(255,255,255,0.04)", minWidth: "220px" }}
                />
                <button
                  type="button"
                  onClick={() => { setUnlockClicks(c => c + 1); handleUnlock(); }}
                  className="font-cinzel px-4 py-1.5 text-xs tracking-widest uppercase border border-[#c8922a]/50 text-[#c8922a] hover:brightness-125 transition-[filter]"
                >
                  Unlock
                </button>
              </>
            ) : (
              <>
                <button onClick={() => saveVault(vault)} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/60 hover:brightness-125 transition-[filter]">Save</button>
                <button onClick={handleLock} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/60 hover:brightness-125 transition-[filter]">Lock</button>
                <button onClick={copyAutofillJson} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/60 hover:brightness-125 transition-[filter]">Copy Autofill JSON</button>
                <label className="text-xs flex items-center gap-2 border border-white/10 px-3 py-1.5 text-[#e8e0d0]/60">
                  <input type="checkbox" checked={idleLockEnabled} onChange={(e) => setIdleLockEnabled(e.target.checked)} />
                  auto-lock
                </label>
                <label className="text-xs flex items-center gap-2 border border-white/10 px-3 py-1.5 text-[#e8e0d0]/60">
                  min
                  <input type="number" min={1} max={120} value={idleMinutes} onChange={(e) => setIdleMinutes(Number(e.target.value))} className="w-12 bg-transparent text-center border border-white/10 px-1" disabled={!idleLockEnabled} />
                </label>
              </>
            )}

            <span className="ml-auto text-xs text-[#e8e0d0]/35">
              {unlocked ? "Unlocked" : "Locked"}
              {status && <span className="ml-2 text-[#c8922a]/60">{status}</span>}
            </span>
          </div>
        </div>

        {/* ── Panel grid ──────────────────────────────────────────────── */}
        <div className="max-w-[1400px] mx-auto p-6 space-y-4">

          {/* ── Primary panel: Vault ────────────────────────────────── */}
          <section
            className="border border-white/5 hover:brightness-[1.03] transition-[filter] duration-300"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            {/* Panel header */}
            <div className="px-6 py-4 border-b border-white/5 flex flex-wrap gap-3 items-center justify-between">
              <h2 className="font-cinzel text-[#e8e0d0] text-xs tracking-[0.22em] uppercase">Vault</h2>
              {unlocked && (
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={() => setView("active")} className={`px-3 py-1 text-xs border ${view === "active" ? "border-[#c8922a]/40 text-[#c8922a]" : "border-white/10 text-[#e8e0d0]/40"} hover:brightness-125 transition-[filter]`}>
                    Active ({activeEntries.length})
                  </button>
                  <button onClick={() => setView("trash")} className={`px-3 py-1 text-xs border ${view === "trash" ? "border-[#c8922a]/40 text-[#c8922a]" : "border-white/10 text-[#e8e0d0]/40"} hover:brightness-125 transition-[filter]`}>
                    Trash ({trashEntries.length})
                  </button>
                  {view === "trash" && trashEntries.length > 0 && (
                    <button onClick={emptyTrash} className="px-3 py-1 text-xs border border-white/10 text-[#e8e0d0]/40 hover:brightness-125 transition-[filter]">Empty Trash</button>
                  )}
                  <button onClick={() => selectAll(listToRender.map((e) => e.id))} className="px-3 py-1 text-xs border border-white/10 text-[#e8e0d0]/40 hover:brightness-125 transition-[filter]" disabled={!listToRender.length}>Select all</button>
                  <button onClick={deselectAll} className="px-3 py-1 text-xs border border-white/10 text-[#e8e0d0]/40 hover:brightness-125 transition-[filter]" disabled={selectedIds.size === 0}>Deselect</button>
                </div>
              )}
            </div>

            <div className="p-6 space-y-4">

              {/* Bulk actions */}
              {unlocked && selectedIds.size > 0 && (
                <div className="p-3 border border-white/5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="text-[10px] font-cinzel tracking-widest uppercase text-[#e8e0d0]/35">
                    Bulk — {selectedIds.size} selected
                  </div>
                  {view === "active" ? (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={bulkTrashSelected} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]">Trash</button>
                      <button onClick={() => bulkSetFavorite(true)} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]">Favorite</button>
                      <button onClick={() => bulkSetFavorite(false)} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]">Unfavorite</button>
                      <input placeholder="Set category…" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="px-2 py-1 text-xs border border-white/10 text-[#e8e0d0] placeholder-[#e8e0d0]/25" style={{ background: "rgba(255,255,255,0.04)" }} />
                      <button onClick={bulkSetCategory} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]">Apply category</button>
                      <input placeholder="Add tags (comma separated)" value={bulkTagsInput} onChange={(e) => setBulkTagsInput(e.target.value)} className="px-2 py-1 text-xs border border-white/10 text-[#e8e0d0] placeholder-[#e8e0d0]/25" style={{ background: "rgba(255,255,255,0.04)" }} />
                      <button onClick={bulkAddTags} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]">Add tags</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={bulkRestoreSelected} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]">Restore</button>
                      <button onClick={() => deletePermanentlySelected(Array.from(selectedIds))} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]">Delete permanently</button>
                    </div>
                  )}
                </div>
              )}

              {/* Search + Filters */}
              <div className="space-y-2">
                <input
                  placeholder={view === "trash" ? "Search trash…" : "Search vault…"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-[#e8e0d0] placeholder-[#e8e0d0]/25 border border-white/10 focus:outline-none focus:border-white/20"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                  disabled={!unlocked}
                />
                {view === "active" && (
                  <div className="flex flex-wrap gap-2">
                    <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="px-2 py-1 text-xs border border-white/10 text-[#e8e0d0]/55 bg-transparent" disabled={!unlocked}>
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="az">A → Z</option>
                      <option value="za">Z → A</option>
                    </select>
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-2 py-1 text-xs border border-white/10 text-[#e8e0d0]/55 bg-transparent" disabled={!unlocked}>
                      <option value="__all__">All Categories</option>
                      {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="px-2 py-1 text-xs border border-white/10 text-[#e8e0d0]/55 bg-transparent" disabled={!unlocked}>
                      <option value="__all__">All Tags</option>
                      {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {[["favoritesOnly", favoritesOnly, setFavoritesOnly, "Favorites"], ["showReusedOnly", showReusedOnly, setShowReusedOnly, "Reused"], ["showWeakOnly", showWeakOnly, setShowWeakOnly, "Weak"], ["showDuplicatesOnly", showDuplicatesOnly, setShowDuplicatesOnly, "Duplicates"]].map(([key, val, setter, label]: any) => (
                      <label key={key} className="text-xs flex items-center gap-1.5 border border-white/10 px-2 py-1 text-[#e8e0d0]/50">
                        <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} disabled={!unlocked} />
                        {label}
                      </label>
                    ))}
                    {(search || tagFilter !== "__all__" || categoryFilter !== "__all__" || favoritesOnly || showReusedOnly || showWeakOnly || showDuplicatesOnly) && (
                      <button onClick={clearFilters} className="px-3 py-1 text-xs border border-white/10 text-[#e8e0d0]/40 hover:brightness-125 transition-[filter]" disabled={!unlocked}>Clear</button>
                    )}
                  </div>
                )}
                <div className="text-[10px] text-[#e8e0d0]/25 tracking-wider">
                  {view === "active"
                    ? `${filteredActiveEntries.length} of ${activeEntries.length} entries`
                    : `${filteredTrashEntries.length} of ${trashEntries.length} trashed`}
                </div>
              </div>

              {/* Add/Edit Entry */}
              <div ref={addEntryRef} className="border border-white/5 p-4 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="text-[10px] font-cinzel tracking-[0.2em] uppercase text-[#e8e0d0]/35">
                  {editingId ? "Edit entry" : "Add entry"}
                </div>
                <input placeholder="Site (or URL)" value={site} onChange={(e) => setSite(e.target.value)} className="w-full px-3 py-2 text-sm text-[#e8e0d0] placeholder-[#e8e0d0]/25 border border-white/10 focus:outline-none focus:border-white/20" style={{ background: "rgba(255,255,255,0.04)" }} disabled={!unlocked} />
                <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 text-sm text-[#e8e0d0] placeholder-[#e8e0d0]/25 border border-white/10 focus:outline-none focus:border-white/20" style={{ background: "rgba(255,255,255,0.04)" }} disabled={!unlocked} />
                <div className="space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <input placeholder="Password" type={showFormPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 text-sm text-[#e8e0d0] placeholder-[#e8e0d0]/25 border border-white/10 focus:outline-none focus:border-white/20" style={{ background: "rgba(255,255,255,0.04)" }} disabled={!unlocked} />
                    <button type="button" onClick={() => setShowFormPassword((v) => !v)} className="px-3 py-2 text-xs border border-white/10 text-[#e8e0d0]/50 hover:brightness-125 transition-[filter]" disabled={!unlocked}>{showFormPassword ? "Hide" : "Show"}</button>
                  </div>
                  {unlocked && password.length > 0 && (
                    <div className="text-xs text-[#e8e0d0]/50">
                      Strength: <span className="text-[#e8e0d0]/80">{strengthTyped.label}</span> ({strengthTyped.score}/4)
                      {strengthTyped.score <= 1 && <span className="ml-2 text-amber-400/70">⚠ weak</span>}
                    </div>
                  )}
                  {unlocked && password.length > 0 && reuseForTypedPassword > 0 && (
                    <div className="text-xs text-amber-400/70">⚠ Reused in {reuseForTypedPassword} other entr{reuseForTypedPassword === 1 ? "y" : "ies"}.</div>
                  )}
                  {unlocked && typedDupCount > 0 && (
                    <div className="text-xs text-amber-400/70">⚠ Duplicate site + username exists.</div>
                  )}
                  {unlocked && site.trim() && (
                    <div className="text-xs text-[#e8e0d0]/30">Domain: {extractDomain(site.trim()) ?? "none"}</div>
                  )}
                </div>
                <input placeholder="Category" value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} className="w-full px-3 py-2 text-sm text-[#e8e0d0] placeholder-[#e8e0d0]/25 border border-white/10 focus:outline-none focus:border-white/20" style={{ background: "rgba(255,255,255,0.04)" }} disabled={!unlocked} />
                <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 text-sm text-[#e8e0d0] placeholder-[#e8e0d0]/25 border border-white/10 focus:outline-none focus:border-white/20" style={{ background: "rgba(255,255,255,0.04)" }} disabled={!unlocked} />
                <input placeholder="Tags (comma separated)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="w-full px-3 py-2 text-sm text-[#e8e0d0] placeholder-[#e8e0d0]/25 border border-white/10 focus:outline-none focus:border-white/20" style={{ background: "rgba(255,255,255,0.04)" }} disabled={!unlocked} />
                <div className="flex gap-2 pt-1">
                  <button onClick={addOrUpdateEntry} className={`font-cinzel px-4 py-2 text-xs tracking-wider uppercase ${unlocked ? "border border-[#c8922a]/50 text-[#c8922a] hover:brightness-125 transition-[filter]" : "border border-white/10 text-[#e8e0d0]/25 cursor-not-allowed"}`} disabled={!unlocked}>
                    {editingId ? "Save changes" : "Add entry"}
                  </button>
                  {editingId && <button onClick={cancelEdit} className="px-4 py-2 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]">Cancel</button>}
                </div>
              </div>

              {/* Entries */}
              <div className="space-y-2">
                {!unlocked ? (
                  <div className="py-12 text-center text-xs font-cinzel tracking-[0.2em] uppercase text-[#e8e0d0]/20">
                    Enter master password to unlock
                  </div>
                ) : listToRender.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#e8e0d0]/30">
                    {view === "trash" ? "Trash is empty." : "No results."}
                  </div>
                ) : (
                  (() => {
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
                  })()
                )}
              </div>
            </div>
          </section>

          {/* ── Secondary panels ────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── Footprints panel ──────────────────────────────── */}
            <section
              className="border border-white/5 hover:brightness-[1.03] transition-[filter] duration-300"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <div className="px-6 py-4 border-b border-white/5">
                <h2 className="font-cinzel text-[#e8e0d0] text-xs tracking-[0.22em] uppercase">Footprints</h2>
              </div>
              <div className="p-6 space-y-6">

                {/* Backup */}
                <div className="space-y-3">
                  <div className="text-[10px] font-cinzel tracking-[0.2em] uppercase text-[#e8e0d0]/35">Backup</div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={exportEncryptedBackup} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]" disabled={!unlocked}>Export encrypted backup</button>
                    <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]" disabled={!unlocked}>Import file</button>
                    <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
                  </div>
                  {importError && <div className="text-xs text-red-400/65 p-2 border border-white/5">{importError}</div>}
                  {importPreview && (
                    <div className="p-3 border border-white/5 space-y-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <div className="text-[10px] font-cinzel tracking-wider uppercase text-[#e8e0d0]/35">Import preview</div>
                      <div className="text-xs text-[#e8e0d0]/55">
                        {importPreview.entriesCount} entries · {importPreview.tagsCount} tags · {importPreview.categoriesCount} categories
                      </div>
                      <div className="text-xs text-[#e8e0d0]/45">
                        Reused: {importPreview.reusedCount} · Weak: {importPreview.weakCount}
                        {importPreview.dupSiteUserCount > 0 && ` · Collisions: ${importPreview.dupSiteUserCount}`}
                      </div>
                      <div className="flex gap-2 flex-wrap items-center pt-1">
                        <select value={importMode} onChange={(e) => setImportMode(e.target.value as any)} className="px-2 py-1 text-xs border border-white/10 text-[#e8e0d0]/55 bg-transparent" disabled={!unlocked}>
                          <option value="merge">Merge</option>
                          <option value="overwrite">Overwrite</option>
                        </select>
                        <button onClick={confirmImport} className="font-cinzel px-3 py-1.5 text-xs border border-[#c8922a]/50 text-[#c8922a] hover:brightness-125 transition-[filter]" disabled={!unlocked || !importDecryptedVault}>Confirm</button>
                        <button onClick={resetImportState} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* CSV Import */}
                <div className="space-y-2">
                  <div className="text-[10px] font-cinzel tracking-[0.2em] uppercase text-[#e8e0d0]/35">CSV Import</div>
                  <div className="text-xs text-[#e8e0d0]/30">Format: <span className="font-mono">site,username,password,notes,category,tags</span></div>
                  <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={`example.com,user@email.com,Password123!,note,Finance,bank`} className="w-full h-28 px-3 py-2 text-xs font-mono text-[#e8e0d0]/70 placeholder-[#e8e0d0]/20 border border-white/10 focus:outline-none focus:border-white/20" style={{ background: "rgba(255,255,255,0.04)" }} disabled={!unlocked} />
                  {csvPreview && <div className="text-xs text-[#e8e0d0]/45">Rows: {csvPreview.rows} · OK: {csvPreview.ok} · Bad: {csvPreview.bad}</div>}
                  <div className="flex gap-2">
                    <button onClick={importCsvIntoVault} className="font-cinzel px-3 py-1.5 text-xs border border-[#c8922a]/50 text-[#c8922a] hover:brightness-125 transition-[filter]" disabled={!unlocked || !csvText.trim()}>Import CSV</button>
                    <button onClick={() => { setCsvText(""); setCsvPreview(null); }} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]" disabled={!unlocked || (!csvText.trim() && !csvPreview)}>Clear</button>
                  </div>
                </div>

                {/* Reused groups (shown here when active) */}
                {unlocked && view === "active" && showReusedGroups && reusedGroups.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-cinzel tracking-[0.2em] uppercase text-[#e8e0d0]/35">Reused groups</div>
                    <div className="text-xs text-[#e8e0d0]/30">Entries sharing identical passwords. Edit each to generate unique ones.</div>
                    <div className="space-y-2">
                      {reusedGroups.map((g, idx) => (
                        <div key={idx} className="p-3 border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div className="text-[10px] text-[#e8e0d0]/30 mb-2">Group size: {g.entries.length}</div>
                          <div className="space-y-2">
                            {g.entries.map((e) => (
                              <div key={e.id} className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="text-sm text-[#e8e0d0]/75">{e.site}</div>
                                  <div className="text-xs text-[#e8e0d0]/40">{e.username}</div>
                                </div>
                                <div className="flex gap-1.5">
                                  <button onClick={() => startEdit(e)} className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]">Edit</button>
                                  <button onClick={() => duplicateEntry(e)} className="px-2.5 py-1 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]">Duplicate</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Security panel ────────────────────────────────── */}
            <section
              className="border border-white/5 hover:brightness-[1.03] transition-[filter] duration-300"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <div className="px-6 py-4 border-b border-white/5">
                <h2 className="font-cinzel text-[#e8e0d0] text-xs tracking-[0.22em] uppercase">Security</h2>
              </div>
              <div className="p-6 space-y-6">

                {/* Vault Health */}
                {unlocked && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-cinzel tracking-[0.2em] uppercase text-[#e8e0d0]/35">Vault Health</div>
                    <div className="grid grid-cols-3 gap-2">
                      {([["Active", activeEntries.length], ["Favorites", favoritesCount], ["Weak", weakCount], ["Reused", reusedEntriesCount], ["Duplicates", duplicateCount], ["Trash", trashEntries.length]] as [string, number][]).map(([label, val]) => (
                        <div key={label} className="p-2 border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div className="text-[9px] text-[#e8e0d0]/25 uppercase tracking-widest">{label}</div>
                          <div className="text-xl font-cinzel text-[#e8e0d0]/65 mt-0.5">{val}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => { setView("active"); setShowWeakOnly(true); setShowReusedOnly(false); setShowDuplicatesOnly(false); }} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]">Weak</button>
                      <button onClick={() => { setView("active"); setShowReusedOnly(true); setShowWeakOnly(false); setShowDuplicatesOnly(false); }} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]">Reused</button>
                      <button onClick={() => { setView("active"); setShowDuplicatesOnly(true); setShowWeakOnly(false); setShowReusedOnly(false); }} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]">Duplicates</button>
                      <button onClick={() => setView("trash")} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]">Trash</button>
                      <button onClick={clearFilters} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]">Clear filters</button>
                      <button onClick={() => setShowReusedGroups((v) => !v)} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/45 hover:brightness-125 transition-[filter]" disabled={reusedEntriesCount === 0}>
                        {showReusedGroups ? "Hide reused groups" : "Reused groups"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Password Generator */}
                <div className="space-y-3">
                  <div className="text-[10px] font-cinzel tracking-[0.2em] uppercase text-[#e8e0d0]/35">Password Generator</div>
                  <div className="border border-white/5 px-4 py-3 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#e8e0d0]/40">Length</span>
                      <input type="range" min={8} max={40} value={genLength} onChange={(e) => setGenLength(Number(e.target.value))} className="flex-1 accent-[#c8922a]" disabled={!unlocked} />
                      <span className="text-xs text-[#e8e0d0]/55 w-6 text-right">{genLength}</span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {[["lower", genLower, setGenLower, "lower"], ["upper", genUpper, setGenUpper, "UPPER"], ["numbers", genNumbers, setGenNumbers, "123"], ["symbols", genSymbols, setGenSymbols, "!@#"]].map(([key, val, setter, label]: any) => (
                        <label key={key} className="text-xs flex items-center gap-1.5 text-[#e8e0d0]/45">
                          <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} disabled={!unlocked} className="accent-[#c8922a]" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <input value={genValue} readOnly className="w-full px-3 py-2 text-sm font-mono text-[#e8e0d0]/75 border border-white/10 focus:outline-none" style={{ background: "rgba(255,255,255,0.04)" }} placeholder="Click Generate…" />
                  <div className="flex gap-2">
                    <button onClick={regenerate} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]" disabled={!unlocked}>Generate</button>
                    <button onClick={async () => { if (!genValue) return; await navigator.clipboard.writeText(genValue); setStatus("Generated password copied ✅"); }} className="px-3 py-1.5 text-xs border border-white/10 text-[#e8e0d0]/55 hover:brightness-125 transition-[filter]" disabled={!unlocked || !genValue}>Copy</button>
                    <button onClick={() => setPassword(genValue)} className="font-cinzel px-3 py-1.5 text-xs border border-[#c8922a]/50 text-[#c8922a] hover:brightness-125 transition-[filter]" disabled={!unlocked || !genValue}>Use in form</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ── Undo Toast ──────────────────────────────────────────────── */}
        {unlocked && undoToast?.active && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(700px,calc(100%-24px))] p-3 border border-white/10 backdrop-blur" style={{ background: "rgba(10,10,10,0.92)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-[#e8e0d0]/60">
                Moved <span className="text-[#e8e0d0]">{undoToast.count}</span> item{undoToast.count === 1 ? "" : "s"} to Trash.
                <span className="text-[#e8e0d0]/30 ml-2">(Undo in 10s)</span>
              </div>
              <button onClick={undoLastTrash} className="font-cinzel px-3 py-1.5 text-xs border border-[#c8922a]/50 text-[#c8922a] hover:brightness-125 transition-[filter]">Undo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}