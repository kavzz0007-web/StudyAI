"use strict";

const { GoogleGenAI } = require("@google/genai");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

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
        ? body.detailLevel.trim()
        : "medium";

    const language =
      typeof body.language === "string"
        ? body.language.trim()
        : "English";

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

    const allowedLevels = ["short", "medium", "detailed"];

    const level = allowedLevels.includes(detailLevel)
      ? detailLevel
      : "medium";

    const instructions = {
      short: "Create concise revision notes with key points.",
      medium: "Create well-organized study notes with explanations and examples.",
      detailed: "Create comprehensive study notes with definitions, detailed explanations, examples, advantages, applications, and a conclusion where relevant."
    };

    const ai = new GoogleGenAI({
      apiKey: apiKey
    });

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",

      contents: `
You are StudyAI, an expert academic study assistant.

Generate useful, accurate study notes for the topic:
"${topic}"

Language: ${language}

Instructions:
- ${instructions[level]}
- Use clear headings and subheadings.
- Explain difficult concepts in simple language.
- Include important definitions and examples.
- Use numbered lists and bullet points where helpful.
- Include formulas or text-based diagrams when relevant.
- Highlight important exam points.
- Finish with a short summary.
- Do not invent facts.
- Return readable plain text or Markdown.
`
    });

    const notes = response.text || "";

    if (!notes.trim()) {
      return res.status(502).json({
        success: false,
        error: "The AI returned empty notes. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      topic: topic,
      notes: notes
    });

  } catch (error) {
    console.error("Notes API error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to generate notes. Please check your API configuration and try again."
    });
  }
};
