import { useState } from "react";
import { User, Shield, Bell, Moon, Sun, Monitor, Save } from "lucide-react";
import "./Pages.css";

function getStoredProfile() {
  try {
    const user = JSON.parse(localStorage.getItem("ambider_user") || "null");
    return { full_name: user?.full_name || "", email: user?.email || "" };
  } catch {
    return { full_name: "", email: "" };
  }
}

function Settings() {
  const [activeTab, setActiveTab] = useState("account");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [notifications, setNotifications] = useState(
    JSON.parse(
      localStorage.getItem("notifications") || '{"email":true,"push":false}',
    ),
  );
  const [profile, setProfile] = useState(getStoredProfile);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    // In a real app we would apply a theme class to document.body here
    alert(`Theme preference saved: ${newTheme}`);
  };

  const handleNotificationChange = (type) => {
    const updated = { ...notifications, [type]: !notifications[type] };
    setNotifications(updated);
    localStorage.setItem("notifications", JSON.stringify(updated));
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    alert("Profile update feature is a stub in this demo.");
  };

  return (
    <div className="page-container">
      <div className="page-header-row">
        <h2>Settings</h2>
      </div>

      <div style={{ display: "flex", gap: "32px", marginTop: "16px" }}>
        {/* Settings Sidebar */}
        <div
          style={{
            width: "220px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <button
            onClick={() => setActiveTab("account")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              background: activeTab === "account" ? "#FFF0EA" : "transparent",
              border: "none",
              borderRadius: "8px",
              color:
                activeTab === "account" ? "#E8510A" : "var(--text-primary)",
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s",
            }}
          >
            <User size={18} /> Account Details
          </button>
          <button
            onClick={() => setActiveTab("appearance")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              background:
                activeTab === "appearance" ? "#FFF0EA" : "transparent",
              border: "none",
              borderRadius: "8px",
              color:
                activeTab === "appearance" ? "#E8510A" : "var(--text-primary)",
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s",
            }}
          >
            <Monitor size={18} /> Appearance
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              background:
                activeTab === "notifications" ? "#FFF0EA" : "transparent",
              border: "none",
              borderRadius: "8px",
              color:
                activeTab === "notifications"
                  ? "#E8510A"
                  : "var(--text-primary)",
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s",
            }}
          >
            <Bell size={18} /> Notifications
          </button>
          <button
            onClick={() => setActiveTab("security")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 16px",
              background: activeTab === "security" ? "#FFF0EA" : "transparent",
              border: "none",
              borderRadius: "8px",
              color:
                activeTab === "security" ? "#E8510A" : "var(--text-primary)",
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s",
            }}
          >
            <Shield size={18} /> Security
          </button>
        </div>

        {/* Settings Content */}
        <div
          style={{
            flex: 1,
            background: "var(--bg-white)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            padding: "32px",
          }}
        >
          {activeTab === "account" && (
            <div>
              <h3
                style={{
                  fontSize: "18px",
                  marginBottom: "24px",
                  color: "var(--text-primary)",
                }}
              >
                Account Details
              </h3>
              <form
                onSubmit={handleSaveProfile}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  maxWidth: "400px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) =>
                      setProfile({ ...profile, full_name: e.target.value })
                    }
                    style={{
                      padding: "10px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      outline: "none",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    style={{
                      padding: "10px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      outline: "none",
                      background: "var(--bg-gray)",
                      color: "var(--text-secondary)",
                    }}
                  />
                  <span
                    style={{ fontSize: "11px", color: "var(--text-muted)" }}
                  >
                    Email cannot be changed directly.
                  </span>
                </div>
                <button
                  type="submit"
                  className="report-primary-btn"
                  style={{
                    alignSelf: "flex-start",
                    marginTop: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Save size={16} /> Save Changes
                </button>
              </form>
            </div>
          )}

          {activeTab === "appearance" && (
            <div>
              <h3
                style={{
                  fontSize: "18px",
                  marginBottom: "24px",
                  color: "var(--text-primary)",
                }}
              >
                Theme Preferences
              </h3>
              <div style={{ display: "flex", gap: "16px" }}>
                <div
                  onClick={() => handleThemeChange("light")}
                  style={{
                    border: `2px solid ${theme === "light" ? "#E8510A" : "#FDDECE"}`,
                    borderRadius: "12px",
                    padding: "24px",
                    cursor: "pointer",
                    textAlign: "center",
                    flex: 1,
                    background: "#FFF",
                  }}
                >
                  <Sun
                    size={32}
                    color={theme === "light" ? "#E8510A" : "#9CA3AF"}
                    style={{ marginBottom: "12px" }}
                  />
                  <div
                    style={{
                      fontWeight: 600,
                      color:
                        theme === "light" ? "#E8510A" : "var(--text-primary)",
                    }}
                  >
                    Light Mode
                  </div>
                </div>
                <div
                  onClick={() => handleThemeChange("dark")}
                  style={{
                    border: `2px solid ${theme === "dark" ? "#E8510A" : "#FDDECE"}`,
                    borderRadius: "12px",
                    padding: "24px",
                    cursor: "pointer",
                    textAlign: "center",
                    flex: 1,
                    background: "#1F2937",
                  }}
                >
                  <Moon
                    size={32}
                    color={theme === "dark" ? "#E8510A" : "#9CA3AF"}
                    style={{ marginBottom: "12px" }}
                  />
                  <div
                    style={{
                      fontWeight: 600,
                      color: theme === "dark" ? "#E8510A" : "#FFF",
                    }}
                  >
                    Dark Mode
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div>
              <h3
                style={{
                  fontSize: "18px",
                  marginBottom: "24px",
                  color: "var(--text-primary)",
                }}
              >
                Notification Preferences
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={notifications.email}
                    onChange={() => handleNotificationChange("email")}
                    style={{
                      width: "18px",
                      height: "18px",
                      accentColor: "#E8510A",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: "14px",
                        color: "var(--text-primary)",
                      }}
                    >
                      Email Notifications
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Receive weekly reports and update summaries.
                    </div>
                  </div>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={notifications.push}
                    onChange={() => handleNotificationChange("push")}
                    style={{
                      width: "18px",
                      height: "18px",
                      accentColor: "#E8510A",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: "14px",
                        color: "var(--text-primary)",
                      }}
                    >
                      Push Notifications
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Receive alerts in your browser when a JD is ready.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div>
              <h3
                style={{
                  fontSize: "18px",
                  marginBottom: "24px",
                  color: "var(--text-primary)",
                }}
              >
                Security & Password
              </h3>
              <button className="action-btn" style={{ marginBottom: "24px" }}>
                Change Password
              </button>

              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "24px",
                }}
              >
                <h4
                  style={{
                    color: "#DC2626",
                    marginBottom: "12px",
                    fontSize: "15px",
                  }}
                >
                  Danger Zone
                </h4>
                <button
                  style={{
                    background: "#FEF2F2",
                    color: "#DC2626",
                    border: "1px solid #FECACA",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    alert("Account deletion is not permitted in this demo.")
                  }
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
