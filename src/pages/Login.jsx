// src/Login.jsx
import React, { useState, useEffect } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import axios from "axios";

const Login = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userPic, setUserPic] = useState(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [securePortalWindow, setSecurePortalWindow] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const SERVER_URL = "https://jdbeue.pythonanywhere.com";


  useEffect(() => {
    document.title = "UNFCU";
    // Listen for logout events via localStorage as a backup.
    const handleStorage = (event) => {
      if (event.key === "logoutEvent" && event.newValue === "true") {
        sessionStorage.removeItem("authenticated");
        setIsLoggedIn(false);
        setUserPic(null);
        setShowLogoutModal(true);
        localStorage.removeItem("logoutEvent");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Define a global function so that SecureMessaging can notify us when a logout occurs.
  useEffect(() => {
    window.handleSecureMessagingLogout = () => {
      localStorage.removeItem("authenticated");
      setIsLoggedIn(false);
      setUserPic(null);
      setShowLogoutModal(true);
    };
    return () => {
      delete window.handleSecureMessagingLogout;
    };
  }, []);

  // Persist login across reloads.
  useEffect(() => {
    if (localStorage.getItem("authenticated") === "true") {
      setIsLoggedIn(true);
      axios
        .get(`${SERVER_URL}/user`, { withCredentials: true })
        // .get("http://localhost:5000/user", { withCredentials: true })
        .then((res) => {
          if (res.data && res.data.picture) {
            setUserPic(res.data.picture);
          } else {
            setUserPic("https://via.placeholder.com/32");
          }
        })
        .catch(() => setUserPic("https://via.placeholder.com/32"));
    }
  }, []);

  const handleSuccess = (credentialResponse) => {
    if (!credentialResponse.credential) {
      setErrorMessage("No credential received from Google.");
      return;
    }
    axios
      .post(
        `${SERVER_URL}/callback`,
        // "http://localhost:5000/callback",
        { token: credentialResponse.credential },
        { withCredentials: true }
      )
      .then((response) => {
        if (response.data && response.data.success) {
          localStorage.setItem("authenticated", "true");
          setIsLoggedIn(true);
          // Fetch user info.
          axios
            .get(`${SERVER_URL}/user`, { withCredentials: true })
            // .get("http://localhost:5000/user", { withCredentials: true })
            .then((res) => {
              if (res.data && res.data.picture) {
                setUserPic(res.data.picture);
              } else {
                setUserPic("https://via.placeholder.com/32");
              }
            })
            .catch(() => setUserPic("https://via.placeholder.com/32"));
          // Open the secure messaging portal.
          const win = window.open("/secure-messaging", "_blank");
          setSecurePortalWindow(win);
        } else {
          setErrorMessage("Authentication failed. Please try again.");
        }
      })
      .catch((error) => {
        console.error("Login failed:", error);
        setErrorMessage("Authentication failed. Please try again.");
      });
  };

  const handleError = () => {
    setErrorMessage("Google Sign-In failed. Please try again.");
  };

  // When user clicks "Logout" from the Login page, close Secure Messaging (if open)
  // then signal logout (here we simply set the local state and also signal via localStorage as a backup).
  const handleLogout = () => {
    if (securePortalWindow && !securePortalWindow.closed) {
      securePortalWindow.close();
    }
    localStorage.removeItem("authenticated");
    setIsLoggedIn(false);
    setUserPic(null);
    localStorage.setItem("logoutEvent", "true");
    setShowLogoutModal(true);
  };

  const enterSecureMessaging = () => {
    if (securePortalWindow && !securePortalWindow.closed) {
      securePortalWindow.focus();
    } else {
      const win = window.open("/secure-messaging", "_blank");
      setSecurePortalWindow(win);
    }
  };

  const JoinDropdown = () => {
    const dropdownStyle = { position: "relative", display: "inline-block" };
    const buttonStyle = {
      backgroundColor: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: "1rem",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    };
    const contentStyle = {
      display: "none",
      position: "absolute",
      backgroundColor: "#fff",
      minWidth: "120px",
      boxShadow: "0 8px 16px rgba(0,0,0,0.2)",
      zIndex: 1,
      right: 0,
    };
    const linkStyle = {
      display: "block",
      padding: "0.5rem 1rem",
      textDecoration: "none",
      color: "#000",
      fontSize: "0.9rem",
    };

    return (
      <div
        style={dropdownStyle}
        onMouseEnter={(e) => {
          e.currentTarget.querySelector(".dropdown-content").style.display = "block";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.querySelector(".dropdown-content").style.display = "none";
        }}
      >
        <button style={buttonStyle}>
          Join <span style={{ fontSize: "0.7rem" }}>▼</span>
        </button>
        <div className="dropdown-content" style={contentStyle}>
          <a href="#" style={linkStyle}>
            Become a Member
          </a>
          <a href="#" style={linkStyle}>
            Benefits
          </a>
        </div>
      </div>
    );
  };

  return (
    <GoogleOAuthProvider clientId="698166460427-83h4b7t00o6ug8hs4mj4bm8g3po5glki.apps.googleusercontent.com">
      <div style={{ backgroundColor: "#fff", minHeight: "100vh", fontFamily: "'Open Sans', sans-serif" }}>
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.4rem 1rem",
            fontSize: "0.85rem",
            backgroundColor: "#f8f9fa",
            color: "#6c757d",
          }}
        >
          <div style={{ display: "flex", gap: "1rem" }}>
            <a href="#" style={{ textDecoration: "none", color: "#6c757d" }}>
              About
            </a>
            <a href="#" style={{ textDecoration: "none", color: "#6c757d" }}>
              Contact Us
            </a>
          </div>
          <div style={{ fontWeight: "400" }}>Rates &nbsp; ABA/Routing #226078609</div>
        </div>

        {/* Navigation Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.8rem 1rem",
            borderBottom: "1px solid #dee2e6",
          }}
        >
          <div style={{ marginLeft: "1rem" }}>
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfgnRAYqlZ9QkeI3zoIhQ3c-JKNLZoGPUzdQ&s"
              alt="UNFCU Logo"
              style={{ height: "40px", width: "auto" }}
            />
          </div>

          <nav style={{ display: "flex", gap: "1.5rem", fontSize: "1rem", color: "#000" }}>
            <div style={{ cursor: "pointer" }}>Save</div>
            <div style={{ cursor: "pointer" }}>Spend</div>
            <div style={{ cursor: "pointer" }}>Borrow</div>
            <div style={{ cursor: "pointer" }}>Transfer</div>
            <div style={{ cursor: "pointer" }}>Learn</div>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ fontWeight: "bold", cursor: "pointer" }}>Q</div>
            <JoinDropdown />

            {isLoggedIn ? (
              <div style={{ position: "relative" }}>
                <img
                  src={userPic || "https://via.placeholder.com/32"}
                  alt="Profile"
                  style={{ width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer" }}
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                />
                {profileDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "110%",
                      right: 0,
                      backgroundColor: "#fff",
                      boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                      borderRadius: "4px",
                      padding: "0.5rem",
                      minWidth: "150px",
                      zIndex: 10,
                    }}
                  >
                    <div
                      style={{
                        padding: "0.5rem",
                        cursor: "pointer",
                        borderBottom: "1px solid #ddd",
                      }}
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        enterSecureMessaging();
                      }}
                    >
                      Enter Secure Messaging
                    </div>
                    <div
                      style={{ padding: "0.5rem", cursor: "pointer" }}
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                    >
                      Log Out
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                render={(renderProps) => (
                  <button
                    onClick={renderProps.onClick}
                    disabled={renderProps.disabled}
                    style={{
                      backgroundColor: "#0077c8",
                      color: "#fff",
                      border: "none",
                      padding: "0.5rem 1rem",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontWeight: "600",
                      fontSize: "0.9rem",
                    }}
                  >
                    Sign In
                  </button>
                )}
              />
            )}
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              margin: "1rem auto",
              width: "90%",
              maxWidth: "400px",
              backgroundColor: "#ffdddd",
              color: "#d8000c",
              padding: "1rem",
              borderRadius: "4px",
              textAlign: "center",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Main hero area */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "1200px",
            margin: "3rem auto",
            padding: "0 1rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: "600px" }}>
            <p style={{ margin: 0, fontSize: "1rem", color: "#000", fontWeight: "400" }}>
              United Nations Federal Credit Union
            </p>
            <h1 style={{ margin: "0.5rem 0", fontWeight: "400", lineHeight: 1.3, fontSize: "3.5rem" }}>
              Serving the people
              <br />
              <span style={{ color: "#0077c8" }}>who serve the world</span>
            </h1>
            <a
              href="#"
              style={{
                display: "inline-block",
                marginTop: "1rem",
                fontSize: "1rem",
                color: "#0077c8",
                textDecoration: "none",
                fontWeight: "500",
              }}
            >
              Member benefits &amp; rewards &rsaquo;
            </a>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <img
              src="https://www.shutterstock.com/image-photo/business-people-standing-around-each-260nw-2247313021.jpg"
              alt="Business people standing"
              style={{
                width: "300px",
                height: "300px",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          </div>
        </div>

        {/* Card section */}
        <div
          style={{
            maxWidth: "1200px",
            margin: "2rem auto",
            padding: "0 1rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              flex: "1 1 300px",
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              padding: "1.5rem",
              minWidth: "280px",
            }}
          >
            <p style={{ color: "#0077c8", margin: 0, fontWeight: "500" }}>Borrow</p>
            <h3
              style={{
                fontSize: "1.25rem",
                margin: "0.5rem 0 1rem 0",
                fontWeight: "400",
                lineHeight: 1.4,
              }}
            >
              Reach your goals using the equity in your home
            </h3>
            <a href="#" style={{ color: "#0077c8", textDecoration: "none", fontWeight: "400" }}>
              Home equity lines of credit &rsaquo;
            </a>
          </div>

          {/* Card 2 */}
          <div
            style={{
              flex: "1 1 300px",
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              padding: "1.5rem",
              minWidth: "280px",
            }}
          >
            <p style={{ color: "#0077c8", margin: 0, fontWeight: "500" }}>Learn</p>
            <h3
              style={{
                fontSize: "1.25rem",
                margin: "0.5rem 0 1rem 0",
                fontWeight: "400",
                lineHeight: 1.4,
              }}
            >
              Know how your money is insured
            </h3>
            <a href="#" style={{ color: "#0077c8", textDecoration: "none", fontWeight: "400" }}>
              Guide to NCUA insurance &rsaquo;
            </a>
          </div>

          {/* Card 3 */}
          <div
            style={{
              flex: "1 1 300px",
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              padding: "1.5rem",
              minWidth: "280px",
            }}
          >
            <p style={{ color: "#0077c8", margin: 0, fontWeight: "500" }}>Learn</p>
            <h3
              style={{
                fontSize: "1.25rem",
                margin: "0.5rem 0 1rem 0",
                fontWeight: "400",
                lineHeight: 1.4,
              }}
            >
              Make secure mobile purchases
            </h3>
            <a href="#" style={{ color: "#0077c8", textDecoration: "none", fontWeight: "400" }}>
              Set up &amp; use a digital wallet &rsaquo;
            </a>
          </div>
        </div>

        {/* Logout Modal */}
        {showLogoutModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                padding: "2rem",
                borderRadius: "8px",
                textAlign: "center",
                maxWidth: "90%",
              }}
            >
              <div style={{ fontSize: "3.5rem", fontWeight: "400", margin: 0, color: "#000" }}>
                Thanks for using the
              </div>
              <div style={{ fontSize: "3.5rem", fontWeight: "400", margin: 0, color: "#0077c8" }}>
                Secure Messaging Portal
              </div>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  marginTop: "1rem",
                  padding: "0.5rem 1rem",
                  backgroundColor: "#0077c8",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </GoogleOAuthProvider>
  );
};

export default Login;
