const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const app = express();
// Enable JSON body parsing for API requests
app.use(express.json());

// Cloud Run automatically sets the PORT environment variable.
const PORT = process.env.PORT || 8080;

// --- GOOGLE CLOUD API SETUP (Gemini) ---

// In production, the API key is read from the environment, securely injected by Cloud Run (see deployment steps).
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

// Initialize the GoogleGenAI client if the API key is available
let ai;
if (GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log("Gemini AI client initialized successfully.");
} else {
    // This warning is crucial for the developer/operator to know the API is not connected.
    console.warn("GEMINI_API_KEY is not set. The /api/generate endpoint will not work until the secret is configured in Cloud Run.");
}

// --- ROUTES ---

// 1. Basic HTML Page Route (frontend for interaction)
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cloud Run AI Generator</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { font-family: 'Inter', sans-serif; }
      </style>
    </head>
    <body class="bg-gray-100 flex justify-center items-start min-h-screen p-8">
      <div class="container bg-white p-8 rounded-xl shadow-2xl max-w-lg w-full mt-10">
        <h1 class="text-3xl font-extrabold text-blue-700 mb-4 text-center">Serverless AI Content Generator</h1>
        <p class="text-gray-600 mb-6 text-center text-sm">
          This containerized Node.js app hosted on Cloud Run calls the Gemini API securely.
        </p>
        
        <form id="ai-form" class="space-y-4">
          <input type="text" id="prompt-input" placeholder="e.g., Write a haiku about serverless computing" 
                 class="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-inner" required>
          <button type="submit" id="submit-button" 
                  class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 shadow-lg hover:shadow-xl disabled:bg-gray-400">
            Generate Content
          </button>
        </form>
        
        <div id="loading" class="text-center text-blue-600 mt-4 hidden">
            <svg class="animate-spin h-5 w-5 mr-3 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Generating...
        </div>
        
        <div class="mt-8 pt-4 border-t border-gray-200">
            <h2 class="text-xl font-semibold text-gray-700 mb-2">AI Response:</h2>
            <p id="response-output" class="whitespace-pre-wrap text-gray-800 bg-gray-50 p-4 rounded-xl border-2 border-dashed border-blue-200 min-h-24 flex items-center justify-center text-base italic text-center">
                The AI's response will appear here.
            </p>
        </div>

        <script>
            document.getElementById('ai-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const prompt = document.getElementById('prompt-input').value;
                const loading = document.getElementById('loading');
                const output = document.getElementById('response-output');
                const button = document.getElementById('submit-button');

                output.textContent = '';
                loading.classList.remove('hidden');
                button.disabled = true;
                output.classList.remove('text-red-600');
                output.classList.remove('italic');

                try {
                    const response = await fetch('/api/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: prompt })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || \`HTTP error! Status: \${response.status}\`);
                    }

                    const data = await response.json();
                    output.textContent = data.text;
                } catch (error) {
                    console.error('API Error:', error);
                    output.textContent = \`Error: \${error.message}. Please ensure the GEMINI_API_KEY is correctly configured on the Cloud Run service.\`;
                    output.classList.add('text-red-600');
                    output.classList.add('italic');
                } finally {
                    loading.classList.add('hidden');
                    button.disabled = false;
                }
            });
        </script>
      </div>
    </body>
    </html>
  `);
});

// 2. API Endpoint for AI Generation
app.post('/api/generate', async (req, res) => {
    if (!ai) {
        // Log a detailed error for the operator
        console.error("Critical Error: AI service is not configured because GEMINI_API_KEY is missing from environment.");
        return res.status(503).json({ error: "AI service is unavailable. The server is missing required configuration (API Key)." });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required in the request body.' });
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                // Keep output token count small for a quick demo
                maxOutputTokens: 256, 
            }
        });
        
        const generatedText = response.candidates[0].content.parts[0].text;

        // Respond with the generated text
        res.json({ text: generatedText });

    } catch (error) {
        console.error("Gemini API call failed:", error);
        res.status(500).json({ error: 'Failed to generate content from the AI model due to an internal API error.' });
    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Web application listening on port ${PORT}`);
});
