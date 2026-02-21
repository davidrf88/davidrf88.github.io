import os
import requests
from typing import List

UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
UNSPLASH_URL = "https://api.unsplash.com/search/photos"


def search_unsplash_images(query: str, num_images: int = 10) -> List[str]:
    """Search Unsplash for images matching the query. Returns a list of image URLs."""
    headers = {"Accept-Version": "v1", "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"}
    params = {"query": query, "per_page": num_images, "content_filter": "high"}
    response = requests.get(UNSPLASH_URL, headers=headers, params=params)
    response.raise_for_status()
    data = response.json()
    return [result["urls"]["regular"] for result in data.get("results", [])]


def download_images(image_urls: List[str], output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    for idx, url in enumerate(image_urls):
        resp = requests.get(url)
        if resp.status_code == 200:
            with open(os.path.join(output_dir, f"image_{idx+1}.jpg"), "wb") as f:
                f.write(resp.content)
        else:
            print(f"Failed to download image {idx+1} from {url}")


def main(prompt: str, output_dir: str):
    if not prompt:
        print("Prompt is empty. Aborting.")
        return
    try:
        image_urls = search_unsplash_images(prompt, 10)
        if not image_urls:
            print("No images found for the prompt.")
        download_images(image_urls, output_dir)
        print(f"Downloaded {len(image_urls)} images to {output_dir}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Download 10 copyright-free images from Unsplash.")
    parser.add_argument("--prompt", required=True, help="Text prompt for image search.")
    parser.add_argument("--output_dir", required=True, help="Directory to save images.")
    args = parser.parse_args()
    main(args.prompt, args.output_dir)
