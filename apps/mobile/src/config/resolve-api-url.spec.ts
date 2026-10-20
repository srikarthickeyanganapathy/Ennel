import { resolveApiUrl } from './resolve-api-url';

describe('resolveApiUrl', () => {
  it('uses the computer address Expo was loaded from when the configured URL is localhost', () => {
    expect(resolveApiUrl('http://localhost:3000', '10.137.105.55:8081')).toBe(
      'http://10.137.105.55:3000',
    );
  });

  it('keeps the configured port', () => {
    expect(resolveApiUrl('http://127.0.0.1:4000/', '192.168.1.20:8081')).toBe(
      'http://192.168.1.20:4000',
    );
  });

  it('always keeps a non-local configured URL', () => {
    expect(resolveApiUrl('http://192.168.1.9:3000/', '10.0.0.5:8081')).toBe(
      'http://192.168.1.9:3000',
    );
  });

  it('falls back to localhost on the same computer, for tunnels, or without Expo host info', () => {
    expect(resolveApiUrl(undefined, 'localhost:8081')).toBe('http://localhost:3000');
    expect(resolveApiUrl('http://localhost:3000', 'abc.exp.direct')).toBe('http://localhost:3000');
    expect(resolveApiUrl('http://localhost:3000', undefined)).toBe('http://localhost:3000');
  });
});
