import './globals.css';
import { AuthProvider } from '../hooks/useAuth.js';

export const metadata = {
  title: 'Practice Tools',
  description: 'Development Platform with Authentication, Versioning, and Notifications',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}