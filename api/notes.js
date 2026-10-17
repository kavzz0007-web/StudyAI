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

    const topic =
      typeof body.topic === "string"
        ? body.topic.trim()
        : "";

    const detailLevel =
      typeof body.detailLevel === "string"
        ? body.detailLevel.trim().toLowerCase()
        : "medium";

    const language =
      typeof body.language === "string"
        ? body.language.trim()
        : "Simple English";

    const format =
      typeof body.format === "string"
        ? body.format.trim()
        : "Study notes";

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: "Please enter a study topic."
      });
    }

    if (topic.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Topic must be under 500 characters."
      });
    }

    const allowedLevels = [
      "short",
      "medium",
      "detailed"
    ];

    const level = allowedLevels.includes(detailLevel)
      ? detailLevel
      : "medium";

    const instructions = {
      short:
        "Create concise revision notes with the most important points.",

      medium:
        "Create well-organized notes with clear explanations and useful examples.",

      detailed:
        "Create comprehensive notes with definitions, detailed explanations, examples, advantages, applications, and a conclusion where relevant."
    };

    const prompt = `
You are StudyAI, an expert academic tutor.

Create study notes for the following topic.

TOPIC: ${topic}

NOTE FORMAT: ${format}

EXPLANATION LANGUAGE: ${language}

DETAIL LEVEL:
${instructions[level]}

REQUIREMENTS:
1. Use the requested language.
2. Use clear headings and subheadings.
3. Explain concepts in simple, student-friendly language.
4. Include important definitions and examples.
5. Use bullet points and numbered lists where useful.
6. Include formulas or text-based diagrams when relevant.
7. If the format is an exam answer, organize the content for exam preparation.
8. Highlight important points.
9. End with a short summary.
10. Do not invent facts.
11. Return readable Markdown without enclosing the entire answer in a code block.
`;

    const ai = new GoogleGenAI({
      apiKey
    });

    // Set GEMINI_MODEL in Vercel to a model
    // that is available to your Gemini API key.
    const model =
      process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });

    const notes =
      typeof response.text === "string"
        ? response.text.trim()
        : "";

    if (!notes) {
      return res.status(502).json({
        success: false,
        error: "The AI returned empty notes. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      topic,
      notes
    });
  } catch (error) {
    console.error("Notes API error:", error);

    const status =
      Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status < 600
        ? error.status
        : 500;

    // Return a useful error without exposing secrets.
    let message =
      "Unable to generate notes. Please try again.";

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
