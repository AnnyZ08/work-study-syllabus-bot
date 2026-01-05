# Syllabus Bot (OpenAI, Deno)

Minimal bot that answers course/assignment questions using OpenAI with `syllabus.md` as context. Embeds in Brightspace and can optionally log to Qualtrics.

## Features
- Accepts free-text questions
- Combines three bots together and allows user to select the specific bot
- Calls OpenAI with `syllabus.md`
- Optionally logs `{queryText, responseText}` to Qualtrics
- Works as a standalone web page or Brightspace embed

## 1. Create your copy
- Use this template on GitHub (e.g., `syllabus-bot-3210`, `paragraph-marker`)

## 2. Replace syllabus content
- Edit `syllabus.md` and `midterm.md` and `final.md` with your course policies and course information (this text is sent with each query)
- ***Please do not change the file names, only edit the content.
## 3. Deploy backend to Deno
- Sign in at https://dash.deno.com → **+ New Project** → **Add Github Account** → **Install Deno** -> Click linked account
- Select your repo
- Production branch: `main`
- Entry point: `main.ts`
- Create the project (you'll get a `https://<name>.deno.dev` URL)

## 4. Add environment variables
In **Deno → Settings → Environment Variables**, add:

    OPENAI_API_KEY=your OpenAI API key
    SYLLABUS_LINK=public link to the syllabus or course webpage
    QUALTRICS_API_TOKEN=(optional)
    QUALTRICS_SURVEY_ID=(optional)
    QUALTRICS_DATACENTER=(optional, e.g., uwo.eu)
    OPENAI_MODEL=(optional, default gpt-4o-mini)

Qualtrics variables can be accessed through: 
- **Qualtrics -> Creat New Project -> Survey Flow** -> Add Two **Embedded Data (repsonseText, QueryText) -> Apply**
- Go back to homepage and activate the survey
- Get SURVEY_ID from URL
- Generate API_TOKEN from user settings

## 5. Point the frontend to your backend
In `index.html`, replace the fetch URL with your Deno URL, e.g.:

    fetch("https://your-app-name.deno.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: userQuery })
    });

## 6. Host the frontend (GitHub Pages)
- Repo → **Settings → Pages**
- Branch: `main`, Folder: `/ (root)` → **Save**
- Use the published URL (e.g., `https://yourusername.github.io/yourbot/`)
- For Brightspace, you can also paste `brightspace.html` as a content item or widget

## 7. Enable or Disable bots
- If there are multiple bots and you want to enable or disable bots, edit `index.html` line 98 and 99. Change values to true if you want the bot to be locked (NOT showed on the page), false if you want to show the bots.
- Save changes on GitHub, you don't have to deploy the webpage again. The changes will be automatically synced once you save.
## Notes
- CORS headers are returned by `main.ts`, so the Brightspace iframe can call your backend.
- Each deployment has its own backend; ensure the frontend fetch URL matches the correct Deno project.
- Responses are capped at **1500 tokens**; increase `max_tokens` in `main.ts` if you need longer answers.
- Hitting OpenAI usage/quota limits may surface as a generic server error—retry or switch to a cheaper model via `OPENAI_MODEL`.

## Qualtrics (optional)
- In your survey, add embedded data fields: `responseText`, `queryText`.
- The response includes an HTML comment like `<!-- Qualtrics status: 200 -->` to confirm logging.

## Files
- `index.html` — public interface
- `brightspace.html` — LMS-friendly wrapper
- `main.ts` — Deno backend (OpenAI API)
- `syllabus.md` — syllabus/grading text used as context
- `README.md` — this file

## License
© Dan Bousfield. CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
