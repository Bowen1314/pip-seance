// Append-only spend ledger. One line per model call, written the moment the
// step finishes, so a worker killed mid-seance still leaves an exact bill.
import fs from 'node:fs';
import path from 'node:path';
import { LEDGER } from './config.js';

export type Price = { prompt: number; completion: number }; // USD per token

let priceCache: Record<string, Price> | null = null;

export async function prices(): Promise<Record<string, Price>> {
  if (priceCache) return priceCache;
  const key = process.env.NEBIUS_API_KEY;
  if (!key) throw new Error('NEBIUS_API_KEY is not set');
  const r = await fetch('https://api.tokenfactory.nebius.com/v1/models?verbose=true', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`Nebius /v1/models: HTTP ${r.status}`);
  const body = (await r.json()) as { data: { id: string; pricing?: { prompt: string; completion: string } }[] };
  priceCache = {};
  for (const m of body.data) {
    if (m.pricing) priceCache[m.id] = { prompt: Number(m.pricing.prompt), completion: Number(m.pricing.completion) };
  }
  return priceCache;
}

export function total(): number {
  if (!fs.existsSync(LEDGER)) return 0;
  return fs
    .readFileSync(LEDGER, 'utf8')
    .split('\n')
    .filter(Boolean)
    .reduce((s, l) => s + (JSON.parse(l).usd ?? 0), 0);
}

export function record(row: {
  run: string; model: string; step: number; input_tokens: number; output_tokens: number; usd: number; note?: string;
}) {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.appendFileSync(LEDGER, JSON.stringify({ ts: new Date().toISOString(), ...row }) + '\n');
}
