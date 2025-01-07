import { z } from "zod";
import LLMScraper from "../src";
import type { Browser } from "@cloudflare/puppeteer";
import type { LanguageModelV1 } from "@ai-sdk/provider";

export async function run(browser: Browser, llm: LanguageModelV1) {
  // Create a new LLMScraper
  const scraper = new LLMScraper(llm);

  // Open new page
  const page = await browser.newPage();
  await page.goto("https://news.ycombinator.com");

  // Define schema to extract contents into
  const schema = z.object({
    top: z
      .array(
        z.object({
          title: z.string(),
          points: z.number(),
          by: z.string(),
          commentsURL: z.string(),
        })
      )
      .length(5)
      .describe("Top 5 stories on Hacker News"),
  });

  // Run the scraper
  const { data } = await scraper.run(page, schema, {
    format: "html",
  });

  await page.close();
  await browser.close();

  // Show the result from LLM
  return data;
}
