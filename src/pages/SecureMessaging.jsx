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

// const SERVER_URL = "http://localhost:5000";
const SERVER_URL = "https://jdbeue.pythonanywhere.com";

const SecureMessaging = () => {
  // State variables
  const [chats, setChats] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);

  // Compose mode & new message fields
  const [composeMode, setComposeMode] = useState(false);
  const [newChatSubject, setNewChatSubject] = useState("");
  const [newChatMessage, setNewChatMessage] = useState("");

  // Inline reply fields
  const [newMessage, setNewMessage] = useState("");
  const [showReplyBox, setShowReplyBox] = useState(false);

  // Profile menu toggle and expanded messages state
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState({});

  // Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const messagesContainerRef = useRef(null);
  const [unreadThreads, setUnreadThreads] = useState([]);

  // New state: track if a forced reload has occurred
  const [hasForcedReload, setHasForcedReload] = useState(false);

  // ------------------ Effects ------------------

  // Set the document title
  useEffect(() => {
    document.title = "Secure Messaging";
  }, []);

  // Authentication check
  useEffect(() => {
    if (localStorage.getItem("authenticated") !== "true") {
      window.location.href = "/";
    }
  }, []);

  // Fetch user info from the server
  useEffect(() => {
    axios
      .get(`${SERVER_URL}/user`, { withCredentials: true })
      .then((res) => setUser(res.data))
      .catch(() => {
        // Optionally handle error (e.g., redirect)
      });
  }, []);

  // Fetch chats from the secure messaging server on mount
  useEffect(() => {
    axios
      .get(`${SERVER_URL}/secure_inbox`, { withCredentials: true })
      .then((res) => {
        const messages = res.data.messages || [];
        // Group messages by thread_id to form chat threads
        const groupedChats = messages.reduce((acc, msg) => {
          const id = msg.thread_id;
          if (!acc[id]) {
            acc[id] = {
              id: id,
              title: msg.topic || `Chat ${id}`,
              time: msg.time,
              messages: [msg],
            };
          } else {
            acc[id].messages.push(msg);
            // Update chat time if this message is later
            if (msg.time > acc[id].time) {
              acc[id].time = msg.time;
            }
          }
          return acc;
        }, {});
        // const chatsArray = Object.values(groupedChats).sort((a, b) => a.id - b.id);
        const chatsArray = Object.values(groupedChats).sort((a, b) => new Date(b.time) - new Date(a.time));
        setChats(chatsArray);
        if (chatsArray.length > 0 && !selectedChat) {
          setSelectedChat(chatsArray[0]);
        }
      })
      .catch((err) =>
        console.error("Error fetching chats from server:", err)
      );
  }, []);

  // Auto-scroll conversation area
  useEffect(() => {
    if (!composeMode && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [selectedChat?.messages, composeMode]);

  // Constant polling for secure replies (agent replies forwarded by the server)
  useEffect(() => {
    const intervalId = setInterval(() => {
      axios
        .get(`${SERVER_URL}/secure_replies`, { withCredentials: true })
        .then((res) => {
          const replies = res.data.replies;
          if (replies && replies.length > 0) {
            setChats((prevChats) => {
              const updatedChats = prevChats.map((chat) => {
                const newReplies = replies.filter(
                  (r) => r.thread_id === chat.id
                );
                if (newReplies.length > 0) {
                  const latestReplyTime = newReplies[newReplies.length - 1].time;
                  return { ...chat, messages: [...chat.messages, ...newReplies], time: latestReplyTime  };
                }
                return chat;
              });
              // Hard-coded workaround:
              // If there's exactly one chat and it currently has only one message,
              // force a page reload (once) when a new reply is received.
              if (
                updatedChats.length === 1 &&
                updatedChats[0].messages.length === 1 &&
                !hasForcedReload
              ) {
                setHasForcedReload(true);
                window.location.reload();
              }
              updatedChats.sort((a, b) => new Date(b.time) - new Date(a.time));
              return updatedChats;
            });
            // Update unread threads if needed
            setUnreadThreads((prevUnread) => {
              const newSet = new Set(prevUnread);
              replies.forEach((r) => newSet.add(r.thread_id));
              return Array.from(newSet);
            });
          }
        })
        .catch((err) => console.error("Error fetching secure replies:", err));
    }, 5000);
    return () => clearInterval(intervalId);
  }, [hasForcedReload]);

  // Ensure selectedChat is updated when chats change
  useEffect(() => {
    if (chats.length > 0) {
      if (!selectedChat) {
        setSelectedChat(chats[0]);
      } else {
        const updated = chats.find((t) => t.id === selectedChat.id);
        if (updated) {
          setSelectedChat(updated);
        } else {
          setSelectedChat(chats[0]);
        }
      }
    }
  }, [chats]);

  // Search logic
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const term = searchTerm.toLowerCase();
    const results = chats.filter((chat) => {
      if (chat.title.toLowerCase().includes(term)) return true;
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

  const handleSelectThread = (thread) => {
    setSelectedChat(thread);
    setComposeMode(false);
    setShowReplyBox(false);
    setUnreadThreads((prev) => prev.filter((id) => id !== thread.id));
  };

  const handleLogout = () => {
    axios
      .get(`${SERVER_URL}/logout`, { withCredentials: true })
      .then(() => {
        localStorage.removeItem("authenticated");
        if (
          window.opener &&
          typeof window.opener.handleSecureMessagingLogout === "function"
        ) {
          window.opener.handleSecureMessagingLogout();
        } else {
          localStorage.setItem("logoutEvent", "true");
        }
        setTimeout(() => window.close(), 100);
      })
      .catch((err) => console.error("Logout failed:", err));
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;
    const newMsg = {
      id: selectedChat.messages.length + 1,
      text: newMessage,
      sender: "You",
      time: formatDate(new Date()),
    };
    // Optimistically update UI
    const updatedChat = { ...selectedChat, messages: [...selectedChat.messages, newMsg] };
    const updatedChats = chats.map((chat) =>
      chat.id === updatedChat.id ? updatedChat : chat
    );
    setChats(updatedChats);
    setSelectedChat(updatedChat);
    setNewMessage("");

    axios
      .post(
        `${SERVER_URL}/send_to_secure`,
        { thread_id: selectedChat.id, message: newMsg.text },
        { withCredentials: true }
      )
      .then((res) =>
        console.log("Message forwarded to secure messaging agent:", res.data)
      )
      .catch((err) =>
        console.error("Error sending message to secure messaging agent:", err)
      );

    setShowReplyBox(false);
  };

  const sendNewChat = () => {
    if (!newChatSubject.trim() || !newChatMessage.trim()) {
      alert("Please fill in all fields.");
      return;
    }
    const newId =
      chats.length > 0 ? Math.max(...chats.map((chat) => chat.id)) + 1 : 1;
    const currentTime = formatDate(new Date());
    const newChat = {
      id: newId,
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
    const updatedChats = [newChat, ...chats];
    setChats(updatedChats);
    setSelectedChat(newChat);

    axios
      .post(
        `${SERVER_URL}/send_to_secure`,
        { thread_id: newChat.id, message: newChatMessage, topic: newChatSubject },
        { withCredentials: true }
      )
      .then((res) =>
        console.log("New chat forwarded to secure messaging agent:", res.data)
      )
      .catch((err) =>
        console.error("Error forwarding new chat message to secure messaging agent:", err)
      );

    setNewChatSubject("");
    setNewChatMessage("");
    setComposeMode(false);
  };

  const cancelCompose = () => {
    setNewChatSubject("");
    setNewChatMessage("");
    setComposeMode(false);
  };

  const deleteThread = () => {
    if (!selectedChat) return;
    if (window.confirm("Are you sure you want to delete this thread?")) {
      const updatedChats = chats.filter((chat) => chat.id !== selectedChat.id);
      setChats(updatedChats);
      setSelectedChat(updatedChats.length > 0 ? updatedChats[0] : null);
    }
  };

  const toggleExpand = (chatId, msgIndex) => {
    const key = `${chatId}-${msgIndex}`;
    setExpandedMessages((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getAvatar = (sender) => {
    const defaultPic = "/avatar.png";
    if (sender === "You") {
      return user?.picture || defaultPic;
    }
    return defaultPic;
  };

  const handleSelectSearchResult = (chat) => {
    setSelectedChat(chat);
    setShowDropdown(false);
    setSearchTerm("");
    setComposeMode(false);
    setShowReplyBox(false);
  };

  return user ? (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        backgroundColor: "#f9f9f9",
      }}
    >
      {/* Left Panel */}
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
        <div style={{ margin: "0 auto", marginBottom: "32px" }}>
          <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfgnRAYqlZ9QkeI3zoIhQ3c-JKNLZoGPUzdQ&s"
            alt="Bank Logo"
            style={{ width: "150px", display: "block", margin: "0 auto" }}
          />
        </div>
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
                  backgroundColor:
                    selectedChat?.id === chat.id ? "#edf2f7" : "#fff",
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
      {/* Right Panel */}
      <div
        style={{
          width: "75%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* Top Bar */}
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
          <div style={{ position: "relative" }}>
            {user && (
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
                  <h2
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      margin: 0,
                    }}
                  >
                    {selectedChat.title}
                  </h2>
                ) : (
                  <h2
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      margin: 0,
                    }}
                  >
                    No Thread Selected
                  </h2>
                )}
              </div>
            </header>
          )}
          {composeMode ? (
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
                <h2
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: "bold",
                    marginBottom: "16px",
                  }}
                >
                  Compose New Message
                </h2>
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "0.85rem",
                    }}
                  >
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
                  <label
                    style={{
                      marginBottom: "4px",
                      fontSize: "0.85rem",
                    }}
                  >
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
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "auto",
                  }}
                >
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
                      const isLastMessage =
                        index === selectedChat.messages.length - 1;
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
                              toggleExpand(selectedChat.id, index);
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
                          <img
                            src={
                              msg.sender === "You" ? "/avatar.png" : "/agent.png"
                            }
                            alt="Avatar"
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              flexShrink: 0,
                            }}
                          />
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
                              <span style={{ fontWeight: "bold" }}>
                                {msg.sender}
                              </span>
                              <span>{msg.time}</span>
                            </div>
                            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                              {displayedText}
                            </p>
                          </div>
                        </div>
                      );
                    })}
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
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "8px",
                          }}
                        >
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
  ) : null;
};

export default SecureMessaging;
