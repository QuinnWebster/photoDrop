import axios from "axios";
import { useState } from "react";

function App() {
  const [file, setFile] = useState(null);

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
        headers: {
          "Content-Type": file.type,
        },
      });

      alert("Upload successful!");
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed");
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
}

export default App;
