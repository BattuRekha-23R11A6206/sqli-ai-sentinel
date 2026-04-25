import React from "react";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <main className="page home-page container">
      <section className="hero">
        <p className="eyebrow">Static Analysis Security Tool</p>
        <h1>SQLi Sentinel</h1>
        <p>AI-Powered SQL Injection Detection for JavaScript</p>
        <Link to="/scanner" className="btn primary">
          Start Scanning
        </Link>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <h3>10,000+</h3>
          <p>Training Samples</p>
        </div>
        <div className="stat-card">
          <h3>6</h3>
          <p>Vulnerability Patterns</p>
        </div>
        <div className="stat-card">
          <h3>Function-Level</h3>
          <p>Analysis</p>
        </div>
        <div className="stat-card">
          <h3>MERN</h3>
          <p>Stack Optimized</p>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <span>01</span>
            <h4>Upload</h4>
            <p>Provide a JavaScript file or paste code directly into the scanner.</p>
          </div>
          <div className="step-card">
            <span>02</span>
            <h4>Scan</h4>
            <p>AST parsing isolates functions and CodeBERT evaluates injection risk.</p>
          </div>
          <div className="step-card">
            <span>03</span>
            <h4>Report</h4>
            <p>Get vulnerability insights with confidence scores and structured output.</p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
