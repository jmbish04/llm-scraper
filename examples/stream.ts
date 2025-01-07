import { z } from "zod";
import LLMScraper from "../src";
import { LanguageModelV1 } from "ai";
import type { Browser } from "@cloudflare/puppeteer";

export async function run(browser: Browser, llm: LanguageModelV1) {
  // // Launch a browser instance
  // const browser = await chromium.launch();

  // // Initialize LLM provider
  // const llm = openai.chat("gpt-4o");

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

  // Run the scraper in streaming mode
  const { stream } = await scraper.stream(page, schema, {
    format: "html",
  });

  await page.close();
  await browser.close();

  // Stream the result from LLM
  // for await (const data of stream) {
  //   console.log(JSON.stringify(data.top, null, 2));
  // }

  // await page.close();
  // await browser.close();
  return stream;
}
