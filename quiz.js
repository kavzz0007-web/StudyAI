const { GoogleGenAI } = require("@google/genai");

/**
 * @typedef {import("http").IncomingMessage & {
 *   method?: string,
 *   body?: {
 *     topic?: unknown,
 *     count?: unknown,
 *     difficulty?: unknown
 *   }
 * }} VercelRequest
 *
 * @typedef {import("http").ServerResponse & {
 *   status: (code: number) => VercelResponse,
 *   json: (data: unknown) => VercelResponse,
 *   setHeader: (name: string, value: string) => void
 * }} VercelResponse
 */

/**
 * Generate a multiple-choice quiz.
 * @param {VercelRequest} req
 * @param {VercelResponse} res
 */
async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        return res.status(405).json({
            success: false,
            error: "Method not allowed. Use POST."
        });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(503).json({
                success: false,
                error: "Gemini API key is not configured."
            });
        }

        const body = req.body || {};

        const topic =
            typeof body.topic === "string"
                ? body.topic.trim()
                : "";

        if (!topic) {
            return res.status(400).json({
                success: false,
                error: "Please enter a quiz topic."
            });
        }

        if (topic.length > 5000) {
            return res.status(400).json({
                success: false,
                error: "Topic must not exceed 5,000 characters."
            });
        }

        const count =
            Number.isInteger(body.count) &&
            body.count >= 1 &&
            body.count <= 20
                ? body.count
                : 5;

        const allowedDifficulties = [
            "easy",
            "medium",
            "hard"
        ];

        const difficulty =
            typeof body.difficulty === "string" &&
            allowedDifficulties.includes(body.difficulty.toLowerCase())
                ? body.difficulty.toLowerCase()
                : "medium";

        const ai = new GoogleGenAI({
            apiKey: apiKey
        });

        const prompt = `
Create a multiple-choice quiz about: ${topic}

Number of questions: ${count}
Difficulty: ${difficulty}

Return ONLY valid JSON in this exact structure:
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
      "explanation": "Short explanation"
    }
  ]
}

Rules:
- Each question must have exactly four options.
- correctAnswer must be an integer from 0 to 3.
- Questions must be accurate and educational.
- Do not repeat questions.
- Include a short explanation for every answer.
- Generate exactly ${count} questions.
- Do not include Markdown fences.
`;

        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                systemInstruction:
                    "You are StudyAI, a careful educational quiz creator. Generate clear, accurate questions and return only valid JSON."
            }
        });

        const rawText = response.text;

        if (!rawText) {
            throw new Error("The AI returned an empty response.");
        }

        const quiz = JSON.parse(rawText);

        if (
            !quiz ||
            !Array.isArray(quiz.questions) ||
            quiz.questions.length !== count
        ) {
            throw new Error("The generated quiz has an invalid structure.");
        }

        for (const question of quiz.questions) {
            if (
                typeof question.question !== "string" ||
                !Array.isArray(question.options) ||
                question.options.length !== 4 ||
                !Number.isInteger(question.correctAnswer) ||
                question.correctAnswer < 0 ||
                question.correctAnswer > 3 ||
                typeof question.explanation !== "string"
            ) {
                throw new Error("A generated question is invalid.");
            }
        }

        return res.status(200).json({
            success: true,
            quiz: quiz
        });

    } catch (error) {
        console.error("StudyAI quiz error:", error.message);

        return res.status(500).json({
            success: false,
            error: "Unable to generate the quiz. Please try again."
        });
    }
}

module.exports = handler;