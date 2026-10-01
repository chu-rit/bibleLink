import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import headsUpWords from '../data/words2/headsUpWords.json';
import { db } from '../firebaseConfig';
import { getServerCalendarDateInfo } from './dailyWord';

export async function getTodayUsedHeadsUpWords() {
  if (!db) throw new Error('firebase-not-configured');
  const { dateKey } = await getServerCalendarDateInfo();
  const snapshots = await Promise.all(headsUpWords.map((entry) => getDoc(doc(db, 'headsUpWordUsage', dateKey, 'words', entry.id))));
  return snapshots.flatMap((snapshot, index) => snapshot.exists()
    ? [{ ...headsUpWords[index], calledAt: snapshot.data()?.calledAt }]
    : [])
    .sort((a, b) => (a.calledAt?.toMillis?.() || 0) - (b.calledAt?.toMillis?.() || 0));
}

export function getAvailableHeadsUpPopularityLevels() {
  return [...new Set(headsUpWords.map((entry) => entry.popularity))];
}

export async function drawHeadsUpWord(popularityLevels, categories) {
  if (!db) throw new Error('firebase-not-configured');
  const popularitySet = new Set(Array.isArray(popularityLevels) ? popularityLevels : []);
  const categorySet = new Set(Array.isArray(categories) ? categories : []);
  const candidates = headsUpWords.filter((entry) => popularitySet.has(entry.popularity) && categorySet.has(entry.category));
  if (!candidates.length) return null;

  const { dateKey, day } = await getServerCalendarDateInfo();
  return runTransaction(db, async (transaction) => {
    const reservations = candidates.map((entry) => ({
      entry,
      ref: doc(db, 'headsUpWordUsage', dateKey, 'words', entry.id),
    }));
    const snapshots = await Promise.all(reservations.map(({ ref }) => transaction.get(ref)));
    const available = reservations.filter((_, index) => !snapshots[index].exists());
    const pool = available.length ? available : reservations;
    const { entry, ref } = pool[Math.floor(Math.random() * pool.length)];

    if (available.length) {
      transaction.set(ref, {
        dateKey,
        day,
        wordId: entry.id,
        category: entry.category,
        popularity: entry.popularity,
        calledAt: serverTimestamp(),
      });
    }
    return entry;
  });
}
