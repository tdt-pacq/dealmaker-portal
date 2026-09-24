import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interviewHasContent, mergeInterview, parseInterview } from './interviewDraft.js';

test('a blank draft does not wipe saved server fields', () => {
  const server = { business_description: 'Coffeehouse and roastery', asking_price: '450000' };
  const draft = { business_description: '', asking_price: '', year_founded: '' };
  assert.deepEqual(mergeInterview(server, draft), server);
  assert.equal(interviewHasContent(draft), false);
});

test('filled draft values overlay the server and blank draft keys stay put', () => {
  const server = { business_description: 'Saved description', asking_price: '450000' };
  const draft = { business_description: 'Typed in this browser', asking_price: '' };
  assert.deepEqual(mergeInterview(server, draft), {
    business_description: 'Typed in this browser',
    asking_price: '450000',
  });
});

test('a draft is kept when the server interview is still empty', () => {
  const draft = { business_description: 'Only on this computer' };
  assert.deepEqual(mergeInterview({}, draft), draft);
});

test('invalid interview JSON loads as an empty object', () => {
  assert.deepEqual(parseInterview(''), {});
  assert.deepEqual(parseInterview('not-json'), {});
  assert.deepEqual(parseInterview('[]'), {});
});
