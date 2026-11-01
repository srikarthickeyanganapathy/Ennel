import type React from 'react';

// In-memory SecureStore so token persistence runs in tests.
const mockSecureStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStore.delete(key);
  }),
}));

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  dismissTo: jest.fn(),
  back: jest.fn(),
};

/** The last `usePreventRemove` registration, so tests can check the unsaved-changes guard. */
export const mockPreventRemove: { isActive: boolean; onRemove: ((event: unknown) => void) | null } =
  {
    isActive: false,
    onRemove: null,
  };
export const mockNavigation = { dispatch: jest.fn() };

/** Whether the screen under test is the focused route; set false to model a screen under the stack. */
export const mockFocus = { isFocused: true };

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof React>('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect: () => void) =>
      useEffect(() => {
        if (mockFocus.isFocused) effect();
      }, [effect]),
    Redirect: () => null,
    useNavigation: () => mockNavigation,
    usePreventRemove: (isActive: boolean, onRemove: (event: unknown) => void) => {
      mockPreventRemove.isActive = isActive;
      mockPreventRemove.onRemove = onRemove;
    },
  };
});

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

beforeEach(() => {
  mockSecureStore.clear();
  mockFocus.isFocused = true;
  mockPreventRemove.isActive = false;
  mockPreventRemove.onRemove = null;
  mockNavigation.dispatch.mockReset();
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
});
