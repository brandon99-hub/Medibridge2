declare module 'circomlibjs' {
  export function buildPoseidon(): Promise<{
    F: any;
    (inputs: bigint[]): bigint;
  }>;
} 