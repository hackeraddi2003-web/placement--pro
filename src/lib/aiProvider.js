/**
 * AI Provider Abstraction Layer
 * ------------------------------------------------------------
 * Every AI feature in the app (English task generation, Mentor
 * review feedback, interview question suggestions) calls
 * `generateAIResponse()` below. It never talks to a provider
 * SDK directly. This means:
 *   - Swapping Gemini -> OpenAI -> Claude later = edit ONE file.
 *   - No API key configured -> falls back to rule-based logic,
 *     so the app is 100% usable with zero cost / zero setup.
 *
 * To add a new provider: write a `callX(prompt, apiKey)` function
 * below following the same shape (returns a plain string), then
 * add one line to the switch in `generateAIResponse`.
 * ------------------------------------------------------------
 */

import { getRuleBasedResponse } from './ruleBasedFallback'

/**
 * @param {string} prompt - the instruction/question for the AI
 * @param {object} opts
 * @param {string} opts.provider - 'gemini' | 'openai' | 'claude' | 'none'
 * @param {string} opts.apiKey - user's own API key (BYOK)
 * @param {string} opts.fallbackType - which rule-based generator to use if no provider configured
 * @param {object} opts.fallbackContext - data needed by the rule-based generator
 * @returns {Promise<{text: string, source: 'ai'|'fallback', provider: string}>}
 */
export async function generateAIResponse(prompt, opts = {}) {
  const { provider = 'none', apiKey = '', fallbackType, fallbackContext = {} } = opts

  if (provider === 'none' || !apiKey) {
    return {
      text: getRuleBasedResponse(fallbackType, fallbackContext),
      source: 'fallback',
      provider: 'rule_based',
    }
  }

  try {
    let text
    switch (provider) {
      case 'gemini':
        text = await callGemini(prompt, apiKey)
        break
      case 'openai':
        text = await callOpenAI(prompt, apiKey)
        break
      case 'claude':
        text = await callClaude(prompt, apiKey)
        break
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
    return { text, source: 'ai', provider }
  } catch (err) {
    console.warn(`AI provider "${provider}" failed, falling back to rule-based:`, err.message)
    return {
      text: getRuleBasedResponse(fallbackType, fallbackContext),
      source: 'fallback',
      provider: 'rule_based',
      error: err.message,
    }
  }
}

// ---------------- Provider implementations ----------------

async function callGemini(prompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

async function callOpenAI(prompt, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() || ''
}

async function callClaude(prompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
  const data = await res.json()
  return data?.content?.find((b) => b.type === 'text')?.text?.trim() || ''
}
