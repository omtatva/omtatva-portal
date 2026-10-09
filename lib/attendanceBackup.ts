// Backup file format + integrity checks for attendance records. Pure
// functions; the browser (download/verify) and the restore script both use
// them so a backup made in one place can be verified in the other.
//
// Timestamps are stored as { "__ts": "<ISO>" } so nothing is lost in JSON.

export const BACKUP_VERSION = 1;

export type BackupRecord = { id: string; data: Record<string, unknown> };

export type BackupMeta = {
  version: number;
  kind: "attendance";
  backupId: string;
  createdAt: string;
  createdBy: string;
  projectId: string;
  range: { from: string; to: string };
  count: number;
  sha256: string;
};

export type BackupFile = { meta: BackupMeta; records: BackupRecord[] };

function isTimestampLike(v: unknown): v is { toDate: () => Date } {
  return !!v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function";
}

export function serializeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return { __ts: value.toISOString() };
  if (isTimestampLike(value)) return { __ts: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map((v) => serializeValue(v) ?? null);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const s = serializeValue(v);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return value;
}

export function deserializeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deserializeValue);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.__ts === "string" && Object.keys(o).length === 1) return new Date(o.__ts);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = deserializeValue(v);
    return out;
  }
  return value;
}

// Stable JSON: object keys sorted, so the same data always hashes the same.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function recordsHashInput(records: BackupRecord[]): string {
  return canonicalJson([...records].sort((a, b) => a.id.localeCompare(b.id)));
}

export async function createBackupFile(input: {
  records: { id: string; data: Record<string, unknown> }[];
  range: { from: string; to: string };
  createdBy: string;
  projectId: string;
  backupId: string;
  now?: Date;
}): Promise<BackupFile> {
  const records: BackupRecord[] = input.records
    .map((r) => ({ id: r.id, data: serializeValue(r.data) as Record<string, unknown> }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    meta: {
      version: BACKUP_VERSION,
      kind: "attendance",
      backupId: input.backupId,
      createdAt: (input.now || new Date()).toISOString(),
      createdBy: input.createdBy,
      projectId: input.projectId,
      range: input.range,
      count: records.length,
      sha256: await sha256Hex(recordsHashInput(records)),
    },
    records,
  };
}

export type VerifyResult = { ok: boolean; problems: string[] };

// Integrity of the FILE itself: parseable shape, count and hash match.
export async function verifyBackupFile(file: unknown): Promise<VerifyResult> {
  const problems: string[] = [];
  const f = file as Partial<BackupFile> | null;

  if (!f || typeof f !== "object" || !f.meta || !Array.isArray(f.records)) {
    return { ok: false, problems: ["Not a valid attendance backup file."] };
  }
  if (f.meta.kind !== "attendance") problems.push("File is not an attendance backup.");
  if (f.meta.version !== BACKUP_VERSION) problems.push(`Unsupported backup version ${f.meta.version}.`);
  if (f.meta.count !== f.records.length) {
    problems.push(`Record count mismatch: header says ${f.meta.count}, file has ${f.records.length}.`);
  }
  const ids = f.records.map((r) => r.id);
  if (new Set(ids).size !== ids.length) problems.push("File contains duplicate record ids.");

  const hash = await sha256Hex(recordsHashInput(f.records));
  if (hash !== f.meta.sha256) problems.push("Checksum mismatch — the file was altered or corrupted.");

  return { ok: problems.length === 0, problems };
}

export type LiveComparison = {
  identical: number;
  changedSinceBackup: string[];
  missingNow: string[]; // in the backup, gone from the live database
  newSinceBackup: string[]; // live records the backup does not contain
};

export function compareWithLive(
  file: BackupFile,
  live: { id: string; data: Record<string, unknown> }[]
): LiveComparison {
  const liveById = new Map(live.map((r) => [r.id, canonicalJson(serializeValue(r.data))]));
  const backupIds = new Set(file.records.map((r) => r.id));

  let identical = 0;
  const changedSinceBackup: string[] = [];
  const missingNow: string[] = [];

  for (const r of file.records) {
    const now = liveById.get(r.id);
    if (now === undefined) missingNow.push(r.id);
    else if (now === canonicalJson(r.data)) identical++;
    else changedSinceBackup.push(r.id);
  }

  const newSinceBackup = live.filter((r) => !backupIds.has(r.id)).map((r) => r.id);
  return { identical, changedSinceBackup, missingNow, newSinceBackup };
}

export type BackupMetaRecord = {
  backupId: string;
  createdAt: string;
  verifiedAt?: string | null;
  range: { from: string; to: string };
  count: number;
  sha256: string;
};

// Bulk changes are only allowed when a VERIFIED backup of the affected
// range exists and is recent.
export function bulkChangeGate(
  backups: BackupMetaRecord[],
  range: { from: string; to: string },
  now: Date = new Date(),
  maxAgeHours = 24
): { allowed: boolean; reason: string } {
  const candidates = backups.filter(
    (b) => b.range.from <= range.from && b.range.to >= range.to
  );
  if (candidates.length === 0) {
    return { allowed: false, reason: "No backup covers this date range. Create and verify one first." };
  }
  const verified = candidates.filter((b) => !!b.verifiedAt);
  if (verified.length === 0) {
    return { allowed: false, reason: "A backup exists but has not been verified yet. Verify the downloaded file first." };
  }
  const fresh = verified.filter((b) => now.getTime() - new Date(b.createdAt).getTime() <= maxAgeHours * 3600000);
  if (fresh.length === 0) {
    return { allowed: false, reason: `The latest verified backup is older than ${maxAgeHours} hours. Create a fresh one.` };
  }
  return { allowed: true, reason: "A fresh, verified backup covers this range." };
}
