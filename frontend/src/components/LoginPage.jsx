import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './LoginPage.css';

import API_BASE from '../config';

function LoginPage({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getPasswordStrength = (password) => {
    if (!password) return { width: '0%', color: '#FDDECE', label: '', labelColor: '#9CA3AF' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score === 1) return { width: '25%', color: '#EF4444', label: 'Weak', labelColor: '#EF4444' };
    if (score === 2) return { width: '50%', color: '#F97316', label: 'Fair', labelColor: '#F97316' };
    if (score === 3) return { width: '75%', color: '#EAB308', label: 'Good', labelColor: '#EAB308' };
    return { width: '100%', color: '#22C55E', label: 'Strong', labelColor: '#22C55E' };
  };

  const pwStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegistering && formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegistering ? '/auth/register' : '/auth/login';
      const body = isRegistering
        ? { full_name: formData.full_name, email: formData.email, password: formData.password }
        : { email: formData.email, password: formData.password };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('ambider_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <img
          src="/logo.png"
          alt="AmbiDer Logo"
          className="login-logo"
          onError={(e) => {
            e.target.style.display = 'none';
            document.getElementById('fallback-logo-text').style.display = 'block';
          }}
        />
        <h1
          id="fallback-logo-text"
          style={{ display: 'none', color: '#E8510A', marginBottom: '20px', fontWeight: 'bold', fontFamily: 'Poppins' }}
        >
          AmbiDer
        </h1>

        <div className="login-app-name">Job Description Generator</div>
        <p className="login-subtitle">
          {isRegistering ? 'Create your account' : 'Sign in to your account'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          {isRegistering && (
            <div className="login-group">
              <label htmlFor="full_name">Full Name</label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                placeholder="e.g. John Doe"
              />
            </div>
          )}

          <div className="login-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="login-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {isRegistering && formData.password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div
                    className="strength-fill"
                    style={{ width: pwStrength.width, background: pwStrength.color }}
                  />
                </div>
                <div className="strength-label" style={{ color: pwStrength.labelColor }}>
                  {pwStrength.label}
                </div>
              </div>
            )}
          </div>

          {isRegistering && (
            <div className="login-group">
              <label htmlFor="confirm_password">Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirm_password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Please wait...' : isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="login-divider">
          <div className="login-divider-line" />
          <span className="login-divider-text">or</span>
          <div className="login-divider-line" />
        </div>

        <button
          className="login-toggle-link"
          onClick={() => {
            setIsRegistering(!isRegistering);
            setError('');
          }}
        >
          {isRegistering
            ? 'Already have an account? Sign In'
            : "Don't have an account? Register here"}
        </button>

        <div className="login-footer">
          AmbiDer Advisors &amp; Management Consultants LLP
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
