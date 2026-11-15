// Stub for the red phase of F-01: plaintext "hash" so that fixtures can be created and the tests fail on their assertions.
export async function hashPassword(password: string): Promise<string> {
  return password;
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return password === hash;
}
