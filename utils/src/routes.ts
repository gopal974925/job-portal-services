import express from 'express';
import  cloudinary  from 'cloudinary';
import dotenv from "dotenv"
import {ai} from "./index.js"
import * as fs from "node:fs";

dotenv.config()
const router = express.Router();

router.post('/upload', async (req, res) => {
  try {
    const { buffer,public_id } = req.body;
    if (public_id) {
      await cloudinary.v2.uploader.destroy(public_id);
    }

    const cloude=await cloudinary.v2.uploader.upload(buffer)
    res.json({ url: cloude.secure_url, public_id: cloude.public_id });
    console.log("pic Uploaded complted");
}
catch (error:any) { 
    res.status(500).json({ error: error.message });
}
}
)





router.post("/career", async (req, res) => {
  try {
    const { skills } = req.body;

    if (!skills) {
      return res.status(400).json({
        message: "Skills are required",
      });
    }

    const prompt = `
Based on the following skills: ${skills}.

Act as a career advisor and generate a career path suggestion.

Your response MUST be valid JSON.
Do not include markdown, code fences, or any text outside the JSON.

Use exactly this structure:

{
  "summary": "A brief, encouraging summary of the user's skill set and general job title.",
  "jobOptions": [
    {
      "title": "The name of the job role.",
      "responsibilities": "A description of what the user would do in this role.",
      "why": "An explanation of why this role is a good fit for their skills."
    }
  ],
  "skillsToLearn": [
    {
      "category": "A general category for skill improvement.",
      "skills": [
        {
          "title": "The name of the skill to learn.",
          "why": "Why learning this skill is important.",
          "how": "Specific examples of how to learn or apply this skill."
        }
      ]
    }
  ],
  "learningApproach": {
    "title": "How to Approach Learning",
    "points": [
      "A bullet point list of actionable advice for learning."
    ]
  }
}
`;

    const interaction = await ai.interactions.create({
      model: "models/gemini-3-flash-preview",
      input: prompt,
    });

    if (!interaction.output_text) {
      return res.status(500).json({
        message: "AI did not return a response",
      });
    }

    const rawText = interaction.output_text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let careerData;

    try {
      careerData = JSON.parse(rawText);
    } catch (error) {
      return res.status(500).json({
        message: "AI returned invalid JSON",
      });
    }

    return res.status(200).json(careerData);

  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Something went wrong",
    });
  }
});


router.post("/career/resume", async (req, res) => {
  try {
    const { pdfBase64 } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({
        message: "Resume is required",
      });
    }

    const prompt = `
You are an expert ATS (Applicant Tracking System) analyzer.

Analyze the provided resume and provide:

1. An ATS compatibility score from 0-100.
2. A detailed score breakdown.
3. Specific suggestions to improve ATS performance.
4. Strengths of the resume.
5. A brief overall summary.

Your entire response MUST be valid JSON.
Do not include markdown, code fences, or any text outside the JSON.

Use exactly this structure:

{
  "atsScore": 85,
  "scoreBreakdown": {
    "formatting": {
      "score": 90,
      "feedback": "Brief feedback on formatting"
    },
    "keywords": {
      "score": 80,
      "feedback": "Brief feedback on keyword usage"
    },
    "structure": {
      "score": 85,
      "feedback": "Brief feedback on resume structure"
    },
    "readability": {
      "score": 88,
      "feedback": "Brief feedback on readability"
    }
  },
  "suggestions": [
    {
      "category": "Formatting",
      "issue": "Description of the issue found",
      "recommendation": "Specific actionable recommendation",
      "priority": "high"
    }
  ],
  "strengths": [
    "List of things the resume does well for ATS"
  ],
  "summary": "A brief 2-3 sentence summary of the overall ATS performance"
}

Focus on:

- File format and structure compatibility
- Standard section headings
- Keyword optimization
- Tables, columns, graphics, and special characters
- Contact information placement
- Date formatting
- Action verbs
- Quantifiable achievements
- Section organization and flow
`;

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "").trim();

    // Send the actual ATS prompt + PDF
    const interaction = await ai.interactions.create({
      model: "gemini-3-flash-preview",
      input: [
        {
          type: "text",
          text: prompt,
        },
        {
          type: "document",
          data: cleanBase64,
          mime_type: "application/pdf",
        },
      ],
    });
     let jsonResponse;
     let rawText;

    if (!interaction.output_text) {
      return res.status(500).json({
        message: "AI did not return a response",
      });
    }

    try {
      rawText = interaction.output_text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      if (!rawText) {
        throw new Error("AI did not return a valid text response");
      }
      jsonResponse = JSON.parse(rawText);
    } catch (error) {
      console.error("Invalid AI JSON:", rawText);

      return res.status(500).json({
        message: "AI returned invalid JSON",
      });
    }

    return res.status(200).json(jsonResponse);

  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      message: error.message || "Something went wrong",
    });
  }
});


export default router;

