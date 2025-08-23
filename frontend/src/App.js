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

      // 2. Upload file directly to S3
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
    <div style={{ padding: "20px" }}>
      <h2>Upload a Photo</h2>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>

      <hr />

      <h2>Search Photos by Tag</h2>
      <input
        type="text"
        placeholder="Enter tag (e.g. Cat)"
        value={searchTag}
        onChange={(e) => setSearchTag(e.target.value)}
      />
      <button onClick={handleSearch}>Search</button>

      <div style={{ marginTop: "20px" }}>
        {results.length === 0 && <p>No results yet.</p>}
        {results.map((photo) => (
          <div
            key={photo.photoId}
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              marginBottom: "10px",
            }}
          >
            <img
              src={photo.url}
              alt={photo.photoId}
              style={{ maxWidth: "200px", display: "block" }}
            />
            <p>{/* <b>Tags:</b> {photo.tags.join(", ")} */}</p>
            <p>
              <b>Uploaded At:</b> {photo.uploadedAt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
