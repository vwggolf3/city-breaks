import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Traveler {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: string;
  email: string;
  phone: string;
  // Passport fields required by Amadeus for ticketing
  passportNumber: string;
  passportExpiry: string; // YYYY-MM-DD
  passportIssuanceCountry: string; // ISO 3166-1 alpha-2 (e.g., US)
  nationality: string; // ISO 3166-1 alpha-2 (e.g., US)
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightOffer: any;
}

export const BookingDialog = ({ open, onOpenChange, flightOffer }: BookingDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
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
    passportNumber: "",
    passportExpiry: "",
    passportIssuanceCountry: "",
    nationality: "",
  });

  // Auto-populate form with user data when dialog opens
  useEffect(() => {
    const loadUserData = async () => {
      if (!open || !user) return;

      // Fetch profile data and email
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      setTraveler(prev => ({
        ...prev,
        firstName: profile?.first_name || '',
        lastName: profile?.last_name || '',
        email: user.email || '',
      }));
    };

    loadUserData();
  }, [open, user]);

  const handleInputChange = (field: keyof Traveler, value: string) => {
    setTraveler(prev => ({ ...prev, [field]: value }));
  };

const validateForm = () => {
  const required = [
    traveler.firstName,
    traveler.lastName,
    traveler.dateOfBirth,
    traveler.gender,
    traveler.email,
    traveler.phone,
    traveler.passportNumber,
    traveler.passportExpiry,
    traveler.passportIssuanceCountry,
    traveler.nationality,
  ];

  if (required.some((v) => !v)) {
    toast({
      title: "Missing Information",
      description: "Please fill in all required fields.",
      variant: "destructive",
    });
    return false;
  }

  const today = new Date().toISOString().split('T')[0];
  if (traveler.passportExpiry <= today) {
    toast({
      title: "Invalid passport expiry",
      description: "Passport expiry must be a future date.",
      variant: "destructive",
    });
    return false;
  }

  if (traveler.passportIssuanceCountry.length !== 2 || traveler.nationality.length !== 2) {
    toast({
      title: "Invalid country code",
      description: "Issuance country and nationality must be 2-letter codes (e.g., US).",
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
        const apiErr = (priceResponse.data as any)?.errors?.[0];
        throw new Error(apiErr ? `${apiErr.title}: ${apiErr.detail}` : priceResponse.error.message);
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
          number: traveler.passportNumber,
          expiryDate: traveler.passportExpiry,
          issuanceCountry: traveler.passportIssuanceCountry.toUpperCase(),
          nationality: traveler.nationality.toUpperCase(),
          holder: true,
        }]
      }];

      const contacts = [{
        addresseeName: {
          firstName: traveler.firstName.toUpperCase(),
          lastName: traveler.lastName.toUpperCase(),
        },
        companyName: "PersonalTravel",
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
        const apiErr = (orderResponse.data as any)?.errors?.[0];
        throw new Error(apiErr ? `${apiErr.title}: ${apiErr.detail}` : orderResponse.error.message);
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
        passportNumber: "",
        passportExpiry: "",
        passportIssuanceCountry: "",
        nationality: "",
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
        {!flightOffer ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No flight selected</p>
          </div>
        ) : (
          <>
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

              <h3 className="font-semibold pt-4">Passport Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="passportNumber">Passport Number *</Label>
                  <Input
                    id="passportNumber"
                    value={traveler.passportNumber}
                    onChange={(e) => handleInputChange('passportNumber', e.target.value.trim())}
                    placeholder="123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passportExpiry">Passport Expiry *</Label>
                  <Input
                    id="passportExpiry"
                    type="date"
                    value={traveler.passportExpiry}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleInputChange('passportExpiry', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="passportIssuanceCountry">Issuance Country (2-letter) *</Label>
                  <Input
                    id="passportIssuanceCountry"
                    value={traveler.passportIssuanceCountry}
                    maxLength={2}
                    onChange={(e) => handleInputChange('passportIssuanceCountry', e.target.value.toUpperCase().slice(0,2))}
                    placeholder="US"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality (2-letter) *</Label>
                  <Input
                    id="nationality"
                    value={traveler.nationality}
                    maxLength={2}
                    onChange={(e) => handleInputChange('nationality', e.target.value.toUpperCase().slice(0,2))}
                    placeholder="US"
                  />
                </div>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
