import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Scanner from "./pages/Scanner";
import History from "./pages/History";

const App = () => {
  const [theme, setTheme] = useState(localStorage.getItem("sqli-theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sqli-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const appClass = useMemo(() => `app ${theme}`, [theme]);

  return (
    <div className={appClass}>
      <Navbar theme={theme} onToggleTheme={toggleTheme} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default App;
