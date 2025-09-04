import { Page } from "@cloudflare/puppeteer";
import Turndown from "turndown";
import { z } from "zod";
import {
  generateWorkerAICompletions,
} from "./models.js";

export type ScraperLoadOptions =
  | {
      format?: "html" | "text" | "markdown" | "cleanup";
    }
  | {
      format: "custom";
      formatFunction: (page: Page) => Promise<string> | string;
    }
  | {
      format: "image";
      fullPage?: boolean;
    };

export type ScraperLoadResult = {
  url: string;
  content: string;
  format: ScraperLoadOptions["format"];
};

export type ScraperLLMOptions = {
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  mode?: "auto" | "json" | "tool" | undefined;
};

export type ScraperRunOptions = ScraperLLMOptions & ScraperLoadOptions;

export default class LLMScraper {
  constructor(
    private ai: Ai
  ) {
    this.ai = ai;
  }

  // Pre-process a page
  private async preprocess(
    page: Page,
    options: ScraperLoadOptions = { format: "html" }
  ): Promise<ScraperLoadResult> {
    const url = page.url();
    let content: string = "";

    if (options.format === "html") {
      content = await page.content();
    }

    if (options.format === "markdown") {
      const body = await page.evaluate(() => document.body.innerHTML);
      content = new Turndown().turndown(body);
    }

    if (options.format === "text") {
      const readable = (await page.evaluate(`async () => {
        const readability = await import(
          // @ts-ignore
          "https://cdn.skypack.dev/@mozilla/readability"
        );

        return new readability.Readability(document).parse();
      }`)) as any;

      content = `Page Title: ${readable.title}\n${readable.textContent}`;
    }

    if (options.format === "cleanup") {
      // await page.evaluate(cleanup);
      // content = await page.content();
      throw new Error("Cleanup not implemented");
    }

    if (options.format === "image") {
      const image = await page.screenshot({ fullPage: options.fullPage });
      content = image.toString("base64");
    }

    if (options.format === "custom") {
      if (
        !options.formatFunction ||
        typeof options.formatFunction !== "function"
      ) {
        throw new Error("customPreprocessor must be provided in custom mode");
      }

      content = await options.formatFunction(page);
    }

    return {
      url,
      content,
      format: options.format,
    };
  }

  // Generate completion using Worker AI
  private async generateCompletions<T extends z.ZodSchema<any>>(
    page: ScraperLoadResult,
    schema: T,
    options?: ScraperRunOptions
  ) {
    return generateWorkerAICompletions<T>(
      this.ai,
      page,
      schema,
      options
    );
  }

  // Pre-process the page and generate completion
  async run<T extends z.ZodSchema<any>>(
    page: Page,
    schema: T,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await this.preprocess(page, options);
    return this.generateCompletions<T>(preprocessed, schema, options);
  }
}
