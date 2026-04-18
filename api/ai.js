import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { studentName, subjects, attendance, avgMarks } = req.body;

    if (!studentName || !subjects || !attendance || avgMarks === undefined) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

    const prompt = `Analyze this student performance data and respond ONLY with valid JSON in this exact format - NO other text:

{
  "summary": "Short performance summary (1-2 sentences)",
  "suggestions": "3 actionable improvement suggestions (bullet points as text)"
}

Student Data:
Name: ${studentName}
Subjects: ${JSON.stringify(subjects)}
Attendance: ${attendance}%
Average Marks: ${avgMarks.toFixed(1)}/100

Risk level: ${avgMarks < 40 ? 'High' : avgMarks < 70 ? 'Medium' : 'Low'}

Provide professional, helpful insights for student improvement.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{.*\}/s);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const aiData = JSON.parse(jsonMatch[0]);

    res.status(200).json(aiData);

  } catch (error) {
    console.error('AI API Error:', error);
    res.status(500).json({ 
      error: 'AI analysis failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
