import type { TemplateConfig } from './types'

export const nextjsApp: TemplateConfig = {
  id: 'nextjs-app',
  name: 'Next.js 14 (App Router)',
  description: 'Next.js 14 App Router + TypeScript + React Server Components',
  triggers: ['next', 'nextjs', 'next.js', 'app-router', 'react-server', '全栈', 'ssr', 'seo'],
  devPort: 3000,
  image: 'pipiclaw/sandbox-base:latest',
  files: [
    {
      path: 'package.json',
      content: `{
  "name": "nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p 3000",
    "build": "next build",
    "start": "next start -H 0.0.0.0 -p 3000"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
  }
}
`,
    },
    {
      path: 'tsconfig.json',
      content: `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`,
    },
    {
      path: 'next.config.mjs',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}
export default nextConfig
`,
    },
    {
      path: 'app/page.tsx',
      content: `export default function Home() {
  return (
    <main>
      <h1>Hello from Next.js 14 (PiPiClaw sandbox)</h1>
    </main>
  )
}
`,
    },
    {
      path: 'app/layout.tsx',
      content: `export const metadata = { title: 'Next.js App', description: 'PiPiClaw sandbox' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
    },
  ],
  startCommand: 'npm install && npm run dev',
  exposePorts: [3000],
  dependencies: { npm: ['next', 'react', 'react-dom'] },
  resourceHint: { cpu: 2, memoryMb: 2048 },
}
