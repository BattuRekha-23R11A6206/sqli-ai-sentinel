import React from "react";

const LoadingSpinner = ({ message = "Analyzing code with CodeBERT..." }) => {
  return (
    <div className="loading-wrap">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  );
};

export default LoadingSpinner;
