import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState } from '../types';

const KEY = 'lmtd:game';

export async function saveGame(g: GameState) {
  await AsyncStorage.setItem(KEY, JSON.stringify(g));
}

export async function loadGame(): Promise<GameState | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export async function clearGame() {
  await AsyncStorage.removeItem(KEY);
}
