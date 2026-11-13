/** Zadnji GitHub release aplikacije – prikazuje se na dnu prijave. */
const RELEASE_URL = 'https://api.github.com/repos/to0ony/blokich/releases/latest';
const KLJUC = 'blokich.verzija';
/** GitHub ograničava upite bez prijave, pa se verzija pamti sat vremena. */
const TRAJANJE_MS = 60 * 60 * 1000;

interface Spremljeno {
  verzija: string;
  vrijeme: number;
}

function procitaj(): Spremljeno | null {
  try {
    const s = JSON.parse(localStorage.getItem(KLJUC) ?? 'null');
    return s && typeof s.verzija === 'string' && typeof s.vrijeme === 'number' ? s : null;
  } catch {
    return null;
  }
}

/**
 * Verzija iz zadnjeg releasea (npr. "v1.5.42"). Native fetch, ne HttpClient,
 * da GitHubu ne idu zaglavlja našeg API-ja. Bez mreže: zadnja poznata ili null.
 */
export async function verzijaAplikacije(): Promise<string | null> {
  const spremljeno = procitaj();
  if (spremljeno && Date.now() - spremljeno.vrijeme < TRAJANJE_MS) return spremljeno.verzija;
  try {
    const res = await fetch(RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return spremljeno?.verzija ?? null;
    const data = await res.json();
    const verzija = String(data?.tag_name || data?.name || '').trim();
    if (!verzija) return spremljeno?.verzija ?? null;
    try {
      localStorage.setItem(KLJUC, JSON.stringify({ verzija, vrijeme: Date.now() }));
    } catch {}
    return verzija;
  } catch {
    return spremljeno?.verzija ?? null;
  }
}
