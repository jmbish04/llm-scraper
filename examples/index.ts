import puppeteer from "@cloudflare/puppeteer";
import { z } from "zod";
import LLMScraper from "../src";

type Env = {
  MYBROWSER: Fetcher;
  AI: Ai;
  WORKER_AUTH_API_KEY: string;
};

// Authentication middleware
function authenticate(request: Request, env: Env): boolean {
  // If no API key is configured, deny access
  if (!env.WORKER_AUTH_API_KEY) {
    return false;
  }
  
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === env.WORKER_AUTH_API_KEY;
}

// Scrape API handler
async function handleScrapeAPI(request: Request, env: Env): Promise<Response> {
  // Check authentication
  if (!authenticate(request, env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as { url: string; prompt?: string };
    
    if (!body.url) {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(body.url);
    } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Check if browser is available (might not be in local dev)
    if (!env.MYBROWSER) {
      return Response.json({ 
        error: 'Browser not available in local development. Deploy to Cloudflare to test full functionality.' 
      }, { status: 503 });
    }

    // Launch browser
    const browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();
    
    try {
      // Navigate to the URL with timeout
      await page.goto(body.url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Check if AI is available
      if (!env.AI) {
        await page.close();
        await browser.close();
        return Response.json({ 
          error: 'AI service not available in local development. Deploy to Cloudflare to test full functionality.' 
        }, { status: 503 });
      }

      // Create LLM scraper with Worker AI
      const scraper = new LLMScraper(env.AI);

      // Define a flexible schema that can capture any structured data
      const schema = z.object({
        content: z.any().describe("Extracted content from the webpage"),
      });

      // Run the scraper
      const result = await scraper.run(page, schema, {
        format: "text",
        prompt: body.prompt || "You are a sophisticated web scraper. Extract the contents of the webpage"
      });

      // Clean up resources
      try {
        await page.close();
      } catch (e) {
        console.error('Failed to close page:', e);
      }
      try {
        await browser.close();
      } catch (e) {
        console.error('Failed to close browser:', e);
      }

      return Response.json(result);
    } catch (error) {
      // Clean up resources safely
      try {
        await page.close();
      } catch (e) {
        console.error('Failed to close page:', e);
      }
      try {
        await browser.close();
      } catch (e) {
        console.error('Failed to close browser:', e);
      }
      
      return Response.json(
        { error: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    return Response.json(
      { error: `Request processing failed: ${error instanceof Error ? error.message : 'Invalid JSON'}` },
      { status: 400 }
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle API routes
    if (url.pathname === "/api/scrape" && request.method === "POST") {
      return handleScrapeAPI(request, env);
    }

    // Serve static files
    if (url.pathname === "/" || url.pathname === "/index.html") {
      // Serve inline HTML (Node.js fs/path modules don't work in Cloudflare Workers)
      return new Response(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM Scraper</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #555;
        }
        input[type="text"], input[type="password"], textarea {
            width: 100%;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            box-sizing: border-box;
        }
        textarea {
            height: 100px;
            resize: vertical;
        }
        button {
            background-color: #007cba;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
        }
        button:hover {
            background-color: #005a8a;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        .result {
            margin-top: 30px;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 5px;
            border-left: 4px solid #007cba;
        }
        .error {
            border-left-color: #dc3545;
            background-color: #f8d7da;
            color: #721c24;
        }
        .loading {
            text-align: center;
            color: #666;
        }
        pre {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 LLM Scraper</h1>
        <form id="scraperForm">
            <div class="form-group">
                <label for="apiKey">API Key:</label>
                <input type="password" id="apiKey" name="apiKey" required placeholder="Enter your Worker Auth API Key">
            </div>
            
            <div class="form-group">
                <label for="url">URL to Scrape:</label>
                <input type="text" id="url" name="url" required placeholder="https://example.com">
            </div>
            
            <div class="form-group">
                <label for="prompt">Prompt:</label>
                <textarea id="prompt" name="prompt" placeholder="Enter your extraction prompt...">You are a sophisticated web scraper. Extract the contents of the webpage</textarea>
            </div>
            
            <button type="submit" id="submitBtn">🚀 Scrape Website</button>
        </form>
        
        <div id="result" style="display: none;"></div>
    </div>

    <script>
        document.getElementById('scraperForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('submitBtn');
            const resultDiv = document.getElementById('result');
            const apiKey = document.getElementById('apiKey').value;
            const url = document.getElementById('url').value;
            const prompt = document.getElementById('prompt').value;
            
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Scraping...';
            resultDiv.style.display = 'block';
            resultDiv.className = 'result loading';
            resultDiv.innerHTML = '<p>Processing your request...</p>';
            
            try {
                const response = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${apiKey}\`
                    },
                    body: JSON.stringify({
                        url: url,
                        prompt: prompt || 'You are a sophisticated web scraper. Extract the contents of the webpage'
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Request failed');
                }
                
                // Show success result
                resultDiv.className = 'result';
                resultDiv.innerHTML = \`
                    <h3>✅ Scraping Successful</h3>
                    <p><strong>URL:</strong> \${data.url}</p>
                    <h4>Extracted Data:</h4>
                    <pre>\${JSON.stringify(data.data, null, 2)}</pre>
                \`;
                
            } catch (error) {
                // Show error result
                resultDiv.className = 'result error';
                resultDiv.innerHTML = \`
                    <h3>❌ Error</h3>
                    <p>\${error.message}</p>
                \`;
            } finally {
                // Reset button
                submitBtn.disabled = false;
                submitBtn.textContent = '🚀 Scrape Website';
            }
        });
    </script>
</body>
</html>`, {
          headers: {
            "Content-Type": "text/html",
          }
        });
    }

    // Handle favicon
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 404 });
    }

    // Default 404 for other routes
    return Response.json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
