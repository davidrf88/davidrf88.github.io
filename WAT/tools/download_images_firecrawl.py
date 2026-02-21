"""
download_images_firecrawl.py - Search and download images using Firecrawl

Usage:
    python download_images_firecrawl.py --prompt "<text>" --output_dir "<dir>"

Output:
    Downloads up to 10 images to the specified directory.

Exit codes:
    0 - Success
    1 - Error (message printed to stderr)
"""

import sys
import os
import requests
from typing import List
from dotenv import load_dotenv
from firecrawl import Firecrawl

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def search_images(query: str, num_images: int = 10) -> List[str]:
    """Search for images using Firecrawl and return a list of image URLs."""
    api_key = os.getenv("firecrawl_API_KEY")
    if not api_key:
        raise ValueError("firecrawl_API_KEY not found in .env")

    client = Firecrawl(api_key=api_key)

    response = client.search(
        query=query,
        limit=num_images,
        sources=["images"],
    )

    image_urls = []

    # Firecrawl returns SearchData with .images list of SearchResultImages
    if hasattr(response, "images") and response.images:
        for item in response.images[:num_images]:
            url = getattr(item, "image_url", None)
            if url:
                image_urls.append(url)
    # Fallback: try response as dict
    elif isinstance(response, dict) and "images" in response:
        for item in response["images"][:num_images]:
            url = item.get("url", item.get("src", None))
            if url:
                image_urls.append(url)

    return image_urls


def download_images(image_urls: List[str], output_dir: str) -> int:
    """Download images from URLs and save to output directory."""
    os.makedirs(output_dir, exist_ok=True)
    downloaded = 0
    for idx, url in enumerate(image_urls):
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                ext = ".jpg"
                content_type = resp.headers.get("Content-Type", "")
                if "png" in content_type:
                    ext = ".png"
                elif "webp" in content_type:
                    ext = ".webp"
                elif "gif" in content_type:
                    ext = ".gif"
                filepath = os.path.join(output_dir, f"image_{idx+1}{ext}")
                with open(filepath, "wb") as f:
                    f.write(resp.content)
                downloaded += 1
                print(f"  [{idx+1}] Saved: {filepath}")
            else:
                print(f"  [{idx+1}] Failed (HTTP {resp.status_code}): {url}", file=sys.stderr)
        except Exception as e:
            print(f"  [{idx+1}] Error: {e}", file=sys.stderr)
    return downloaded


def main(prompt: str, output_dir: str):
    if not prompt:
        print("Error: Prompt is empty. Aborting.", file=sys.stderr)
        sys.exit(1)

    print(f"Searching images for: \"{prompt}\"")
    image_urls = search_images(prompt, 10)

    if not image_urls:
        print("No images found for the prompt.", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(image_urls)} images. Downloading...")
    downloaded = download_images(image_urls, output_dir)
    print(f"Done. {downloaded}/{len(image_urls)} images saved to {output_dir}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Download images using Firecrawl.")
    parser.add_argument("--prompt", required=True, help="Text prompt for image search.")
    parser.add_argument("--output_dir", required=True, help="Directory to save images.")
    args = parser.parse_args()
    main(args.prompt, args.output_dir)
