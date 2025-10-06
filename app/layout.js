import { Inter } from 'next/font/google'
import './globals.css'
import { AppProvider } from '../contexts/AppContext'
import SessionInterceptor from '../components/SessionInterceptor'

const inter = Inter({ subsets: ['latin'] })

// Static metadata - app name will be updated dynamically on the client side
export const metadata = {
  title: 'Netsync Practice Tools',
  description: 'Practice management and issue tracking system',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>
        <SessionInterceptor />
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  )
}