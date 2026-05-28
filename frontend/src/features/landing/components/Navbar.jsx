import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic, Menu, X } from "lucide-react";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  return (
    <nav className={`lp-nav ${scrolled ? "lp-nav--scrolled" : ""}`}>
      <div className="lp-nav-inner">
        <button className="lp-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="lp-logo-icon">
            <Mic size={18} color="white" />
          </div>
          <span className="lp-logo-text">VoicePrep AI</span>
        </button>

        <div className={`lp-nav-links ${menuOpen ? "open" : ""}`}>
          <button onClick={() => scrollTo("features")}>Features</button>
          <button onClick={() => scrollTo("how-it-works")}>How It Works</button>
          <button onClick={() => scrollTo("stats")}>Why Us</button>
          <div className="lp-nav-divider" />
          <Link to="/login" className="lp-btn-ghost">Sign In</Link>
          <button className="lp-btn-primary" onClick={() => navigate("/register")}>
            Get Started Free
          </button>
        </div>

        <button className="lp-hamburger" onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
