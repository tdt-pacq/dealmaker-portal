'use strict';

/**
 * Claude Sonnet 5 runs adaptive thinking unless it is turned off.
 * The reply can start with a thinking block, which has no `.text`.
 * Deal Marketing used to read `content[0].text` and then bind that
 * value into SQLite, so a successful model call still produced nothing.
 */

function textFromMessage(message) {
  const blocks = message && Array.isArray(message.content) ? message.content : [];
  return blocks
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
    .trim();
}

function documentFromMessage(message, label) {
  const text = textFromMessage(message);
  if (text) return text;
  const reason = (message && message.stop_reason) || 'unknown';
  const err = new Error(emptyDocumentMessage(label, reason));
  err.statusCode = 502;
  throw err;
}

function emptyDocumentMessage(label, reason) {
  if (reason === 'max_tokens') {
    return `${label} was cut off before any document text was produced. Try again.`;
  }
  if (reason === 'refusal') {
    return `${label} was refused by the model. Review the interview content and try again.`;
  }
  return `${label} did not return any document text. Try again.`;
}

function generationBody(maxTokens, system, content) {
  return {
    model: 'claude-sonnet-5',
    max_tokens: maxTokens,
    // Omit this and Sonnet 5 spends the output budget on thinking blocks.
    thinking: { type: 'disabled' },
    system,
    messages: [{ role: 'user', content }],
  };
}

module.exports = {
  textFromMessage,
  documentFromMessage,
  generationBody,
};
