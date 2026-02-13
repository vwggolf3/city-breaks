import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const EUROPEAN_DESTINATIONS = [
  { code: 'PAR', city: 'Paris', country: 'France' },
  { code: 'LON', city: 'London', country: 'United Kingdom' },
  { code: 'BCN', city: 'Barcelona', country: 'Spain' },
  { code: 'ROM', city: 'Rome', country: 'Italy' },
  { code: 'AMS', city: 'Amsterdam', country: 'Netherlands' },
  { code: 'BER', city: 'Berlin', country: 'Germany' },
  { code: 'MAD', city: 'Madrid', country: 'Spain' },
  { code: 'VIE', city: 'Vienna', country: 'Austria' },
  { code: 'PRG', city: 'Prague', country: 'Czech Republic' },
  { code: 'DUB', city: 'Dublin', country: 'Ireland' },
  { code: 'LIS', city: 'Lisbon', country: 'Portugal' },
  { code: 'ATH', city: 'Athens', country: 'Greece' },
  { code: 'IST', city: 'Istanbul', country: 'Turkey' },
  { code: 'CPH', city: 'Copenhagen', country: 'Denmark' },
  { code: 'STO', city: 'Stockholm', country: 'Sweden' },
  { code: 'BRU', city: 'Brussels', country: 'Belgium' },
  { code: 'MIL', city: 'Milan', country: 'Italy' },
  { code: 'VCE', city: 'Venice', country: 'Italy' },
  { code: 'MUC', city: 'Munich', country: 'Germany' },
  { code: 'ZRH', city: 'Zurich', country: 'Switzerland' },
  { code: 'OSL', city: 'Oslo', country: 'Norway' },
  { code: 'HEL', city: 'Helsinki', country: 'Finland' },
  { code: 'WAW', city: 'Warsaw', country: 'Poland' },
  { code: 'BUD', city: 'Budapest', country: 'Hungary' },
  { code: 'EDI', city: 'Edinburgh', country: 'United Kingdom' },
  { code: 'DUS', city: 'Dusseldorf', country: 'Germany' },
  { code: 'OPO', city: 'Porto', country: 'Portugal' },
  { code: 'NCE', city: 'Nice', country: 'France' },
  { code: 'AGP', city: 'Malaga', country: 'Spain' },
  { code: 'SVQ', city: 'Seville', country: 'Spain' },
];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: "" };
  }

  try {
    const { query } = JSON.parse(event.body || "{}");

    if (!query || query.length < 1) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: EUROPEAN_DESTINATIONS }),
      };
    }

    const searchTerm = query.toLowerCase();
    const filtered = EUROPEAN_DESTINATIONS.filter(dest =>
      dest.city.toLowerCase().includes(searchTerm) ||
      dest.country.toLowerCase().includes(searchTerm) ||
      dest.code.toLowerCase().includes(searchTerm)
    );

    console.log(`Found ${filtered.length} destinations matching "${query}"`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: filtered }),
    };
  } catch (error) {
    console.error('Error in get-destinations function:', error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to get destinations'
      }),
    };
  }
};
