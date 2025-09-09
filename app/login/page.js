'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

function LoginLogo() {
  const [logoSrc, setLogoSrc] = useState('/netsync.svg');
  
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const response = await fetch('/api/settings/general');
        const data = await response.json();
        if (data.loginLogo) {
          setLogoSrc(data.loginLogo);
        }
      } catch (error) {
        console.error('Error loading login logo:', error);
      }
    };
    loadLogo();
  }, []);
  
  return (
    <img 
      src={logoSrc} 
      alt="Logo" 
      className="h-16 w-auto"
    />
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginStep, setLoginStep] = useState('');
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [passwordChangeData, setPasswordChangeData] = useState({ newPassword: '', confirmPassword: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [appName, setAppName] = useState('');

  useEffect(() => {
    console.log('[LOGIN] Component mounted, starting auth checks...');
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check-session');
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            router.push('/');
            return;
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
    };
    
    checkAuth();
    
    // Check if SSO is enabled
    const checkSsoEnabled = async () => {
      console.log('[LOGIN] Checking SSO status...');
      try {
        const response = await fetch('/api/auth/sso-status');
        console.log('[LOGIN] SSO status response:', response.status, response.ok);
        if (response.ok) {
          const data = await response.json();
          console.log('[LOGIN] SSO status data:', data);
          setSsoEnabled(data.enabled);
          console.log('[LOGIN] SSO enabled state set to:', data.enabled);
        } else {
          console.error('[LOGIN] SSO status response not ok:', response.status);
        }
      } catch (error) {
        console.error('[LOGIN] SSO status check error:', error);
      }
    };
    
    // Load application name from settings
    const loadAppName = async () => {
      try {
        const response = await fetch('/api/settings/general');
        if (response.ok) {
          const data = await response.json();
          setAppName(data.appName || '');
        }
      } catch (error) {
        console.error('Error loading app name:', error);
        setAppName('');
      }
    };
    
    checkSsoEnabled();
    loadAppName();
    
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    const emailParam = searchParams.get('email');
    
    if (errorParam) {
      // Use custom message if provided, otherwise use default messages
      if (messageParam) {
        setError(decodeURIComponent(messageParam));
      } else if (errorParam === 'user_not_in_system') {
        setError(`Authentication successful, but ${emailParam || 'your account'} is not authorized to access this system. Please contact your administrator.`);
      } else if (errorParam === 'user_not_found') {
        setError('Your account was removed from the system. Please contact your administrator.');
      } else if (errorParam === 'user_not_sso_enabled') {
        setError(`Your account ${emailParam || ''} is not configured for SSO login. Please use local login or contact your administrator.`);
      } else if (errorParam === 'access_denied') {
        setError('Access denied. Your account is not authorized to access this application. Please contact your administrator.');
      } else if (errorParam === 'saml_validation_failed') {
        setError('SAML authentication failed. Please try again or contact your administrator.');
      } else if (errorParam === 'no_email_in_saml') {
        setError('No email address found in SAML response. Please contact your administrator.');
      } else {
        setError('Login failed. Please try again or contact your administrator.');
      }
    }
  }, [searchParams, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setLoginStep('Authenticating...');

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.requirePasswordChange) {
          setRequirePasswordChange(true);
          setLoading(false);
          setLoginStep('');
          return;
        }
        
        setLoginStep('Success! Redirecting...');
        localStorage.setItem('user', JSON.stringify(data.user));
        
        await new Promise(resolve => setTimeout(resolve, 800));
        router.push('/');
      } else {
        // Handle specific error cases with appropriate messages
        let errorMessage = 'Login failed';
        
        try {
          const data = await response.json();
          if (data.error) {
            errorMessage = data.error;
          }
        } catch (e) {
          console.error('Error parsing response:', e);
        }
        
        if (response.status === 401) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (response.status === 403) {
          errorMessage = 'Your account is not authorized to access this system. Please contact your administrator.';
        } else if (response.status === 429) {
          errorMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
        } else if (response.status >= 500) {
          errorMessage = 'Server error occurred. Please try again later or contact support.';
        }
        
        setError(errorMessage);
        setLoading(false);
        setLoginStep('');
      }
    } catch (error) {
      setError('Network error occurred');
      setLoading(false);
      setLoginStep('');
    }
  };
  
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    if (passwordChangeData.newPassword !== passwordChangeData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          currentPassword: formData.password,
          newPassword: passwordChangeData.newPassword
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to change password');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <LoginLogo />
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-2">
            {appName}
          </h2>
          <p className="text-blue-600/70">
            Sign in to access your dashboard
          </p>
        </div>
        
        <div className="card">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          <div className="space-y-4">
            {/* Netsync Employee Login - Only show if SSO is enabled */}
            {ssoEnabled && (
              <button
                onClick={() => window.location.href = '/api/auth/saml/login'}
                className="w-full bg-blue-600 text-white py-4 px-4 rounded-md hover:bg-blue-700 flex items-center justify-center gap-3 font-medium transition-colors text-lg"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                Netsync Employee
              </button>
            )}
            
            {/* Local User Login Toggle */}
            <button
              onClick={() => setShowLocalLogin(!showLocalLogin)}
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-200 flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              Everyone Else
              <svg className={`w-4 h-4 transition-transform ${showLocalLogin ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {/* Local Login Form */}
          {showLocalLogin && (
            <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t border-gray-200 space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="input-field"
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="input-field pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className={`w-full ${loading ? 'btn-disabled' : 'btn-primary'} flex items-center justify-center gap-2 transition-all duration-300 ${loading ? 'transform scale-95' : ''}`}
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {loading ? loginStep || 'Signing in...' : 'Sign in'}
              </button>
              
              {loading && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 text-blue-600 text-sm">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <p className="text-blue-600/70 text-xs mt-2">{loginStep}</p>
                </div>
              )}
            </form>
          )}
          
          {/* Password Change Modal */}
          {requirePasswordChange && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Password Change Required</h3>
                  <p className="text-gray-600 text-sm">
                    For security purposes, you must change your password before accessing the system.
                  </p>
                </div>
                
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordChangeData.newPassword}
                        onChange={(e) => setPasswordChangeData({...passwordChangeData, newPassword: e.target.value})}
                        className="input-field pr-10"
                        placeholder="Enter new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showNewPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordChangeData.confirmPassword}
                        onChange={(e) => setPasswordChangeData({...passwordChangeData, confirmPassword: e.target.value})}
                        className="input-field pr-10"
                        placeholder="Confirm new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <EyeIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading || passwordChangeData.newPassword !== passwordChangeData.confirmPassword || !passwordChangeData.newPassword}
                    className={`w-full ${loading || passwordChangeData.newPassword !== passwordChangeData.confirmPassword || !passwordChangeData.newPassword ? 'btn-disabled' : 'btn-primary'} flex items-center justify-center gap-2`}
                  >
                    {loading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    {loading ? 'Updating Password...' : 'Change Password'}
                  </button>
                  
                  {passwordChangeData.newPassword && passwordChangeData.confirmPassword && passwordChangeData.newPassword !== passwordChangeData.confirmPassword && (
                    <p className="text-sm text-red-600 text-center">Passwords do not match</p>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}