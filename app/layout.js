import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

// Function to fetch app name from settings
async function getAppName() {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/settings/general`, {
      cache: 'no-store' // Ensure fresh data
    });
    const data = await response.json();
    return data.appName || 'Issue Tracker';
  } catch (error) {
    console.error('Error fetching app name:', error);
    return 'Issue Tracker';
  }
}

// Generate metadata dynamically
export async function generateMetadata() {
  const appName = await getAppName();
  return {
    title: `Netsync ${appName}`,
    description: 'Track and manage issues efficiently',
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon.ico',
      apple: '/favicon.ico',
    },
  };
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}