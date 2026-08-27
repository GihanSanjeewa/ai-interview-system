import Hero from "./sections/Hero";
import Trusted from "./sections/Trusted";
import Categories from "./sections/Categories";
import Features from "./sections/Features";
import LiveInterviewPreview from "./sections/LiveInterviewPreview";
import HowItWorks from "./sections/HowItWorks";
import Testimonials from "./sections/Testimonials";
import Faq from "./sections/Faq";
import CtaBanner from "./sections/CtaBanner";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Trusted />
      <Categories />
      <Features />
      <div id="preview">
        <LiveInterviewPreview />
      </div>
      <HowItWorks />
      <Testimonials />
      <Faq />
      <CtaBanner />
    </>
  );
}
