import * as SecureStore from 'expo-secure-store';

// Only the refresh token is persisted, in the OS keychain/keystore; the access token stays in memory.
const REFRESH_TOKEN_KEY = 'ennel.refreshToken';

export function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export function writeRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export function deleteRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
