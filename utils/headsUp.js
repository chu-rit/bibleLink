import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import headsUpWords from '../data/words2/headsUpWords.json';
import { db } from '../firebaseConfig';
import { getServerDateInfo } from './dailyWord';

export async function drawHeadsUpWord(popularity, categories) {
  if (!db) throw new Error('firebase-not-configured');
  const categorySet = new Set(Array.isArray(categories) ? categories : []);
  const candidates = headsUpWords.filter((entry) => entry.popularity === popularity && categorySet.has(entry.category));
  if (!candidates.length) return null;

  const { dateKey, day } = await getServerDateInfo();
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
