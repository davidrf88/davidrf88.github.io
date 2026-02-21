"""
scrape_article.py - Scrape full article text from a URL using Firecrawl

Usage:
    python scrape_article.py "<url>"

Output:
    JSON object to stdout with: title, url, source, markdown (full article text).

Exit codes:
    0 - Success
    1 - Error (message printed to stderr)
"""

import sys
import json
import os
from urllib.parse import urlparse
from dotenv import load_dotenv
from firecrawl import Firecrawl

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def extract_source_name(url: str) -> str:
    """Extract a clean source name from a URL (e.g., 'bbc.com' from 'https://www.bbc.com/news/...')."""
    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path
    # Remove www. prefix
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def scrape_article(url: str) -> dict:
    """Scrape full article text from a URL."""
    api_key = os.getenv("firecrawl_API_KEY")
    if not api_key:
        raise ValueError("firecrawl_API_KEY not found in .env")

    client = Firecrawl(api_key=api_key)

    response = client.scrape(
        url=url,
        formats=["markdown"],
    )

    # Handle response — could be a ScrapeData object or a dict
    if hasattr(response, "markdown"):
        markdown = response.markdown or ""
        metadata = response.metadata if hasattr(response, "metadata") else None
        if metadata:
            title = getattr(metadata, "title", None) or getattr(metadata, "ogTitle", "No title")
        else:
            title = "No title"
    elif isinstance(response, dict):
        markdown = response.get("markdown", "")
        metadata = response.get("metadata", {})
        title = metadata.get("title", metadata.get("ogTitle", "No title"))
    else:
        markdown = str(response)
        title = "No title"

    return {
        "title": title,
        "url": url,
        "source": extract_source_name(url),
        "markdown": markdown,
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python scrape_article.py \"<url>\"", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]

    try:
        result = scrape_article(url)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
