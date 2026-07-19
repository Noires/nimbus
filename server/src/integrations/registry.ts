import { github } from "./github.js";
import { ProviderError, type Provider } from "./types.js";

const providers: Record<string, Provider> = { github };

export function providerFor(kind: string): Provider {
  const provider = providers[kind];
  if (!provider) throw new ProviderError(400, `Unknown provider '${kind}'`);
  return provider;
}
