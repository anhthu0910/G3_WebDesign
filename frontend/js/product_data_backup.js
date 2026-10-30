
const products = [
  {
    id: 1,
    name: "Daily Hydrating Cleanser",
    brand: "GlowLab Demo",
    category: "Cleanser",
    price: 185000,
    skinTypes: ["dry", "normal", "sensitive"],
    concerns: ["dryness", "barrier"],
    color: "#e4ebdb",
    icon: "🫧",
    description: "Gentle daily cleansing."
  },
  {
    id: 2,
    name: "Lightweight Gel Moisturizer",
    brand: "PureSkin Demo",
    category: "Moisturizer",
    price: 245000,
    skinTypes: ["oily", "combination"],
    concerns: ["acne", "barrier", "large-pores"],
    color: "#dceef1",
    icon: "💧",
    description: "Lightweight daily hydration."
  },
  {
    id: 3,
    name: "Brightening Facial Serum",
    brand: "LumiCare Demo",
    category: "Serum",
    price: 320000,
    skinTypes: ["normal", "dry", "combination"],
    concerns: ["dark-spots", "large-pores"],
    color: "#f7e4cb",
    icon: "✨",
    description: "Brightening skincare serum."
  },
  {
    id: 4,
    name: "Barrier Recovery Cream",
    brand: "DermaSoft Demo",
    category: "Moisturizer",
    price: 290000,
    skinTypes: ["dry", "sensitive", "normal"],
    concerns: ["dryness", "barrier"],
    color: "#eddff0",
    icon: "🌸",
    description: "Comforting moisturizing cream."
  },
  {
    id: 5,
    name: "Oil Balance Face Wash",
    brand: "ClearDays Demo",
    category: "Cleanser",
    price: 165000,
    skinTypes: ["oily", "combination"],
    concerns: ["acne"],
    color: "#d6e9df",
    icon: "🌿",
    description: "Face wash for oily skin."
  },
  {
    id: 6,
    name: "Age Support Night Cream",
    brand: "GlowLab Demo",
    category: "Night Cream",
    price: 420000,
    skinTypes: ["dry", "normal"],
    concerns: ["aging", "dryness"],
    color: "#f2e1db",
    icon: "🌙",
    description: "Rich nighttime moisturizer."
  },
  {
    id: 7,
    name: "Calming Hydration Toner",
    brand: "PureSkin Demo",
    category: "Toner",
    price: 210000,
    skinTypes: ["sensitive", "dry", "combination"],
    concerns: ["barrier", "dryness"],
    color: "#dce7f5",
    icon: "🪷",
    description: "Refreshing hydrating toner."
  },
  {
    id: 8,
    name: "Even Tone Daily Essence",
    brand: "LumiCare Demo",
    category: "Essence",
    price: 355000,
    skinTypes: ["normal", "oily", "combination"],
    concerns: ["dark-spots", "aging"],
    color: "#f1e4b8",
    icon: "☀️",
    description: "Daily skin tone care."
  }
];


const productDetails = {
  1: {
    ingredients: ["Glycerin", "Panthenol"],
    benefits: [
      "Gentle cleansing",
      "Supports skin hydration"
    ],
    usage: "Apply to damp skin and rinse with water.",
    cautions: "Avoid direct contact with eyes."
  },

  2: {
    ingredients: ["Glycerin", "Hyaluronic Acid", "Niacinamide"],
    benefits: [
      "Lightweight hydration",
      "Supports moisture retention"
    ],
    usage: "Apply after cleansing, morning or evening.",
    cautions: "Patch test before first use."
  },

  3: {
    ingredients: ["Niacinamide", "Glycerin"],
    benefits: [
      "Supports even-looking skin tone",
      "Provides hydration"
    ],
    usage: "Apply a few drops before moisturizer.",
    cautions: "Use sunscreen during the day."
  },

  4: {
    ingredients: ["Ceramides", "Panthenol", "Glycerin"],
    benefits: [
      "Supports the skin barrier",
      "Helps maintain skin moisture"
    ],
    usage: "Apply evenly to clean skin.",
    cautions: "Discontinue if irritation occurs."
  },

  5: {
    ingredients: ["Glycerin", "Mild cleansing agents"],
    benefits: [
      "Removes excess surface oil",
      "Gentle daily cleansing"
    ],
    usage: "Massage on damp face and rinse thoroughly.",
    cautions: "Avoid over-cleansing."
  },

  6: {
    ingredients: ["Peptides", "Glycerin"],
    benefits: [
      "Provides nighttime hydration",
      "Supports smoother-looking skin"
    ],
    usage: "Apply during your nighttime routine.",
    cautions: "Patch test new products."
  },

  7: {
    ingredients: ["Panthenol", "Allantoin"],
    benefits: [
      "Supports skin hydration",
      "Helps maintain skin comfort"
    ],
    usage: "Apply gently after cleansing.",
    cautions: "Avoid direct eye contact."
  },

  8: {
    ingredients: ["Niacinamide", "Antioxidant ingredients"],
    benefits: [
      "Supports more even-looking skin",
      "Provides daily hydration"
    ],
    usage: "Apply before moisturizer.",
    cautions: "Wear sunscreen during daytime."
  }
};
