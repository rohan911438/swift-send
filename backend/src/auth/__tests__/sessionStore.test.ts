import { createNewUserSession, getSession, saveSession } from '../sessionStore';
import { decryptString, encryptString } from '../../utils/encryption';

describe('PII encryption for session data', () => {
  it('should encrypt and decrypt strings using AES-256-GCM', () => {
    const value = 'alice@example.com';
    const encrypted = encryptString(value);
    expect(encrypted).not.toEqual(value);
    const decrypted = decryptString(encrypted);
    expect(decrypted).toBe(value);
  });

  it('should return decrypted session email and phone after save/get', () => {
    const email = 'test.user@example.com';
    const phone = '+15551234567';
    const session = createNewUserSession(email, undefined);
    expect(session.email).toBe(email);

    const saved = getSession(session.id);
    expect(saved).toBeDefined();
    expect(saved?.email).toBe(email);
    expect(saved?.phone).toBeUndefined();

    saved!.phone = phone;
    saveSession(saved!);

    const updated = getSession(session.id);
    expect(updated).toBeDefined();
    expect(updated?.phone).toBe(phone);
    expect(updated?.email).toBe(email);
  });
});
