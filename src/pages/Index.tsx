import { Hero } from "@/components/Hero";
import { SearchForm } from "@/components/SearchForm";
import { FlightCard } from "@/components/FlightCard";
import { Header } from "@/components/Header";

// Mock data for flight results
const mockFlights = [
  {
    destination: "Barcelona",
    country: "Spain",
    price: 89,
    departureTime: "18:30",
    returnTime: "22:15",
    duration: "5h 45m",
    airline: "Ryanair",
    stops: 0,
    image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&auto=format&fit=crop",
  },
  {
    destination: "Amsterdam",
    country: "Netherlands",
    price: 125,
    departureTime: "14:20",
    returnTime: "19:30",
    duration: "4h 10m",
    airline: "KLM",
    stops: 0,
    image: "https://images.unsplash.com/photo-1584003564911-a8945aba762b?w=800&auto=format&fit=crop",
  },
  {
    destination: "Lisbon",
    country: "Portugal",
    price: 95,
    departureTime: "16:45",
    returnTime: "21:00",
    duration: "6h 15m",
    airline: "TAP Air",
    stops: 0,
    image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&auto=format&fit=crop",
  },
  {
    destination: "Prague",
    country: "Czech Republic",
    price: 78,
    departureTime: "12:30",
    returnTime: "16:45",
    duration: "4h 15m",
    airline: "Wizz Air",
    stops: 0,
    image: "https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&auto=format&fit=crop",
  },
  {
    destination: "Copenhagen",
    country: "Denmark",
    price: 142,
    departureTime: "09:15",
    returnTime: "14:20",
    duration: "5h 05m",
    airline: "Norwegian",
    stops: 0,
    image: "https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=800&auto=format&fit=crop",
  },
  {
    destination: "Rome",
    country: "Italy",
    price: 115,
    departureTime: "15:40",
    returnTime: "20:30",
    duration: "4h 50m",
    airline: "Ryanair",
    stops: 0,
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&auto=format&fit=crop",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      
      <section id="search" className="py-16 px-4 bg-secondary/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Where Do You Want to Go?
            </h2>
            <p className="text-lg text-muted-foreground">
              Set your preferences and discover amazing weekend destinations
            </p>
          </div>
          <SearchForm />
        </div>
      </section>


      <footer className="bg-muted/50 py-8 px-4 mt-16 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>© 2025 Weekend Flight Finder. Your next adventure is just a weekend away.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
