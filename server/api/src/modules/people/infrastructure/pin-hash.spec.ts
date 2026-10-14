import { hashPin, newDeviceToken, newPairingCode, sha256Hex, verifyPin } from './pin-hash';

describe('kiosk PIN hashing (058-time AC-TM11)', () => {
  const pepper = 'a-pepper-of-at-least-thirty-two-chars!';

  it('verifies the PIN it hashed, and nothing else', async () => {
    const stored = await hashPin('482915', pepper);
    expect(stored.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(stored).not.toContain('482915');
    await expect(verifyPin('482915', stored, pepper)).resolves.toBe(true);
    await expect(verifyPin('482916', stored, pepper)).resolves.toBe(false);
  });

  it('salts per hash, so one PIN twice is two hashes', async () => {
    const [a, b] = await Promise.all([hashPin('1234', pepper), hashPin('1234', pepper)]);
    expect(a).not.toBe(b);
  });

  it('needs the pepper: the table alone verifies nothing', async () => {
    const stored = await hashPin('1234', pepper);
    await expect(verifyPin('1234', stored, 'another-pepper-of-thirty-two-chars!!')).resolves.toBe(false);
  });

  it('refuses a stored value it did not write', async () => {
    await expect(verifyPin('1234', 'plain-1234', pepper)).resolves.toBe(false);
    await expect(verifyPin('1234', 'scrypt$x$y$z$$', pepper)).resolves.toBe(false);
  });

  it('mints 8 digit codes and long tokens, and hashes them to hex', () => {
    for (let i = 0; i < 50; i += 1) expect(newPairingCode()).toMatch(/^\d{8}$/);
    expect(newDeviceToken().length).toBeGreaterThanOrEqual(43);
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
