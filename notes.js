const { GoogleGenAI } = require("@google/genai");

/**
 * @typedef {import("http").IncomingMessage & {
 *   method?: string,
 *   body?: { topic?: unknown, detailLevel?: unknown }
 * }} VercelRequest
 *
 * @typedef {import("http").ServerResponse & {
 *   status: (code: number) => VercelResponse,
 *   json: (data: unknown) => VercelResponse,
 *   setHeader: (name: string, value: string) => void
 * }} VercelResponse
 */

/**
 * Generate AI study notes.
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
                error: "Please enter a topic for your study notes."
            });
        }

        if (topic.length > 10000) {
            return res.status(400).json({
                success: false,
                error: "Topic must not exceed 10,000 characters."
            });
        }

        const detailLevel =
            typeof body.detailLevel === "string"
                ? body.detailLevel
                : "detailed";

        const ai = new GoogleGenAI({
            apiKey: apiKey
        });

        const prompt = `
Create student-friendly study notes about:

${topic}

Detail level: ${detailLevel}

Requirements:
1. Give a clear title.
2. Explain the introduction and definition.
3. Organize the main concepts using headings.
4. Use bullet points and numbered lists.
5. Include examples where useful.
6. Highlight important terms.
7. Include exam preparation points.
8. End with a short summary.
9. Do not invent facts when information is uncertain.
`;

        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction:
                    "You are StudyAI, an educational assistant who creates accurate, well-organized study notes for college students. Use clear language and explain difficult concepts step by step."
            }
        });

        return res.status(200).json({
            success: true,
            topic: topic,
            notes: response.text ||
                "No notes were generated. Please try again."
        });

    } catch (error) {
        console.error("StudyAI notes error:", error.message);

        return res.status(500).json({
            success: false,
            error: "Unable to generate study notes. Please try again."
        });
    }
}

module.exports = handler;