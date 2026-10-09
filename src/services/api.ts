import { HttpAdapter, type ApiAdapter } from "./adapters/http";
// The demo uses a real persistent API. Inject an alternate adapter here, never in components.
export const api: ApiAdapter = new HttpAdapter();
