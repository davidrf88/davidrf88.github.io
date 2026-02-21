"""
search_news.py - Search Google News for a topic using Firecrawl

Usage:
    python search_news.py "<topic>"

Output:
    JSON array of top 5 news results to stdout.
    Each result contains: title, url, snippet, date, source.

Exit codes:
    0 - Success
    1 - Error (message printed to stderr)
"""

import sys
import json
import os
from dotenv import load_dotenv
from firecrawl import Firecrawl

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def search_news(topic: str, limit: int = 5) -> list[dict]:
    """Search Google News for a topic and return top results."""
    api_key = os.getenv("firecrawl_API_KEY")
    if not api_key:
        raise ValueError("firecrawl_API_KEY not found in .env")

    client = Firecrawl(api_key=api_key)

    response = client.search(
        query=topic,
        limit=limit,
        sources=["news"],
    )

    # Response is a SearchData object with .web, .news, .images attributes
    items = []

    # Try .news attribute first (SearchData object)
    if hasattr(response, "news") and response.news:
        for item in response.news[:limit]:
            items.append({
                "title": getattr(item, "title", "No title"),
                "url": getattr(item, "url", ""),
                "snippet": getattr(item, "snippet", getattr(item, "description", "")),
                "date": getattr(item, "date", getattr(item, "publishedDate", "Unknown")),
            })
    # Fallback: try .web attribute
    elif hasattr(response, "web") and response.web:
        for item in response.web[:limit]:
            items.append({
                "title": getattr(item, "title", "No title"),
                "url": getattr(item, "url", ""),
                "snippet": getattr(item, "description", getattr(item, "snippet", "")),
                "date": getattr(item, "date", "Unknown"),
            })
    # Fallback: treat as dict or list
    elif isinstance(response, dict):
        raw = response.get("data", response)
        raw_items = raw.get("news", raw.get("results", [])) if isinstance(raw, dict) else raw if isinstance(raw, list) else []
        for item in raw_items[:limit]:
            items.append({
                "title": item.get("title", "No title"),
                "url": item.get("url", ""),
                "snippet": item.get("snippet", item.get("description", "")),
                "date": item.get("date", "Unknown"),
            })

    results = items

    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python search_news.py \"<topic>\"", file=sys.stderr)
        sys.exit(1)

    topic = sys.argv[1]

    try:
        results = search_news(topic)
        print(json.dumps(results, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
