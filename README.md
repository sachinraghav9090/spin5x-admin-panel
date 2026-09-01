# Spin5X Admin Panel

A modern, responsive admin panel for the Spin5X rewards platform built with React 18, Vite, Tailwind CSS, and Firebase.

## Features

- **User Management** - View, search, filter, and manage all users with bulk actions
- **Withdrawals Management** - Approve, reject, and process withdrawal requests
- **Content Management** - Manage Tasks, Quizzes, and Surveys
- **Real-time Chat** - Communicate with users and manage support tickets
- **Analytics Dashboard** - Platform metrics, revenue trends, user acquisition funnels
- **Ad Configuration** - Configure AdMob/Unity Ads with test/live mode switching
- **App Configuration** - Version management, reward settings, maintenance mode
- **Security Settings** - 2FA, session management, audit logs, API keys

## Tech Stack

- **React 18** with functional components and hooks
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for responsive, modern styling
- **React Router v6** for client-side routing
- **TanStack Query (React Query)** for server state management
- **Zustand** for client state management
- **Firebase** (Auth, Firestore) for backend
- **Lucide React** for beautiful icons
- **React Hot Toast** for notifications
- **date-fns** for date formatting

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Firebase project with Firestore and Auth enabled

### Installation

```bash
cd admin-panel
npm install
```

### Configuration

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Fill in your Firebase configuration in `.env.local`

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build

```bash
npm run build
```

Output will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Deployment to Netlify

1. Connect your repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variables in Netlify dashboard (same as `.env.local`)

The `netlify.toml` file handles:
- SPA routing redirects
- Security headers
- Asset caching
- Build configuration

## Project Structure

```
admin-panel/
├── public/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── Layout.jsx    # Main layout with sidebar navigation
│   ├── pages/            # Page components
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Users.jsx
│   │   ├── Withdrawals.jsx
│   │   ├── Tasks.jsx
│   │   ├── Quizzes.jsx
│   │   ├── Surveys.jsx
│   │   ├── Chat.jsx
│   │   ├── Analytics.jsx
│   │   ├── AdConfig.jsx
│   │   ├── Settings.jsx
│   │   └── NotFound.jsx
│   ├── stores/           # Zustand stores
│   │   └── authStore.js  # Authentication state
│   ├── firebase/         # Firebase configuration
│   │   └── config.js
│   ├── hooks/            # Custom hooks (future use)
│   ├── utils/            # Utility functions (future use)
│   ├── App.jsx           # Main app with routing
│   ├── main.jsx          # Entry point
│   └── index.css         # Global styles with Tailwind
├── .env.example
├── netlify.toml
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Authentication

The admin panel uses Firebase Auth with email/password. Only users with `isAdmin: true` in their Firestore user document can access the panel.

## Firestore Collections Used

- `Users` - User accounts and profiles
- `Withdrawals` - Withdrawal requests
- `Tasks` - Available tasks
- `Quizzes` - Quiz content
- `Surveys` - Survey content
- `Chats` - Support chat conversations
- `Transactions` - Points transactions
- `AdConfigs` - Ad network configuration
- `AppConfig` - App-wide settings

## Security

- Firebase Auth for authentication
- Admin role verification on every request
- Firestore security rules (configure separately)
- Environment variables for sensitive config
- Security headers via Netlify

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## License

Private - Spin5X Platform