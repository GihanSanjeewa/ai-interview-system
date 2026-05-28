import Hero from "./sections/Hero";
import Trusted from "./sections/Trusted";
import Categories from "./sections/Categories";
import Features from "./sections/Features";
import HowItWorks from "./sections/HowItWorks";
import LiveInterviewPreview from "./sections/LiveInterviewPreview";
import Testimonials from "./sections/Testimonials";
import Pricing from "./sections/Pricing";
import Faq from "./sections/Faq";
import CtaBanner from "./sections/CtaBanner";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Trusted />
      <Categories />
      <Features />
      <LiveInterviewPreview />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <Faq />
      <CtaBanner />
    </>
  );
}
