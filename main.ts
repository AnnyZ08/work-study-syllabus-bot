import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const QUALTRICS_API_TOKEN = Deno.env.get("QUALTRICS_API_TOKEN");
const QUALTRICS_SURVEY_ID = Deno.env.get("QUALTRICS_SURVEY_ID");
const QUALTRICS_DATACENTER = Deno.env.get("QUALTRICS_DATACENTER");
const SYLLABUS_LINK = Deno.env.get("SYLLABUS_LINK") || "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

async function loadFolderAsContext(folderPath: string): Promise<string> {
  let combined = "";

  for await (const entry of Deno.readDir(folderPath)) {
    console.log("in read directory");
    if (entry.isFile) {
        try {
          content = await Deno.readTextFile(`${folderPath}/${entry.name}`);
        } catch (err) {
          console.error("Failed to read file:", entry.name, err);
          continue; // skip this file instead of crashing
        }
      console.log(`${folderPath}/${entry.name}`);
//       const content = await Deno.readTextFile(`${folderPath}/${entry.name}`);
      combined += `\n\n===== ${entry.name} =====\n\n${content}`;
    } else throw new Error(`No files found in folder: ${folderPath}`);
  });

  console.log(`Folder ${folderPath}: loaded ${fileCount} files`);

  return combined;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  type RequestBody = {
    mode: string;
    question?: string;
  };

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.mode || !body.question) {
    return new Response("Missing mode or question", { status: 400 });
  }

  if (!GEMINI_API_KEY) {
    return new Response("Missing GEMINI API key", { status: 500 });
  }

  let inputFile = "";
  let inputFileLabel = "";

  try {
    switch (body.mode) {
      case "syllabus":
        inputFile = await Deno.readTextFile("syllabus.md");
        inputFileLabel = "syllabus file";
        break;

      case "midterm":
          console.log("Attempting to load folder:", "1026_midterm_test");
          console.log("CWD:", Deno.cwd());
          inputFile = await loadFolderAsContext("1026_midterm_test");
          inputFileLabel = "midterm materials";
          break;

      case "final":
          inputFile = await loadFolderAsContext("1026_final");
          inputFileLabel = "final exam materials";
          break;

      default:
        return new Response("Unknown mode", { status: 400 });
    }
  } catch {
    return new Response(`Error loading ${inputFileLabel}`, { status: 500 });
  }

  if (!inputFile || inputFile.trim().length === 0) {
    return new Response("No materials available for this section yet.", {
      status: 500,
    });
  }

  const prompt = `
    INSTRUCTION:
    You are an accurate course assistant.
    Answer using ONLY the provided context.
    If the answer is not in the context, say you do not know.

    CONTEXT (from ${inputFileLabel}):
    ${inputFile}

    QUESTION:
    ${body.question}
  `.trim();

  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
            { text: prompt }
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2, // controls creativity
          maxOutputTokens: 1500,
        },
    }),
  });

  const geminiJson = await geminiResponse.json();
  const baseResponse =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from Gemini";
  const result = `${baseResponse}\n\nThere may be errors in my responses; always refer to the course web page: ${SYLLABUS_LINK}`;

  let qualtricsStatus = "Qualtrics not called";

  if (QUALTRICS_API_TOKEN && QUALTRICS_SURVEY_ID && QUALTRICS_DATACENTER) {
    const qualtricsPayload = {
      values: {
        responseText: result,
        queryText: body.question,
      },
    };

    const qt = await fetch(`https://${QUALTRICS_DATACENTER}.qualtrics.com/API/v3/surveys/${QUALTRICS_SURVEY_ID}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-TOKEN": QUALTRICS_API_TOKEN,
      },
      body: JSON.stringify(qualtricsPayload),
    });

    qualtricsStatus = `Qualtrics status: ${qt.status}`;
  }

  return new Response(`${result}\n<!-- ${qualtricsStatus} -->`, {
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
