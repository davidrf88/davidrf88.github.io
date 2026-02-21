# Workflow: Topic to Script

## Objective
Given a general topic, search the web for interesting articles, present the list to the user for selection, then produce a 30–60 second social media video script and download related images — just like the news pipeline but driven by user choice.

## Inputs
- **Topic** (string): The subject to search for (e.g., "fishtank", "parkour", "space elevator")

## Pipeline

### Step 1: Search for Articles
**Tool:** `tools/search_topic.py`
**Command:** `python tools/search_topic.py "<topic>"`
**Output:** JSON array of up to 10 web results (title, url, snippet)

### Step 2: Present Results & Wait for User Selection
**No tool — Agent presents list.**

Show the user a numbered list of the results:

```
1. [Title] — snippet...
   URL: https://...

2. [Title] — snippet...
   URL: https://...

...
```

Then ask:
> **Which article would you like me to use? (enter a number)**

⚠️ **Do NOT proceed until the user replies.** The user may also say "search again" with a different query — in that case go back to Step 1.

### Step 3: Scrape the Selected Article
**Tool:** `tools/scrape_article.py`
**Command:** `python tools/scrape_article.py "<chosen_url>"`
**Output:** JSON object with title, url, source, and full article text in markdown

If the scrape fails (paywall, blocked), tell the user and ask them to pick a different number.

### Step 4: Agent Creates the Headline & Folder Slug
**No tool — Agent decision.**

Read the full article and create two things:

**A) Headline (for the script):** A compelling, direct title of any length. This is the real headline that opens the video.
- Direct and objective, like a news anchor would say it
- No clickbait, no filler words

**B) Folder slug (max 3 words):** A short version used only for the output folder name.
- Max 3 words, all caps, underscores
- Examples: "FISHTANK_CARE_GUIDE", "PARKOUR_WORLD_RECORD", "SPACE_ELEVATOR_PLAN"

### Step 5: Agent Writes the Script (Draft)
**No tool — Agent decision.**

Write a 30–60 second social media script (approximately 75–150 words). Rules:
- **Open with the headline** as the first line so viewers immediately know what the video is about
- Follow with a simple, interesting summary of the story
- Use short sentences. No complex words. Write like you're telling a friend
- Make it engaging — the viewer should want to stay until the end
- No hashtags, no emojis — just the story

### Step 5b: "Bar Bet" Rewrite Pass
**No tool — Agent decision. Reference:** `workflows/script_style_guide.md`

Take the draft from Step 5 and run it through these checks (in order):

1. **Hook check** — First line must use [Common Belief] + [Twist]. Rewrite if not.
2. **Bar test** — Read every sentence. Would you say this to a friend at a bar? Replace formal words ("furthermore" → "turns out", "classified as" → "basically").
3. **Sentence scan** — Any sentence over 15 words? Split it.
4. **Jargon audit** — Max 1 technical term per 30 seconds. Anchor it to a common object immediately.
5. **Voice flip** — Any passive voice? Flip to first-person active ("I found out" not "It was discovered").
6. **Outro** — End with a value-linked CTA: "I post [Category] like this every day. Subscribe so you don't miss the next [Benefit]."
7. **Breath test** — Read out loud. If you stumble, break the sentence.

The rewritten script replaces the draft. Only the final version goes into the save file.

### Step 5c: Generate Hashtags
**No tool — Agent decision.**

Create hashtags using the **Three-Tier 30-60-10 Strategy**:

1. **Search Intent tier (60%)** — High-volume, evergreen tags that tell the algorithm what the video is about.
   - Example: #Avocados, #FruitFacts, #ScienceFacts
2. **Niche/Community tier (30%)** — Specific tags for sub-cultures or communities interested in the topic.
   - Example: #PlantBiology, #AvocadoLover, #BotanicalScience
3. **Broad Discovery tier (10%)** — Massive, general tags that signal the format or vibe.
   - Example: #DidYouKnow, #Shorts, #HealthyLiving

**Rules:**
- Every tag must be strictly relevant — no spam tags (e.g., don't use #FYP on a science video).
- Use **#CamelCase** (capitalize first letter of each word) for accessibility and readability.
- Provide **two lines** — one for TikTok (conversational, trend-heavy, e.g., #ScienceTok) and one for YouTube (noun-based, search-friendly, e.g., #ScienceFacts).
- Format as a single copy-paste line per platform, tags separated by spaces.

**Output format (saved in the JSON as `hashtags`):**
```
TikTok: #Tag1 #Tag2 #Tag3 ...
YouTube: #Tag1 #Tag2 #Tag3 ...
```

### Step 6: Save Output
**Tool:** `tools/save_output.py`
**Command:** Pipe JSON or use `--input` flag

Prepare a JSON object with:
```json
{
    "topic": "<original topic>",
    "headline": "<full headline for the script>",
    "folder_slug": "<max 3 words for folder name>",
    "source": "<source domain>",
    "link": "<article URL>",
    "full_article": "<full article text>",
    "script": "<the 30-60 sec script>",
    "hashtags": "TikTok: #Tag1 #Tag2 ...\nYouTube: #Tag1 #Tag2 ...",
    "discarded_articles": [
        {"title": "...", "url": "...", "snippet": "..."},
        ...
    ]
}
```

**Output folder:** `.tmp/YYYY_MM_DD_TOPIC_FOLDERSLUG_v1/output.txt`

The `save_output.py` script prints the output folder path to stdout. Capture it for the next step.

### Step 7: Download Related Images
**Tool:** `tools/download_images_firecrawl.py`
**Command:** `python tools/download_images_firecrawl.py --prompt "<headline>" --output_dir "<output_folder_from_step_6>"`
**Output:** 10 images saved to the same folder as the output.txt

Use the **headline** from Step 4 as the search prompt. The `--output_dir` is the folder path returned by `save_output.py` in Step 6.

## Regeneration

When the user asks to regenerate:
- **"Regenerate the script"** → Rewrite Step 5 only, using the same article. Increment version.
- **"Pick a different article"** → Show the list from Step 2 again. User picks a new number, then run Steps 3–7. Increment version.
- **"Search again"** → Re-run the entire pipeline from Step 1 with the same or a new query.

## Output Format (output.txt)

Each section is clearly separated with `====` dividers:
- TOPIC
- SOURCE
- LINK
- HEADLINE
- SCRIPT (30-60 seconds)
- HASHTAGS (TikTok + YouTube lines)
- FULL ARTICLE
- OTHER CANDIDATES (discarded) — titles, URLs, and snippets

## Edge Cases

- **Firecrawl returns few or no results:** Tell the user and suggest refining the topic.
- **Article is paywalled / empty after scraping:** Inform the user and ask them to pick another number.
- **User picks an invalid number:** Ask again.
- **Rate limiting:** Wait and retry once. If it persists, inform the user.

## Credits Cost
- Search: ~2 Firecrawl credits
- Scrape: ~1 Firecrawl credit
- Image search: ~1 Firecrawl credit
- **Total per run: ~4 credits**
