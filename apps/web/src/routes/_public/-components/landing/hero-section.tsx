import { Button } from '@repo/ui/components/button';
import { Link } from '@tanstack/react-router';

// Note: Component function name remains PascalCase
export function HeroSection() {
  return (
    <section className="bg-slate-900 text-white py-16 md:py-24">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center">
        {/* Left Column: Text Content */}
        <div className="md:w-1/2 text-center md:text-left mb-10 md:mb-0 md:pr-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            Your Finances.
            <br />
            Your Voice. Your Time.
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8">
            Connect your accounts. Get smart audio updates. Talk to AI about
            your money like never before.
          </p>
          <Button size="lg" className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-8 py-3 rounded-lg mb-4">
              <Link to="/login">
                Get Started
              </Link>
          </Button>
        </div>

        {/* Right Column: Image */}
        <div className="md:w-1/2 flex justify-center">
          <img
            src="/LandingPage.png" // Assumes image is in public folder
            alt="Hero Illustration"
            className="max-w-full h-auto rounded-lg shadow-lg"
            style={{ maxWidth: '450px' }} // Optional: constrain max width
          />
        </div>
      </div>
    </section>
  );
}