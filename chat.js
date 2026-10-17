const { GoogleGenAI } = require("@google/genai");

/**
 * @typedef {import("http").IncomingMessage & {
 *   method?: string,
 *   body?: { message?: unknown }
 * }} VercelRequest
 *
 * @typedef {import("http").ServerResponse & {
 *   status: (code: number) => VercelResponse,
 *   json: (data: unknown) => VercelResponse,
 *   setHeader: (name: string, value: string) => void
 * }} VercelResponse
 */

/**
 * StudyAI Chat API
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
                error: "Message is too long."
            });
        }

        const ai = new GoogleGenAI({
            apiKey: apiKey
        });

        const response = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            contents: message,
            config: {
                systemInstruction:
                    "You are StudyAI, a friendly study assistant. Explain concepts clearly, use headings and bullet points, give examples, and help students prepare for exams."
            }
        });

        return res.status(200).json({
            success: true,
            reply: response.text ||
                "I couldn't generate a response. Please try again."
        });

    } catch (error) {
        console.error("StudyAI API error:", error.message);

        return res.status(500).json({
            success: false,
            error: "Unable to generate an AI response. Please try again."
        });
    }
}

module.exports = handler;