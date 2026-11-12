export type ImageResult = {
  thumb: string;
  full: string;
  title: string;
  source: string;
  width?: number;
  height?: number;
};

type Keys = { brave?: string; serper?: string };

/**
 * Finds product photos on the internet for a model name.
 * Uses Brave Search (free $5 credit/month ≈ 1,000 searches) or Serper.
 */
export async function searchProductImages(
  query: string,
  keys: Keys,
): Promise<{ results: ImageResult[]; provider: string | null; error?: string }> {
  const q = query.trim();
  if (q.length < 2) return { results: [], provider: null };

  if (keys.brave) {
    try {
      return { results: await brave(q, keys.brave), provider: "Brave" };
    } catch (e) {
      if (!keys.serper) return { results: [], provider: "Brave", error: (e as Error).message };
    }
  }
  if (keys.serper) {
    try {
      return { results: await serper(q, keys.serper), provider: "Serper" };
    } catch (e) {
      return { results: [], provider: "Serper", error: (e as Error).message };
    }
  }
  return { results: [], provider: null, error: "not-configured" };
}

async function brave(q: string, key: string): Promise<ImageResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/images/search");
  url.searchParams.set("q", q);
  url.searchParams.set("count", "24");
  url.searchParams.set("safesearch", "strict");
  const res = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Brave search failed (${res.status})`);
  const data = (await res.json()) as {
    results?: {
      title?: string;
      source?: string;
      url?: string;
      thumbnail?: { src?: string; width?: number; height?: number };
      properties?: { url?: string; placeholder?: string; width?: number; height?: number };
    }[];
  };
  return (data.results ?? [])
    .map((r) => ({
      thumb: r.thumbnail?.src || r.properties?.placeholder || r.properties?.url || "",
      full: r.properties?.url || r.thumbnail?.src || "",
      title: r.title || "",
      source: r.source || hostOf(r.url),
      width: r.properties?.width,
      height: r.properties?.height,
    }))
    .filter((r) => r.thumb && r.full);
}

async function serper(q: string, key: string): Promise<ImageResult[]> {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q, gl: "in", num: 24 }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Serper search failed (${res.status})`);
  const data = (await res.json()) as {
    images?: {
      title?: string;
      imageUrl?: string;
      thumbnailUrl?: string;
      source?: string;
      domain?: string;
      imageWidth?: number;
      imageHeight?: number;
    }[];
  };
  return (data.images ?? [])
    .map((r) => ({
      thumb: r.thumbnailUrl || r.imageUrl || "",
      full: r.imageUrl || r.thumbnailUrl || "",
      title: r.title || "",
      source: r.domain || r.source || "",
      width: r.imageWidth,
      height: r.imageHeight,
    }))
    .filter((r) => r.thumb && r.full);
}

function hostOf(url?: string) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}
