import type { SimulateInput, SimulateOutput } from '../lib/formulas';

export async function postSimulate(input: SimulateInput): Promise<SimulateOutput> {
  const res = await fetch('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return (await res.json()) as SimulateOutput;
}
