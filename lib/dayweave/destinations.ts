export const FEATURED_DESTINATIONS = [
  "Singapore",
  "Hong Kong",
  "Cheung Chau",
  "Johor Bahru",
  "Tokyo",
  "Kyoto",
  "Seoul",
  "Taipei",
  "Bangkok",
  "Bali",
  "Kuala Lumpur",
  "Ho Chi Minh City",
  "Hanoi",
  "Paris",
  "London",
  "Rome",
  "Barcelona",
  "Amsterdam",
  "Istanbul",
  "Dubai",
  "New York City",
  "San Francisco",
  "Los Angeles",
  "Sydney",
  "Melbourne",
  "Auckland",
  "Cape Town",
  "Marrakech",
  "Mexico City",
  "Buenos Aires",
  "Rio de Janeiro",
] as const;

export const WORLD_COUNTRIES_AND_REGIONS = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Ivory Coast",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macao",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Republic of the Congo",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Türkiye",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
] as const;

export const DESTINATION_SUGGESTIONS = Array.from(
  new Set([...FEATURED_DESTINATIONS, ...WORLD_COUNTRIES_AND_REGIONS]),
);

const FEATURED_SET = new Set<string>(FEATURED_DESTINATIONS);
const CURATED_SET = new Set<string>([
  "Hong Kong",
  "Singapore",
  "Cheung Chau",
  "Johor Bahru",
  "Seoul",
]);

const DESTINATION_ALIASES: Record<string, readonly string[]> = {
  "Hong Kong": ["HK", "Hongkong"],
  "Johor Bahru": ["JB"],
  "South Korea": ["Korea"],
  "United Arab Emirates": ["UAE"],
  "United Kingdom": ["UK", "Britain"],
  "United States": ["USA", "US", "America"],
};

export type DestinationSuggestionKind =
  | "Curated by DayWeave"
  | "Popular destination"
  | "Country or region";

export interface DestinationSuggestion {
  label: string;
  kind: DestinationSuggestionKind;
}

function normalizeDestination(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en")
    .trim();
}

function destinationKind(label: string): DestinationSuggestionKind {
  if (CURATED_SET.has(label)) return "Curated by DayWeave";
  if (FEATURED_SET.has(label)) return "Popular destination";
  return "Country or region";
}

export function searchDestinationSuggestions(
  query: string,
  limit = 9,
): DestinationSuggestion[] {
  const normalizedQuery = normalizeDestination(query);
  const ranked = DESTINATION_SUGGESTIONS.flatMap((label, index) => {
    const candidates = [
      normalizeDestination(label),
      ...(DESTINATION_ALIASES[label] ?? []).map(normalizeDestination),
    ];
    let score = Number.POSITIVE_INFINITY;

    if (!normalizedQuery) {
      if (!FEATURED_SET.has(label)) return [];
      score = index;
    } else {
      for (const candidate of candidates) {
        if (candidate === normalizedQuery) score = Math.min(score, 0);
        else if (candidate.startsWith(normalizedQuery)) score = Math.min(score, 1);
        else if (
          candidate
            .split(/\s+/)
            .some((token) => token.startsWith(normalizedQuery))
        ) {
          score = Math.min(score, 2);
        } else if (candidate.includes(normalizedQuery)) {
          score = Math.min(score, 3);
        }
      }
    }

    if (!Number.isFinite(score)) return [];
    return [{ label, kind: destinationKind(label), score, index }];
  });

  return ranked
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, Math.max(1, limit))
    .map(({ label, kind }) => ({ label, kind }));
}

export function isCountryOrRegion(value: string) {
  const normalizedValue = normalizeDestination(value);
  return WORLD_COUNTRIES_AND_REGIONS.some(
    (country) => normalizeDestination(country) === normalizedValue,
  );
}
