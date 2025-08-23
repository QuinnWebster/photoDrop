import axios from "axios";
import { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [searchTag, setSearchTag] = useState("");
  const [results, setResults] = useState([]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      // 1. Ask Lambda for a presigned URL
      const res = await axios.post(
        "https://spgf8l3if3.execute-api.us-west-2.amazonaws.com/prod/get-upload-url",
        {
          fileName: file.name,
          fileType: file.type,
        }
      );

      const { uploadUrl } = res.data;

      await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
      });

      alert("Upload successful!");
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed");
    }
  };

  const handleSearch = async () => {
    if (!searchTag.trim()) return;

    try {
      const res = await axios.get(
        `https://spgf8l3if3.execute-api.us-west-2.amazonaws.com/prod/search`,
        { params: { tag: searchTag } }
      );

      console.log("Search results:", res.data);

      setResults(res.data);
    } catch (err) {
      console.error("Search failed:", err);
      alert("Search failed");
    }
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Upload Section */}
      <h2 style={{ marginBottom: "10px", color: "#1976d2" }}>Upload a Photo</h2>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="file"
          onChange={handleFileChange}
          style={{
            flex: 1,
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <button
          onClick={handleUpload}
          style={{
            background: "#1976d2",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Upload
        </button>
      </div>

      <hr style={{ margin: "30px 0" }} />

      {/* Search Section */}
      <h2 style={{ marginBottom: "10px", color: "#1976d2" }}>
        Search Photos by Tag
      </h2>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter tag (e.g. Cat)"
          value={searchTag}
          onChange={(e) => setSearchTag(e.target.value)}
          style={{
            flex: 1,
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            background: "#388e3c",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>

      {/* Results Section */}
      <div style={{ marginTop: "20px" }}>
        {results.length === 0 ? (
          <p style={{ color: "#666" }}>No results yet.</p>
        ) : (
          results.map((photo) => (
            <div
              key={photo.photoId}
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "15px",
                marginBottom: "15px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
              }}
            >
              <img
                src={photo.url}
                alt={photo.photoId}
                style={{
                  width: "120px",
                  height: "auto",
                  borderRadius: "6px",
                  marginRight: "15px",
                }}
              />
              <div>
                <p style={{ margin: "4px 0" }}>
                  <b>Tags:</b> {photo.tags?.join(", ") || "None"}
                </p>
                <p style={{ margin: "4px 0", color: "#555" }}>
                  <b>Uploaded At:</b> {photo.uploadedAt}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
