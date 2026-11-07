import { fetch as serverFetch, EnvHttpProxyAgent } from "undici";
const dispatcher = new EnvHttpProxyAgent();
// Fixed destinations and paths only. Never forward client headers, URLs or credentials.
export function upstream(source: string, q: string, page: number, id: boolean) {
  if (
    !q.trim() ||
    q.length > 500 ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > 100
  )
    throw Error("Invalid search parameters");
  if (source === "pubchem") {
    if (page !== 0) throw Error("PubChem name lookup has no pagination");
    const mode = id && /^\d+$/.test(q) ? "cid" : "name";
    return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/${mode}/${encodeURIComponent(q)}/property/Title,CanonicalSMILES,IsomericSMILES,InChIKey/JSON`;
  }
  if (source === "chembl")
    return id
      ? `https://www.ebi.ac.uk/chembl/api/data/molecule.json?molecule_chembl_id=${encodeURIComponent(q)}&limit=20`
      : `https://www.ebi.ac.uk/chembl/api/data/molecule/search.json?q=${encodeURIComponent(q)}&limit=20&offset=${page * 20}`;
  throw Error("Unsupported source");
}
interface Request {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}
interface Response {
  status: (n: number) => Response;
  json: (v: unknown) => void;
  setHeader: (k: string, v: string) => void;
}
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET required" });
    return;
  }
  let url: string;
  try {
    const { source, q, page = "0", id = "false" } = req.query;
    if (
      typeof source !== "string" ||
      typeof q !== "string" ||
      typeof page !== "string" ||
      typeof id !== "string"
    )
      throw Error();
    url = upstream(source, q, Number(page), id === "true");
  } catch {
    res.status(400).json({ error: "Invalid source or query" });
    return;
  }
  try {
    const result = await serverFetch(url, {
      dispatcher,
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (!result.ok) {
      res
        .status(result.status === 429 ? 429 : result.status === 404 ? 404 : 502)
        .json({ error: "Upstream source unavailable" });
      return;
    }
    const body = await result.text();
    if (body.length > 2_000_000) throw Error("Response too large");
    const parsed: unknown = JSON.parse(body);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).json(parsed);
  } catch {
    res.status(502).json({ error: "Scientific source could not be reached" });
  }
}
