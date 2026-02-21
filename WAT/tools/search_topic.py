"""
search_topic.py - Search the web for articles on a topic using Firecrawl

Usage:
    python search_topic.py "<topic>" [--limit N]

Output:
    JSON array of top results to stdout.
    Each result contains: title, url, snippet, source.

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


def search_topic(topic: str, limit: int = 10) -> list[dict]:
    """Search the web for articles on a topic and return results."""
    api_key = os.getenv("firecrawl_API_KEY")
    if not api_key:
        raise ValueError("firecrawl_API_KEY not found in .env")

    client = Firecrawl(api_key=api_key)

    response = client.search(
        query=topic,
        limit=limit,
    )

    items = []

    # Try .web attribute first (SearchData object)
    if hasattr(response, "web") and response.web:
        for item in response.web[:limit]:
            items.append({
                "title": getattr(item, "title", "No title"),
                "url": getattr(item, "url", ""),
                "snippet": getattr(item, "description", getattr(item, "snippet", "")),
            })
    # Fallback: try as dict
    elif isinstance(response, dict):
        raw = response.get("data", response)
        raw_items = raw.get("results", raw.get("web", [])) if isinstance(raw, dict) else raw if isinstance(raw, list) else []
        for item in raw_items[:limit]:
            items.append({
                "title": item.get("title", "No title"),
                "url": item.get("url", ""),
                "snippet": item.get("snippet", item.get("description", "")),
            })

    return items


def main():
    if len(sys.argv) < 2:
        print("Usage: python search_topic.py \"<topic>\" [--limit N]", file=sys.stderr)
        sys.exit(1)

    topic = sys.argv[1]
    limit = 10

    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        if idx + 1 < len(sys.argv):
            try:
                limit = int(sys.argv[idx + 1])
            except ValueError:
                pass

    try:
        results = search_topic(topic, limit)
        print(json.dumps(results, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
