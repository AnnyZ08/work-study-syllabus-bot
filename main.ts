import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const QUALTRICS_API_TOKEN = Deno.env.get("QUALTRICS_API_TOKEN");
const QUALTRICS_SURVEY_ID = Deno.env.get("QUALTRICS_SURVEY_ID");
const QUALTRICS_DATACENTER = Deno.env.get("QUALTRICS_DATACENTER");
const SYLLABUS_LINK = Deno.env.get("SYLLABUS_LINK") || "";
// New: allow model override, default to gpt-4o-mini
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

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

  if (!OPENAI_API_KEY) {
    return new Response("Missing OpenAI API key", { status: 500 });
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
        inputFile = await Deno.readTextFile("midterm.md");
        inputFileLabel = "midterm file";
        break;

      case "final":
        inputFile = await Deno.readTextFile("final.md");
        inputFileLabel = "final exam file";
        break;

      default:
        return new Response("Unknown mode", { status: 400 });
    }
  } catch {
    return new Response(`Error loading ${inputFileLabel}`, { status: 500 });
  }

  const messages = [
    {
      role: "system",
      content:
          "You are an accurate course assistant. Answer using ONLY the provided context.",
    },
    {
      role: "system",
      content: `Here is important context from ${inputFileLabel}:\n\n${inputFile}`,
    },
    {
      role: "user",
      content: body.question,
    },
  ];

  const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      max_tokens: 1500, // gives room for long answers
    }),
  });

  const openaiJson = await openaiResponse.json();
  const baseResponse = openaiJson?.choices?.[0]?.message?.content || "No response from OpenAI";
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
