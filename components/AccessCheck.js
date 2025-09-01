'use client';

export default function AccessCheck({ user, requireAdmin = false, children, fallback = null }) {
  if (!user) {
    return fallback || <div className="text-gray-500">Access denied. Please log in.</div>;
  }

  if (requireAdmin && user.role !== 'admin') {
    return fallback || <div className="text-gray-500">Admin access required.</div>;
  }

  return children;
}