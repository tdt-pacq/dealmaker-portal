import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_SERVICE_EMAIL,
  fallbackSignInProvider,
  isAnalyzerUserAllowed,
} from './analyzerAccess.js';

const user = (email, providers) => ({
  email,
  providerData: providers.map(providerId => ({ providerId })),
});

test('the service email constant is the Deal Engine account', () => {
  assert.equal(ALLOWED_SERVICE_EMAIL, 'deal-engine@thedealteam.co');
});

test('Google users keep the domain allowlist', () => {
  assert.equal(isAnalyzerUserAllowed(user('a@thedealteam.co', ['google.com']), 'google.com'), true);
  assert.equal(isAnalyzerUserAllowed(user('a@petersonacquisitions.com', ['google.com']), 'google.com'), true);
  assert.equal(isAnalyzerUserAllowed(user('a@gmail.com', ['google.com']), 'google.com'), false);
});

test('password sign-in allows only the service account, case-insensitively', () => {
  assert.equal(isAnalyzerUserAllowed(user('deal-engine@thedealteam.co', ['password']), 'password'), true);
  assert.equal(isAnalyzerUserAllowed(user('  Deal-Engine@TheDealTeam.co  ', ['password']), 'password'), true);
});

test('other password users are denied even on an allowed domain', () => {
  assert.equal(isAnalyzerUserAllowed(user('advisor@thedealteam.co', ['password']), 'password'), false);
  assert.equal(isAnalyzerUserAllowed(user('advisor@petersonacquisitions.com', ['password']), 'password'), false);
  assert.equal(isAnalyzerUserAllowed(user('someone@gmail.com', ['password']), 'password'), false);
});

test('Google sign-in still uses the domain rule when password is also linked', () => {
  const linked = user('advisor@thedealteam.co', ['google.com', 'password']);
  assert.equal(isAnalyzerUserAllowed(linked, 'google.com'), true);
  assert.equal(isAnalyzerUserAllowed(linked, 'password'), false);
});

test('a missing email is denied', () => {
  assert.equal(isAnalyzerUserAllowed({ email: null, providerData: [{ providerId: 'google.com' }] }, 'google.com'), false);
  assert.equal(isAnalyzerUserAllowed({ email: '   ', providerData: [{ providerId: 'password' }] }, 'password'), false);
});

test('fallback treats a password-only account as password', () => {
  assert.equal(fallbackSignInProvider(user('deal-engine@thedealteam.co', ['password'])), 'password');
  assert.equal(fallbackSignInProvider(user('a@thedealteam.co', ['google.com'])), 'google.com');
  assert.equal(fallbackSignInProvider(user('a@thedealteam.co', ['google.com', 'password'])), 'google.com');
});
