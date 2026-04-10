export interface Runtime {
  id: string;
  name: string;
  command: string;
  version: string | null;
  path: string | null;
  isAvailable: boolean;
  detectedAt: string | null;
}
