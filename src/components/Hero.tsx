import { Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-plane-sunset.jpg";

export const Hero = () => {
  return (
    <section className="relative min-h-[400px] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-background/50 to-background/70 backdrop-blur-[2px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
            Find Your Perfect
            <br />
            <span className="bg-hero-gradient bg-clip-text text-transparent">
              Weekend Escape
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Discover spontaneous weekend getaways from your nearest airport. 
            Quick, affordable, and unforgettable trips at your fingertips.
          </p>

        </div>
      </div>
    </section>
  );
};