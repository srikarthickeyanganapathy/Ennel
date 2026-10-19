import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestActor {
  type: 'STUDENT' | 'STAFF';
  id: string;
  roles: string[];
}

/** Per-request data for logging and audit entries (Admin §P). */
export interface RequestContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
  actor?: RequestActor;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
