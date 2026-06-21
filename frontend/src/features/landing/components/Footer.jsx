import { Mic } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="lp-footer">
    <div className="lp-footer-inner">
      <div className="lp-footer-brand">
        <div className="lp-footer-logo">
          <div className="lp-logo-icon">
            <Mic size={16} color="white" />
          </div>
          <span className="lp-logo-text">VoicePrep AI</span>
        </div>
        <p className="lp-footer-tagline">
          AI-powered voice interview practice for Sri Lankan job seekers.
        </p>
      </div>

      <div className="lp-footer-links">
        <div className="lp-footer-col">
          <h4>Product</h4>
          <a
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            How It Works
          </a>
          <a
            href="#stats"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("stats")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Why Us
          </a>
        </div>
        <div className="lp-footer-col">
          <h4>Account</h4>
          <Link to="/login">Sign In</Link>
          <Link to="/register">Create Account</Link>
          <Link to="/dashboard">Dashboard</Link>
        </div>
      </div>
    </div>
    <div className="lp-footer-bottom">
      <span>© {new Date().getFullYear()} VoicePrep AI. Built for Sri Lankan job seekers.</span>
    </div>
  </footer>
);

export default Footer;
