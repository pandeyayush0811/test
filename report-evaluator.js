/**
 * Hinglish Report Evaluator for Utkio Lab
 * Generates natural Hinglish post-session feedback and bilingual drills
 * based on conversation turns.
 */

import { HINGLISH_REPORT_PROMPT } from './scenarios.js';

export async function generateHinglishReport(apiKey, model, conversationTurns) {
  if (!apiKey) {
    throw new Error('Gemini API Key is required to evaluate reports.');
  }

  if (!conversationTurns || conversationTurns.length === 0) {
    throw new Error('No conversation turns found to analyze. Have a quick chat first!');
  }

  // Format turns into clean transcript text
  const transcriptText = conversationTurns
    .map(turn => `${turn.role.toUpperCase()}: ${turn.text}`)
    .join('\n\n');

  const promptContent = `Here is the conversation transcript to analyze:\n\n---\n${transcriptText}\n---\n\nPlease generate the comprehensive Hinglish feedback report now.`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: promptContent }]
      }
    ],
    systemInstruction: {
      parts: [{ text: HINGLISH_REPORT_PROMPT }]
    },
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 1200
    }
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const reportMarkdown = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No report generated.';
  return reportMarkdown;
}

/**
 * Lightweight pure-client Markdown to HTML converter for report rendering
 */
export function renderMarkdownToHtml(markdown) {
  if (!markdown) return '';

  let html = markdown
    // Escape standard HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold & Italics
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Blockquotes
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Lists
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>')
    // Line breaks & paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `<p>${html}</p>`.replace(/<p><\/p>/g, '');
}
