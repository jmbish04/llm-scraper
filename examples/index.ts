import puppeteer from "@cloudflare/puppeteer";

import { run as runHN } from "./hn";
import { run as runStream } from "./stream";
// import { run as runCodegen } from "./codegen";
import { createOpenAI } from "@ai-sdk/openai";

type Env = {
  MYBROWSER: Fetcher;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        `
        <!doctype html>
        <html>
          <body>
            <h1>LLM Scraper Worker Examples</h1>
            <a href="/hn">HN</a>
            <a href="/stream">Stream</a>
            <!-- <a href="/codegen">Codegen</a> -->
          </body>
        </html>
        `,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 404 });
    }

    // Launch a browser instance
    const browser = await puppeteer.launch(env.MYBROWSER);

    // Initialize LLM provider
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const llm = openai.chat("gpt-4o");

    if (url.pathname === "/hn") {
      const data = await runHN(browser, llm);
      return Response.json(data);
    }

    if (url.pathname === "/stream") {
      const data = await runStream(browser, llm);

      // let's stream the data as a stream of JSON objects

      const textEncoder = new TextEncoder();

      const readableStream = new ReadableStream({
        start(controller) {
          data.pipeTo(
            new WritableStream({
              write: (chunk) =>
                controller.enqueue(textEncoder.encode(JSON.stringify(chunk))),
            })
          );
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/plain",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    // if (url.pathname === "/codegen") {
    //   const data = await runCodegen(browser, llm);
    //   return Response.json(data);
    // }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
