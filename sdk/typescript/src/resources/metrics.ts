import type { DogData } from '../client.js';
import type { MetricsUtxo, HolderConcentration, RealizedCap } from '../types.js';

export class MetricsResource {
  constructor(private client: DogData) {}

  async utxo(): Promise<MetricsUtxo> {
    return this.client.request<MetricsUtxo>('/api/metrics/utxo');
  }

  async holderConcentration(): Promise<HolderConcentration> {
    return this.client.request<HolderConcentration>('/api/metrics/holder-concentration');
  }

  async realizedCap(): Promise<RealizedCap> {
    return this.client.request<RealizedCap>('/api/metrics/realized-cap');
  }

  async all(): Promise<{
    utxo: MetricsUtxo;
    concentration: HolderConcentration;
    realizedCap: RealizedCap;
  }> {
    const [utxo, concentration, realizedCap] = await Promise.all([
      this.utxo(),
      this.holderConcentration(),
      this.realizedCap(),
    ]);
    return { utxo, concentration, realizedCap };
  }
}
