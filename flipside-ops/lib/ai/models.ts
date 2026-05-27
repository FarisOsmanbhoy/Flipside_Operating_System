// Anthropic model IDs + per-million-token prices. Prices are in USD and used by
// usage.ts to estimate cost for every call we log. Keep in sync with the
// pricing page (https://www.anthropic.com/pricing#api).

export const HAIKU = "claude-haiku-4-5-20251001";
export const SONNET = "claude-sonnet-4-6";

export type ModelId = typeof HAIKU | typeof SONNET;

type PriceUSDPerMillion = { input: number; output: number };

const PRICES: Record<ModelId, PriceUSDPerMillion> = {
  [HAIKU]: { input: 1.0, output: 5.0 },
  [SONNET]: { input: 3.0, output: 15.0 },
};

export function costUsd(
  model: ModelId,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICES[model];
  return (
    (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  );
}
