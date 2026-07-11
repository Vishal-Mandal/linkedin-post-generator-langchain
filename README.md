# LinkedIn Post Studio 

An AI-powered dashboard that generates contextually rich LinkedIn posts, processes visual media, displays them in a real-time feed preview, and publishes them directly to your personal LinkedIn profile using LangChain, Google Gemini APIs, and LinkedIn APIs.

---

##  Features

1. **AI Post Generation (LangChain + Gemini):** Generates engaging LinkedIn copy with attention-grabbing hooks, clean layout spacing, proper emojis, and relevant hashtags.
2. **AI Visual Creator (Pollinations.ai):** When creating an image post, it uses Google Gemini to write a high-fidelity image prompt, generates the graphic in real-time, caches it locally, and displays it.
3. **LinkedIn Feed Simulator:** A pixel-perfect, interactive simulation of the LinkedIn feed (supporting both Light/Dark styled variations depending on client configuration) to preview your post exactly as it will look live.
4. **Publishing Integrations:** Supports posting text and image attachments directly to LinkedIn.
5. **Smart Fallbacks & Mock Mode:** If no LinkedIn credentials are set, the server runs in **Mock Mode** by default. Post requests are validated, logged to the server, and simulate successful network publishes.

---

##  Setup Instructions

### 1. Prerequisites
- **Node.js:** Ensure Node.js v18 or newer is installed (`node -v`).

### 2. Configure Environment
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your keys:
   - **`GEMINI_API_KEY`**: Obtain this key for free from [Google AI Studio](https://aistudio.google.com/).
   - **`LINKEDIN_ACCESS_TOKEN`**: A Member Social Token with the `w_member_social` permission.

> **Tip:** You can also paste these keys directly into the UI dashboard by clicking the **Settings (gear)** icon. Settings typed in the browser are securely saved in `localStorage` and will override the `.env` configuration.

---

##  Running the Project

1. Run development server (runs with hot reloading using nodemon):
   ```bash
   npm run dev
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

##  File Structure

- `/public`: Static frontend files (HTML structural grids, glassmorphism styles, controller)
- `/src/services/geminiService.js`: Integration point for `@langchain/google-genai` and Gemini-2.5-flash
- `/src/services/linkedinService.js`: Handles UGC publication, digital media uploads, and user authentication
- `/src/server.js`: Standard API routing, asset caching, and static server setup
- `/temp_uploads`: Temporary directory created dynamically to hold generated or downloaded images
