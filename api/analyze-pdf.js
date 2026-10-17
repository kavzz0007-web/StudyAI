import { GoogleGenAI } from "@google/genai";
import pdf from "pdf-parse";

const MAX_PDF_SIZE = 3 * 1024 * 1024;
const MAX_TEXT_LENGTH = 80000;

const VALID_TASKS = [
    "summary",
    "study-notes",
    "questions",
    "flashcards"
];

const VALID_LANGUAGES = [
    "Simple English",
    "Tamil",
    "Tanglish"
];

function sendError(res, status, message) {
    return res.status(status).json({
        success: false,
        error: message
    });
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");

        return sendError(
            res,
            405,
            "Only POST requests are allowed."
        );
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return sendError(
                res,
                500,
                "GEMINI_API_KEY is not configured in Vercel."
            );
        }

        const {
            fileName,
            fileData,
            task,
            language
        } = req.body || {};

        if (
            typeof fileName !== "string" ||
            !fileName.toLowerCase().endsWith(".pdf")
        ) {
            return sendError(
                res,
                400,
                "Please upload a PDF file."
            );
        }

        if (
            typeof fileData !== "string" ||
            fileData.length === 0
        ) {
            return sendError(
                res,
                400,
                "PDF data is missing."
            );
        }

        if (!VALID_TASKS.includes(task)) {
            return sendError(
                res,
                400,
                "Choose a valid PDF analysis task."
            );
        }

        const outputLanguage = VALID_LANGUAGES.includes(language)
            ? language
            : "Simple English";

        const estimatedSize = Math.floor(
            fileData.length * 3 / 4
        );

        if (estimatedSize > MAX_PDF_SIZE) {
            return sendError(
                res,
                413,
                "PDF must be 3 MB or smaller."
            );
        }

        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(fileData)) {
            return sendError(
                res,
                400,
                "Invalid Base64 PDF data."
            );
        }

        const pdfBuffer = Buffer.from(fileData, "base64");

        if (
            pdfBuffer.length === 0 ||
            pdfBuffer.length > MAX_PDF_SIZE
        ) {
            return sendError(
                res,
                413,
                "The PDF is empty or exceeds the 3 MB limit."
            );
        }

        if (
            pdfBuffer.subarray(0, 5).toString() !== "%PDF-"
        ) {
            return sendError(
                res,
                400,
                "The uploaded file is not a valid PDF."
            );
        }

        const parsedPdf = await pdf(pdfBuffer);

        const extractedText = String(
            parsedPdf.text || ""
        ).trim();

        if (!extractedText) {
            return sendError(
                res,
                422,
                "No readable text found. Scanned PDFs may require OCR."
            );
        }

        const textTruncated =
            extractedText.length > MAX_TEXT_LENGTH;

        const documentText = extractedText.slice(
            0,
            MAX_TEXT_LENGTH
        );

        const taskInstructions = {
            summary: `
Create a clear summary of the document.
Include the main ideas, important facts, key definitions,
and a short conclusion.
`,

            "study-notes": `
Create organized, exam-ready study notes.
Use headings, subheadings, bullet points, definitions,
examples, important keywords, and a quick revision section.
`,

            questions: `
Create 10 useful practice questions based on the document.
Include a mixture of short-answer and descriptive questions.
Provide answers after the questions in a separate answer key.
`,

            flashcards: `
Create 15 concise revision flashcards.
Format each card as:
Q: Question
A: Answer
Focus on important definitions, concepts, facts, and formulas.
`
        };

        const ai = new GoogleGenAI({
            apiKey
        });

        const model =
            process.env.GEMINI_MODEL || "gemini-3.8-flash";

        const response = await ai.models.generateContent({
            model,
            contents: `
You are StudyAI, an educational assistant.

Analyze the supplied document and produce accurate,
student-friendly study material.

OUTPUT LANGUAGE: ${outputLanguage}

TASK:
${taskInstructions[task]}

RULES:
- Base your answer on the supplied document.
- Do not invent facts that are not supported by the document.
- Explain difficult ideas in simple language.
- Preserve important technical terms and formulas.
- Use clear headings and readable formatting.
- If information is missing, say so honestly.

DOCUMENT NAME:
${fileName}

DOCUMENT CONTENT:
${documentText}
`
        });

        const result = String(
            response.text || ""
        ).trim();

        if (!result) {
            return sendError(
                res,
                502,
                "The AI returned an empty response. Please try again."
            );
        }

        return res.status(200).json({
            success: true,
            fileName,
            task,
            language: outputLanguage,
            textTruncated,
            result
        });

    } catch (error) {
        console.error(
            "PDF analysis error:",
            error?.message || error
        );

        return sendError(
            res,
            500,
            "PDF analysis failed. Check your PDF format, Gemini model configuration, and Vercel function logs."
        );
    }
}
