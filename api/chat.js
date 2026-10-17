"use strict";

const { GoogleGenAI } = require("@google/genai");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      error: "Only POST requests are allowed."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "GEMINI_API_KEY is missing in Vercel Environment Variables."
    });
  }

  try {
    const body = req.body || {};

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Please enter a message."
      });
    }

    if (message.length > 10000) {
      return res.status(400).json({
        success: false,
        error: "Your message is too long. Please use fewer than 10000 characters."
      });
    }

    const ai = new GoogleGenAI({
      apiKey
    });

    // Configure this in Vercel with a model
    // available to your Gemini API key.
    const model =
      process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const prompt = `
You are StudyAI, a friendly and knowledgeable AI study assistant.

Help students understand concepts clearly and accurately.

Guidelines:
- Explain difficult topics in simple language.
- Use examples when useful.
- Use headings and bullet points for longer answers.
- For exam questions, provide structured, exam-ready answers.
- If the student asks for code, provide readable code and explain it.
- If a question is ambiguous, ask a short clarifying question.
- Never claim to have read a file unless its contents were actually provided.

STUDENT'S MESSAGE:
${message}
`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });

    const reply =
      typeof response.text === "string"
        ? response.text.trim()
        : "";

    if (!reply) {
      return res.status(502).json({
        success: false,
        error: "The AI returned an empty response. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      reply
    });
  } catch (error) {
    console.error("StudyAI API error:", error);

    const status =
      Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status < 600
        ? error.status
        : 500;

    let message =
      "The AI could not process your request. Please try again.";

    if (status === 404) {
      message =
        "The configured Gemini model is unavailable. Check GEMINI_MODEL in Vercel.";
    } else if (status === 400) {
      message =
        "Gemini rejected the request. Check the model and request configuration.";
    } else if (status === 401 || status === 403) {
      message =
        "Gemini API authentication failed. Check your API key and permissions.";
    } else if (status === 429) {
      message =
        "Gemini API quota or rate limit reached. Please try again later.";
    }

    return res.status(status).json({
      success: false,
      error: message
    });
  }
};
