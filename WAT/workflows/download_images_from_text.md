# Workflow: Download 10 Copyright-Free Images from Text

## Objective
Given a headline or script, find and download 10 copyright-free images relevant to the content using a public image API.

## Inputs
- `prompt`: Text string (preferably the full script, fallback to headline)
- `output_dir`: Directory to save images

## Tools Required
- Python script to query a copyright-free image API (e.g., Unsplash, Pexels, Pixabay)
- API key (stored in .env)

## Steps
1. Receive the prompt (full script preferred for context).
2. Use the Python tool to query the image API for relevant images.
3. Download the top 10 images to the specified output directory.
4. Handle errors: fewer than 10 results, API errors, rate limits.
5. Log results and any issues.

## Edge Cases
- If fewer than 10 images are found, log a warning and download as many as possible.
- If API fails, retry up to 2 times, then log error.
- If prompt is empty, abort and log error.

## Output
- 10 (or fewer, if not available) copyright-free images saved to `output_dir`
- Log file with results and any errors

## Notes
- Always use the full script for richer search context if available.
- Only use headline if script is missing or too short.
- Images should be copyright-free and suitable for editorial use.
