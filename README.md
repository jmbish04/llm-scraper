llm-scraper-worker

---

A port of [llm-scraper](https://github.com/mishushakov/llm-scraper) to Cloudflare Workers, using the [browser rendering api](https://developers.cloudflare.com/browser-rendering) and [ai sdk](https://sdk.vercel.ai/).

### Usage

- setup your `wrangler.toml`

```toml
# ...

browser = { binding = "MYBROWSER" }
```

```ts
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import LLMScraper from "llm-scraper-worker";

// ...later, in your worker...

// Launch a browser instance
const browser = await puppeteer.launch(env.MYBROWSER);

// Initialize LLM provider
const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY, // set this up in .dev.vars / secrets
});
const llm = openai.chat("gpt-4o");

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
console.log(data.top);
```

This will output:

```json
{
  "top": [
    {
      "title": "A 2-ply minimax chess engine in 84,688 regular expressions",
      "points": 245,
      "by": "ilya_m",
      "commentsURL": "https://news.ycombinator.com/item?id=42619652"
    },
    {
      "title": "Stimulation Clicker",
      "points": 2365,
      "by": "meetpateltech",
      "commentsURL": "https://news.ycombinator.com/item?id=42611536"
    },
    {
      "title": "AI and Startup Moats",
      "points": 37,
      "by": "vismit2000",
      "commentsURL": "https://news.ycombinator.com/item?id=42620994"
    },
    {
      "title": "How I program with LLMs",
      "points": 370,
      "by": "stpn",
      "commentsURL": "https://news.ycombinator.com/item?id=42617645"
    },
    {
      "title": "First time a Blender-made production has won the Golden Globe",
      "points": 155,
      "by": "jgilias",
      "commentsURL": "https://news.ycombinator.com/item?id=42620656"
    }
  ]
}
```
