import { useState, useRef, useEffect } from "react";

const N8N_UPLOAD_URL = "http://localhost:5678/webhook/upload-doc";
const N8N_LIST_URL = "http://localhost:5678/webhook/list-docs";
const N8N_GET_DOCS = "http://localhost:5678/webhook/get-docs";
const N8N_GENERATE_QUESTIONS = "http://localhost:5678/webhook/generate-questions";
const N8N_ASK_QUESTION = "http://localhost:5678/webhook/ask-question";
const N8N_GET_FILE = "http://localhost:5678/webhook/get-file";

function DocumentPage() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    fetch(N8N_LIST_URL)
      .then(r => r.json())
      .then(data => setUploads(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return "—";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("document", file); 
    try {
      await fetch(N8N_UPLOAD_URL, { method: "POST", body: formData });
      const res = await fetch(N8N_LIST_URL);
      const data = await res.json();
      setUploads(Array.isArray(data) ? data : []);
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setLoading(false);
      fileRef.current.value = "";
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: "1rem" }}>Document Upload</h2>
      <div
        onClick={() => !loading && fileRef.current.click()}
        style={{
          border: "1.5px dashed #ccc", borderRadius: 12, padding: "2.5rem",
          textAlign: "center", cursor: loading ? "not-allowed" : "pointer",
          background: "#f9f9f9", marginBottom: "1.5rem", opacity: loading ? 0.6 : 1,
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.xlsx,.docx" style={{ display: "none" }} onChange={handleUpload} disabled={loading} />
        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
        <p style={{ fontSize: 14, color: "#888" }}>
          {loading ? "Processing..." : <><span style={{ fontWeight: 500, color: "#111" }}>Click to upload</span> a document</>}
        </p>
      </div>
      {uploads.length === 0 ? (
        <p style={{ fontSize: 14, color: "#888", textAlign: "center", padding: "2rem 0" }}>No documents uploaded yet</p>
      ) : (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: "#888", marginBottom: 12 }}>Upload history</h3>
          {uploads.map((u, i) => (
            <div key={i} style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{u.name}</span>
                <span style={{ fontSize: 12, color: "#888" }}>{new Date(u.created_at).toLocaleTimeString()}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { label: "File size", value: formatBytes(u.size_bytes) },
                  { label: "Duration", value: u.duration_ms ? u.duration_ms + "ms" : "—" },
                  { label: "Tokens used", value: u.tokens_used ? u.tokens_used.toLocaleString() : "—" },
                ].map((stat) => (
                  <div key={stat.label} style={{ background: "#f5f5f5", borderRadius: 8, padding: "0.6rem 0.8rem" }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{stat.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatPage() {
  const [step, setStep] = useState("select-doc");
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [summary, setSummary] = useState("")
  const [answer, setAnswer] = useState("");
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [otherMode, setOtherMode] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState("");

  useEffect(() => {
    fetch(N8N_GET_DOCS)
      .then(r => r.json())
      .then(data => setDocs(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const selectDoc = async (doc) => {
    setSelectedDoc(doc);
    setStep("loading-questions");
    setLoading(true);
    try {
      const res = await fetch(N8N_GENERATE_QUESTIONS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: doc.id })
      });
      const data = await res.json();

      let parsedQuestions = data.questions;
      if (typeof parsedQuestions === 'string') {
        try {
          parsedQuestions = JSON.parse(parsedQuestions);
        } catch (e) {
          console.error("Failed to parse questions string:", e);
          parsedQuestions = [];
        }
      }

      setQuestions(Array.isArray(parsedQuestions) ? parsedQuestions : []);
      setSummary(data.summary || "")
      setStep("select-question");
    } catch {
      alert("Failed to generate questions");
      setStep("select-doc");
    } finally {
      setLoading(false);
    }
  };

  const askQuestion = async (question) => {
    setCurrentQuestion(question);
    setStep("loading-answer");
    setLoading(true);
    setOtherMode(false);
    setCustomQuestion("");
    try {
      const res = await fetch(N8N_ASK_QUESTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: selectedDoc.id, question })
      });
      const data = await res.json();
      setAnswer(data.choices[0].message.content || "");
      // setAnswer(data.answer || "");

      // let parsedFollowUps = data.followUpQuestions;
      // if (typeof parsedFollowUps === 'string') {
      //   try {
      //     parsedFollowUps = JSON.parse(parsedFollowUps);
      //   } catch (e) {
      //     console.error("Failed to parse followUps string:", e);
      //     parsedFollowUps = [];
      //   }
      // }

      // setFollowUps(Array.isArray(parsedFollowUps) ? parsedFollowUps : []);
      setFollowUps([]);
      setStep("show-answer");
    } catch {
      alert("Failed to get answer");
      setStep("select-question");
    } finally {
      setLoading(false);
    }
  };

  const viewDocument = async () => {
    const res = await fetch(N8N_GET_FILE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: selectedDoc.id })
    });
    const data = await res.json();
    const item = Array.isArray(data) ? data[0] : data;
    const blob = base64ToBlob(item.file_data, item.mime_type);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const formatAnswer = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <p key={i} style={{ margin: line.trim().startsWith('*') || line.trim().startsWith('-') ? "4px 0" : "8px 0", direction: "auto", unicodeBidi: "plaintext" }}>
        {line.trim().startsWith('*') ? '• ' + line.trim().slice(1).trim() : line}
      </p>
    ));
  };

  const base64ToBlob = (base64, mimeType) => {
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mimeType });
  };

  const reset = () => {
    setStep("select-doc");
    setSelectedDoc(null);
    setQuestions([]);
    setAnswer("");
    setFollowUps([]);
    setOtherMode(false);
    setCustomQuestion("");
    setCurrentQuestion("");
  };

  const chipStyle = {
    padding: "10px 16px", borderRadius: 20, border: "0.5px solid #e5e5e5",
    background: "#fff", fontSize: 14, cursor: "pointer", textAlign: "left",
    transition: "background 0.15s",
  };

  const otherChipStyle = {
    ...chipStyle, border: "0.5px solid #ccc", color: "#555", fontStyle: "italic"
  };

  if (step === "select-doc") return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: "1rem" }}>Chat</h2>
      <p style={{ fontSize: 14, color: "#888", marginBottom: 16 }}>Select a document to start chatting</p>
      {docs.length === 0 ? (
        <p style={{ fontSize: 14, color: "#888" }}>No documents available. Upload one first.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {docs.map((doc) => (
            <button key={doc.id} onClick={() => selectDoc(doc)} style={{ ...chipStyle, padding: "14px 18px", fontSize: 15 }}>
              📄 {doc.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (step === "loading-questions") return (
    <div style={{ textAlign: "center", padding: "3rem 0" }}>
      <p style={{ fontSize: 14, color: "#888" }}>Generating questions for {selectedDoc?.name}...</p>
    </div>
  );

  if (step === "select-question") return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>←</button>
        <div>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Chatting with</p>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>📄 {selectedDoc?.name}</p>
        </div>
      </div>
      {summary && (
        <div style={{ background: "#f5f5f5", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Document Summary</p>
          <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>{summary}</p>
        </div>
      )}
      <p style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>Select a question:</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {questions?.map((q, i) => (
          <button key={i} onClick={() => askQuestion(q)} style={chipStyle}>{q}</button>
        ))}
        {!otherMode ? (
          <button onClick={() => setOtherMode(true)} style={otherChipStyle}>✏️ type Another question</button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              value={customQuestion}
              onChange={e => setCustomQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && customQuestion.trim() && askQuestion(customQuestion.trim())}
              placeholder="Type your question..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: "0.5px solid #ccc", fontSize: 14, outline: "none" }}
            />
            <button
              onClick={() => customQuestion.trim() && askQuestion(customQuestion.trim())}
              style={{ padding: "10px 18px", borderRadius: 20, border: "none", background: "#111", color: "#fff", fontSize: 14, cursor: "pointer" }}
            >
              Ask
            </button>
          </div>
        )}
        <button onClick={viewDocument} style={{ ...chipStyle, color: "#555" }}>📄 View Document</button>
      </div>
    </div>
  );

  if (step === "loading-answer") return (
    <div style={{ textAlign: "center", padding: "3rem 0" }}>
      <p style={{ fontSize: 14, color: "#888" }}>Searching the document and generating answer...</p>
    </div>
  );

  if (step === "show-answer") return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => setStep("select-question")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>←</button>
        <div>
          <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Chatting with</p>
          <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>📄 {selectedDoc?.name}</p>
        </div>
      </div>

      <div style={{ background: "#f5f5f5", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Question</p>
        <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{currentQuestion}</p>
      </div>

      <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Answer</p>
        <div style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>{formatAnswer(answer)}</div>
      </div>

      <p style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>Follow-up questions:</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {followUps.map((q, i) => (
          <button key={i} onClick={() => askQuestion(q)} style={chipStyle}>{q}</button>
        ))}
        {!otherMode ? (
          <button onClick={() => setOtherMode(true)} style={otherChipStyle}>✏️ Other — type your own question</button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus
              value={customQuestion}
              onChange={e => setCustomQuestion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && customQuestion.trim() && askQuestion(customQuestion.trim())}
              placeholder="Type your question..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: "0.5px solid #ccc", fontSize: 14, outline: "none" }}
            />
            <button
              onClick={() => customQuestion.trim() && askQuestion(customQuestion.trim())}
              style={{ padding: "10px 18px", borderRadius: 20, border: "none", background: "#111", color: "#fff", fontSize: 14, cursor: "pointer" }}
            >
              Ask
            </button>
          </div>
        )}
        <button onClick={reset} style={{ ...chipStyle, color: "#888", marginTop: 8 }}>🔄 Start over with a different document</button>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("doc");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: "1.5rem" }}>RAG Dashboard</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", borderBottom: "0.5px solid #e5e5e5", paddingBottom: "1rem" }}>
        {["doc", "chat"].map((p) => (
          <button key={p} onClick={() => setPage(p)} style={{
            padding: "6px 16px", borderRadius: 8,
            border: page === p ? "0.5px solid #ccc" : "0.5px solid transparent",
            background: page === p ? "#f5f5f5" : "transparent",
            fontWeight: 500, fontSize: 14, cursor: "pointer",
            color: page === p ? "#111" : "#888",
          }}>
            {p === "doc" ? "Document Upload" : "Chat"}
          </button>
        ))}
      </div>
      {page === "doc" ? <DocumentPage /> : <ChatPage />}
    </div>
  );
}