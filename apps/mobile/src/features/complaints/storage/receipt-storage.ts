import * as SecureStore from 'expo-secure-store';

/**
 * Anonymous reports can only be found again with their receipt token (ADR-0008), so the tokens
 * stay on this phone in the keychain/keystore, per student, and are never sent anywhere else.
 */
const MAX_RECEIPTS = 40;
const keyFor = (studentId: string) => `ennel.complaintReceipts.${studentId}`;

export async function readReceipts(studentId: string): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(keyFor(studentId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function addReceipt(studentId: string, token: string): Promise<void> {
  const receipts = await readReceipts(studentId);
  const next = [token, ...receipts.filter((item) => item !== token)].slice(0, MAX_RECEIPTS);
  await SecureStore.setItemAsync(keyFor(studentId), JSON.stringify(next));
}
