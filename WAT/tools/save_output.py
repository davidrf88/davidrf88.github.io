"""
save_output.py - Save news-to-script output to a versioned folder

Usage:
    python save_output.py --topic "<topic>" --headliner "<headliner>" --input "<json_file>"

    The JSON input file should contain:
    {
        "topic": "...",
        "headline": "...",
        "folder_slug": "...",
        "source": "...",
        "link": "...",
        "full_article": "...",
        "script": "...",
        "discarded_articles": [
            {"title": "...", "url": "...", "snippet": "...", "date": "..."},
            ...
        ]
    }

    Alternatively, pipe JSON via stdin:
    echo '{"topic": "..."}' | python save_output.py

Output:
    Creates folder: .tmp/YYYY_MM_DD_TOPIC_HEADLINER_v1/output.txt
    Prints the folder path to stdout.

Exit codes:
    0 - Success
    1 - Error (message printed to stderr)
"""

import sys
import json
import os
import re
from datetime import datetime

# Project root
PROJECT_ROOT = os.path.join(os.path.dirname(__file__), "..")
TMP_DIR = os.path.join(PROJECT_ROOT, ".tmp")


def sanitize_name(text: str) -> str:
    """Convert text to a filesystem-safe name (uppercase, underscores, no special chars)."""
    text = text.upper().strip()
    text = re.sub(r"[^A-Z0-9]+", "_", text)
    text = text.strip("_")
    return text


def get_next_version(date_str: str, topic_slug: str, headliner_slug: str) -> int:
    """Find the next version number by scanning existing folders in .tmp/."""
    prefix = f"{date_str}_{topic_slug}_{headliner_slug}_v"

    if not os.path.exists(TMP_DIR):
        return 1

    max_version = 0
    for name in os.listdir(TMP_DIR):
        if name.startswith(prefix):
            # Extract version number
            version_str = name[len(prefix):]
            try:
                version = int(version_str)
                max_version = max(max_version, version)
            except ValueError:
                continue

    return max_version + 1


def save_output(data: dict) -> str:
    """Save output to a versioned folder. Returns the folder path."""
    topic = data.get("topic", "UNKNOWN")
    headline = data.get("headline", "UNKNOWN")
    folder_slug = data.get("folder_slug", "UNKNOWN")
    source = data.get("source", "Unknown")
    link = data.get("link", "")
    full_article = data.get("full_article", "")
    script = data.get("script", "")
    discarded = data.get("discarded_articles", [])

    # Build folder name (folder_slug is max 3 words, used only for the folder)
    date_str = datetime.now().strftime("%Y_%m_%d")
    topic_slug = sanitize_name(topic)
    slug = sanitize_name(folder_slug)
    version = get_next_version(date_str, topic_slug, slug)

    folder_name = f"{date_str}_{topic_slug}_{slug}_v{version}"
    folder_path = os.path.join(TMP_DIR, folder_name)

    os.makedirs(folder_path, exist_ok=True)

    # Build output content with clearly separated sections
    sections = []

    sections.append("=" * 60)
    sections.append("TOPIC")
    sections.append("=" * 60)
    sections.append(topic)

    sections.append("")
    sections.append("=" * 60)
    sections.append("SOURCE")
    sections.append("=" * 60)
    sections.append(source)

    sections.append("")
    sections.append("=" * 60)
    sections.append("LINK")
    sections.append("=" * 60)
    sections.append(link)

    sections.append("")
    sections.append("=" * 60)
    sections.append("HEADLINE")
    sections.append("=" * 60)
    sections.append(headline)

    sections.append("")
    sections.append("=" * 60)
    sections.append("SCRIPT (30-60 seconds)")
    sections.append("=" * 60)
    sections.append(script)

    hashtags = data.get("hashtags", "")
    if hashtags:
        sections.append("")
        sections.append("=" * 60)
        sections.append("HASHTAGS")
        sections.append("=" * 60)
        sections.append(hashtags)

    sections.append("")
    sections.append("=" * 60)
    sections.append("FULL ARTICLE")
    sections.append("=" * 60)
    sections.append(full_article)

    sections.append("")
    sections.append("=" * 60)
    sections.append("OTHER CANDIDATES (discarded)")
    sections.append("=" * 60)
    if discarded:
        for i, article in enumerate(discarded, 1):
            sections.append(f"\n--- Candidate {i} ---")
            sections.append(f"Title: {article.get('title', 'N/A')}")
            sections.append(f"URL:   {article.get('url', 'N/A')}")
            sections.append(f"Date:  {article.get('date', 'N/A')}")
            sections.append(f"Snippet: {article.get('snippet', 'N/A')}")
    else:
        sections.append("None recorded.")

    content = "\n".join(sections) + "\n"

    # Write file
    output_path = os.path.join(folder_path, "output.txt")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    return folder_path


def main():
    # Read JSON from stdin or from --input file
    if len(sys.argv) >= 3 and sys.argv[1] == "--input":
        input_path = sys.argv[2]
        try:
            with open(input_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error reading input file: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        try:
            data = json.load(sys.stdin)
        except Exception as e:
            print(f"Error reading JSON from stdin: {e}", file=sys.stderr)
            print("Usage: python save_output.py --input <json_file>", file=sys.stderr)
            print("   or: echo '{...}' | python save_output.py", file=sys.stderr)
            sys.exit(1)

    try:
        folder_path = save_output(data)
        print(folder_path)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
