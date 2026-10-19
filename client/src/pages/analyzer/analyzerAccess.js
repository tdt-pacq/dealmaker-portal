export const ALLOWED_DOMAINS = ['petersonacquisitions.com', 'thedealteam.co'];

// Deal Engine automation account. Clear this constant to revoke password sign-in.
// Disabling the user in the Firebase console revokes it as well.
export const ALLOWED_SERVICE_EMAIL = 'deal-engine@thedealteam.co';

export const isAllowed = email => ALLOWED_DOMAINS.some(d => email.endsWith('@' + d));

export const isPasswordSignIn = signInProvider => signInProvider === 'password';

export function isAnalyzerUserAllowed(user, signInProvider) {
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  if (!email) return false;
  if (isPasswordSignIn(signInProvider)) {
    return email.toLowerCase() === ALLOWED_SERVICE_EMAIL.toLowerCase();
  }
  return isAllowed(email);
}

// Used only when the ID token's sign-in provider cannot be read.
// A password-only account stays on the service-email rule. An account that
// also has Google keeps the domain rule.
export function fallbackSignInProvider(user) {
  const ids = (user?.providerData || []).map(p => p && p.providerId).filter(Boolean);
  if (ids.length === 1) return ids[0];
  if (ids.includes('password') && ids.every(id => id === 'password')) return 'password';
  return ids.find(id => id !== 'password') || '';
}
