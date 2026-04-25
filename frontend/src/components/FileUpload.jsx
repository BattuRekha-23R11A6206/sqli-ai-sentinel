import React, { useRef, useState } from "react";
import { UploadCloud, FileCode2 } from "lucide-react";

const FileUpload = ({ onFileSelect, selectedFile }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files) => {
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    if (!file.name.endsWith(".js")) {
      onFileSelect(null, "Please upload a .js file only.");
      return;
    }

    onFileSelect(file, null);
  };

  return (
    <div
      className={`upload-area ${isDragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          inputRef.current?.click();
        }
      }}
    >
      <UploadCloud size={30} />
      <p>Drop your .js file here or click to browse</p>
      {selectedFile ? (
        <div className="selected-file">
          <FileCode2 size={16} />
          <span>{selectedFile.name}</span>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept=".js"
        onChange={(event) => handleFiles(event.target.files)}
        hidden
      />
    </div>
  );
};

export default FileUpload;
