# Agent Instructions

You're working inside the **WAT framework** (Workflows, Agents, Tools). This architecture separates concerns so that probabilistic AI handles reasoning while deterministic code handles execution. That separation is what makes this system reliable.

## The WAT Architecture

**Layer 1: Workflows (The Instructions)**
- Markdown SOPs stored in `workflows/`
- Each workflow defines the objective, required inputs, which tools to use, expected outputs, and how to handle edge cases
- Written in plain language, the same way you'd brief someone on your team

**Layer 2: Agents (The Decision-Maker)**
- This is your role. You're responsible for intelligent coordination.
- Read the relevant workflow, run tools in the correct sequence, handle failures gracefully, and ask clarifying questions when needed
- You connect intent to execution without trying to do everything yourself
- Example: If you need to pull data from a website, don't attempt it directly. Read `workflows/scrape_website.md`, figure out the required inputs, then execute `tools/scrape_single_site.py`

**Layer 3: Tools (The Execution)**
- Python scripts in `tools/` that do the actual work
- API calls, data transformations, file operations, database queries
- Credentials and API keys are stored in `.env`
- These scripts are consistent, testable, and fast

**Why this matters:** When AI tries to handle every step directly, accuracy drops fast. If each step is 90% accurate, you're down to 59% success after just five steps. By offloading execution to deterministic scripts, you stay focused on orchestration and decision-making where you excel.

## How to Operate

**1. Look for existing tools first**
Before building anything new, check `tools/` based on what your workflow requires. Only create new scripts when nothing exists for that task.

**2. Learn and adapt when things fail**
When you hit an error:
- Read the full error message and trace
- Fix the script and retest (if it uses paid API calls or credits, check with me before running again)
- Document what you learned in the workflow (rate limits, timing quirks, unexpected behavior)
- Example: You get rate-limited on an API, so you dig into the docs, discover a batch endpoint, refactor the tool to use it, verify it works, then update the workflow so this never happens again

**3. Keep workflows current**
Workflows should evolve as you learn. When you find better methods, discover constraints, or encounter recurring issues, update the workflow. That said, don't create or overwrite workflows without asking unless I explicitly tell you to. These are your instructions and need to be preserved and refined, not tossed after one use.

## The Self-Improvement Loop

Every failure is a chance to make the system stronger:
1. Identify what broke
2. Fix the tool
3. Verify the fix works
4. Update the workflow with the new approach
5. Move on with a more robust system

This loop is how the framework improves over time.

## File Structure

**What goes where:**
- **Deliverables**: Final outputs go to cloud services (Google Sheets, Slides, etc.) where I can access them directly
- **Intermediates**: Temporary processing files that can be regenerated

**Directory layout:**
```
.tmp/           # Temporary files (scraped data, intermediate exports). Regenerated as needed.
tools/          # Python scripts for deterministic execution
workflows/      # Markdown SOPs defining what to do and how
.env            # API keys and environment variables (NEVER store secrets anywhere else)
credentials.json, token.json  # Google OAuth (gitignored)
```

**Core principle:** Local files are just for processing. Anything I need to see or use lives in cloud services. Everything in `.tmp/` is disposable.

## Environment Setup

**Python:** 3.13 with venv at `.venv/`
**Activate (if needed):** `.venv/Scripts/activate` (Windows)
**Run tools:** `& "F:/DR/GitHub/davidrf88/davidrf88.github.io/WAT/.venv/Scripts/python.exe" tools/<script>.py <args>`
**Dependencies:** `firecrawl-py`, `python-dotenv`, `requests` (see `requirements.txt`)
**API keys in `.env`:** `firecrawl_API_KEY` (note: lowercase `firecrawl`, not `FIRECRAWL`)

## Available Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| `tools/search_news.py` | Search Google News via Firecrawl | `python tools/search_news.py "<topic>"` → JSON array of 5 results |
| `tools/search_topic.py` | Search the web for articles on a topic | `python tools/search_topic.py "<topic>"` → JSON array of up to 10 results |
| `tools/scrape_article.py` | Scrape full article text from a URL | `python tools/scrape_article.py "<url>"` → JSON with markdown text |
| `tools/save_output.py` | Save output to versioned folder in `.tmp/` | `python tools/save_output.py --input <json_file>` |
| `tools/download_images_firecrawl.py` | Download images from Google Images via Firecrawl | `python tools/download_images_firecrawl.py --prompt "<text>" --output_dir "<path>"` → 10 images |

## Available Workflows

| Workflow | Purpose | SOP |
|----------|---------|-----|
| News to Script | Topic → news search → pick best article → scrape → headline → draft script → **Bar Bet rewrite** → **hashtags** → save → images | `workflows/news_to_script.md` |
| Topic to Script | Topic → web search → **user picks** article → scrape → headline → draft script → **Bar Bet rewrite** → **hashtags** → save → images | `workflows/topic_to_script.md` |
| Script Style Guide | Voice & tone rules for the "Bar Bet" rewrite pass (Step 5b). Referenced by both workflows above | `workflows/script_style_guide.md` |

## How to Run the News-to-Script Workflow

When the user gives you a topic, read `workflows/news_to_script.md` and follow these steps:

1. **Search:** Run `tools/search_news.py "<topic>"` → get 5 news results as JSON
2. **Pick:** Review the 5 results yourself (Agent decision). Prioritize: breaking news, trusted sources, emotional hook, broad appeal
3. **Scrape:** Run `tools/scrape_article.py "<chosen_url>"` → get full article text
4. **Headline & slug:** Create a full headline (any length, for the script) and a folder slug (max 3 words, for the folder name)
5. **Script (draft):** Write a 30–60 second script (~75–150 words). Opens with the headline. Simple language, short sentences, no complex words
5b. **Bar Bet rewrite:** Run the draft through the style checklist in `workflows/script_style_guide.md` — hook check, bar test, 15-word sentence limit, jargon audit, active voice, value-linked CTA, breath test. The final version replaces the draft
6. **Save:** Write a JSON file to `.tmp/input.json` with all data, then run `tools/save_output.py --input .tmp/input.json`

**Important:** Delete `.tmp/input.json` before each new run (the file must be created fresh, not edited).

**Save JSON structure:**
```json
{
    "topic": "...",
    "headline": "full headline for the script",
    "folder_slug": "MAX THREE WORDS",
    "source": "domain.com",
    "link": "https://...",
    "full_article": "clean article text",
    "script": "the 30-60 sec script",
    "discarded_articles": [{"title": "...", "url": "...", "snippet": "...", "date": "..."}]
}
```

**Regeneration:**
- "Regenerate the script" → Rewrite the script only (same article), increment version
- "Pick candidate X" → Scrape that discarded article, create new headline/slug/script, save
- "Search again" → Re-run the full pipeline from step 1

**Output:** `.tmp/YYYY_MM_DD_TOPIC_FOLDERSLUG_v1/output.txt` — contains topic, source, link, headline, script, full article, and discarded candidates

## Firecrawl SDK Notes (learned during development)

These are important quirks discovered while building the tools:

1. **Package:** `firecrawl-py` (not `firecrawl`). Import: `from firecrawl import Firecrawl`
2. **Response objects:** The SDK returns typed objects (e.g., `SearchData`, `ScrapeData`), NOT dicts. Use `hasattr()` / `getattr()` to access fields, not `.get()`
3. **Search for news:** Must pass `sources=["news"]` to get news results. Without it, only web results are returned (`.news` will be `None`)
4. **Scrape method:** The method is `client.scrape()`, NOT `client.scrape_url()`
5. **Search response structure:** `response.news` is a list of objects with `.title`, `.url`, `.snippet`, `.date` attributes
6. **Scrape response structure:** `response.markdown` for content, `response.metadata.title` for the page title
7. **Credits:** Search costs ~2 credits per call, scrape costs ~1 credit per page

## Bottom Line

You sit between what I want (workflows) and what actually gets done (tools). Your job is to read instructions, make smart decisions, call the right tools, recover from errors, and keep improving the system as you go.

Stay pragmatic. Stay reliable. Keep learning.