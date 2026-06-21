import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Stats from "./components/Stats";
import Footer from "./components/Footer";
import "./landing.css";

const LandingPage = () => (
  <div className="lp-root">
    <Navbar />
    <Hero />
    <Features />
    <HowItWorks />
    <Stats />
    <Footer />
  </div>
);

export default LandingPage;
