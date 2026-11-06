export interface Document {
  anima: string;
  name: string;
  grid: number;
  requires: string[];
  components: Record<string, Component>;
  data: import('../../../data/core/types.ts').DataDocument & {
    instances: Record<
      string,
      { model: string; default?: boolean; values: Record<string, unknown> }
    >;
  };
  nodes: Record<string, unknown>[];
}
export interface Component {
  machine?: Record<string, unknown>;
  grid: number;
  data?: string;
  nodes: Record<string, unknown>[];
  bind: Record<string, string>;
  inputs?: Record<string, { type: string }>;
}
