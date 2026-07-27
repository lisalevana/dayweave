import {
  DayRecommendationBundleSchema,
  type DayRecommendationBundle,
  type RecommendationRequest,
  type RecommendedStopBrief,
  type ServiceEvidence,
} from "@/lib/schemas/evidence";
import {
  planGeographicDays,
  resolveContextualBranch,
  type ContextualBranchFamily,
  type ContextualBranchVariant,
  type GeographicStop,
} from "@/lib/dayweave/geographic-planner";

const CHECKED_DATE = "2026-07-24";
const WIKIVOYAGE_API = "https://en.wikivoyage.org/w/api.php";
const WIKIVOYAGE_LICENSE = "CC BY-SA 4.0";
const WIKIVOYAGE_USER_AGENT =
  "DayWeave/0.1 (travel recommendation prototype; https://github.com/lisalevana/dayweave)";

export type CuratedStop = {
  id: string;
  name: string;
  mapsArea?: string;
  curationOrder?: number;
  savedOnly?: boolean;
  localityKey?: string;
  localityLabel?: string;
  latitude?: number;
  longitude?: number;
  preferredDayOrder?: number;
  routeRank?: number;
  dayTitle?: string;
  dayRationale?: string;
  aliases: string[];
  whyPeopleCome: string;
  dontMiss: string;
  worthKnowing: string;
  evidence: ServiceEvidence[];
};

type CuratedBranchVariantDefinition = Omit<
  ContextualBranchVariant<CuratedStop>,
  "stop"
> & {
  stopId: string;
};

type CuratedBranchFamily = Omit<
  ContextualBranchFamily<CuratedStop>,
  "variants"
> & {
  curationOrder: number;
  variants: CuratedBranchVariantDefinition[];
};

type CuratedDestination = {
  destination: string;
  aliases: string[];
  headline: string;
  rationaleFocus: string;
  attribution: DayRecommendationBundle["attribution"];
  stops: CuratedStop[];
  branchFamilies?: CuratedBranchFamily[];
  minimumStops?: number;
};

export interface WikivoyageListing {
  name: string;
  altNames?: string[];
  description: string;
  latitude?: number;
  longitude?: number;
  section?: "see" | "do" | "eat";
}

export interface RecommendationSource {
  recommend(
    input: RecommendationRequest,
  ): Promise<DayRecommendationBundle | null>;
}

export type ResolvedDestinationPlace = {
  wishlistItem: string;
  stop: CuratedStop;
  score: number;
  reason: string;
};

export interface DestinationWishlistResolver {
  resolveWishlist(
    destination: string,
    wishlistItems: readonly string[],
  ): Promise<ResolvedDestinationPlace[]>;
}

export class RecommendationUnavailableError extends Error {
  readonly code = "RECOMMENDATIONS_UNAVAILABLE";

  constructor(
    message = "DayWeave could not find enough sourced recommendations for this destination yet.",
  ) {
    super(message);
    this.name = "RecommendationUnavailableError";
  }
}

const HONG_KONG: CuratedDestination = {
  destination: "Hong Kong",
  aliases: ["hong kong", "hongkong", "hk"],
  headline: "Hong Kong through temple smoke, harbour light and the view from the Peak",
  rationaleFocus:
    "the city’s living heritage with its defining harbour crossing and skyline view",
  attribution: {
    label: "Curated by DayWeave from Hong Kong Tourism Board guidance.",
    url: "https://www.discoverhongkong.com/eng/index.html",
    license: null,
  },
  stops: [
    {
      id: "man-mo-temple",
      name: "Man Mo Temple",
      localityKey: "hong-kong-core",
      localityLabel: "Hong Kong",
      latitude: 22.2847,
      longitude: 114.1501,
      routeRank: 1,
      aliases: ["man mo", "man mo temple", "文武廟"],
      whyPeopleCome:
        "One of Hong Kong’s oldest temples brings the city’s living worship, traditional craftsmanship and Sheung Wan history into one atmospheric stop.",
      dontMiss:
        "Look up beneath the hanging incense coils, then notice the Qing Dynasty bronze bell and carved details instead of treating the temple as only a photo backdrop.",
      worthKnowing:
        "This remains an active place of worship. Move quietly, give worshippers space and check current visitor guidance before going.",
      evidence: [
        {
          id: "hk-man-mo-hktb",
          claim:
            "Hong Kong Tourism Board describes Man Mo Temple as a declared monument built between 1847 and 1862, with preserved artefacts and traditional craftsmanship.",
          sourceName: "Hong Kong Tourism Board: Man Mo Temple",
          sourceUrl:
            "https://www.discoverhongkong.com/eng/place-to-go/travel.guide-man-mo-temple.html",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "star-ferry",
      name: "Star Ferry",
      localityKey: "hong-kong-core",
      localityLabel: "Hong Kong",
      latitude: 22.2878,
      longitude: 114.1618,
      routeRank: 2,
      aliases: ["star ferry", "victoria harbour ferry", "central ferry"],
      whyPeopleCome:
        "The short crossing turns Victoria Harbour into the experience, with Hong Kong Island and Kowloon unfolding from the water.",
      dontMiss:
        "Choose an open-air harbour-facing seat and watch the skyline change across the crossing, especially as the light softens toward evening.",
      worthKnowing:
        "Routes, pier access and service times can change. Check the current Star Ferry timetable before choosing the crossing that fits your day.",
      evidence: [
        {
          id: "hk-star-ferry-hktb",
          claim:
            "Hong Kong Tourism Board highlights the Star Ferry’s century of harbour crossings, skyline panoramas and open-air seating between Kowloon and Hong Kong Island.",
          sourceName: "Hong Kong Tourism Board: Star Ferry",
          sourceUrl:
            "https://www.discoverhongkong.com/seasia/explore/attractions/sailing-icon-hong-kong-s-star-ferry.html",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "victoria-peak",
      name: "Victoria Peak",
      localityKey: "hong-kong-core",
      localityLabel: "Hong Kong",
      latitude: 22.2759,
      longitude: 114.1455,
      routeRank: 3,
      aliases: ["victoria peak", "the peak", "peak circle walk"],
      whyPeopleCome:
        "The Peak gives the city’s defining perspective across Victoria Harbour, the Kowloon peninsula and the surrounding mountains.",
      dontMiss:
        "Make room for part of the Peak Circle Walk so the view changes as you move; do not stop at only one indoor viewing window.",
      worthKnowing:
        "Visibility and transport queues are weather-dependent. Check the forecast and current transport status before protecting a sunset window.",
      evidence: [
        {
          id: "hk-victoria-peak-hktb",
          claim:
            "Hong Kong Tourism Board identifies Victoria Peak and the Peak Circle Walk as a must-see destination for iconic harbour, Kowloon and mountain views.",
          sourceName: "Hong Kong Tourism Board: The Peak",
          sourceUrl:
            "https://www.discoverhongkong.com/eng/place-to-go/travel.guide-the-peak.html",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "bakehouse-the-peak",
      name: "Bakehouse · The Peak",
      mapsArea: "The Peak, Hong Kong",
      localityKey: "hong-kong-core",
      localityLabel: "Hong Kong",
      latitude: 22.2711,
      longitude: 114.1498,
      routeRank: 4,
      aliases: [
        "bakehouse the peak",
        "bakehouse peak",
        "peak tower bakehouse",
      ],
      whyPeopleCome:
        "This verified Bakehouse branch sits inside The Peak Tower, so the bakery wish becomes part of the Peak visit instead of a separate descent to Central.",
      dontMiss:
        "Use it as the food pause immediately before or after the Peak experience at the visitor hub; the route value is keeping both wishes in one ascent.",
      worthKnowing:
        "The official listing places it at G08, The Peak Tower. Current hours are 09:00–21:00 on weekdays and 08:00–21:00 on weekends and public holidays; check again before going.",
      evidence: [
        {
          id: "hk-bakehouse-the-peak-official",
          claim:
            "Bakehouse's official location directory lists a Bakery & Café at G08, The Peak Tower, with current opening hours.",
          sourceName: "Bakehouse: The Peak location",
          sourceUrl: "https://www.bakehouse.hk/locations",
          sourceType: "official_venue",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
        {
          id: "hk-peak-tower-hktb",
          claim:
            "Hong Kong Tourism Board places The Peak Tower above the Peak Tram Upper Terminus and describes it as part of the Peak visitor route.",
          sourceName: "Hong Kong Tourism Board: Peak Circle Walk",
          sourceUrl:
            "https://www.discoverhongkong.com/eng/place-to-go/travel.guide-peak-circle-walk.html",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "bakehouse-soho",
      name: "Bakehouse · Soho",
      mapsArea: "Soho, Hong Kong",
      localityKey: "hong-kong-core",
      localityLabel: "Hong Kong",
      latitude: 22.2821,
      longitude: 114.1528,
      routeRank: 2,
      aliases: [
        "bakehouse soho",
        "soho bakehouse",
        "bakehouse central",
      ],
      whyPeopleCome:
        "The Soho takeaway branch turns a general Bakehouse wish into a precise Central stop when the rest of the day already sits around Soho and Sheung Wan.",
      dontMiss:
        "Treat it as a short pickup within the Central–Soho thread rather than crossing districts only for the bakery.",
      worthKnowing:
        "The official directory lists this branch at G/F, 5 Staunton Street with daily 08:00–21:00 hours. Check the venue again before going.",
      evidence: [
        {
          id: "hk-bakehouse-soho-official",
          claim:
            "Bakehouse's official location directory lists its takeaway-only Soho branch at G/F, 5 Staunton Street and publishes its current daily hours.",
          sourceName: "Bakehouse: Soho location",
          sourceUrl: "https://www.bakehouse.hk/locations",
          sourceType: "official_venue",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
  ],
  branchFamilies: [
    {
      id: "bakehouse",
      intentLabel: "Bakehouse",
      aliases: ["bakehouse"],
      defaultVariantId: "soho",
      includeByDefault: false,
      curationOrder: 4,
      defaultReason:
        "With no stronger branch anchor, DayWeave keeps the central Soho branch and makes the assumption visible.",
      variants: [
        {
          id: "the-peak",
          stopId: "bakehouse-the-peak",
          explicitAliases: [
            "bakehouse the peak",
            "bakehouse peak",
            "peak tower bakehouse",
          ],
          contextAliases: [
            "victoria peak",
            "the peak",
            "peak",
            "peak circle walk",
            "peak tram",
          ],
          contextMatchKind: "same_complex",
          contextReason:
            "DayWeave matched Bakehouse to its verified branch inside The Peak Tower because Victoria Peak is also in your wishlist. Both stay in one Peak visit instead of creating another descent and ascent.",
        },
        {
          id: "soho",
          stopId: "bakehouse-soho",
          explicitAliases: [
            "bakehouse soho",
            "soho bakehouse",
            "bakehouse central",
          ],
          contextAliases: [
            "soho",
            "pmq",
            "man mo temple",
            "tai kwun",
            "mid levels escalator",
          ],
          contextMatchKind: "contextual_area",
          contextReason:
            "DayWeave matched Bakehouse to Soho because the saved Central and Soho stops form the stronger local thread.",
        },
      ],
    },
  ],
};

const SINGAPORE: CuratedDestination = {
  destination: "Singapore",
  aliases: ["singapore", "sg"],
  headline: "Singapore essentials, with the part worth noticing at every stop",
  rationaleFocus:
    "a sequence that moves from layered history to the skyline and the coast",
  attribution: {
    label:
      "Curated by DayWeave from Singapore Tourism Board, NParks and attributed Wikivoyage guidance.",
    url: "https://www.visitsingapore.com/",
    license: null,
  },
  stops: [
    {
      id: "fort-canning-park",
      name: "Fort Canning Park",
      aliases: ["fort canning", "fort canning park"],
      whyPeopleCome:
        "A green hill in the city where more than 700 years of Singapore history sit beside heritage trees and restored gardens.",
      dontMiss:
        "Step into the free Fort Canning Heritage Gallery, then notice the Spice Garden rather than treating the park as only a photo stop.",
      worthKnowing:
        "The park is open 24 hours. The official accessibility route is from the Cox Terrace roundabout drop-off.",
      evidence: [
        {
          id: "sg-fort-canning-nparks",
          claim:
            "NParks documents the hill's heritage gallery, nine historical gardens, diverse Spice Garden, visitor access and 24-hour opening.",
          sourceName: "NParks: Fort Canning Park",
          sourceUrl:
            "https://www.nparks.gov.sg/visit/parks/park-detail/fort-canning-park",
          sourceType: "official_venue",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "marina-bay-waterfront",
      name: "Marina Bay waterfront",
      aliases: [
        "marina bay",
        "marina bay waterfront",
        "marina bay sands",
        "merlion park",
      ],
      whyPeopleCome:
        "Singapore's modern skyline gathers the Merlion, ArtScience Museum, waterfront promenade and Gardens by the Bay into one recognisable district.",
      dontMiss:
        "Walk the waterfront sightline instead of seeing only one building: frame the Merlion against the bay, then let the skyline unfold toward the Supertrees.",
      worthKnowing:
        "Marina Bay is a district, not a single pin. Bayfront, Promenade, Esplanade and Marina Bay stations serve different sides, so choose the edge that fits the rest of the day.",
      evidence: [
        {
          id: "sg-marina-bay-stb",
          claim:
            "Singapore Tourism Board highlights the waterfront promenade, Merlion Park, ArtScience Museum and Gardens by the Bay as defining Marina Bay experiences.",
          sourceName: "Visit Singapore: Marina Bay",
          sourceUrl:
            "https://www.visitsingapore.com/neighbourhood/featured-neighbourhood/marina-bay/",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "east-coast-park",
      name: "East Coast Park",
      aliases: [
        "east coast",
        "east coast park",
        "east coast lagoon",
        "east coast lagoon food village",
      ],
      whyPeopleCome:
        "This is Singapore's long, local-feeling coastal playground for cycling, skating, sea views and an unhurried meal.",
      dontMiss:
        "Pair the waterfront path with East Coast Lagoon Food Village; the seaside hawker stop is the detail that turns a generic park visit into an East Coast experience.",
      worthKnowing:
        "The park stretches across several areas, so pick a specific meeting point. Check NParks notices before going because maintenance can affect individual lawns or facilities.",
      evidence: [
        {
          id: "sg-east-coast-nparks",
          claim:
            "NParks describes East Coast Park as a sea-facing destination for recreation, sport and dining and publishes current area notices.",
          sourceName: "NParks: East Coast Park",
          sourceUrl:
            "https://www.nparks.gov.sg/visit/parks/park-detail/east-coast-park",
          sourceType: "official_venue",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
        {
          id: "sg-east-coast-wikivoyage",
          claim:
            "Wikivoyage identifies East Coast Lagoon Food Village as a popular seaside food stop inside East Coast Park.",
          sourceName: "Wikivoyage: Singapore/East Coast",
          sourceUrl: "https://en.wikivoyage.org/wiki/Singapore/East_Coast",
          sourceType: "licensed_editorial",
          lastCheckedDate: CHECKED_DATE,
          license: WIKIVOYAGE_LICENSE,
        },
      ],
    },
  ],
};

const CHEUNG_CHAU: CuratedDestination = {
  destination: "Cheung Chau",
  aliases: ["cheung chau", "cheng chau"],
  headline: "Cheung Chau beyond the ferry: temple stories and the island snacks people seek out",
  rationaleFocus:
    "the island's heritage with the mango mochi and giant fish balls visitors often discover too late",
  attribution: {
    label: "Curated by DayWeave from Hong Kong Tourism Board guidance.",
    url: "https://www.discoverhongkong.com/eng/place-to-go/outdoors/cheung-chau.html",
    license: null,
  },
  stops: [
    {
      id: "pak-tai-temple-cheung-chau",
      name: "Pak Tai Temple",
      aliases: [
        "pak tai temple",
        "pak tai temple cheung chau",
        "yuk hui temple",
      ],
      whyPeopleCome:
        "The late-18th-century Taoist temple anchors Cheung Chau's living maritime heritage and the island's famous Bun Festival.",
      dontMiss:
        "Look beyond the forecourt for the historic artefacts and the temple's connection to the Bun Festival, rather than treating it as a quick façade photo.",
      worthKnowing:
        "This is an active place of worship. Visit quietly, dress respectfully and give ceremonies space.",
      evidence: [
        {
          id: "hk-cheung-chau-pak-tai",
          claim:
            "Hong Kong Tourism Board describes Pak Tai Temple as integral to the Cheung Chau Bun Festival and notes its valuable artefacts.",
          sourceName: "Hong Kong Tourism Board: Pak Tai Temple",
          sourceUrl:
            "https://www.discoverhongkong.com/eng/place-to-go/travel.guide-pak-tai-temple-at-cheung-chau.html",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "cheung-chau-mango-mochi",
      name: "Cheung Chau mango mochi",
      aliases: ["mango mochi", "mango glutinous rice", "mango dessert"],
      whyPeopleCome:
        "The oversized fresh-mango mochi is one of the island snacks that food lovers specifically cross the harbour to try.",
      dontMiss:
        "Choose one made around a substantial piece of fresh mango, where the fruit remains the centre of the bite rather than an afterthought.",
      worthKnowing:
        "Treat this as a roaming snack stop near the ferry-side lanes, not a guaranteed single shop. Vendors and availability can change.",
      evidence: [
        {
          id: "hk-cheung-chau-mango-mochi",
          claim:
            "Hong Kong Tourism Board names handmade mango mochi among the foods that draw visitors to Cheung Chau.",
          sourceName: "Hong Kong Tourism Board: Outlying islands by ferry",
          sourceUrl:
            "https://www.discoverhongkong.com/eng/neighbourhoods/outlying-islands/outlying-islands-to-catch-a-ferry-to-from-central.html",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "cheung-chau-giant-fish-ball",
      name: "Cheung Chau giant fish ball",
      aliases: [
        "giant fishball",
        "giant fish ball",
        "jumbo fishball",
        "jumbo fish ball",
        "fish balls",
        "fishball",
      ],
      whyPeopleCome:
        "Cheung Chau's giant fish balls are a playful, destination-specific version of a familiar Hong Kong street snack.",
      dontMiss:
        "Try the giant fish ball itself, not only a standard bowl of fish-ball noodles; the oversized street version is the island signature people remember.",
      worthKnowing:
        "Sauces and preparations vary by stall. Share one first if you also want room for seafood and mango mochi.",
      evidence: [
        {
          id: "hk-cheung-chau-giant-fish-ball",
          claim:
            "Hong Kong Tourism Board says food lovers flock to Cheung Chau for giant fish balls as well as handmade mango mochi.",
          sourceName: "Hong Kong Tourism Board: Outlying islands by ferry",
          sourceUrl:
            "https://www.discoverhongkong.com/eng/neighbourhoods/outlying-islands/outlying-islands-to-catch-a-ferry-to-from-central.html",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
  ],
};

const JOHOR_BAHRU: CuratedDestination = {
  destination: "Johor Bahru",
  aliases: ["johor bahru", "johor baru", "jb"],
  headline: "Johor Bahru with its royal-city character intact, plus the seafood finish worth planning for",
  rationaleFocus:
    "two pieces of Johor Bahru heritage and a sunset seafood meal where king crab is a stated house speciality",
  attribution: {
    label:
      "Curated by DayWeave from Tourism Johor and the official Senibong Bay Seafood venue.",
    url: "https://tourism.johor.gov.my/johor-bahru/",
    license: null,
  },
  stops: [
    {
      id: "sultan-abu-bakar-state-mosque",
      name: "Sultan Abu Bakar State Mosque",
      aliases: [
        "sultan abu bakar mosque",
        "sultan abu bakar state mosque",
        "masjid sultan abu bakar",
      ],
      whyPeopleCome:
        "The hilltop state mosque expresses Johor Bahru's royal-era identity through an unusual blend of Victorian and Moorish design.",
      dontMiss:
        "Notice the four minarets designed like British clock towers; that architectural mix is the detail that makes the mosque distinct.",
      worthKnowing:
        "It is an active mosque. Check visitor access around prayer times, dress modestly and follow on-site guidance.",
      evidence: [
        {
          id: "jb-sultan-abu-bakar-mosque",
          claim:
            "Tourism Johor describes the mosque's Victorian and Moorish mix and its four clock-tower-like minarets.",
          sourceName: "Tourism Johor: Johor Bahru",
          sourceUrl: "https://tourism.johor.gov.my/johor-bahru/",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "johor-bahru-old-chinese-temple",
      name: "Johor Bahru Old Chinese Temple",
      aliases: [
        "old chinese temple",
        "johor old chinese temple",
        "johor bahru old chinese temple",
      ],
      whyPeopleCome:
        "One of the city's oldest cultural landmarks, the temple embodies the shared history of Johor Bahru's Chinese dialect communities.",
      dontMiss:
        "Look for how the compact red-and-white temple survives amid the modern city centre; its scale and setting carry much of the story.",
      worthKnowing:
        "This is a living religious site. Keep the visit quiet and check locally before photographing worshippers or ritual activity.",
      evidence: [
        {
          id: "jb-old-chinese-temple-tourism-johor",
          claim:
            "Tourism Johor traces the Old Chinese Temple's history to Johor Bahru's Chinese community in the late 19th century.",
          sourceName: "Tourism Johor: Culture and Heritage",
          sourceUrl:
            "https://tourism.johor.gov.my/category/culture-heritage/",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "senibong-bay-seafood",
      name: "Senibong Bay Seafood",
      aliases: [
        "senibong",
        "senibong bay",
        "senibong bay seafood",
        "king crab",
        "alaska king crab",
        "alaskan king crab",
      ],
      whyPeopleCome:
        "A waterfront seafood dinner with sunset views and live music gives the day a distinctly Johor Bahru finish.",
      dontMiss:
        "Ask about the Alaska king crab: the venue lists it as a house speciality, so this is the point of the stop rather than an interchangeable seafood dinner.",
      worthKnowing:
        "The venue lists split lunch and dinner hours. Confirm crab availability and the current price or price-by-weight before ordering.",
      evidence: [
        {
          id: "jb-senibong-bay-king-crab",
          claim:
            "Senibong Bay Seafood's official site lists Alaska king crab as a speciality and publishes its waterfront setting and opening hours.",
          sourceName: "Senibong Bay Seafood official venue",
          sourceUrl: "https://www.senibongbayseafood.com/",
          sourceType: "official_venue",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
  ],
};

const SEOUL: CuratedDestination = {
  destination: "Seoul",
  aliases: ["seoul", "seoul korea", "seoul south korea"],
  headline:
    "Seoul with each saved place matched to the right city and the right day",
  rationaleFocus:
    "the strongest local moments without sending you back and forth between Seoul and Suwon",
  attribution: {
    label:
      "Curated by DayWeave from Korea Tourism Organization, Seoul Metropolitan Government and Samsung visitor guidance.",
    url: "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=226730",
    license: null,
  },
  stops: [
    {
      id: "starfield-library-coex",
      name: "Starfield Library at COEX",
      curationOrder: 1,
      localityKey: "seoul",
      localityLabel: "Seoul",
      latitude: 37.5101,
      longitude: 127.0602,
      preferredDayOrder: 2,
      routeRank: 2,
      aliases: [
        "starfield",
        "starfield library",
        "starfield coex",
        "coex",
        "coex mall",
        "byeolmadang library",
      ],
      whyPeopleCome:
        "This is the Seoul Starfield experience: a free, two-storey public library set inside COEX, with more than 50,000 books beneath monumental shelves.",
      dontMiss:
        "Stand in the middle of the Central Plaza and look up through the 13-metre bookshelves before exploring the quieter reading levels.",
      worthKnowing:
        "The official listing currently gives 10:30–22:00 hours and year-round opening. If you meant Starfield Suwon instead, treat it as a different stop and pair it with the Samsung detour.",
      evidence: [
        {
          id: "seoul-starfield-library-kto",
          claim:
            "Korea Tourism Organization places Starfield Library in COEX Central Plaza and documents its two floors, 13-metre shelves, 50,000-plus books, free admission and current visitor hours.",
          sourceName: "VISITKOREA: Starfield Library",
          sourceUrl:
            "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=60729",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "starfield-library-suwon",
      name: "Starfield Library · Suwon",
      mapsArea: "Suwon",
      curationOrder: 1,
      localityKey: "suwon",
      localityLabel: "Suwon",
      latitude: 37.287,
      longitude: 126.991,
      preferredDayOrder: 1,
      routeRank: 2,
      dayTitle: "Suwon day",
      dayRationale:
        "Your saved Suwon experiences stay in one city thread, avoiding a Seoul → Suwon → Seoul → Suwon pattern. Maps handles current travel times within Suwon.",
      aliases: [
        "starfield suwon",
        "suwon starfield",
        "suwon starfield library",
        "starfield library suwon",
      ],
      whyPeopleCome:
        "The Suwon Starfield Library is a free, multi-level cultural space and the correct branch when the same wishlist also points to Samsung Digital City.",
      dontMiss:
        "Explore the open library across floors 4–7 instead of treating Starfield as only a shopping stop; the layered sightlines are the point of this branch.",
      worthKnowing:
        "The official venue lists 10:00–22:00 hours and places Starfield Suwon near Hwaseo Station. It belongs on the Suwon day, not between two Seoul stops.",
      evidence: [
        {
          id: "suwon-starfield-library-official",
          claim:
            "Starfield Suwon's official library page describes a free, multi-level space open to everyone and publishes current 10:00–22:00 hours.",
          sourceName: "Starfield Suwon: Starfield Library",
          sourceUrl:
            "https://www.starfield.co.kr/suwon/starfieldLibrary/library.do",
          sourceType: "official_venue",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
        {
          id: "suwon-starfield-directions-official",
          claim:
            "Starfield Suwon's official directions place the venue at 175 Suseong-ro in Suwon and about 470 metres from Hwaseo Station.",
          sourceName: "Starfield Suwon: Directions",
          sourceUrl:
            "https://www.starfield.co.kr/suwon/about/directions.do?type=metro",
          sourceType: "official_venue",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "jamsil-hangang-ramyeon",
      name: "Jamsil Hangang Park ramyeon picnic",
      curationOrder: 2,
      localityKey: "seoul",
      localityLabel: "Seoul",
      latitude: 37.518,
      longitude: 127.087,
      preferredDayOrder: 2,
      routeRank: 3,
      dayTitle: "Seoul day",
      dayRationale:
        "The Hangang experience stays in Seoul instead of sitting between two Suwon stops. That removes the cross-city backtracking pattern.",
      aliases: [
        "hangang",
        "hangang river",
        "han river",
        "jamsil hangang",
        "jamsil hangang park",
        "eat ramyeon",
        "hangang ramyeon",
        "ramyeon",
        "ramen",
      ],
      whyPeopleCome:
        "Hangang is where Seoul turns its river into everyday leisure. Jamsil gives your broad river note a real pin and keeps the ramyeon ritual inside the experience.",
      dontMiss:
        "Buy packet ramyeon at a park convenience store, use the self-service cooking machine and eat it facing the river; “eat ramyeon” belongs to this stop, not a separate errand.",
      worthKnowing:
        "Hangang has 11 separate parks, so navigate to Jamsil Hangang Park rather than the river name alone. Convenience-store stock and riverside conditions can change, so check on arrival.",
      evidence: [
        {
          id: "seoul-hangang-ramyeon-kto",
          claim:
            "Korea Tourism Organization identifies instant ramyeon cooked in a special machine as a Hangang Park must-eat and describes the river's 11 parks as picnic destinations.",
          sourceName: "VISITKOREA: Enjoy the Hangang River",
          sourceUrl:
            "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=226730",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
        {
          id: "seoul-jamsil-hangang-city",
          claim:
            "Seoul Metropolitan Government lists Jamsil on the Hangang route and documents convenience-store ramyeon displays and instant cookers among the pier amenities.",
          sourceName: "Seoul Metropolitan Government: Hangang amenities",
          sourceUrl:
            "https://english.seoul.go.kr/eco-friendly-hangang-bus-ferry-service-unfolds-a-new-chapter-of-the-hangang-river/",
          sourceType: "official_venue",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "gyeongbokgung-palace",
      name: "Gyeongbokgung Palace",
      curationOrder: 3,
      localityKey: "seoul",
      localityLabel: "Seoul",
      latitude: 37.5796,
      longitude: 126.977,
      preferredDayOrder: 2,
      routeRank: 1,
      aliases: [
        "gyeongbokgung",
        "gyeongbokgung palace",
        "gwanghwamun palace",
      ],
      whyPeopleCome:
        "Seoul’s principal Joseon palace brings royal architecture, courtyards and the city’s historic axis into one defining cultural stop.",
      dontMiss:
        "Go beyond the main gate to Gyeonghoeru Pavilion and Hyangwonjeong; those interiors and water views keep the visit from becoming only a Gwanghwamun photo.",
      worthKnowing:
        "Hours change by season and the palace is normally closed on Tuesdays. Check the official listing before choosing the day.",
      evidence: [
        {
          id: "seoul-gyeongbokgung-kto",
          claim:
            "Korea Tourism Organization documents Gyeongbokgung's Joseon history, Gyeonghoeru and Hyangwonjeong, seasonal hours and Tuesday closure.",
          sourceName: "VISITKOREA: Gyeongbokgung Palace",
          sourceUrl:
            "https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=87740",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "samsung-innovation-museum-suwon",
      name: "Samsung Innovation Museum · Suwon",
      mapsArea: "Suwon",
      curationOrder: 4,
      savedOnly: true,
      localityKey: "suwon",
      localityLabel: "Suwon",
      latitude: 37.258,
      longitude: 127.054,
      preferredDayOrder: 1,
      routeRank: 1,
      dayTitle: "Suwon day",
      dayRationale:
        "Samsung’s limited visitor window anchors the Suwon thread. Starfield Suwon stays in the same city so you do not travel Seoul → Suwon → Seoul → Suwon.",
      aliases: [
        "samsung digital city",
        "digital city",
        "samsung suwon",
        "samsung innovation museum",
        "sim",
      ],
      whyPeopleCome:
        "DayWeave resolves your broad Samsung Digital City note to its visitor-facing museum, where the history of the electronics industry and the meaning of innovation become the actual experience.",
      dontMiss:
        "Follow the permanent exhibition’s electronics story instead of treating Samsung Digital City as a general walk-in campus attraction.",
      worthKnowing:
        "Outside Seoul · Suwon. Weekday visits currently require advance reservation; Saturdays allow entry without a reservation, and admission is free. Check the official guidance again before travelling.",
      evidence: [
        {
          id: "suwon-samsung-innovation-museum",
          claim:
            "Samsung's official museum guide places the venue at Samsung Electronics in Suwon and publishes its exhibitions, free admission, weekday reservation requirement and Saturday access.",
          sourceName: "Samsung Innovation Museum: Visit us",
          sourceUrl:
            "https://www.samsunginnovationmuseum.com/en/statics/intro/infoList.do",
          sourceType: "official_venue",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
    {
      id: "mong-ted-lovely-runner-suwon",
      name: "Mong Ted · Lovely Runner filming location",
      mapsArea: "Suwon",
      curationOrder: 5,
      savedOnly: true,
      localityKey: "suwon",
      localityLabel: "Suwon",
      latitude: 37.2847761,
      longitude: 127.0136201,
      preferredDayOrder: 1,
      routeRank: 2,
      dayTitle: "Suwon day",
      dayRationale:
        "The Lovely Runner location belongs with the other saved Suwon places, keeping the filming-location visit out of the Seoul day and avoiding another cross-city return.",
      aliases: [
        "lovely runner filming location",
        "lovely runner filming locations",
        "lovely runner location",
        "lovely runner locations",
        "lovely runner cafe",
        "lovely runner house",
        "sol house",
        "sols house",
        "im sol house",
        "im sols house",
        "mong ted",
        "mongted",
      ],
      whyPeopleCome:
        "Mong Ted is the Suwon café used as Sol’s house in Lovely Runner, turning a broad filming-location wish into a specific, visitor-facing stop.",
      dontMiss:
        "Notice the familiar alley from Mong Ted and try its signature salt bread. The blue-gate house opposite represented Sun-jae’s home, but it is a private family residence and should only be viewed respectfully from outside.",
      worthKnowing:
        "Outside Seoul · Suwon. VISITKOREA lists Mong Ted at 14 Hwaseomun-ro 48beon-gil. Confirm current café hours before going, and do not enter or disturb the private blue-gate residence across the alley.",
      evidence: [
        {
          id: "suwon-lovely-runner-mong-ted-route",
          claim:
            "Korea Tourism Organization identifies Mong Ted in Suwon as Sol’s house in Lovely Runner and describes the opposite blue-gate house as Sun-jae’s home in the drama and a private family residence that visitors cannot enter.",
          sourceName:
            "VISITKOREA: A Time-Slip Journey in Suwon",
          sourceUrl:
            "https://english.visitkorea.or.kr/svc/sp/HallyuNew/contentsView.do?dataSetId=70&vcontsId=216625",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
        {
          id: "suwon-lovely-runner-mong-ted-venue",
          claim:
            "Korea Tourism Organization's venue listing confirms Mong Ted's role as Sol’s house, its Suwon address and current visitor information; the private residence opposite should be respected.",
          sourceName: "VISITKOREA: Mong Ted",
          sourceUrl:
            "https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=215908",
          sourceType: "official_tourism",
          lastCheckedDate: CHECKED_DATE,
          license: null,
        },
      ],
    },
  ],
  branchFamilies: [
    {
      id: "starfield",
      intentLabel: "Starfield",
      aliases: [
        "starfield",
        "starfield library",
        "byeolmadang library",
      ],
      defaultVariantId: "coex",
      includeByDefault: true,
      curationOrder: 1,
      defaultReason:
        "With no stronger branch clue, DayWeave defaults to COEX because it is inside the selected destination, Seoul.",
      variants: [
        {
          id: "coex",
          stopId: "starfield-library-coex",
          explicitAliases: [
            "starfield coex",
            "coex starfield",
            "coex library",
            "gangnam starfield",
          ],
          contextAliases: ["coex", "gangnam", "bongeunsa"],
          contextMatchKind: "contextual_area",
          contextReason:
            "DayWeave matched Starfield to COEX because the other saved places point to the Gangnam and COEX area.",
        },
        {
          id: "suwon",
          stopId: "starfield-library-suwon",
          explicitAliases: [
            "starfield suwon",
            "suwon starfield",
            "suwon starfield library",
            "starfield library suwon",
          ],
          contextAliases: [
            "samsung digital city",
            "samsung innovation museum",
            "samsung suwon",
            "suwon",
          ],
          contextMatchKind: "contextual_area",
          contextReason:
            "DayWeave interpreted “Starfield” as Starfield Suwon because Samsung Digital City is also in your wishlist. Both now stay in the same Suwon day.",
        },
      ],
    },
  ],
  minimumStops: 3,
};

const CURATED_DESTINATIONS = [
  HONG_KONG,
  SINGAPORE,
  CHEUNG_CHAU,
  JOHOR_BAHRU,
  SEOUL,
];

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/&(?:amp;)?/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stableSlug(value: string): string {
  return (
    normalize(value)
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "place"
  );
}

function textContainsAlias(text: string, aliases: string[]): boolean {
  const haystack = ` ${normalize(text)} `;
  return aliases.some((alias) => {
    const needle = normalize(alias);
    return needle.length > 1 && haystack.includes(` ${needle} `);
  });
}

function stopWasSaved(
  stop: Pick<CuratedStop, "id" | "name" | "aliases">,
  input: RecommendationRequest,
): boolean {
  const aliases = [stop.id, stop.name, ...stop.aliases];
  if (textContainsAlias(input.rawWishlist, aliases)) return true;

  return (input.savedPlaces ?? []).some(
    (place) =>
      textContainsAlias(place.id, aliases) ||
      textContainsAlias(place.name, aliases) ||
      textContainsAlias(aliases.join(" "), [place.id, place.name]),
  );
}

function rationaleFor(
  savedCount: number,
  totalCount: number,
  focus: string,
): string {
  const addedCount = totalCount - savedCount;
  if (savedCount === totalCount) {
    return `DayWeave turns what you saved into ${totalCount} sourced experiences. It adds the local point of each stop and orders them as ${focus}.`;
  }
  if (savedCount === 0) {
    return `Your notes did not name a matching stop yet, so DayWeave proposes ${totalCount} sourced essentials: ${focus}.`;
  }
  return `DayWeave keeps ${savedCount} ${savedCount === 1 ? "place" : "places"} from your notes and adds ${addedCount} sourced ${addedCount === 1 ? "essential" : "essentials"} to create ${focus}.`;
}

type ResolvedCuratedCandidate = {
  stop: CuratedStop;
  curationOrder: number;
  saved: boolean;
  branchIntentAliases?: string[];
};

function fullWishlistText(input: RecommendationRequest): string {
  return [
    input.rawWishlist,
    ...(input.savedPlaces ?? []).flatMap((place) => [
      place.id,
      place.name,
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

type WishlistInputItem = {
  label: string;
  searchableText: string;
};

function wishlistInputItems(
  input: RecommendationRequest,
): WishlistInputItem[] {
  const items = new Map<string, WishlistInputItem>();

  const addItem = (label: string, searchableText = label) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;
    const key = normalize(trimmedLabel);
    const existing = items.get(key);
    if (existing) {
      existing.searchableText = [
        existing.searchableText,
        searchableText,
      ].join("\n");
      return;
    }
    items.set(key, {
      label: trimmedLabel,
      searchableText,
    });
  };

  input.rawWishlist.split(/\r?\n/).forEach((line) => addItem(line));
  (input.savedPlaces ?? []).forEach((place) =>
    addItem(place.name, `${place.id}\n${place.name}`),
  );

  return [...items.values()];
}

function unresolvedWishlistItems(
  input: RecommendationRequest,
  selectedCandidates: Array<
    Pick<ResolvedCuratedCandidate, "stop" | "branchIntentAliases">
  >,
): string[] {
  return wishlistInputItems(input)
    .filter(
      (item) =>
        !selectedCandidates.some((candidate) => {
          const stopAliases = [
            candidate.stop.id,
            candidate.stop.name,
            ...candidate.stop.aliases,
          ];
          return (
            textContainsAlias(item.searchableText, stopAliases) ||
            textContainsAlias(
              item.searchableText,
              candidate.branchIntentAliases ?? [],
            )
          );
        }),
    )
    .map((item) => item.label);
}

function resolveCuratedCandidates(
  destination: CuratedDestination,
  input: RecommendationRequest,
) {
  const stopById = new Map(
    destination.stops.map((stop) => [stop.id, stop]),
  );
  const branchStopIds = new Set(
    (destination.branchFamilies ?? []).flatMap((family) =>
      family.variants.map((variant) => variant.stopId),
    ),
  );
  const regularCandidates: ResolvedCuratedCandidate[] = destination.stops
    .filter((stop) => !branchStopIds.has(stop.id))
    .map((stop, index) => ({
      stop,
      curationOrder: stop.curationOrder ?? index + 1,
      saved: stopWasSaved(stop, input),
    }));
  const branchResolutions: DayRecommendationBundle["branchResolutions"] = [];
  const wishlistText = fullWishlistText(input);
  const branchCandidates = (destination.branchFamilies ?? []).flatMap(
    (family): ResolvedCuratedCandidate[] => {
      const variants = family.variants.flatMap(
        (variant): ContextualBranchVariant<CuratedStop>[] => {
          const stop = stopById.get(variant.stopId);
          return stop ? [{ ...variant, stop }] : [];
        },
      );
      const resolved = resolveContextualBranch(
        { ...family, variants },
        wishlistText,
      );
      if (!resolved) return [];
      if (resolved.resolution) {
        branchResolutions.push(resolved.resolution);
      }
      return [
        {
          stop: resolved.stop,
          curationOrder: family.curationOrder,
          saved: resolved.intentMatched,
          branchIntentAliases: [
            ...family.aliases,
            ...variants
              .filter((variant) => variant.stop.id === resolved.stop.id)
              .flatMap((variant) => variant.explicitAliases),
          ],
        },
      ];
    },
  );
  const candidates = [...regularCandidates, ...branchCandidates].sort(
    (left, right) =>
      left.curationOrder - right.curationOrder ||
      left.stop.id.localeCompare(right.stop.id),
  );
  const minimumStops = destination.minimumStops ?? 3;
  const selectedById = new Map<string, ResolvedCuratedCandidate>();

  candidates
    .filter((candidate) => candidate.saved)
    .forEach((candidate) => selectedById.set(candidate.stop.id, candidate));
  for (const candidate of candidates) {
    if (selectedById.size >= minimumStops) break;
    if (candidate.stop.savedOnly) continue;
    selectedById.set(candidate.stop.id, candidate);
  }

  const selected = [...selectedById.values()].sort(
    (left, right) =>
      left.curationOrder - right.curationOrder ||
      left.stop.id.localeCompare(right.stop.id),
  );

  return {
    selected,
    branchResolutions: branchResolutions.filter((resolution) =>
      selectedById.has(resolution.selectedPlaceId),
    ),
  };
}

function approximateDistanceKm(
  left: Pick<CuratedStop, "latitude" | "longitude">,
  right: Pick<CuratedStop, "latitude" | "longitude">,
): number {
  if (
    left.latitude === undefined ||
    left.longitude === undefined ||
    right.latitude === undefined ||
    right.longitude === undefined
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const latitudeKm = (right.latitude - left.latitude) * 111.32;
  const meanLatitudeRadians =
    ((left.latitude + right.latitude) / 2) * (Math.PI / 180);
  const longitudeKm =
    (right.longitude - left.longitude) *
    111.32 *
    Math.cos(meanLatitudeRadians);
  return Math.hypot(latitudeKm, longitudeKm);
}

function alignSupplementalLocality(
  stop: CuratedStop,
  existingCandidates: Iterable<ResolvedCuratedCandidate>,
): CuratedStop {
  const nearest = [...existingCandidates]
    .filter(
      (candidate) =>
        candidate.stop.localityKey &&
        candidate.stop.localityLabel &&
        Number.isFinite(
          approximateDistanceKm(stop, candidate.stop),
        ),
    )
    .map((candidate) => ({
      candidate,
      distanceKm: approximateDistanceKm(stop, candidate.stop),
    }))
    .sort(
      (left, right) =>
        left.distanceKm - right.distanceKm ||
        left.candidate.stop.id.localeCompare(right.candidate.stop.id),
    )[0];

  if (!nearest || nearest.distanceKm > 12) return stop;
  return {
    ...stop,
    localityKey: nearest.candidate.stop.localityKey,
    localityLabel: nearest.candidate.stop.localityLabel,
  };
}

async function buildBundle(
  destination: CuratedDestination,
  input: RecommendationRequest,
  supplementalResolver?: DestinationWishlistResolver,
): Promise<DayRecommendationBundle> {
  const curatedResolution = resolveCuratedCandidates(
    destination,
    input,
  );
  const selected = [...curatedResolution.selected];
  const branchResolutions = [...curatedResolution.branchResolutions];
  const unresolvedBeforeSupplement = unresolvedWishlistItems(
    input,
    selected,
  );

  if (
    supplementalResolver &&
    unresolvedBeforeSupplement.length > 0 &&
    selected.length < 12
  ) {
    try {
      const supplemental = await supplementalResolver.resolveWishlist(
        destination.destination,
        unresolvedBeforeSupplement,
      );
      const selectedById = new Map(
        selected.map((candidate) => [candidate.stop.id, candidate]),
      );
      const selectedByName = new Map(
        selected.map((candidate) => [
          normalize(candidate.stop.name),
          candidate,
        ]),
      );
      const destinationStopByName = new Map<
        string,
        ResolvedCuratedCandidate
      >(
        destination.stops.map((stop, index) => [
          normalize(stop.name),
          {
            stop,
            curationOrder: stop.curationOrder ?? index + 1,
            saved: true,
          },
        ]),
      );

      supplemental.forEach((resolution, index) => {
        if (selectedById.size >= 12) return;
        const alignedStop = alignSupplementalLocality(
          resolution.stop,
          selectedById.values(),
        );
        const matchingSelected =
          selectedById.get(alignedStop.id) ??
          selectedByName.get(normalize(alignedStop.name));
        const matchingDestination = destinationStopByName.get(
          normalize(alignedStop.name),
        );
        const candidate: ResolvedCuratedCandidate =
          matchingSelected ??
          matchingDestination ?? {
            stop: alignedStop,
            curationOrder: 1_000 + index,
            saved: true,
            branchIntentAliases: [resolution.wishlistItem],
          };
        candidate.saved = true;
        candidate.branchIntentAliases = [
          ...(candidate.branchIntentAliases ?? []),
          resolution.wishlistItem,
        ];
        selectedById.set(candidate.stop.id, candidate);
        selectedByName.set(normalize(candidate.stop.name), candidate);
        branchResolutions.push({
          intent: resolution.wishlistItem,
          selectedPlaceId: candidate.stop.id,
          selectedPlaceName: candidate.stop.name,
          matchKind: "contextual_area",
          reason: `DayWeave matched “${resolution.wishlistItem}” to ${candidate.stop.name} because ${resolution.reason}.`,
          alternative: null,
        });
      });

      selected.splice(
        0,
        selected.length,
        ...[...selectedById.values()].sort(
          (left, right) =>
            left.curationOrder - right.curationOrder ||
            left.stop.id.localeCompare(right.stop.id),
        ),
      );
    } catch {
      // Curated recommendations remain useful offline. A source outage must
      // leave unmatched lines visible rather than fail the whole destination.
    }
  }

  const candidateById = new Map(
    selected.map((candidate) => [candidate.stop.id, candidate]),
  );
  const routePlan = planGeographicDays(
    selected.map(
      ({ stop }): GeographicStop => ({
        id: stop.id,
        localityKey: stop.localityKey ?? normalize(destination.destination),
        localityLabel: stop.localityLabel ?? destination.destination,
        ...(stop.latitude === undefined
          ? {}
          : { latitude: stop.latitude }),
        ...(stop.longitude === undefined
          ? {}
          : { longitude: stop.longitude }),
        ...(stop.preferredDayOrder === undefined
          ? {}
          : { preferredDayOrder: stop.preferredDayOrder }),
        ...(stop.routeRank === undefined
          ? {}
          : { routeRank: stop.routeRank }),
        ...(stop.dayTitle ? { dayTitle: stop.dayTitle } : {}),
        ...(stop.dayRationale
          ? { dayRationale: stop.dayRationale }
          : {}),
      }),
    ),
  );
  const orderedBriefs: RecommendedStopBrief[] = routePlan.days
    .flatMap((day) => day.stopIds)
    .map((stopId, index) => {
      const candidate = candidateById.get(stopId);
      if (!candidate) {
        throw new RecommendationUnavailableError(
          "DayWeave could not keep every sourced stop in its geographic route.",
        );
      }
      const { stop, saved } = candidate;
      const origin = saved ? "saved" : "service_added";
      return {
        order: index + 1,
        placeId: stop.id,
        placeName: stop.name,
        ...(stop.mapsArea ? { mapsArea: stop.mapsArea } : {}),
        origin,
        whyPeopleCome: stop.whyPeopleCome,
        dontMiss: stop.dontMiss,
        worthKnowing: stop.worthKnowing,
        evidence: stop.evidence,
      };
    });
  const savedPlaceIds = orderedBriefs
    .filter((brief) => brief.origin === "saved")
    .map((brief) => brief.placeId);
  const serviceAddedPlaceIds = orderedBriefs
    .filter((brief) => brief.origin === "service_added")
    .map((brief) => brief.placeId);
  const unresolvedItems = unresolvedWishlistItems(input, selected);

  return DayRecommendationBundleSchema.parse({
    schemaVersion: "1.0",
    destination: destination.destination,
    mode: "curated_local",
    headline: destination.headline,
    rationale: rationaleFor(
      savedPlaceIds.length,
      orderedBriefs.length,
      destination.rationaleFocus,
    ),
    savedPlaceIds,
    serviceAddedPlaceIds,
    orderedBriefs,
    unresolvedWishlistItems: unresolvedItems,
    branchResolutions,
    routePlan,
    attribution: destination.attribution,
  });
}

export class CuratedDestinationRecommendationAdapter
  implements RecommendationSource
{
  constructor(
    private readonly supplementalResolver?: DestinationWishlistResolver,
  ) {}

  async recommend(
    input: RecommendationRequest,
  ): Promise<DayRecommendationBundle | null> {
    const requestedDestination = normalize(input.destination);
    const destination = CURATED_DESTINATIONS.find((candidate) =>
      candidate.aliases.some(
        (alias) => normalize(alias) === requestedDestination,
      ),
    );

    return destination
      ? buildBundle(destination, input, this.supplementalResolver)
      : null;
  }
}

function decodeHtml(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lsquo: "‘",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    rdquo: "”",
    rsquo: "’",
    lt: "<",
  };

  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, key: string) => {
      if (key.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
      }
      if (key.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
      }
      return namedEntities[key.toLocaleLowerCase("en")] ?? entity;
    },
  );
}

function plainText(html: string): string {
  return decodeHtml(
    html
      .replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/gi, " ")
      .replace(/<sup\b[\s\S]*?<\/sup>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\[[^\]]*edit[^\]]*\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function conciseDescription(value: string): string {
  if (value.length <= 420) return value;
  const shortened = value.slice(0, 420);
  const sentenceEnd = Math.max(
    shortened.lastIndexOf(". "),
    shortened.lastIndexOf("! "),
    shortened.lastIndexOf("? "),
  );
  return `${shortened.slice(0, sentenceEnd > 160 ? sentenceEnd + 1 : 417).trim()}…`;
}

/**
 * Extracts Wikivoyage's semantic listing markup without requiring a browser DOM.
 * The parser operates on an HTML string returned by MediaWiki's parse API.
 */
export function parseWikivoyageListings(
  html: string,
  limit = 12,
): WikivoyageListing[] {
  const listings: WikivoyageListing[] = [];
  const seen = new Set<string>();
  const namePattern =
    /<([a-z][\w:-]*)\b[^>]*class=(["'])[^"']*\blisting-name\b[^"']*\2[^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = [...html.matchAll(namePattern)];

  matches.forEach((match, index) => {
    if (listings.length >= limit) return;
    const name = plainText(match[3]);
    const key = normalize(name);
    if (!name || !key || seen.has(key)) return;

    const listingStart = html.lastIndexOf("<li", match.index ?? 0);
    const listingEnd = html.indexOf("</li>", (match.index ?? 0) + match[0].length);
    const listingMarkup =
      listingStart >= 0 && listingEnd >= 0
        ? html.slice(listingStart, listingEnd + 5)
        : "";
    const segmentStart = (match.index ?? 0) + match[0].length;
    const segmentEnd =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? html.length)
        : Math.min(html.length, segmentStart + 5_000);
    const segment = html.slice(segmentStart, segmentEnd);
    const descriptionMatch =
      /<([a-z][\w:-]*)\b[^>]*class=(["'])[^"']*\b(?:listing-description|listing-content)\b[^"']*\2[^>]*>([\s\S]*?)<\/\1>/i.exec(
        segment,
      );
    let description = plainText(descriptionMatch?.[3] ?? "");

    if (!description) {
      const enclosingEnd = html.indexOf("</li>", segmentStart);
      const fallback =
        enclosingEnd >= 0 && enclosingEnd < segmentEnd
          ? plainText(html.slice(segmentStart, enclosingEnd))
          : "";
      description = fallback;
    }

    description = conciseDescription(
      description ||
        `${name} is included in Wikivoyage's visitor listings for this destination.`,
    );
    const latitudeText =
      /class=(["'])[^"']*\blatitude\b[^"']*\1[^>]*>([^<]+)</i.exec(
        listingMarkup,
      )?.[2] ??
      /\bdata-lat=(["'])([^"']+)\1/i.exec(listingMarkup)?.[2];
    const longitudeText =
      /class=(["'])[^"']*\blongitude\b[^"']*\1[^>]*>([^<]+)</i.exec(
        listingMarkup,
      )?.[2] ??
      /\bdata-lon=(["'])([^"']+)\1/i.exec(listingMarkup)?.[2];
    const latitude = Number.parseFloat(plainText(latitudeText ?? ""));
    const longitude = Number.parseFloat(plainText(longitudeText ?? ""));
    const altNames = [
      ...listingMarkup.matchAll(
        /<([a-z][\w:-]*)\b[^>]*class=(["'])[^"']*\blisting-alt\b[^"']*\2[^>]*>([\s\S]*?)<\/\1>/gi,
      ),
    ]
      .map((altMatch) => plainText(altMatch[3]))
      .filter(Boolean);
    const hasCoordinates =
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180;
    seen.add(key);
    listings.push({
      name,
      ...(altNames.length > 0 ? { altNames } : {}),
      description,
      ...(hasCoordinates ? { latitude, longitude } : {}),
    });
  });

  return listings;
}

/**
 * Destination pages also contain transport, accommodation and administrative
 * listings. Only traveller-facing See, Do and Eat sections may become a
 * DayWeave recommendation.
 */
export function parseWikivoyageTravelListings(
  html: string,
  limit = 12,
): WikivoyageListing[] {
  const headingPattern =
    /<div\b[^>]*class=(["'])[^"']*\bmw-heading2\b[^"']*\1[^>]*>\s*<h2\b[^>]*id=(["'])([^"']+)\2/gi;
  const headings = [...html.matchAll(headingPattern)];
  const preferredSections = ["see", "do", "eat"] as const;
  const listings: WikivoyageListing[] = [];
  const seen = new Set<string>();

  for (const preferred of preferredSections) {
    for (const [index, heading] of headings.entries()) {
      const sectionId = normalize(decodeHtml(heading[3]).replace(/_/g, " "));
      if (
        sectionId !== preferred &&
        !sectionId.startsWith(`${preferred} `)
      ) {
        continue;
      }
      const start = heading.index ?? 0;
      const end = headings[index + 1]?.index ?? html.length;
      for (const listing of parseWikivoyageListings(
        html.slice(start, end),
        limit,
      )) {
        const key = normalize(listing.name);
        if (seen.has(key)) continue;
        seen.add(key);
        listings.push({
          ...listing,
          section: preferred,
        });
        if (listings.length >= limit) return listings;
      }
    }
  }

  return listings;
}

function splitRecommendationCopy(description: string): {
  whyPeopleCome: string;
  dontMiss: string;
} {
  const sentences =
    description
      .match(/[^.!?]+(?:[.!?]+|$)/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];
  const whyPeopleCome = sentences[0] ?? description;
  const dontMiss =
    sentences.find(
      (sentence, index) =>
        index > 0 &&
        /\b(?:look|notice|view|oldest|largest|only|famous|known|highlight|signature|collection|garden|market|temple|museum)\b/i.test(
          sentence,
        ),
    ) ??
    sentences[1] ??
    whyPeopleCome;
  return { whyPeopleCome, dontMiss };
}

type WikivoyageCatalogListing = WikivoyageListing & {
  sourceTitle: string;
  sourceUrl: string;
  sourceOrder: number;
  localityKey: string;
  localityLabel: string;
};

type WikivoyageCatalog = {
  destination: string;
  articleTitle: string;
  articleUrl: string;
  listings: WikivoyageCatalogListing[];
};

type WishlistCatalogMatch = {
  item: WishlistInputItem;
  listing: WikivoyageCatalogListing;
  score: number;
  reason: string;
};

type WishlistCatalogResolution = {
  matches: WishlistCatalogMatch[];
  unresolvedItems: WishlistInputItem[];
  ambiguousListingKeys: Set<string>;
};

const WISHLIST_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "eat",
  "for",
  "go",
  "i",
  "in",
  "location",
  "of",
  "on",
  "or",
  "place",
  "ride",
  "see",
  "spot",
  "the",
  "to",
  "try",
  "visit",
  "want",
  "we",
]);

function words(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

function meaningfulWishlistWords(
  value: string,
  destination: string,
): string[] {
  const destinationWords = new Set(words(destination));
  const filtered = words(value).filter(
    (word) =>
      !destinationWords.has(word) && !WISHLIST_STOP_WORDS.has(word),
  );
  return filtered.length > 0 ? filtered : words(value);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  let previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current.push(
        Math.min(
          current[rightIndex] + 1,
          previous[rightIndex + 1] + 1,
          previous[rightIndex] +
            (left[leftIndex] === right[rightIndex] ? 0 : 1),
        ),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function tokenSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (Math.min(left.length, right.length) < 5) return 0;
  return (
    1 -
    levenshteinDistance(left, right) /
      Math.max(left.length, right.length)
  );
}

function listingKey(listing: WikivoyageCatalogListing): string {
  const place = normalize(listing.name);
  if (
    listing.latitude !== undefined &&
    listing.longitude !== undefined
  ) {
    return [
      place,
      listing.latitude.toFixed(5),
      listing.longitude.toFixed(5),
    ].join(":");
  }
  return `${place}:${normalize(listing.sourceTitle)}`;
}

function scoreWishlistListing(
  item: WishlistInputItem,
  destination: string,
  listing: WikivoyageCatalogListing,
): { score: number; reason: string } {
  const queryWords = meaningfulWishlistWords(
    item.searchableText,
    destination,
  );
  if (queryWords.length === 0) {
    return { score: 0, reason: "" };
  }

  const queryPhrase = queryWords.join(" ");
  const nameVariants = [listing.name, ...(listing.altNames ?? [])]
    .map(normalize)
    .filter(Boolean);
  const description = normalize(listing.description);
  const sourceTitle = normalize(listing.sourceTitle);
  const combined = `${nameVariants.join(" ")} ${description} ${sourceTitle}`;
  const nameWords = words(nameVariants.join(" "));
  const combinedWords = words(combined);

  if (nameVariants.includes(queryPhrase)) {
    return {
      score: 1,
      reason: "the sourced place name is an exact match",
    };
  }
  if (
    nameVariants.some(
      (variant) =>
        variant.includes(` ${queryPhrase} `) ||
        variant.startsWith(`${queryPhrase} `) ||
        variant.endsWith(` ${queryPhrase}`) ||
        queryPhrase.includes(variant),
    )
  ) {
    return {
      score: 0.97,
      reason: "the sourced place name contains the same distinctive wording",
    };
  }

  const phraseInName = nameVariants.some((variant) =>
    variant.includes(queryPhrase),
  );
  const phraseInDescription = description.includes(queryPhrase);
  if (phraseInName) {
    return {
      score: 0.95,
      reason: "the sourced place name uses the same wording",
    };
  }
  if (phraseInDescription) {
    return {
      score: queryWords.length > 1 ? 0.91 : 0.79,
      reason: "the destination guide explicitly uses this wording",
    };
  }

  const exactNameCoverage = queryWords.filter((queryWord) =>
    nameWords.includes(queryWord),
  ).length;
  const exactCombinedCoverage = queryWords.filter((queryWord) =>
    combinedWords.includes(queryWord),
  ).length;
  if (exactNameCoverage === queryWords.length) {
    return {
      score: 0.92,
      reason: "every distinctive word appears in the sourced place name",
    };
  }
  if (exactCombinedCoverage === queryWords.length) {
    return {
      score: queryWords.length > 1 ? 0.86 : 0.78,
      reason:
        "the same distinctive words appear together in the destination guide",
    };
  }

  const similarities = queryWords.map((queryWord) =>
    combinedWords.reduce(
      (best, candidateWord) =>
        Math.max(best, tokenSimilarity(queryWord, candidateWord)),
      0,
    ),
  );
  const allClose = similarities.every((similarity) => similarity >= 0.8);
  if (!allClose) return { score: 0, reason: "" };

  const average =
    similarities.reduce((total, similarity) => total + similarity, 0) /
    similarities.length;
  const nameHasCloseWord = queryWords.some((queryWord) =>
    nameWords.some(
      (candidateWord) =>
        tokenSimilarity(queryWord, candidateWord) >= 0.8,
    ),
  );
  return {
    score: Math.min(
      nameHasCloseWord ? 0.9 : 0.8,
      (nameHasCloseWord ? 0.82 : 0.75) + average * 0.08,
    ),
    reason: "the source has one clear spelling-near match",
  };
}

function resolveWishlistAgainstCatalog(
  items: readonly WishlistInputItem[],
  destination: string,
  listings: readonly WikivoyageCatalogListing[],
): WishlistCatalogResolution {
  const matches: WishlistCatalogMatch[] = [];
  const unresolvedItems: WishlistInputItem[] = [];
  const ambiguousListingKeys = new Set<string>();

  items.forEach((item) => {
    const ranked = listings
      .map((listing) => ({
        listing,
        ...scoreWishlistListing(item, destination, listing),
      }))
      .filter((candidate) => candidate.score >= 0.62)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.listing.sourceOrder - right.listing.sourceOrder ||
          left.listing.name.localeCompare(right.listing.name),
      );
    const best = ranked[0];
    const second = ranked[1];
    const hasClearWinner =
      best &&
      best.score >= 0.78 &&
      (best.score === 1
        ? !second || second.score < 1
        : !second || best.score - second.score >= 0.08);

    if (hasClearWinner) {
      matches.push({
        item,
        listing: best.listing,
        score: best.score,
        reason: best.reason,
      });
      return;
    }

    ranked
      .filter(
        (candidate) =>
          candidate.score >= 0.7 &&
          (!best || best.score - candidate.score < 0.08),
      )
      .forEach((candidate) =>
        ambiguousListingKeys.add(listingKey(candidate.listing)),
      );
    unresolvedItems.push(item);
  });

  return { matches, unresolvedItems, ambiguousListingKeys };
}

type WikivoyageSearchResponse = {
  query?: { search?: Array<{ title?: unknown }> };
};

type WikivoyageSubpageResponse = {
  query?: { allpages?: Array<{ title?: unknown }> };
};

type WikivoyageParseResponse = {
  parse?: {
    title?: unknown;
    displaytitle?: unknown;
    text?: unknown;
  };
};

function wikipediaStyleUrl(title: string): string {
  const path = title
    .replace(/\s+/g, "_")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://en.wikivoyage.org/wiki/${path}`;
}

export class WikivoyageRecommendationAdapter
  implements RecommendationSource, DestinationWishlistResolver
{
  private readonly rootCatalogCache = new Map<
    string,
    Promise<WikivoyageCatalog | null>
  >();
  private readonly expandedCatalogCache = new Map<
    string,
    Promise<WikivoyageCatalog | null>
  >();
  private readonly guideCache = new Map<
    string,
    Promise<WikivoyageCatalogListing[]>
  >();

  constructor(private readonly fetcher: typeof fetch = globalThis.fetch) {}

  async resolveWishlist(
    destination: string,
    wishlistItems: readonly string[],
  ): Promise<ResolvedDestinationPlace[]> {
    const items = wishlistItems
      .map((label) => ({
        label: label.trim(),
        searchableText: label,
      }))
      .filter((item) => item.label);
    if (items.length === 0) return [];

    const rootCatalog = await this.loadRootCatalog(destination);
    if (!rootCatalog) return [];
    let catalog = rootCatalog;
    let resolution = resolveWishlistAgainstCatalog(
      items,
      destination,
      catalog.listings,
    );
    if (resolution.unresolvedItems.length > 0) {
      try {
        catalog = (await this.loadExpandedCatalog(destination)) ?? catalog;
        resolution = resolveWishlistAgainstCatalog(
          items,
          destination,
          catalog.listings,
        );
      } catch {
        // A district-guide outage must not turn a preserved wish into a
        // guessed place or make the destination's root guide unusable.
      }
    }

    return resolution.matches.map((match) => ({
      wishlistItem: match.item.label,
      stop: this.stopFromListing(match.listing, catalog.articleTitle),
      score: match.score,
      reason: match.reason,
    }));
  }

  async recommend(
    input: RecommendationRequest,
  ): Promise<DayRecommendationBundle | null> {
    const wishlistItems = wishlistInputItems(input);
    const rootCatalog = await this.loadRootCatalog(input.destination);
    if (!rootCatalog) return null;
    let catalog = rootCatalog;
    let resolution = resolveWishlistAgainstCatalog(
      wishlistItems,
      input.destination,
      catalog.listings,
    );
    if (resolution.unresolvedItems.length > 0) {
      try {
        catalog =
          (await this.loadExpandedCatalog(input.destination)) ?? catalog;
        resolution = resolveWishlistAgainstCatalog(
          wishlistItems,
          input.destination,
          catalog.listings,
        );
      } catch {
        // Keep the root-guide recommendation available. Any unmatched line
        // stays visible for review instead of failing the whole request.
      }
    }

    const matchedByListing = new Map<
      string,
      {
        listing: WikivoyageCatalogListing;
        matches: WishlistCatalogMatch[];
      }
    >();
    resolution.matches.forEach((match) => {
      const key = listingKey(match.listing);
      const existing = matchedByListing.get(key);
      if (existing) {
        existing.matches.push(match);
      } else {
        matchedByListing.set(key, {
          listing: match.listing,
          matches: [match],
        });
      }
    });

    const matchedSourceTitles = new Set(
      [...matchedByListing.values()].map(
        ({ listing }) => listing.sourceTitle,
      ),
    );
    const sectionRank = { see: 0, do: 1, eat: 2 } as const;
    const selectedListings = [...matchedByListing.values()]
      .map(({ listing }) => listing)
      .slice(0, 12);
    const selectedKeys = new Set(selectedListings.map(listingKey));
    const fillers = catalog.listings
      .filter(
        (listing) =>
          !selectedKeys.has(listingKey(listing)) &&
          !resolution.ambiguousListingKeys.has(listingKey(listing)),
      )
      .sort(
        (left, right) =>
          Number(matchedSourceTitles.has(right.sourceTitle)) -
            Number(matchedSourceTitles.has(left.sourceTitle)) ||
          (sectionRank[left.section ?? "eat"] -
            sectionRank[right.section ?? "eat"]) ||
          left.sourceOrder - right.sourceOrder ||
          left.name.localeCompare(right.name),
      );
    for (const filler of fillers) {
      if (selectedListings.length >= 3 || selectedListings.length >= 12) {
        break;
      }
      selectedListings.push(filler);
      selectedKeys.add(listingKey(filler));
    }
    if (selectedListings.length < 3) return null;

    const selectedCandidates: ResolvedCuratedCandidate[] =
      selectedListings.map((listing, index) => {
        const key = listingKey(listing);
        const matches = matchedByListing.get(key)?.matches ?? [];
        return {
          stop: this.stopFromListing(listing, catalog.articleTitle),
          curationOrder: index + 1,
          saved: matches.length > 0,
          branchIntentAliases: matches.map((match) => match.item.label),
        };
      });
    const candidateById = new Map(
      selectedCandidates.map((candidate) => [
        candidate.stop.id,
        candidate,
      ]),
    );
    const routePlan = planGeographicDays(
      selectedCandidates.map(
        ({ stop }): GeographicStop => ({
          id: stop.id,
          localityKey: stop.localityKey ?? normalize(input.destination),
          localityLabel: stop.localityLabel ?? input.destination,
          ...(stop.latitude === undefined
            ? {}
            : { latitude: stop.latitude }),
          ...(stop.longitude === undefined
            ? {}
            : { longitude: stop.longitude }),
          ...(stop.preferredDayOrder === undefined
            ? {}
            : { preferredDayOrder: stop.preferredDayOrder }),
          ...(stop.routeRank === undefined
            ? {}
            : { routeRank: stop.routeRank }),
          ...(stop.dayTitle ? { dayTitle: stop.dayTitle } : {}),
          ...(stop.dayRationale
            ? { dayRationale: stop.dayRationale }
            : {}),
        }),
      ),
    );
    const orderedBriefs: RecommendedStopBrief[] = routePlan.days
      .flatMap((day) => day.stopIds)
      .map((stopId, index) => {
        const candidate = candidateById.get(stopId);
        if (!candidate) {
          throw new RecommendationUnavailableError(
            "DayWeave could not keep every sourced stop in its geographic route.",
          );
        }
        return {
          order: index + 1,
          placeId: candidate.stop.id,
          placeName: candidate.stop.name,
          ...(candidate.stop.mapsArea
            ? { mapsArea: candidate.stop.mapsArea }
            : {}),
          origin: candidate.saved ? "saved" : "service_added",
          whyPeopleCome: candidate.stop.whyPeopleCome,
          dontMiss: candidate.stop.dontMiss,
          worthKnowing: candidate.stop.worthKnowing,
          evidence: candidate.stop.evidence,
        };
      });
    const savedPlaceIds = orderedBriefs
      .filter((brief) => brief.origin === "saved")
      .map((brief) => brief.placeId);
    const serviceAddedPlaceIds = orderedBriefs
      .filter((brief) => brief.origin === "service_added")
      .map((brief) => brief.placeId);
    const resolvedWishlistLabels = new Set(
      selectedCandidates.flatMap((candidate) =>
        (candidate.branchIntentAliases ?? []).map(normalize),
      ),
    );
    const unresolvedItems = wishlistItems
      .filter(
        (item) => !resolvedWishlistLabels.has(normalize(item.label)),
      )
      .map((item) => item.label);
    const branchResolutions =
      resolution.matches
        .filter((match) => selectedKeys.has(listingKey(match.listing)))
        .map((match) => {
          const stop = this.stopFromListing(
            match.listing,
            catalog.articleTitle,
          );
          return {
            intent: match.item.label,
            selectedPlaceId: stop.id,
            selectedPlaceName: stop.name,
            matchKind: "contextual_area" as const,
            reason: `DayWeave matched “${match.item.label}” to ${stop.name} because ${match.reason}.`,
            alternative: null,
          };
        });

    return DayRecommendationBundleSchema.parse({
      schemaVersion: "1.0",
      destination: input.destination,
      mode: "wikivoyage",
      headline: `What stands out in ${input.destination}`,
      rationale: rationaleFor(
        savedPlaceIds.length,
        orderedBriefs.length,
        "a short set of concrete, sourced places from the destination guide",
      ),
      savedPlaceIds,
      serviceAddedPlaceIds,
      orderedBriefs,
      unresolvedWishlistItems: unresolvedItems,
      branchResolutions,
      routePlan,
      attribution: {
        label:
          "Recommendations adapted from Wikivoyage contributors. Open the source for revision history and contributors.",
        url: catalog.articleUrl,
        license: WIKIVOYAGE_LICENSE,
      },
    });
  }

  private stopFromListing(
    listing: WikivoyageCatalogListing,
    articleTitle: string,
  ): CuratedStop {
    const recommendationCopy = splitRecommendationCopy(
      listing.description,
    );
    const isRoot =
      normalize(listing.sourceTitle) === normalize(articleTitle);
    const placeId = isRoot
      ? `wikivoyage-${stableSlug(listing.name)}`
      : `wikivoyage-${stableSlug(listing.localityLabel)}-${stableSlug(listing.name)}`;
    return {
      id: placeId,
      name: listing.name,
      mapsArea: listing.localityLabel,
      localityKey: listing.localityKey,
      localityLabel: listing.localityLabel,
      ...(listing.latitude === undefined
        ? {}
        : { latitude: listing.latitude }),
      ...(listing.longitude === undefined
        ? {}
        : { longitude: listing.longitude }),
      preferredDayOrder: Math.floor(listing.sourceOrder / 1_000),
      routeRank: listing.sourceOrder % 1_000,
      dayTitle: isRoot
        ? `${listing.localityLabel} guide thread`
        : `${listing.localityLabel} day`,
      dayRationale: isRoot
        ? `These sourced stops stay in ${listing.localityLabel}. Maps remains responsible for current travel time.`
        : `These stops come from the ${listing.localityLabel} district guide, keeping that part of the destination in one day.`,
      aliases: [listing.name, ...(listing.altNames ?? [])],
      whyPeopleCome: recommendationCopy.whyPeopleCome,
      dontMiss: recommendationCopy.dontMiss,
      worthKnowing:
        "Wikivoyage is community-edited. Verify current opening, access and booking details with the venue before the day.",
      evidence: [
        {
          id: `wikivoyage-${stableSlug(listing.sourceTitle)}-${stableSlug(listing.name)}`,
          claim: listing.description,
          sourceName: `Wikivoyage: ${listing.sourceTitle}`,
          sourceUrl: listing.sourceUrl,
          sourceType: "licensed_editorial",
          lastCheckedDate: new Date().toISOString().slice(0, 10),
          license: WIKIVOYAGE_LICENSE,
        },
      ],
    };
  }

  private async loadRootCatalog(
    destination: string,
  ): Promise<WikivoyageCatalog | null> {
    const cacheKey = normalize(destination);
    const existing = this.rootCatalogCache.get(cacheKey);
    if (existing) return existing;

    const pending = (async () => {
      const title = await this.findArticleTitle(destination);
      if (!title) return null;
      const listings = await this.fetchGuideListings(
        title,
        destination,
        0,
      );
      return {
        destination,
        articleTitle: title,
        articleUrl: wikipediaStyleUrl(title),
        listings,
      };
    })();
    this.rootCatalogCache.set(cacheKey, pending);
    try {
      return await pending;
    } catch (error) {
      this.rootCatalogCache.delete(cacheKey);
      throw error;
    }
  }

  private async loadExpandedCatalog(
    destination: string,
  ): Promise<WikivoyageCatalog | null> {
    const cacheKey = normalize(destination);
    const existing = this.expandedCatalogCache.get(cacheKey);
    if (existing) return existing;

    const pending = (async () => {
      const root = await this.loadRootCatalog(destination);
      if (!root) return null;
      const subpageTitles = await this.findSubpageTitles(
        root.articleTitle,
      );
      const subpageListings: WikivoyageCatalogListing[] = [];
      for (let index = 0; index < subpageTitles.length; index += 6) {
        const batch = await Promise.all(
          subpageTitles.slice(index, index + 6).map(async (title, offset) => {
            try {
              return await this.fetchGuideListings(
                title,
                destination,
                index + offset + 1,
              );
            } catch {
              return [];
            }
          }),
        );
        subpageListings.push(...batch.flat());
      }

      const byIdentity = new Map<string, WikivoyageCatalogListing>();
      [...root.listings, ...subpageListings].forEach((listing) => {
        const identity = listingKey(listing);
        const existingListing = byIdentity.get(identity);
        if (
          !existingListing ||
          (existingListing.latitude === undefined &&
            listing.latitude !== undefined)
        ) {
          byIdentity.set(identity, listing);
        }
      });
      return {
        ...root,
        listings: [...byIdentity.values()],
      };
    })();
    this.expandedCatalogCache.set(cacheKey, pending);
    try {
      return await pending;
    } catch (error) {
      this.expandedCatalogCache.delete(cacheKey);
      throw error;
    }
  }

  private async fetchGuideListings(
    title: string,
    destination: string,
    guideOrder: number,
  ): Promise<WikivoyageCatalogListing[]> {
    const cacheKey = normalize(title);
    const existing = this.guideCache.get(cacheKey);
    if (existing) return existing;

    const pending = (async () => {
      const parseUrl = new URL(WIKIVOYAGE_API);
      parseUrl.search = new URLSearchParams({
        action: "parse",
        page: title,
        prop: "text|displaytitle",
        format: "json",
        formatversion: "2",
        origin: "*",
        maxlag: "5",
      }).toString();
      const parsed =
        await this.fetchJson<WikivoyageParseResponse>(parseUrl);
      const sourceTitle =
        typeof parsed.parse?.title === "string"
          ? parsed.parse.title
          : title;
      const html =
        typeof parsed.parse?.text === "string"
          ? parsed.parse.text
          : "";
      const localityLabel = sourceTitle.includes("/")
        ? sourceTitle.split("/").at(-1)?.trim() || destination
        : destination;
      const sourceUrl = wikipediaStyleUrl(sourceTitle);
      return parseWikivoyageTravelListings(html, 80).map(
        (listing, index) => ({
          ...listing,
          sourceTitle,
          sourceUrl,
          sourceOrder: guideOrder * 1_000 + index + 1,
          localityKey: normalize(sourceTitle),
          localityLabel,
        }),
      );
    })();
    this.guideCache.set(cacheKey, pending);
    try {
      return await pending;
    } catch (error) {
      this.guideCache.delete(cacheKey);
      throw error;
    }
  }

  private async findSubpageTitles(title: string): Promise<string[]> {
    const searchUrl = new URL(WIKIVOYAGE_API);
    searchUrl.search = new URLSearchParams({
      action: "query",
      list: "allpages",
      apprefix: `${title}/`,
      apnamespace: "0",
      aplimit: "30",
      format: "json",
      formatversion: "2",
      origin: "*",
      maxlag: "5",
    }).toString();
    const result =
      await this.fetchJson<WikivoyageSubpageResponse>(searchUrl);
    return (
      result.query?.allpages
        ?.map((page) => page.title)
        .filter(
          (pageTitle): pageTitle is string =>
            typeof pageTitle === "string" &&
            pageTitle.startsWith(`${title}/`),
        ) ?? []
    );
  }

  private async findArticleTitle(destination: string): Promise<string | null> {
    const searchUrl = new URL(WIKIVOYAGE_API);
    searchUrl.search = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: destination,
      srnamespace: "0",
      srlimit: "1",
      format: "json",
      formatversion: "2",
      origin: "*",
      maxlag: "5",
    }).toString();
    const result = await this.fetchJson<WikivoyageSearchResponse>(searchUrl);
    const title = result.query?.search?.[0]?.title;
    return typeof title === "string" && title.trim() ? title : null;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const response = await this.fetcher(url, {
      headers: {
        Accept: "application/json",
        "Api-User-Agent": WIKIVOYAGE_USER_AGENT,
        "User-Agent": WIKIVOYAGE_USER_AGENT,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new RecommendationUnavailableError(
        `Wikivoyage returned ${response.status}; try the destination again shortly.`,
      );
    }
    return (await response.json()) as T;
  }
}

export class DayRecommendationService {
  private readonly curated: RecommendationSource;
  private readonly fallback: RecommendationSource;

  constructor(
    curated?: RecommendationSource,
    fallback?: RecommendationSource,
  ) {
    const resolvedFallback =
      fallback ?? new WikivoyageRecommendationAdapter();
    const supplementalResolver =
      "resolveWishlist" in resolvedFallback &&
      typeof resolvedFallback.resolveWishlist === "function"
        ? (resolvedFallback as RecommendationSource &
            DestinationWishlistResolver)
        : undefined;
    this.curated =
      curated ??
      new CuratedDestinationRecommendationAdapter(
        supplementalResolver,
      );
    this.fallback = resolvedFallback;
  }

  async recommend(
    input: RecommendationRequest,
  ): Promise<DayRecommendationBundle> {
    const curated = await this.curated.recommend(input);
    if (curated) return DayRecommendationBundleSchema.parse(curated);

    const fallback = await this.fallback.recommend(input);
    if (fallback) return DayRecommendationBundleSchema.parse(fallback);

    throw new RecommendationUnavailableError();
  }
}
