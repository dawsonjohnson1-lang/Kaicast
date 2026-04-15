import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export const SPOTS = [
  { id: 'sharks-cove', name: "Shark's Cove", coast: 'North Shore' },
  { id: 'three-tables', name: 'Three Tables', coast: 'North Shore' },
  { id: 'mokuleia', name: 'Mokuleia', coast: 'North Shore' },
  { id: 'makua-beach', name: 'Makua Beach', coast: 'West' },
  { id: 'hanauma-bay', name: 'Hanauma Bay', coast: 'South' },
];

function getCurrentHourKey() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  return `${y}${m}${d}${h}`;
}

export async function fetchCurrentReports() {
  const hourKey = getCurrentHourKey();
  const reportsRef = collection(db, 'kaicast_reports');
  const q = query(reportsRef, where('hourKey', '==', hourKey));
  const snapshot = await getDocs(q);

  const reports = {};
  snapshot.forEach((doc) => {
    const data = doc.data();
    reports[data.spot] = data;
  });

  // If no reports for current hour, try the previous hour
  if (Object.keys(reports).length === 0) {
    const prevHour = new Date(Date.now() - 3600000);
    const py = prevHour.getUTCFullYear();
    const pm = String(prevHour.getUTCMonth() + 1).padStart(2, '0');
    const pd = String(prevHour.getUTCDate()).padStart(2, '0');
    const ph = String(prevHour.getUTCHours()).padStart(2, '0');
    const prevKey = `${py}${pm}${pd}${ph}`;
    const q2 = query(reportsRef, where('hourKey', '==', prevKey));
    const snap2 = await getDocs(q2);
    snap2.forEach((doc) => {
      const data = doc.data();
      reports[data.spot] = data;
    });
  }

  return reports;
}

export async function fetchSpotReport(spotId) {
  const hourKey = getCurrentHourKey();
  const docId = `${spotId}_${hourKey}`;
  const ref = doc(db, 'kaicast_reports', docId);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  // Fallback to previous hour
  const prevHour = new Date(Date.now() - 3600000);
  const py = prevHour.getUTCFullYear();
  const pm = String(prevHour.getUTCMonth() + 1).padStart(2, '0');
  const pd = String(prevHour.getUTCDate()).padStart(2, '0');
  const ph = String(prevHour.getUTCHours()).padStart(2, '0');
  const prevDocId = `${spotId}_${py}${pm}${pd}${ph}`;
  const ref2 = doc(db, 'kaicast_reports', prevDocId);
  const snap2 = await getDoc(ref2);
  return snap2.exists() ? snap2.data() : null;
}
