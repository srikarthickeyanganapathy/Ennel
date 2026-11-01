// Web build only: like the refresh token, receipts stay in memory, so a reload forgets them.
const receipts = new Map<string, string[]>();

export function readReceipts(studentId: string): Promise<string[]> {
  return Promise.resolve(receipts.get(studentId) ?? []);
}

export function addReceipt(studentId: string, token: string): Promise<void> {
  const current = receipts.get(studentId) ?? [];
  receipts.set(studentId, [token, ...current.filter((item) => item !== token)]);
  return Promise.resolve();
}
