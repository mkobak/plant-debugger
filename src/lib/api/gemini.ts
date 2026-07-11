import { GoogleGenAI } from '@google/genai';

let _client: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}
