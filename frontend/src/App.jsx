import { useState, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { HelpCircle, Bell, LogOut } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import Sidebar from "./components/Sidebar";
import InputForm from "./components/InputForm";
import OutputPage from "./components/OutputPage";
import LoginPage from "./components/LoginPage";
import SavedJDs from "./components/SavedJDs";
import History from "./components/History";
import Analytics from "./components/Analytics";
import Reports from "./components/Reports";
import Templates from "./components/Templates";
import Settings from "./components/Settings";
import "./App.css";

import API_BASE from "./config";

function App() {
  const [theme] = useState(
    localStorage.getItem("theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"),
  );

  // Apply theme class to documentElement
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const [formData, setFormData] = useState({});
  const [generatedJD, setGeneratedJD] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      text: "Your JD was auto-saved successfully.",
      time: "Just now",
      read: false,
    },
    {
      id: 2,
      text: "Analytics data has been updated.",
      time: "5 min ago",
      read: false,
    },
    {
      id: 3,
      text: "New template: Senior Data Scientist available.",
      time: "1 hr ago",
      read: true,
    },
  ]);
  const notifRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function checkAuth() {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        throw new Error("Token expired");
      }

      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem("token");
      }
    } catch (err) {
      console.error("Auth error:", err);
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkAuth();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    navigate("/");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  const handleGenerate = async (jdText, data) => {
    setGeneratedJD(jdText);
    setFormData(data);
    navigate("/output");

    // Auto-save JD
    try {
      const token = localStorage.getItem("token");
      const saveRes = await fetch(`${API_BASE}/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...data, jd_text: jdText }),
      });
      const saveData = await saveRes.json();
      if (saveData.id) {
        setFormData((prev) => ({ ...prev, saved_jd_id: saveData.id }));
      }
    } catch (err) {
      console.error("Failed to auto-save JD:", err);
    }
  };

  const handleJDUpdate = (updatedJD) => {
    setGeneratedJD(updatedJD);
  };

  const handleRegenerate = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          skills: Array.isArray(formData.skills)
            ? formData.skills.join(", ")
            : formData.skills,
        }),
      });
      const data = await res.json();
      if (data.jd) {
        setGeneratedJD(data.jd);
      }
    } catch (err) {
      console.error("Regenerate failed:", err);
    }
  };

  const handleJDLoad = (jdText, prefill) => {
    setGeneratedJD(jdText);
    if (prefill) {
      setFormData((prev) => ({ ...prev, ...prefill }));
    }
    navigate("/output");
  };

  const handleNavigate = (path, prefill) => {
    if (prefill) {
      setFormData((prev) => ({ ...prev, ...prefill }));
    }
    navigate(path);
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "var(--bg-gray)",
        }}
      >
        Loading AmbiDer...
      </div>
    );
  }

  if (!user && location.pathname !== "/login") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-wrapper">
      <Routes>
        <Route
          path="/login"
          element={
            !user ? (
              <LoginPage onLoginSuccess={handleLoginSuccess} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="*"
          element={
            user ? (
              <>
                <header className="top-nav">
                  <div className="top-nav-left">
                    <div className="top-nav-title">
                      <h1>AmbiDer Job Description Generator</h1>
                    </div>
                  </div>
                  <div className="top-nav-right">
                    <button className="top-nav-icon" aria-label="Help">
                      <HelpCircle size={18} />
                    </button>
                    <button
                      className="top-nav-icon"
                      aria-label="Notifications"
                      onClick={() => setNotifOpen((prev) => !prev)}
                      style={{ position: "relative" }}
                    >
                      <Bell size={18} />
                      {notifications.some((n) => !n.read) && (
                        <span className="nav-badge"></span>
                      )}
                    </button>
                    {notifOpen && (
                      <div
                        ref={notifRef}
                        style={{
                          position: "absolute",
                          top: "52px",
                          right: "90px",
                          width: "320px",
                          background: "#fff",
                          border: "1px solid var(--border)",
                          borderRadius: "12px",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                          zIndex: 9999,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            padding: "16px",
                            borderBottom: "1px solid var(--border)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: "14px" }}>
                            Notifications
                          </span>
                          <button
                            onClick={() =>
                              setNotifications((prev) =>
                                prev.map((n) => ({ ...n, read: true })),
                              )
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: "#E8510A",
                              fontSize: "12px",
                              cursor: "pointer",
                              fontWeight: 500,
                            }}
                          >
                            Mark all read
                          </button>
                        </div>
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() =>
                              setNotifications((prev) =>
                                prev.map((x) =>
                                  x.id === n.id ? { ...x, read: true } : x,
                                ),
                              )
                            }
                            style={{
                              padding: "12px 16px",
                              borderBottom: "1px solid var(--border)",
                              cursor: "pointer",
                              background: n.read ? "#fff" : "#FFF7F5",
                              display: "flex",
                              gap: "12px",
                              alignItems: "flex-start",
                            }}
                          >
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: n.read ? "transparent" : "#E8510A",
                                marginTop: "5px",
                                flexShrink: 0,
                              }}
                            ></div>
                            <div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "var(--text-primary)",
                                  lineHeight: "1.4",
                                }}
                              >
                                {n.text}
                              </div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-secondary)",
                                  marginTop: "4px",
                                }}
                              >
                                {n.time}
                              </div>
                            </div>
                          </div>
                        ))}
                        {notifications.length === 0 && (
                          <div
                            style={{
                              padding: "24px",
                              textAlign: "center",
                              color: "var(--text-secondary)",
                              fontSize: "13px",
                            }}
                          >
                            No notifications
                          </div>
                        )}
                      </div>
                    )}
                    <div className="top-nav-user" style={{ cursor: "default" }}>
                      <div
                        className="top-nav-avatar"
                        style={{
                          background: "var(--primary-light)",
                          color: "var(--primary)",
                        }}
                      >
                        {user.full_name
                          ? user.full_name.substring(0, 2).toUpperCase()
                          : "U"}
                      </div>
                      <div className="top-nav-user-info">
                        <span className="top-nav-user-name">
                          {user.full_name}
                        </span>
                      </div>
                    </div>
                    <button
                      className="top-nav-icon"
                      aria-label="Logout"
                      onClick={handleLogout}
                      title="Logout"
                      style={{ marginLeft: "8px" }}
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                </header>

                <div className="app-body">
                  <Sidebar
                    onNavigate={handleNavigate}
                    user={user}
                    onLogout={handleLogout}
                  />
                  <main className="main-content">
                    <Routes>
                      <Route
                        path="/"
                        element={
                          <InputForm
                            onGenerate={handleGenerate}
                            initialData={formData}
                          />
                        }
                      />
                      <Route
                        path="/output"
                        element={
                          <OutputPage
                            jdText={generatedJD}
                            formData={formData}
                            onJDUpdate={handleJDUpdate}
                            onRegenerate={handleRegenerate}
                            onNavigate={handleNavigate}
                          />
                        }
                      />
                      <Route
                        path="/saved"
                        element={
                          <SavedJDs
                            onNavigate={handleNavigate}
                            onJDLoad={handleJDLoad}
                          />
                        }
                      />
                      <Route
                        path="/templates"
                        element={<Templates onNavigate={handleNavigate} />}
                      />
                      <Route path="/history" element={<History />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
              </>
            ) : null
          }
        />
      </Routes>
    </div>
  );
}

export default App;
