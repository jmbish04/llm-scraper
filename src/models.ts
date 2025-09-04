import { z } from "zod";
import { ScraperLoadResult, ScraperLLMOptions } from "./index.js";
import { zodToJsonSchema } from "zod-to-json-schema";

export type ScraperCompletionResult<T extends z.ZodSchema<any>> = {
  data: z.infer<T>;
  url: string;
};

const defaultPrompt =
  "You are a sophisticated web scraper. Extract the contents of the webpage";

export async function generateWorkerAICompletions<T extends z.ZodSchema<any>>(
  ai: Ai,
  page: ScraperLoadResult,
  schema: T,
  options?: ScraperLLMOptions
) {
  const systemPrompt = options?.prompt || defaultPrompt;
  const content = page.format === "image" 
    ? `[Image content provided as base64: ${page.content.substring(0, 100)}...]`
    : page.content;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Please extract data from this webpage according to the schema provided. URL: ${page.url}\n\nContent:\n${content}` }
  ];

  const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
    messages,
    temperature: options?.temperature || 0.7,
    max_tokens: options?.maxTokens || 2048,
  });

  // Handle the response properly based on Worker AI response format
  let responseText: string;
  
  if (typeof response === 'string') {
    responseText = response;
  } else if (response && typeof response === 'object') {
    // Worker AI typically returns { response: string } for text generation
    responseText = (response as any).response || JSON.stringify(response);
  } else {
    responseText = JSON.stringify(response);
  }

  // Parse the response to match the schema
  try {
    const parsed = JSON.parse(responseText);
    const validated = schema.parse(parsed);
    return {
      data: validated,
      url: page.url,
    };
  } catch (error) {
    // If parsing fails, try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const validated = schema.parse(parsed);
        return {
          data: validated,
          url: page.url,
        };
      } catch (e) {
        // If still fails, return a default structure that matches the schema
        throw new Error(`Failed to parse AI response: ${error}`);
      }
    }
    throw new Error(`Failed to extract valid JSON from AI response: ${responseText}`);
  }
}


