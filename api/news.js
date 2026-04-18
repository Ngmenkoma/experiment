let cache = null;
let cacheTime = null;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export default async function handler(req, res) {
  const category = req.query.category || "health";

  const feeds = {
    health: "https://www.myjoyonline.com/feed/?cat=health",
    general: "https://www.myjoyonline.com/feed/",
    business: "https://www.myjoyonline.com/feed/?cat=business",
    politics: "https://www.myjoyonline.com/feed/?cat=politics",
    sports: "https://www.myjoyonline.com/feed/?cat=sports",
    education: "https://www.myjoyonline.com/feed/?cat=education",
  };

  const feedUrl = feeds[category] || feeds.general;

  // Return cached result if still fresh
  if (cache && cache[category] && cacheTime && (Date.now() - cacheTime < CACHE_DURATION)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json({ articles: cache[category] });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(feedUrl, { signal: controller.signal });
    clearTimeout(timeout);

    const xmlText = await response.text();
    const items = [];
    const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];

    for (const item of itemMatches.slice(0, 6)) {
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/) || [])[1] || "";
      const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || "";
      const description = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/) || [])[1] || "";
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
      const image = (item.match(/<media:content[^>]+url="([^"]+)"/) || item.match(/<enclosure[^>]+url="([^"]+)"/) || [])[1] || "";
      const cleanDesc = description.replace(/<[^>]+>/g, "").substring(0, 200);

      items.push({
        title: title.trim(),
        url: link.trim(),
        description: cleanDesc.trim(),
        image: image.trim(),
        publishedAt: pubDate.trim(),
        source: { name: "MyJoyOnline" }
      });
    }

    // Save to cache
    if (!cache) cache = {};
    cache[category] = items;
    cacheTime = Date.now();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate");
    res.status(200).json({ articles: items });

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch news" });
  }
}
