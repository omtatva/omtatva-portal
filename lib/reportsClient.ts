"use client";

// Browser helpers for the Super-Admin-only report API. Every request carries
// the signed-in user's Firebase ID token; the server decides what that user
// may see (a non-Super-Admin gets 403 no matter what the page shows).

import { auth } from "./firebase";

export class ApiClientError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ApiClientError(401, "unauthenticated", "You are signed out. Please sign in again.");

  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    let message = "The request failed. Please try again.";
    let code = "error";
    try {
      const data = await res.json();
      message = data?.error?.message || message;
      code = data?.error?.code || code;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiClientError(res.status, code, message);
  }
  return res;
}

export async function getJson<T>(path: string): Promise<T> {
  return (await authedFetch(path, { cache: "no-store" })).json() as Promise<T>;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Downloads a server-generated CSV. Returns the number of data rows the
// server says it wrote (for a cross-check against the on-screen report).
export async function downloadServerCsv(path: string, fallbackName: string): Promise<{ rows: number; filename: string }> {
  const res = await authedFetch(path, { cache: "no-store" });
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="([A-Za-z0-9_.-]+)"/.exec(disposition);
  const filename = match ? match[1] : fallbackName;
  triggerDownload(await res.blob(), filename);
  return { rows: Number(res.headers.get("X-Row-Count") || "-1"), filename };
}
