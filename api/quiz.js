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

    const requestedCount = Number(body.count) || 5;

    const count = Math.max(
      1,
      Math.min(10, Math.floor(requestedCount))
    );

    const requestedDifficulty =
      typeof body.difficulty === "string"
        ? body.difficulty.toLowerCase()
        : "medium";

    const allowedDifficulties = [
      "easy",
      "medium",
      "hard"
    ];

    const difficulty = allowedDifficulties.includes(
      requestedDifficulty
    )
      ? requestedDifficulty
      : "medium";

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: "Please enter a quiz topic."
      });
    }

    if (topic.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Topic must be under 500 characters."
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey
    });

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",

      contents: `
You are StudyAI, an expert quiz creator.

Create exactly ${count} multiple-choice questions.

Topic: ${topic}
Difficulty: ${difficulty}

Requirements:
- Each question must test understanding of the topic.
- Each question must have exactly four answer options.
- Only one option must be correct.
- correctAnswer must be the zero-based index of the correct option (0, 1, 2, or 3).
- Give a short, accurate explanation for each answer.
- Avoid duplicate questions.
- Do not include information unrelated to the topic.

Return ONLY valid JSON in this exact format:
{
  "title": "Quiz title",
  "questions": [
    {
      "question": "Question text",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "correctAnswer": 0,
      "explanation": "Explanation of the correct answer"
    }
  ]
}
`
    });

    let text = response.text || "";

    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      throw new Error("The AI did not return valid JSON.");
    }

    const quiz = JSON.parse(text.slice(start, end + 1));

    if (
      !quiz ||
      !Array.isArray(quiz.questions) ||
      quiz.questions.length === 0
    ) {
      throw new Error("The generated quiz has no questions.");
    }

    const questions = quiz.questions
      .slice(0, count)
      .map((question) => {
        if (
          typeof question.question !== "string" ||
          !Array.isArray(question.options) ||
          question.options.length !== 4 ||
          !Number.isInteger(question.correctAnswer) ||
          question.correctAnswer < 0 ||
          question.correctAnswer > 3 ||
          typeof question.explanation !== "string"
        ) {
          throw new Error("The AI returned an invalid question.");
        }

        return {
          question: question.question,
          options: question.options.map(String),
          correctAnswer: question.correctAnswer,
          explanation: question.explanation
        };
      });

    return res.status(200).json({
      success: true,
      quiz: {
        title: quiz.title || `${topic} Quiz`,
        questions: questions
      }
    });

  } catch (error) {
    console.error("Quiz API error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to generate the quiz. Please try again."
    });
  }
};
