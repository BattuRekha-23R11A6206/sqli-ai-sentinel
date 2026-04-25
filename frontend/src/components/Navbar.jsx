import React from "react";
import { Link, NavLink } from "react-router-dom";
import { ShieldCheck, MoonStar, SunMedium } from "lucide-react";

const Navbar = ({ theme, onToggleTheme }) => {
  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="logo">
          <ShieldCheck size={20} />
          <span>SQLi Sentinel</span>
        </Link>

        <nav className="nav-links">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/scanner">Scanner</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>

        <button className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <SunMedium size={18} /> : <MoonStar size={18} />}
        </button>
      </div>
    </header>
  );
};

export default Navbar;
