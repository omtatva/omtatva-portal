// Read-only DNS checks for the sending domain. DNS can show that the records
// EXIST; it cannot prove that mail will reach an inbox or that the provider
// has verified the domain, so every result is reported honestly as
// ok / warning / missing / unknown.

export type DnsStatus = "ok" | "warning" | "missing" | "unknown";
export type DnsItem = { id: "spf" | "dkim" | "dmarc" | "return-path"; label: string; status: DnsStatus; detail: string };

export interface Resolver {
  resolveTxt(name: string): Promise<string[][]>;
  resolveCname(name: string): Promise<string[]>;
}

const txt = async (r: Resolver, name: string): Promise<string[] | null> => {
  try {
    return (await r.resolveTxt(name)).map((parts) => parts.join(""));
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "ENODATA") return [];
    return null; // could not ask
  }
};

export async function checkEmailDns(
  domain: string,
  resolver: Resolver,
  opts: { spfInclude?: string; dkimSelector?: string; returnPathHost?: string } = {}
): Promise<DnsItem[]> {
  const spfInclude = opts.spfInclude || "spf.mtasv.net"; // Postmark
  const items: DnsItem[] = [];
  if (!domain) return [{ id: "spf", label: "SPF", status: "unknown", detail: "EMAIL_FROM is not set, so there is no domain to check." }];

  // SPF
  const root = await txt(resolver, domain);
  if (root === null) items.push({ id: "spf", label: "SPF", status: "unknown", detail: "DNS could not be queried from the server." });
  else {
    const spf = root.filter((r) => r.toLowerCase().startsWith("v=spf1"));
    if (spf.length === 0) items.push({ id: "spf", label: "SPF", status: "missing", detail: `No SPF record on ${domain}. Add: v=spf1 include:${spfInclude} ~all (merge with any existing SPF record — a domain may have only one).` });
    else if (spf.length > 1) items.push({ id: "spf", label: "SPF", status: "warning", detail: "More than one SPF record exists — receivers treat that as an error. Merge them into one." });
    else if (!spf[0].includes(`include:${spfInclude}`)) items.push({ id: "spf", label: "SPF", status: "warning", detail: `SPF exists but does not include ${spfInclude}. (Not required for DMARC if DKIM aligns, but recommended.)` });
    else items.push({ id: "spf", label: "SPF", status: "ok", detail: `SPF record includes ${spfInclude}.` });
  }

  // DKIM
  if (!opts.dkimSelector) {
    items.push({ id: "dkim", label: "DKIM", status: "unknown", detail: "Set EMAIL_DKIM_SELECTOR (shown in your provider's domain page) so the DKIM key can be checked." });
  } else {
    const d = await txt(resolver, `${opts.dkimSelector}._domainkey.${domain}`);
    if (d === null) items.push({ id: "dkim", label: "DKIM", status: "unknown", detail: "DNS could not be queried from the server." });
    else if (d.some((r) => /p=[A-Za-z0-9+/=]{20,}/.test(r))) items.push({ id: "dkim", label: "DKIM", status: "ok", detail: `A DKIM public key is published at ${opts.dkimSelector}._domainkey.${domain}.` });
    else items.push({ id: "dkim", label: "DKIM", status: "missing", detail: `No DKIM key at ${opts.dkimSelector}._domainkey.${domain}. Copy the record from your provider's domain page.` });
  }

  // DMARC
  const dm = await txt(resolver, `_dmarc.${domain}`);
  if (dm === null) items.push({ id: "dmarc", label: "DMARC", status: "unknown", detail: "DNS could not be queried from the server." });
  else {
    const rec = dm.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
    if (!rec) items.push({ id: "dmarc", label: "DMARC", status: "missing", detail: `No DMARC record. Add a TXT record at _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:dmarc@${domain}` });
    else {
      const policy = /;\s*p=(none|quarantine|reject)/i.exec(rec.replace(/^v=dmarc1/i, "v=DMARC1;"))?.[1]?.toLowerCase();
      if (policy === "none") items.push({ id: "dmarc", label: "DMARC", status: "warning", detail: "DMARC exists in monitoring mode (p=none). Fine to start; move to quarantine/reject once reports show mail passing." });
      else if (policy) items.push({ id: "dmarc", label: "DMARC", status: "ok", detail: `DMARC policy is p=${policy}. Alignment holds when the From domain matches the DKIM signing domain.` });
      else items.push({ id: "dmarc", label: "DMARC", status: "warning", detail: "A DMARC record exists but its policy (p=) could not be read." });
    }
  }

  // Custom return-path (bounce) domain — needed for SPF alignment
  if (opts.returnPathHost) {
    try {
      const c = await resolver.resolveCname(opts.returnPathHost);
      items.push({ id: "return-path", label: "Return-Path", status: c.length ? "ok" : "missing", detail: c.length ? `${opts.returnPathHost} points to ${c[0]}.` : `No CNAME at ${opts.returnPathHost}.` });
    } catch {
      items.push({ id: "return-path", label: "Return-Path", status: "missing", detail: `No CNAME at ${opts.returnPathHost}. Optional, but it makes SPF align with your From domain.` });
    }
  }
  return items;
}
