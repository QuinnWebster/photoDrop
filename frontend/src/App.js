import axios from "axios";
import { useState, useEffect } from "react";
import { IoMdClose } from "react-icons/io";

function App() {
  const [file, setFile] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [searchTags, setSearchTags] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [topTags, setTopTags] = useState([]);

  // File change
  const handleFileChange = (e) => setFile(e.target.files[0]);

  // Upload flow
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const res = await axios.post(
        "https://spgf8l3if3.execute-api.us-west-2.amazonaws.com/prod/get-upload-url",
        { fileName: file.name, fileType: file.type }
      );

      const { uploadUrl } = res.data;
      await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
      });

      alert("Upload successful!");
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  // Tag input management
  const addTag = () => {
    if (tagInput.trim() && !searchTags.includes(tagInput.trim())) {
      setSearchTags([...searchTags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag) => {
    setSearchTags(searchTags.filter((t) => t !== tag));
  };

  // Search flow
  const handleSearch = async () => {
    console.log("Serarhing!");
    console.log("test", searchTags.length);
    if (searchTags.length === 0) return;
    setLoading(true);

    try {
      const res = await axios.get(
        "https://spgf8l3if3.execute-api.us-west-2.amazonaws.com/prod/search",
        {
          params: {
            tags: searchTags?.map((t) => t.toLowerCase()).join(","),
          },
        }
      );
      console.log("Search results:", res);

      setResults(
        res?.data?.results?.map((photo) => ({
          id: photo.photoId,
          url: photo.url,
          tags: photo.labels,
          score: photo.score,
        }))
      );
    } catch (err) {
      console.error("Search failed:", err);
      alert("Search failed");
    } finally {
      setLoading(false);
    }
  };

  console.log("Results", results);

  const handleTopTags = async () => {
    try {
      const res = await axios.get(
        "https://spgf8l3if3.execute-api.us-west-2.amazonaws.com/prod/top-tags"
      );

      console.log("Top tags fetched successfully:", res.data);

      setTopTags(
        res.data.map((tag) => ({
          key: tag.tag,
          count: tag.count,
          tag: tag.tag,
        }))
      );
    } catch (err) {
      console.error("Search failed:", err);
      alert("Search failed");
    } finally {
      setLoading(false);
    }
  };

  function capitalizeFirstLetter(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // useEffect(() => {
  //   handleTopTags();
  // }, []);

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Upload Section */}
      <div
        style={{
          maxWidth: "400px",
          margin: "0 auto",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          textAlign: "center",
          background: "#fff",
        }}
      >
        <h2 style={{ color: "#1976d2", marginBottom: "20px" }}>
          Upload a Photo
        </h2>

        {/* File input styled as a dropzone */}
        <label
          style={{
            display: "block",
            border: "2px dashed #1976d2",
            borderRadius: "8px",
            padding: "30px 20px",
            cursor: "pointer",
            marginBottom: "20px",
            color: file ? "#333" : "#666",
            fontSize: "14px",
            background: file ? "#e3f2fd" : "#fafafa",
            transition: "0.2s ease",
          }}
        >
          {file ? (
            <strong>{file.name}</strong>
          ) : (
            "Click to select an image or drag it here"
          )}
          <input
            type="file"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          style={{
            background: "#1976d2",
            color: "white",
            border: "none",
            padding: "12px 20px",
            borderRadius: "6px",
            fontSize: "15px",
            fontWeight: 600,
            cursor: loading || !file ? "not-allowed" : "pointer",
            opacity: loading || !file ? 0.6 : 1,
            transition: "background 0.2s ease",
          }}
        >
          {loading ? "Uploading..." : "Upload"}
        </button>
      </div>

      <hr style={{ margin: "30px 0" }} />

      {/* Search Section */}
      <h2 style={{ color: "#1976d2" }}>Search Photos by Tags</h2>
      <div style={{ marginBottom: "8px" }}>
        <span
          style={{
            fontSize: "0.85em",
            color: "#666",
            marginRight: "8px",
          }}
        >
          Top tags:
        </span>
        {topTags.map((tag) => (
          <span
            key={tag.tag}
            style={{
              display: "inline-block",
              fontSize: "0.85em",
              background: "#f5f5f5",
              color: "#444",
              padding: "4px 8px",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
              marginRight: "6px",
              marginBottom: "6px",
            }}
          >
            {capitalizeFirstLetter(tag.tag)}{" "}
            <span style={{ color: "#888" }}>({tag.count})</span>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="Enter a tag (e.g. Cat)"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
          style={{
            flex: 1,
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <button
          onClick={addTag}
          style={{
            background: "#1976d2",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Add
        </button>
        <button
          onClick={handleSearch}
          disabled={loading || searchTags.length === 0}
          style={{
            background: "#388e3c",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "4px",
            cursor: searchTags.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          Search
        </button>
      </div>

      {/* Tag chips */}
      <div style={{ marginBottom: "20px" }}>
        {searchTags.map((tag) => (
          <span
            key={tag.tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: "0.85em",
              background: "#f5f5f5",
              color: "#444",
              padding: "4px 8px",
              borderRadius: "12px",
              border: "1px solid #e0e0e0",
              marginRight: "6px",
              marginBottom: "6px",
            }}
          >
            {capitalizeFirstLetter(tag)}{" "}
            <IoMdClose
              onClick={() => removeTag(tag)}
              style={{
                marginLeft: "6px",
                cursor: "pointer",
                fontSize: "1.1em",
                color: "#888",
              }}
            />
          </span>
        ))}
      </div>

      {/* Results Section */}
      <div>
        {loading ? (
          <p style={{ color: "#666" }}>Loading...</p>
        ) : results.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px 16px",
              // border: "1px dashed #ddd",
              borderRadius: "10px",
              // background: "#fafafa",
              // color: "#555",
              fontSize: "0.95em",
              marginTop: "20px",
            }}
          >
            <p style={{ margin: 0, fontWeight: 500 }}>
              No photos matched your search
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "0.85em", color: "#888" }}>
              Try adjusting your search tags
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "15px",
            }}
          >
            {results?.map((photo) => (
              <div
                key={photo.photoId}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "10px",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.photoId}
                  style={{
                    width: "100%",
                    borderRadius: "6px",
                    marginBottom: "10px",
                  }}
                />

                <p style={{ color: "#555", fontSize: "0.9em" }}>
                  <b>similarity:</b> {photo.score}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
