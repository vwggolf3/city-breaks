import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Traveler {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightOffer: any;
}

export const BookingDialog = ({ open, onOpenChange, flightOffer }: BookingDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'details' | 'confirming' | 'booking'>('details');
  const [traveler, setTraveler] = useState<Traveler>({
    id: "1",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    email: "",
    phone: "",
  });

  const handleInputChange = (field: keyof Traveler, value: string) => {
    setTraveler(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!traveler.firstName || !traveler.lastName || !traveler.dateOfBirth || 
        !traveler.gender || !traveler.email || !traveler.phone) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleBookFlight = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setStep('confirming');

    try {
      // Step 1: Confirm flight price
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to book a flight');
      }

      const priceResponse = await supabase.functions.invoke('confirm-flight-price', {
        body: { flightOffer },
      });

      if (priceResponse.error) {
        throw new Error(priceResponse.error.message);
      }

      console.log('Price confirmed:', priceResponse.data);
      const confirmedOffer = priceResponse.data.data.flightOffers[0];

      // Step 2: Create flight order
      setStep('booking');
      
      const travelers = [{
        id: traveler.id,
        dateOfBirth: traveler.dateOfBirth,
        name: {
          firstName: traveler.firstName.toUpperCase(),
          lastName: traveler.lastName.toUpperCase(),
        },
        gender: traveler.gender,
        contact: {
          emailAddress: traveler.email,
          phones: [{
            deviceType: "MOBILE",
            countryCallingCode: "1",
            number: traveler.phone.replace(/\D/g, ''),
          }],
        },
        documents: [{
          documentType: "PASSPORT",
          birthPlace: "Madrid",
          issuanceLocation: "Madrid",
          issuanceDate: "2015-04-14",
          number: "00000000",
          expiryDate: "2025-04-14",
          issuanceCountry: "ES",
          validityCountry: "ES",
          nationality: "ES",
          holder: true
        }]
      }];

      const contacts = [{
        addresseeName: {
          firstName: traveler.firstName.toUpperCase(),
          lastName: traveler.lastName.toUpperCase(),
        },
        companyName: "WEEKEND FLIGHT FINDER",
        purpose: "STANDARD",
        phones: [{
          deviceType: "MOBILE",
          countryCallingCode: "1",
          number: traveler.phone.replace(/\D/g, ''),
        }],
        emailAddress: traveler.email,
        address: {
          lines: ["123 Main St"],
          postalCode: "10001",
          cityName: "New York",
          countryCode: "US"
        }
      }];

      const orderResponse = await supabase.functions.invoke('create-flight-order', {
        body: { 
          flightOffer: confirmedOffer,
          travelers,
          contacts,
        },
      });

      if (orderResponse.error) {
        throw new Error(orderResponse.error.message);
      }

      console.log('Booking created:', orderResponse.data);

      toast({
        title: "Booking Successful!",
        description: `Your booking reference is: ${orderResponse.data.data?.associatedRecords?.[0]?.reference}`,
      });

      onOpenChange(false);
      
      // Reset form
      setStep('details');
      setTraveler({
        id: "1",
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        gender: "",
        email: "",
        phone: "",
      });
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to complete booking. Please try again.",
        variant: "destructive",
      });
      setStep('details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Booking</DialogTitle>
          <DialogDescription>
            {step === 'details' && "Enter traveler information to complete your booking"}
            {step === 'confirming' && "Confirming flight availability and price..."}
            {step === 'booking' && "Creating your flight booking..."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {step === 'confirming' && "Verifying flight details..."}
              {step === 'booking' && "Processing your booking..."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Flight Summary */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h3 className="font-semibold">Flight Summary</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Route:</span>
                <span>{flightOffer.itineraries[0].segments[0].departure.iataCode} → {flightOffer.itineraries[0].segments[flightOffer.itineraries[0].segments.length - 1].arrival.iataCode}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Price:</span>
                <span className="font-semibold">{flightOffer.price.currency} {flightOffer.price.total}</span>
              </div>
            </div>

            {/* Traveler Information Form */}
            <div className="space-y-4">
              <h3 className="font-semibold">Traveler Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={traveler.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={traveler.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={traveler.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={traveler.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={traveler.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="john.doe@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={traveler.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="555-555-5555"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBookFlight}
                className="flex-1"
                disabled={loading}
              >
                Complete Booking
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
