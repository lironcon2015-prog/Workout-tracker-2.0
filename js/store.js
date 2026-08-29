// store.js — שמירה מקומית של הגדרות ושל יצירות שיובאו
const S_KEY = 'pianoGuide.settings.v2';
const L_KEY = 'pianoGuide.songs.v1';

export const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem(S_KEY)) || {}; } catch { return {}; }
};
export const saveSettings = (s) => {
  try { localStorage.setItem(S_KEY, JSON.stringify(s)); } catch {}
};
export const loadSongs = () => {
  try { return JSON.parse(localStorage.getItem(L_KEY)) || []; } catch { return []; }
};
export const saveSongs = (list) => {
  try { localStorage.setItem(L_KEY, JSON.stringify(list)); return true; }
  catch { return false; }
};
