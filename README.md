# iRedlof AI Chat

A premium, mission-critical AI chat application built with Next.js 14, designed for power users who need reliable, secure, and multi-model AI interactions.

![iRedlof AI Chat](/logo.png)

## 🚀 Mission Critical Features

iRedlof is engineered for reliability, security, and versatility. It goes beyond simple chat interfaces to provide a robust workspace for AI collaboration.

### 1. Dual-Mode Interface
*   **Standard Chat:** A full-featured chat interface supporting Markdown, code syntax highlighting, and persistent history. Perfect for coding, writing, and general assistance.
*   **Battle Mode ⚔️:** A specialized split-screen interface to compare two different AI models (e.g., Gemini 1.5 Pro vs. GPT-4o) side-by-side.
    *   **Synchronized Inputs:** Send the same prompt to both models simultaneously.
    *   **Independent Configuration:** Choose different models for each side to test reasoning capabilities.
    *   **Usage Tracking:** Compare token usage and cost in real-time.

### 2. Enterprise-Grade Security 🔒
Security is a core pillar of iRedlof. We ensure your data and API keys remain under your control.
*   **Client-Side Encryption:** API keys are encrypted using **AES-256-GCM** with a user-defined PIN.
*   **Local Storage Only:** Keys and chat history are stored exclusively in your browser's `localStorage`. No data is ever sent to a third-party database.
*   **Session Security:** Decrypted keys exist only in `sessionStorage` and are cleared when you close the tab.
*   **Selective Transmission:** The app intelligently sends *only* the required API key (Gemini or OpenAI) to the server for the specific model being used.

### 3. Multi-Model Support 🤖
Seamlessly switch between leading AI providers:
*   **Google Gemini:** Support for Gemini 1.5 Flash, Pro, and experimental models.
*   **OpenAI:** Support for GPT-4o, GPT-4o-mini, and legacy models.
*   **Extensible Architecture:** Built on Vercel's AI SDK, making it easy to add new providers.

### 4. Smart Widgets 🧩
A customizable dashboard to keep you informed while you work:
*   **Weather:** Real-time weather data with location autocomplete (powered by Google Maps & OpenWeather).
*   **Stocks:** Track real-time market data for single tickers or watchlists (powered by Yahoo Finance).
*   **GitHub Activity:** Monitor commit history and contributions.
*   **World Clock:** Keep track of time across multiple timezones.

---

## 🛠️ Getting Started

### Prerequisites
*   **Node.js 18+** installed.
*   **npm**, **yarn**, or **pnpm**.
*   **API Keys:**
    *   [Google Gemini API Key](https://aistudio.google.com/app/apikey)
    *   [OpenAI API Key](https://platform.openai.com/api-keys)
    *   (Optional) Google Maps API Key for location services.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd ai-chat
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env.local` file in the root directory. This is required for server-side features like the Weather widget's location search.

    ```env
    # Required for Weather Widget Location Search
    GOOGLE_MAPS_API_KEY=your_google_maps_api_key

    # Optional: Default Server-Side Keys (Fallbacks)
    GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
    OPENAI_API_KEY=your_openai_key
    ```

4.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

5.  **Open the App:**
    Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💻 Development & Debugging

### Project Structure
*   `app/`: Next.js App Router pages and API routes.
    *   `api/`: Server-side API endpoints (Chat, Weather, etc.).
    *   `battle/`: Battle Mode page.
    *   `widgets/`: Widget Dashboard page.
*   `components/`: Reusable React components.
    *   `chat/`: Core chat components (Interface, Input, Settings).
    *   `widgets/`: Widget implementations.
*   `utils/`: Helper functions.
    *   `apiKeyEncryption.ts`: Cryptography logic.
    *   `settingsStorage.ts`: Local storage management.
*   `hooks/`: Custom React hooks (`useManualChat`).

### Syncing Locally
To keep your local environment up to date:

1.  **Pull latest changes:**
    ```bash
    git pull origin main
    ```
2.  **Install new dependencies:**
    ```bash
    npm install
    ```
3.  **Check for database/env changes:**
    Review the commit logs or ask the team if new environment variables are required.

### Debugging Guide

#### 1. API Key Issues
*   **Symptom:** "Missing API Key" error.
*   **Fix:**
    *   Check **Settings** (Gear icon) to ensure keys are entered.
    *   If keys are encrypted, ensure you have **Unlocked** them with your PIN.
    *   Check the browser console (`F12`) for specific error messages.

#### 2. Weather Widget Errors
*   **Symptom:** "Location search unavailable".
*   **Fix:**
    *   Verify `GOOGLE_MAPS_API_KEY` is set in `.env.local`.
    *   Restart the dev server (`Ctrl+C`, `npm run dev`) after changing `.env.local`.

#### 3. Hydration Errors
*   **Symptom:** "Text content does not match server-rendered HTML".
*   **Fix:**
    *   This often happens due to `localStorage` reading. Ensure components accessing storage use the `useEffect` + `mounted` pattern to only render on the client.

#### 4. Build Errors
*   **Fix:**
    *   Clear the Next.js cache:
        ```bash
        rm -rf .next
        npm run dev
        ```

---

## 📦 Deployment

### Vercel (Recommended)
The easiest way to deploy is using [Vercel](https://vercel.com).

1.  Push your code to a Git repository (GitHub/GitLab).
2.  Import the project into Vercel.
3.  **Critical:** Add your Environment Variables (`GOOGLE_MAPS_API_KEY`, etc.) in the Vercel Project Settings.
4.  Deploy!

### Firebase Hosting
To deploy to Firebase Hosting using GitHub Actions:

1.  **Configure Project ID:**
    *   Update `.firebaserc` and replace `your-project-id` with your actual Firebase Project ID.
    *   Update `.github/workflows/firebase-deploy.yml` and replace `your-project-id` (in two places) with your actual ID.

2.  **Generate Service Account:**
    *   Go to Firebase Console -> Project Settings -> Service accounts.
    *   Click "Generate new private key".
    *   This will download a JSON file.

3.  **Add GitHub Secret:**
    *   Go to your GitHub Repository -> Settings -> Secrets and variables -> Actions.
    *   Create a new repository secret named `FIREBASE_SERVICE_ACCOUNT_YOUR_PROJECT_ID` (replace `YOUR_PROJECT_ID` with your actual ID, matching the workflow file).
    *   Paste the *entire content* of the JSON file as the secret value.

4.  **Push to Main:**
    *   Any push to the `main` branch will now trigger a deployment!

---

## 🤝 Contributing

1.  Create a feature branch (`git checkout -b feature/amazing-feature`).
2.  Commit your changes (`git commit -m 'feat: Add amazing feature'`).
3.  Push to the branch (`git push origin feature/amazing-feature`).
4.  Open a Pull Request.

---

Built with ❤️ by the iRedlof Team.
