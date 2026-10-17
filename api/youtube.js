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
      error: "GEMINI_API_KEY is missing in Vercel."
    });
  }

  try {
    const body = req.body || {};
    const url =
      typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "Please enter a YouTube video URL."
      });
    }

    let videoUrl;

    try {
      videoUrl = new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid YouTube URL."
      });
    }

    const host = videoUrl.hostname.toLowerCase();

    const validHost = [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be",
      "www.youtube-nocookie.com"
    ].includes(host);

    if (!validHost) {
      return res.status(400).json({
        success: false,
        error: "Only YouTube video URLs are supported."
      });
    }

    let videoId = "";

    if (host === "youtu.be") {
      videoId = videoUrl.pathname.split("/").filter(Boolean)[0] || "";
    } else {
      videoId =
        videoUrl.searchParams.get("v") ||
        videoUrl.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ||
        "";
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({
        success: false,
        error: "Could not find a valid YouTube video ID."
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const model =
      process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const prompt = `
You are StudyAI, an academic seminar assistant.

Video URL:
https://www.youtube.com/watch?v=${videoId}

Create useful seminar notes based on the actual content of this video,
if the video content is accessible to you.

Return these sections:
1. Seminar title
2. Introduction
3. Main topics and explanations
4. Important points
5. Examples mentioned
6. Conclusion
7. Five questions for seminar preparation

Use simple English and clear headings.

IMPORTANT:
- Do not pretend you watched the video if you cannot access its content.
- Do not invent a transcript or claim exact statements from the video.
- If the video content is unavailable, clearly tell the student to provide
  the transcript or captions so accurate notes can be generated.
`;

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
        error: "The AI returned no notes. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      notes
    });
  } catch (error) {
    console.error("YouTube notes API error:", error);

    return res.status(500).json({
      success: false,
      error:
        "Unable to process this video. Please try again or provide its transcript."
    });
  }
};
