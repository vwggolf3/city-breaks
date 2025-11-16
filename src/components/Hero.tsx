import { Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-plane-sunset.jpg";

export const Hero = () => {
  return (
    <section className="relative min-h-[250px] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-background/50 to-background/70 backdrop-blur-[2px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-6 text-center">
        <div className="max-w-4xl mx-auto space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
            Discover Europe from
            <br />
            <span className="bg-hero-gradient bg-clip-text text-transparent">
              Amsterdam Airport
            </span>
          </h1>

          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            Weekend getaways to 193 European cities departing Thursday, Friday, or Saturday. 
            Quick escapes from Amsterdam Schiphol at your fingertips.
          </p>

        </div>
      </div>
    </section>
  );
};