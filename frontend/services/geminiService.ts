import { GoogleGenAI } from "@google/genai";

// As per guidelines, the API key must be obtained exclusively from `process.env.API_KEY`.
// We assume this is pre-configured and accessible.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Helper function to convert a File object to a GoogleGenerativeAI.Part object.
const fileToGenerativePart = async (file: File) => {
  // FIX: Explicitly type the Promise to resolve with a string, fixing the `unknown` type error.
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

/**
 * Uses a multimodal model to extract key information from a provided file.
 * @param file The file (image or text) to analyze.
 * @param prompt The instruction for what information to extract.
 * @returns A promise that resolves to the extracted information as a string.
 */
export const extractInfoFromFile = async (file: File, prompt: string): Promise<string> => {
    try {
        const filePart = await fileToGenerativePart(file);
        const textPart = { text: prompt };

        // Use a model that supports multimodal input.
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [filePart, textPart] },
        });

        return response.text;
    } catch (error) {
        console.error('Error extracting info from file with Gemini:', error);
        return 'Sorry, I had trouble reading the contents of your file.';
    }
};


/**
 * Generates a response from the Gemini model based on a given prompt.
 * @param prompt The complete prompt, including any RAG context and the user's query.
 * @returns A promise that resolves to the AI's generated response as a string.
 */
export const getAiResponse = async (prompt: string): Promise<string> => {
  try {
    // UPDATED: Using gemini-2.5-pro for complex reasoning tasks like RAG.
    // This model is better at following strict instructions and reasoning over provided context.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });
    
    // As per guidelines, access the text directly from the response object.
    const text = response.text;
    return text;

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    // Provide a user-friendly error message.
    return 'Sorry, I encountered an error while trying to generate a response. Please check the console for details and try again later.';
  }
};