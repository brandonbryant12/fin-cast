import { GoogleGenerativeAI } from '@google/genai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function generateContent(prompt: string) {
  // Use the models.generateContent method instead of getGenerativeModel
  const model = genAI.models;
  
  try {
    const result = await model.generateContent({
      model: 'gemini-pro',
      contents: prompt,
    });

    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating content:', error);
    throw error;
  }
} 