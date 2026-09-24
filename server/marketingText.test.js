const { test } = require('node:test');
const assert = require('node:assert/strict');
const { textFromMessage, documentFromMessage, generationBody } = require('./marketingText');

test('reads the text block when a thinking block comes first', () => {
  const message = {
    stop_reason: 'end_turn',
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: '**Coffee roaster in the White Mountains**' },
    ],
  };
  assert.equal(textFromMessage(message), '**Coffee roaster in the White Mountains**');
  assert.equal(documentFromMessage(message, 'Blind ad'), '**Coffee roaster in the White Mountains**');
});

test('joins every text block and ignores non-text blocks', () => {
  const message = {
    content: [
      { type: 'thinking', thinking: 'plan' },
      { type: 'text', text: '<p>One' },
      { type: 'text', text: ' page</p>' },
    ],
  };
  assert.equal(textFromMessage(message), '<p>One page</p>');
});

test('content[0].text is not the document when thinking is first', () => {
  const message = {
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: 'The ad' },
    ],
  };
  assert.equal(message.content[0].text, undefined);
  assert.equal(textFromMessage(message), 'The ad');
});

test('empty or thinking-only replies raise a user-facing error', () => {
  assert.throws(
    () => documentFromMessage({ stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: '' }] }, 'Blind ad'),
    /cut off before any document text/
  );
  assert.throws(
    () => documentFromMessage({ stop_reason: 'refusal', content: [] }, 'One-page flyer'),
    /refused by the model/
  );
  assert.throws(
    () => documentFromMessage({ content: [{ type: 'text', text: '   ' }] }, 'CBR'),
    /did not return any document text/
  );
});

test('generation requests disable adaptive thinking', () => {
  const body = generationBody(4000, 'system', 'user');
  assert.equal(body.model, 'claude-sonnet-5');
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.max_tokens, 4000);
  assert.equal(body.messages[0].content, 'user');
});
