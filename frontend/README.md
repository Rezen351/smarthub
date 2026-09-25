# Frontend - ENYX-Smart Hub

React + Vite + TypeScript frontend for ENYX-Smart Hub.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable components
│   │   ├── layout/     # Dashboard layout
│   │   ├── auth/       # Auth components
│   │   ├── dashboard/  # Dashboard components
│   │   └── shared/     # Shared UI components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom hooks
│   ├── lib/            # Utilities
│   ├── styles/         # Global styles
│   ├── types/          # TypeScript types
│   ├── App.tsx         # Main app with routing
│   └── main.tsx        # Entry point
├── public/             # Static assets
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## 🎨 Theme

- **Colors**: Green (#166534) + White
- **Font**: Poppins
- **Style**: Minimalis, no shadow

## 🔐 Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@enyx.local | password | ADMIN |
| weighing@enyx.local | password | WEIGHING_OPERATOR |
| sorting@enyx.local | password | SORTING_OPERATOR |
| warehouse@enyx.local | password | WAREHOUSE_OPERATOR |
| delivery@enyx.local | password | DELIVERY_OPERATOR |
| farmer@enyx.local | password | FARMER |

## 🛠️ Tech Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- React Router DOM 7
- Axios
