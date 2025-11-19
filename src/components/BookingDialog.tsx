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
  phoneCountryCode: string;
  phone: string;
  // Passport fields required by Amadeus for ticketing
  passportNumber: string;
  passportExpiry: string; // YYYY-MM-DD
  passportIssuanceCountry: string; // ISO 3166-1 alpha-2 (e.g., US)
  nationality: string; // ISO 3166-1 alpha-2 (e.g., US)
  // Address fields required by Amadeus
  addressLine: string;
  city: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
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
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [confirmedOffer, setConfirmedOffer] = useState<any>(null);
  const [traveler, setTraveler] = useState<Traveler>({
    id: "1",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    email: "",
    phoneCountryCode: "40",
    phone: "",
    passportNumber: "",
    passportExpiry: "",
    passportIssuanceCountry: "",
    nationality: "",
    addressLine: "",
    city: "",
    postalCode: "",
    country: "",
  });

  // Auto-populate form with user data when dialog opens
  useEffect(() => {
    const loadUserData = async () => {
      if (!open || !user) return;

      // Fetch profile data and email
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, gender')
        .eq('id', user.id)
        .single();

      // Map profile gender to Amadeus-required format (MALE/FEMALE only)
      const mappedGender = profile?.gender ? 
        (profile.gender.toLowerCase() === 'female' ? 'FEMALE' : 'MALE') : '';

      setTraveler(prev => ({
        ...prev,
        firstName: profile?.first_name || '',
        lastName: profile?.last_name || '',
        gender: mappedGender,
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
    traveler.addressLine,
    traveler.city,
    traveler.postalCode,
    traveler.country,
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

  // Validate country codes are exactly 2 letters (no numbers)
  const countryCodeRegex = /^[A-Z]{2}$/;
  if (!countryCodeRegex.test(traveler.passportIssuanceCountry) || 
      !countryCodeRegex.test(traveler.nationality) || 
      !countryCodeRegex.test(traveler.country)) {
    toast({
      title: "Invalid country code",
      description: "Country codes must be exactly 2 LETTERS (e.g., RO for Romania, US, GB, FR). Numbers like 'R0' are not valid.",
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

      // Always confirm price with Amadeus API for all flights
      const priceResponse = await supabase.functions.invoke('confirm-flight-price', {
        body: { flightOffer },
      });

      setApiResponse({ step: 'price-confirmation', response: priceResponse });

      if (priceResponse.error) {
        const apiErr = (priceResponse.data as any)?.errors?.[0];
        throw new Error(apiErr ? `${apiErr.title}: ${apiErr.detail}` : priceResponse.error.message);
      }

      console.log('Price confirmed:', priceResponse.data);
      const confirmedOfferData = priceResponse.data.data.flightOffers[0];
      setConfirmedOffer(confirmedOfferData);

      // Step 2: Create flight order
      setStep('booking');
      
      const travelers = [{
        id: traveler.id,
        dateOfBirth: traveler.dateOfBirth,
        name: {
          firstName: traveler.firstName.toUpperCase(),
          lastName: traveler.lastName.toUpperCase(),
        },
        gender: traveler.gender.toUpperCase(),
        contact: {
          emailAddress: traveler.email,
          phones: [{
            deviceType: "MOBILE",
            countryCallingCode: traveler.phoneCountryCode,
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
          countryCallingCode: traveler.phoneCountryCode,
          number: traveler.phone.replace(/\D/g, ''),
        }],
        emailAddress: traveler.email,
        address: {
          lines: [traveler.addressLine],
          postalCode: traveler.postalCode,
          cityName: traveler.city,
          countryCode: traveler.country.toUpperCase()
        }
      }];

      const orderResponse = await supabase.functions.invoke('create-flight-order', {
        body: { 
          flightOffer: confirmedOfferData,
          travelers,
          contacts,
        },
      });

      setApiResponse({ step: 'create-order', response: orderResponse });

      if (orderResponse.error) {
        const apiErr = (orderResponse.data as any)?.errors?.[0];
        throw new Error(apiErr ? `${apiErr.title}: ${apiErr.detail}` : orderResponse.error.message);
      }

      console.log('Booking created:', orderResponse.data);

      const isSimulated = (orderResponse.data as any)?.meta?.simulated;
      const ref = orderResponse.data.data?.associatedRecords?.[0]?.reference;
      toast({
        title: isSimulated ? "Booking Recorded in Demo Mode" : "Booking Successful!",
        description: ref
          ? (isSimulated
              ? `Demo reference: ${ref}. This is a sandbox reservation saved in your account.`
              : `Your booking reference is: ${ref}`)
          : (isSimulated ? "Sandbox booking saved." : "Booking created."),
      });

      // Keep dialog open so user can view API response and preserve form values
      setStep('details');
    } catch (error: any) {
      console.error('Booking error:', error);
      
      // Check if it's the common test environment limitation (error 38189)
      const isTestEnvError = error.message?.includes('38189') || error.message?.includes('Internal error');
      
      toast({
        title: "Booking Failed",
        description: isTestEnvError 
          ? "This flight is unavailable in the test environment. The test API uses limited cached inventory that fills up quickly. Try: (1) a different date further in the future, (2) a less popular route, or (3) upgrading to production API for real bookings."
          : error.message || "Failed to complete booking. Please try again.",
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

            {/* Test Environment Notice */}
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-sm space-y-3">
              <p className="text-muted-foreground">
                <strong>Note:</strong> This is a test booking. Popular flights may show as unavailable due to limited test inventory.
              </p>
              
              {/* Raw API Response */}
              {apiResponse && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                    View Raw API Response ({apiResponse.step})
                  </summary>
                  <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto max-h-64 border">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </details>
              )}
            </div>

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
                    <span className="font-semibold">
                      {confirmedOffer ? (
                        <>{confirmedOffer.price.currency} {confirmedOffer.price.total}</>
                      ) : (
                        <>{flightOffer.price.currency} {flightOffer.price.total}</>
                      )}
                    </span>
                  </div>
                  {confirmedOffer && confirmedOffer.price.total !== flightOffer.price.total && (
                    <div className="text-xs text-muted-foreground">
                      Price confirmed with Amadeus API
                    </div>
                  )}
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

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phoneCountryCode">Country Code *</Label>
                      <Select value={traveler.phoneCountryCode} onValueChange={(value) => handleInputChange('phoneCountryCode', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="40">+40 (RO)</SelectItem>
                          <SelectItem value="1">+1 (US/CA)</SelectItem>
                          <SelectItem value="44">+44 (UK)</SelectItem>
                          <SelectItem value="33">+33 (FR)</SelectItem>
                          <SelectItem value="49">+49 (DE)</SelectItem>
                          <SelectItem value="34">+34 (ES)</SelectItem>
                          <SelectItem value="39">+39 (IT)</SelectItem>
                          <SelectItem value="31">+31 (NL)</SelectItem>
                          <SelectItem value="32">+32 (BE)</SelectItem>
                          <SelectItem value="41">+41 (CH)</SelectItem>
                          <SelectItem value="351">+351 (PT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-2">
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
                      <Label htmlFor="passportIssuanceCountry">Issuance Country (2 letters, e.g., RO) *</Label>
                      <Input
                        id="passportIssuanceCountry"
                        value={traveler.passportIssuanceCountry}
                        maxLength={2}
                        onChange={(e) => handleInputChange('passportIssuanceCountry', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0,2))}
                        placeholder="RO"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nationality">Nationality (2 letters, e.g., RO) *</Label>
                      <Input
                        id="nationality"
                        value={traveler.nationality}
                        maxLength={2}
                        onChange={(e) => handleInputChange('nationality', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0,2))}
                        placeholder="RO"
                      />
                    </div>
                  </div>

                  <h3 className="font-semibold pt-4">Contact Address</h3>
                  <div className="space-y-2">
                    <Label htmlFor="addressLine">Street Address *</Label>
                    <Input
                      id="addressLine"
                      value={traveler.addressLine}
                      onChange={(e) => handleInputChange('addressLine', e.target.value)}
                      placeholder="123 Main Street, Apt 4B"
                      maxLength={200}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={traveler.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        placeholder="New York"
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code *</Label>
                      <Input
                        id="postalCode"
                        value={traveler.postalCode}
                        onChange={(e) => handleInputChange('postalCode', e.target.value)}
                        placeholder="10001"
                        maxLength={20}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country (2 letters only, e.g., RO) *</Label>
                    <Input
                      id="country"
                      value={traveler.country}
                      maxLength={2}
                      onChange={(e) => handleInputChange('country', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0,2))}
                      placeholder="RO"
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
