import LZString from 'lz-string';

const ALGORITHM = 'AES-GCM';

export async function generateKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    { name: ALGORITHM, length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

function bufferToBase64UrlSafe(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlSafeToBuffer(b64Safe: string): Uint8Array {
  let b64 = b64Safe.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  const binaryString = window.atob(b64);
  const buffer = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }
  return buffer;
}

export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return bufferToBase64UrlSafe(new Uint8Array(exported));
}

export async function importKey(keyStr: string): Promise<CryptoKey> {
  const binaryDer = base64UrlSafeToBuffer(keyStr);
  return await window.crypto.subtle.importKey(
    'raw',
    binaryDer as any,
    { name: ALGORITHM },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload(key: CryptoKey, jsonString: string): Promise<string> {
  const compressed = LZString.compressToUint8Array(jsonString);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    compressed as any
  );
  
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);
  
  return bufferToBase64UrlSafe(combined);
}

export async function decryptPayload(key: CryptoKey, encryptedB64: string): Promise<string> {
  const combined = base64UrlSafeToBuffer(encryptedB64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    ciphertext as any
  );
  
  const decompressed = LZString.decompressFromUint8Array(new Uint8Array(decryptedBuffer));
  if (!decompressed) throw new Error("Decompression failed");
  return decompressed;
}

export function parseHash(): { payload: string | null, key: string | null, burn: boolean, salt: string | null } {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return {
    payload: params.get('data'),
    key: params.get('key'),
    burn: params.get('burn') === 'true',
    salt: params.get('salt')
  };
}

export function updateHash(payload: string, key?: string, salt?: string) {
  const params = new URLSearchParams();
  params.set('data', payload);
  if (key) params.set('key', key);
  if (salt) params.set('salt', salt);
  window.history.replaceState(null, '', `#${params.toString()}`);
}
export { bufferToBase64UrlSafe, base64UrlSafeToBuffer };
