llm-scraper-worker

---

A Cloudflare Worker that uses Worker AI and browser rendering to scrape websites with LLM-powered content extraction.

## Features

- 🤖 **Worker AI Integration**: Uses Cloudflare's native AI models (`@cf/meta/llama-3.1-8b-instruct`)
- 🌐 **Browser Rendering**: Powered by Cloudflare's browser rendering API
- 🔐 **API Authentication**: Secure endpoints with API key authentication
- 🎨 **Web Interface**: Simple HTML frontend for easy testing
- 📡 **REST API**: RESTful endpoints for programmatic access

## API Endpoints

### POST /api/scrape

Scrape a website and extract content using AI.

**Headers:**
```
Authorization: Bearer YOUR_WORKER_AUTH_API_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "url": "https://example.com",
  "prompt": "Extract the main content from this webpage"
}
```

**Response:**
```json
{
  "data": {
    "content": "Extracted content here..."
  },
  "url": "https://example.com"
}
```

## Deployment

1. Set up your environment variables:
```bash
echo "WORKER_AUTH_API_KEY=your-secret-key" > .dev.vars
```

2. Deploy to Cloudflare Workers:
```bash
npx wrangler deploy
```

3. Set the `WORKER_AUTH_API_KEY` secret in your Cloudflare dashboard.

## Local Development

```bash
npm install
npx wrangler dev
```

Note: Browser rendering and Worker AI require deployment to Cloudflare Workers to function fully.

## Web Interface

Visit your deployed worker URL to access the web interface with:
- API Key input field
- URL to scrape input field  
- Custom prompt input field (with default prompt)

## Usage Example

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/api/scrape \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "prompt": "Extract the main heading and key information"
  }'
```
