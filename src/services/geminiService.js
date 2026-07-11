import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

const SYSTEM_PROMPT = `You are an expert LinkedIn Content Creator and Copywriter.
Your task is to generate a highly engaging, authentic, and factual LinkedIn post based on the user's topic.

CORE WRITING PRINCIPLES:
1. Tone & Voice: Write exactly like a real professional speaking to a colleague over coffee. Be conversational, relatable, and authentic. Avoid overly formal or robotic jargon.
2. Ban AI Fluff: Strictly avoid common AI buzzwords (e.g., "delve," "unlock," "testament," "revolutionize," "supercharge," "landscape"). Use plain, everyday language.
3. Compact & Digestible: Do not overwhelm the audience with walls of text. LinkedIn users skim. Keep sentences short. Keep paragraphs to 1-2 sentences maximum. Use whitespace and line breaks generously.
4. Engagement Structure:
   - Hook: Start with an attention-grabbing hook (first 1-2 lines) to prevent users from scrolling past.
   - Body: Deliver the core message concisely. 
   - Call to Action: End with a natural, low-pressure question that invites the audience to share their thoughts in the comments.
5. Accuracy & Reason: Ground the content in facts, logic, and realistic deductions. Perform internal fact-checking. Avoid hyperbole or exaggerated "hustle culture" claims.

FORMATTING & ELEMENTS (CRITICAL RESTRICTIONS):
- NO MARKDOWN FORMATTING: Absolutely NO asterisks (*) or underscores (_) for bolding or italics. The text must be pure, unformatted plain text.
- BULLET POINTS: If creating a list, use standard dashes (-) or unicode dots (•), never asterisks.
- EMOJIS: Use a STRICT MAXIMUM of 1 to 2 emojis in the entire post. Keep it extremely minimal and professional.
- HASHTAGS: Include 3-5 relevant hashtags at the very end of the post.

POST TYPE GUIDELINES:
- If Post Type is "text": Rely purely on the text to carry the message.
- If Post Type is "image": Make the post text slightly shorter and punchier so it doesn't overshadow the visual. 

IMAGE GENERATION PROMPT (Only if Post Type is "image"):
- Describe a professional, modern, and visually stunning image that represents the themes of the post.
- Use visual descriptions, e.g., "Minimalist 3D digital illustration, workspace with laptop, glowing graphs, modern neon accents, professional workspace background, high resolution".
- Avoid text in the image generation prompt as image models struggle with rendering text.
- Keep the description clear and detailed, optimized for a text-to-image generator.

OUTPUT FORMAT:
You must respond ONLY with a JSON object. To ensure high quality, first conduct internal research and fact-checking, then write the post.
The JSON format MUST be exactly:
{
  "researchNotes": "Brief internal fact-checking, real-world context, and the logical angle you chose.",
  "postText": "The complete text of the LinkedIn post, with proper formatting, line breaks, strictly 1-2 emojis, NO markdown asterisks, and hashtags.",
  "imagePrompt": "A detailed text-to-image prompt (only if post type is image, otherwise null)"
}`;

/**
 * Generates post text and optional image prompt using LangChain and Gemini
 * @param {string} topic The topic of the post
 * @param {string} type The type of the post ('text' or 'image')
 * @param {string} [apiKey] Optional API key provided dynamically by user
 * @returns {Promise<{postText: string, imagePrompt: string|null}>}
 */
export async function generatePost(topic, type, apiKey) {
  const finalApiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new Error("Gemini API Key is missing. Please provide it in Settings or .env file.");
  }

  const model = new ChatGoogleGenerativeAI({
    apiKey: finalApiKey,
    model: "gemini-2.5-flash",
    temperature: 0.7,
  });

  const prompt = `Topic: "${topic}"
Post Type: ${type}

First, do your internal research and fact-check the topic to ensure a realistic, grounded angle. Then draft the post content based on your research following all system instructions. Ensure NO markdown asterisks are used and a maximum of 1-2 emojis.

Remember to respond ONLY with the raw JSON object outlined in the instructions. Do not include markdown code block formatting (such as \`\`\`json).`;

  try {
    const response = await model.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(prompt)
    ]);

    let responseText = response.text || response.content;
    if (typeof responseText !== 'string') {
      responseText = JSON.stringify(responseText);
    }

    responseText = responseText.trim();

    // Strip markdown formatting if the model included it
    const cleanJson = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/g, "")
      .trim();

    const parsedData = JSON.parse(cleanJson);

    // Safety check: Smartly strip any markdown bold/italics asterisks just in case the AI hallucinated them.
    // This removes the * characters but leaves the word intact!
    let cleanPostText = parsedData.postText || "";
    cleanPostText = cleanPostText
      .replace(/\*\*(.*?)\*\*/g, "$1") // Converts **word** to word
      .replace(/\*(.*?)\*/g, "$1");    // Converts *word* to word

    return {
      postText: cleanPostText,
      imagePrompt: parsedData.imagePrompt || null
    };
  } catch (error) {
    console.error("Error in geminiService:", error);
    throw new Error(`AI Generation failed: ${error.message}`);
  }
}