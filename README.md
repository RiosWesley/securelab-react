# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Environment Variables Configuration

This project uses environment variables to manage sensitive information like API keys. To run the application locally, you need to create a `.env` file in the root directory of the project.

1.  **Create the `.env` file:**
    ```bash
    touch .env
    ```

2.  **Add the following variables to the `.env` file**, replacing the placeholder values with your actual credentials:

    ```dotenv
    # Gemini API Key
    VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY

    # Firebase Configuration
    VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
    VITE_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
    VITE_FIREBASE_DATABASE_URL=YOUR_FIREBASE_DATABASE_URL
    VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
    VITE_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
    VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
    VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
    ```

    **Important:**
    *   Make sure the variable names start with `VITE_` as required by Vite.
    *   The `.env` file is included in `.gitignore` to prevent accidentally committing your keys.

3.  **Restart your development server** if it's running for the changes to take effect.
