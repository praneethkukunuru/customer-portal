// src/SecureMessaging.jsx
import { useEffect, useState, useRef } from "react";
import axios from "axios";

// Helper: format date/time
function formatDate(time) {
  return new Date(time).toLocaleString();
}

// Helper: remove newlines and truncate text
function truncateText(text, maxLength = 80) {
  const singleLine = text.replace(/\n/g, " ");
  if (singleLine.length <= maxLength) return singleLine;
  return singleLine.substring(0, maxLength) + "...";
}

/** 
 * We'll now store all users' chats in a single localStorage key:
 */
const ALL_CHATS_STORAGE_KEY = "ALL_SECURE_MESSAGING_CHATS";

/** 
 * Utility: Load all chats (for all users) from localStorage.
 */
function loadAllChats() {
  const stored = localStorage.getItem(ALL_CHATS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/** 
 * Utility: Save all chats (for all users) to localStorage.
 */
function saveAllChats(allChats) {
  localStorage.setItem(ALL_CHATS_STORAGE_KEY, JSON.stringify(allChats));
}

/**
 * Sample data for demonstration; if you want to provide default chats 
 * for a newly registered user, you can incorporate them once user is known.
 */
const sampleChats = [
  {
    id: 1,
    title: "Syngenta Yield Trailing Data Analytics Internship",
    time: "2025-02-24 00:20",
    messages: [
      {
        sender: "You",
        text: "Hey Andrew!\nThank you for considering my application for the Yield Trailing Data Analytics Internship...",
        time: "2025-02-24 00:20",
      },
      {
        sender: "UNFCU Agent",
        text: "Hi Praneeth,\nThanks for the follow-up. Let me check with the team about scheduling availability...",
        time: "2025-02-24 00:30",
      },
    ],
  },
  {
    id: 2,
    title: "Account Security Alert",
    time: "2025-02-24 08:55",
    messages: [
      {
        sender: "UNFCU Agent",
        text: "We noticed unusual activity on your account. Please verify your login.",
        time: "2025-02-24 08:55",
      },
      {
        sender: "You",
        text: "Is everything okay now? I changed my password.",
        time: "2025-02-24 09:10",
      },
    ],
  },
];

const SecureMessaging = () => {
  useEffect(() => {
    document.title = "Secure Messaging";
  }, []);

  // This is the user-specific list of chats we display in the UI.
  const [chats, setChats] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);

  // Compose mode
  const [composeMode, setComposeMode] = useState(false);
  const [newChatSubject, setNewChatSubject] = useState("");
  const [newChatMessage, setNewChatMessage] = useState("");

  // Inline reply
  const [newMessage, setNewMessage] = useState("");
  const [showReplyBox, setShowReplyBox] = useState(false);

  // Profile menu toggle
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Expanded states for older messages
  const [expandedMessages, setExpandedMessages] = useState({});

  // Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // For unread
  const [unreadThreads, setUnreadThreads] = useState([]);
  // Server URL
  const SERVER_URL = "https://jdbeue.pythonanywhere.com";

  const messagesContainerRef = useRef(null);

  // ------------------ Effects ------------------

  // Authentication check
  useEffect(() => {
    if (localStorage.getItem("authenticated") !== "true") {
      window.location.href = "/";
    }
  }, []);

  // Fetch user info
  useEffect(() => {
    axios
      .get(`${SERVER_URL}/user`, { withCredentials: true })
      .then((res) => {
        // Once we know who the user is, we can load their chats from localStorage
        setUser(res.data);
      })
      .catch((err) => console.log("User fetch error:", err));
  }, []);

  /**
   * Once we have a user, load all chats from localStorage, filter to only this user's chats.
   * If no chats for them, you can optionally provide default (e.g. sample) data.
   */
  useEffect(() => {
    if (!user || !user.email) return; // wait until user is known

    const allChats = loadAllChats();
    // Filter for this user's chats only
    const userChats = allChats.filter((chat) => chat.ownerEmail === user.email);
    if (userChats.length === 0) {
      // OPTIONAL: If you want to give them sample data the first time, do so here:
      // e.g. copy sampleChats, set ownerEmail, and save.
      /*
      const sampleWithOwner = sampleChats.map((ch) => ({
        ...ch,
        ownerEmail: user.email,
      }));
      allChats.push(...sampleWithOwner);
      saveAllChats(allChats);
      setChats(sampleWithOwner);
      setSelectedChat(sampleWithOwner[0]);
      */
      setChats([]); // or set to empty
    } else {
      setChats(userChats);
      setSelectedChat(userChats[0] || null);
    }
  }, [user]);

  // Auto-scroll conversation area
  useEffect(() => {
    if (!composeMode && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [selectedChat?.messages, composeMode]);

  // Poll for agent replies
  useEffect(() => {
    const intervalId = setInterval(() => {
      axios
        .get(`${SERVER_URL}/agent_replies`, { withCredentials: true })
        .then((res) => {
          const replies = res.data.replies;
          if (replies && replies.length > 0 && user?.email) {
            // We need to incorporate these replies into localStorage
            const allChats = loadAllChats();
            let changed = false;

            // For each reply, find the chat with same thread_id & ownerEmail == user.email
            replies.forEach((r) => {
              const idx = allChats.findIndex(
                (c) => c.id === r.thread_id && c.ownerEmail === user.email
              );
              if (idx >= 0) {
                // Insert the new message
                allChats[idx] = {
                  ...allChats[idx],
                  messages: [...allChats[idx].messages, r],
                };
                changed = true;

                // If not selected, mark unread
                if (!selectedChat || selectedChat.id !== r.thread_id) {
                  setUnreadThreads((prevUnread) => {
                    const newSet = new Set(prevUnread);
                    newSet.add(r.thread_id);
                    return Array.from(newSet);
                  });
                }
              }
            });

            if (changed) {
              // Save back to localStorage
              saveAllChats(allChats);
              // Filter to user
              const userChats = allChats.filter(
                (chat) => chat.ownerEmail === user.email
              );
              setChats(userChats);
              // If selectedThread changed
              if (selectedChat) {
                const updatedSelected = userChats.find(
                  (c) => c.id === selectedChat.id
                );
                if (updatedSelected) setSelectedChat(updatedSelected);
              }
            }
          }
        })
        .catch((err) => console.error("Error fetching agent replies:", err));
    }, 5000);
    return () => clearInterval(intervalId);
  }, [selectedChat, chats, user]);

  // If chats array changes, update selectedChat if needed
  useEffect(() => {
    if (chats.length > 0 && selectedChat) {
      const updated = chats.find((t) => t.id === selectedChat.id);
      if (
        updated &&
        updated.messages.length !== selectedChat.messages.length
      ) {
        setSelectedChat(updated);
      }
    }
  }, [chats, selectedChat]);

  // Search logic
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const term = searchTerm.toLowerCase();
    const results = chats.filter((chat) => {
      // Check chat title
      if (chat.title.toLowerCase().includes(term)) return true;
      // Check messages
      for (let msg of chat.messages) {
        if (msg.text.toLowerCase().includes(term)) {
          return true;
        }
      }
      return false;
    });
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  }, [searchTerm, chats]);

  // ------------------ Handlers ------------------

  function handleSelectThread(thread) {
    setSelectedChat(thread);
    setComposeMode(false);
    setShowReplyBox(false);
    // Mark as read
    setUnreadThreads((prev) => prev.filter((id) => id !== thread.id));
  }

  function handleLogout() {
    axios
      .get(`${SERVER_URL}/logout`, { withCredentials: true })
      .then(() => {
        localStorage.removeItem("authenticated");
        if (window.opener && typeof window.opener.handleSecureMessagingLogout === "function") {
          window.opener.handleSecureMessagingLogout();
        } else {
          localStorage.setItem("logoutEvent", "true");
        }
        setTimeout(() => window.close(), 100);
      })
      .catch((err) => console.error("Logout failed:", err));
  }

  /**
   * Send a message in the selected chat.
   */
  function sendMessage() {
    if (!newMessage.trim() || !selectedChat || !user?.email) return;

    // 1. Load all
    const allChats = loadAllChats();
    // 2. Find the chat in allChats
    const idx = allChats.findIndex(
      (c) => c.id === selectedChat.id && c.ownerEmail === user.email
    );
    if (idx < 0) {
      console.error("Chat not found in localStorage for this user. Cannot send message.");
      return;
    }

    // 3. Build new message
    const newMsg = {
      id: allChats[idx].messages.length + 1,
      text: newMessage,
      sender: "You",
      time: formatDate(new Date()),
    };

    // 4. Update that chat
    allChats[idx] = {
      ...allChats[idx],
      messages: [...allChats[idx].messages, newMsg],
    };

    // 5. Save all
    saveAllChats(allChats);

    // 6. Filter to user
    const userChats = allChats.filter((c) => c.ownerEmail === user.email);
    setChats(userChats);

    // 7. Update selectedChat
    const updatedChat = allChats[idx];
    setSelectedChat(updatedChat);

    // 8. Optionally forward to agent
    axios
      .post(`${SERVER_URL}/send_to_agent`, {
        thread_id: updatedChat.id,
        message: newMsg.text,
      }, { withCredentials: true })
      .then((res) => console.log("Message forwarded to agent:", res.data))
      .catch((err) => console.error("Error sending message to agent:", err));

    setShowReplyBox(false);
    setNewMessage("");
  }

  /**
   * Create a new chat for this user.
   */
  function sendNewChat() {
    if (!newChatSubject.trim() || !newChatMessage.trim()) {
      alert("Please fill in all fields.");
      return;
    }
    if (!user?.email) return;

    // 1. Load all
    const allChats = loadAllChats();

    // 2. Determine new ID
    const newId =
      allChats.length > 0 ? Math.max(...allChats.map((c) => c.id)) + 1 : 1;

    // 3. Build new chat with ownerEmail
    const currentTime = formatDate(new Date());
    const newChat = {
      id: newId,
      ownerEmail: user.email, // <--- key
      title: newChatSubject,
      time: currentTime,
      messages: [
        {
          sender: "You",
          text: newChatMessage,
          time: currentTime,
        },
      ],
    };

    // 4. Insert into all
    allChats.push(newChat);

    // 5. Save
    saveAllChats(allChats);

    // 6. Filter to user
    const userChats = allChats.filter((c) => c.ownerEmail === user.email);
    setChats(userChats);
    setSelectedChat(newChat);

    // 7. Forward to agent
    axios
      .post(`${SERVER_URL}/send_to_agent`, {
        thread_id: newId,
        message: newChatMessage,
        topic: newChatSubject,
      }, { withCredentials: true })
      .then((res) => console.log("New chat forwarded to agent:", res.data))
      .catch((err) => console.error("Error forwarding new chat:", err));

    setNewChatSubject("");
    setNewChatMessage("");
    setComposeMode(false);
  }

  function cancelCompose() {
    setNewChatSubject("");
    setNewChatMessage("");
    setComposeMode(false);
  }

  /**
   * Delete the selected thread from localStorage as well.
   */
  function deleteThread() {
    if (!selectedChat || !user?.email) return;
    if (window.confirm("Are you sure you want to delete this thread?")) {
      const allChats = loadAllChats();
      const filtered = allChats.filter(
        (c) => !(c.id === selectedChat.id && c.ownerEmail === user.email)
      );
      saveAllChats(filtered);
      const userChats = filtered.filter((c) => c.ownerEmail === user.email);
      setChats(userChats);
      setSelectedChat(userChats.length > 0 ? userChats[0] : null);
    }
  }

  function toggleExpand(chatId, msgIndex) {
    const key = `${chatId}-${msgIndex}`;
    setExpandedMessages((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function getAvatar(sender) {
    const defaultPic = "/avatar.png";
    if (sender === "You") {
      return user?.picture || defaultPic;
    }
    return defaultPic;
  }

  function handleSelectSearchResult(chat) {
    handleSelectThread(chat);
    setSearchDropdown(false);
    setSearchTerm("");
  }

  // If there's no user or we haven't loaded them yet, just show nothing (or a spinner).
  if (!user) return null;

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "#f9f9f9" }}>
      {/* Left Panel: 25% width, bank logo centered */}
      <aside
        style={{
          width: "25%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px",
          backgroundColor: "#f9f9f9",
          fontSize: "0.9rem",
        }}
      >
        {/* Bank logo centered with extra space below */}
        <div style={{ margin: "0 auto", marginBottom: "32px" }}>
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfgnRAYqlZ9QkeI3zoIhQ3c-JKNLZoGPUzdQ&s"
            alt="Bank Logo"
            style={{ width: "150px", display: "block", margin: "0 auto" }}
          />
        </div>

        {/* New Message button (bluish-gray) */}
        <button
          style={{
            width: "100%",
            backgroundColor: "#cbd5e1",
            color: "#000",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            border: "none",
            cursor: "pointer",
            fontWeight: "500",
          }}
          onClick={() => {
            setComposeMode(true);
            setShowReplyBox(false);
          }}
        >
          New Message
        </button>

        {/* Chat list */}
        <ul style={{ listStyle: "none", paddingLeft: 0, width: "100%" }}>
          {chats.length === 0 ? (
            <p style={{ color: "#666" }}>No conversations yet.</p>
          ) : (
            chats.map((chat) => (
              <li
                key={chat.id}
                onClick={() => handleSelectThread(chat)}
                style={{
                  position: "relative",
                  padding: "12px",
                  borderBottom: "1px solid #e2e8f0",
                  marginBottom: "8px",
                  cursor: "pointer",
                  backgroundColor: selectedChat?.id === chat.id ? "#edf2f7" : "#fff",
                }}
              >
                <p style={{ fontWeight: "bold", margin: 0 }}>{chat.title}</p>
                <span style={{ fontSize: "0.75rem", color: "#718096" }}>
                  {chat.time}
                </span>
                {unreadThreads.includes(chat.id) && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      width: 10,
                      height: 10,
                      backgroundColor: "#3182ce",
                      borderRadius: "50%",
                    }}
                  ></div>
                )}
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* Right Panel: 75% width, top search bar + user pic, white conversation card */}
      <div
        style={{
          width: "75%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* Top bar with search + user profile */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px",
            backgroundColor: "#f9f9f9",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          {/* Search input (rounded) */}
          <div style={{ flex: 1, position: "relative", marginRight: "16px" }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%",
                padding: "8px 48px 8px 16px",
                borderRadius: "9999px",
                border: "1px solid #ccc",
                outline: "none",
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowDropdown(false), 150);
              }}
            />
            {/* Dropdown of search results */}
            {showDropdown && searchResults.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "40px",
                  left: "0",
                  width: "100%",
                  backgroundColor: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  zIndex: 10,
                }}
              >
                {searchResults.map((chat) => (
                  <div
                    key={chat.id}
                    onMouseDown={() => handleSelectSearchResult(chat)}
                    style={{
                      padding: "8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee",
                      backgroundColor:
                        selectedChat?.id === chat.id ? "#edf2f7" : "#fff",
                    }}
                  >
                    <strong>{chat.title}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User profile picture on the right side */}
          <div style={{ position: "relative" }}>
            {user && user.picture && (
              <img
                src={user.picture}
                alt="Profile"
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  cursor: "pointer",
                }}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                title="Click for options"
              />
            )}
            {showProfileMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  marginTop: "8px",
                  width: "120px",
                  backgroundColor: "#fff",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  zIndex: 10,
                }}
              >
                <button
                  onClick={handleLogout}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px",
                    fontSize: "0.875rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Conversation Card */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            padding: "16px",
            margin: "0 16px 16px",
          }}
        >
          {/* Header (only if not in compose mode) */}
          {!composeMode && (
            <header
              style={{
                borderBottom: "1px solid #ccc",
                paddingBottom: "8px",
                marginBottom: "16px",
              }}
            >
              <div>
                {selectedChat ? (
                  <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>
                    {selectedChat.title}
                  </h2>
                ) : (
                  <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", margin: 0 }}>
                    No Thread Selected
                  </h2>
                )}
              </div>
            </header>
          )}

          {composeMode ? (
            // Compose Mode
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "4px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                }}
              >
                <h2 style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "16px" }}>
                  Compose New Message
                </h2>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem" }}>
                    Subject
                  </label>
                  <input
                    type="text"
                    value={newChatSubject}
                    onChange={(e) => setNewChatSubject(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                    placeholder="Enter subject"
                  />
                </div>
                <div
                  style={{
                    marginBottom: "16px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <label style={{ marginBottom: "4px", fontSize: "0.85rem" }}>
                    Message
                  </label>
                  <textarea
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    rows={6}
                    style={{
                      flex: 1,
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      resize: "vertical",
                    }}
                    placeholder="Type your message..."
                  ></textarea>
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                  <button
                    onClick={sendNewChat}
                    style={{
                      backgroundColor: "#3182ce",
                      color: "#fff",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Send Message
                  </button>
                  <button
                    onClick={cancelCompose}
                    style={{
                      backgroundColor: "#718096",
                      color: "#fff",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation area now includes messages and the reply/delete or reply box */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                }}
                ref={messagesContainerRef}
              >
                {selectedChat ? (
                  <>
                    {selectedChat.messages.map((msg, index) => {
                      const isLastMessage = index === selectedChat.messages.length - 1;
                      const key = `${selectedChat.id}-${index}`;
                      const expanded = expandedMessages[key] || false;
                      const truncated = !isLastMessage && !expanded;
                      const displayedText = truncated
                        ? truncateText(msg.text, 80)
                        : msg.text;

                      return (
                        <div
                          key={key}
                          onClick={() => {
                            if (!isLastMessage) {
                              setExpandedMessages((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }));
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            padding: "12px 0",
                            borderBottom:
                              index < selectedChat.messages.length - 1
                                ? "1px solid #e2e8f0"
                                : "none",
                            cursor: truncated ? "pointer" : "default",
                            fontSize: "0.85rem",
                          }}
                        >
                          {/* Profile pic (32px) */}
                          <img
                            src={
                              msg.sender === "You"
                                ? "/avatar.png"
                                : "/agent.png"
                            }
                            alt="Avatar"
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              flexShrink: 0,
                            }}
                          />
                          {/* Message content */}
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "4px",
                                color: "#555",
                              }}
                            >
                              <span style={{ fontWeight: "bold" }}>{msg.sender}</span>
                              <span>{msg.time}</span>
                            </div>
                            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                              {displayedText}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {/* Reply/Delete buttons or inline reply box appear right after the latest message */}
                    {!showReplyBox ? (
                      <div
                        style={{
                          marginTop: "8px",
                          marginLeft: "40px",
                          display: "flex",
                          gap: "12px",
                          justifyContent: "flex-start",
                        }}
                      >
                        <button
                          onClick={() => setShowReplyBox(true)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid #dadce0",
                            borderRadius: "9999px",
                            padding: "10px 18px",
                            background: "none",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            color: "#3c4043",
                            fontWeight: "500",
                          }}
                        >
                          ← Reply
                        </button>
                        <button
                          onClick={deleteThread}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid #dadce0",
                            borderRadius: "9999px",
                            padding: "10px 18px",
                            background: "none",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            color: "#3c4043",
                            fontWeight: "500",
                          }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: "16px" }}>
                        <textarea
                          rows={4}
                          style={{
                            width: "100%",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            padding: "8px",
                            fontSize: "0.85rem",
                          }}
                          placeholder="Type your reply..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                        ></textarea>
                        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                          <button
                            onClick={sendMessage}
                            style={{
                              backgroundColor: "#3182ce",
                              color: "#fff",
                              padding: "8px 16px",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                            }}
                          >
                            Send
                          </button>
                          <button
                            onClick={sendMessage}
                            style={{
                              backgroundColor: "#3182ce",
                              color: "#fff",
                              padding: "8px 16px",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                            }}
                          >
                            Attachment
                          </button>
                          <button
                            onClick={() => {
                              setShowReplyBox(false);
                              setNewMessage("");
                            }}
                            style={{
                              backgroundColor: "#718096",
                              color: "#fff",
                              padding: "8px 16px",
                              borderRadius: "4px",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "100%",
                    }}
                  >
                    <p style={{ fontSize: "1rem", color: "#718096" }}>
                      Select a conversation.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecureMessaging;
