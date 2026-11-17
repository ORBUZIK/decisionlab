export type Direction = 'min' | 'max';
export type Criterion = { key: string; label: string; direction: Direction; weight: number };
export type Alternative = { name: string; values: Record<string, number> };
export type Dataset = { criteria: Criterion[]; alternatives: Alternative[]; pairwise?: number[][] | null };

export type Ranked = { name: string; rank: number; score?: number; flow?: number };
export type Analysis = {
  weights: { key: string; label: string; weight: number }[];
  ahp: { weights: number[]; ci: number; cr: number; lambda_max: number; consistent: boolean } | null;
  topsis: Ranked[];
  saw: Ranked[];
  electre: {
    ranking: Ranked[];
    edges: { source: string; target: string }[];
    concordance: number[][];
    discordance: number[][];
    thresholds: { concordance: number; discordance: number };
  };
  sensitivity: { criterion: string; factor: number; leader: string; score: number }[];
  recommendation: {
    name: string; score: number;
    reasons: { criterion: string; utility: number; weight: number }[];
    note: string;
  };
};
export type ScenarioSummary = {
  id: string; name: string; created_at: string; alternatives: number;
};
