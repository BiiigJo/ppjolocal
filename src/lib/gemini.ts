import { GoogleGenAI, Type } from "@google/genai";

// Initialiser Gemini avec la clé depuis .env.local
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error('GEMINI_API_KEY is not set');
}

const ai = new GoogleGenAI({ 
  apiKey: apiKey || ''
});

export const clothingRecognitionSchema = {
  type: Type.OBJECT,
  properties: {
    poeticSuggestedTitle: { 
      type: Type.STRING, 
      description: "Un titre poétique et évocateur en français pour cette tenue (ex: 'Balade automnale à Montmartre', 'Éclat d'été', 'Brise marine')." 
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nom descriptif court du vêtement" },
          category: { type: Type.STRING, description: "Catégorie (Haut, Bas, Chaussures, Accessoire)" },
          type: { type: Type.STRING, description: "Type spécifique (T-shirt, Jean, Baskets, Veste, etc.)" },
          color: { type: Type.STRING, description: "Couleur dominante" },
          style: { type: Type.STRING, description: "Style (Casual, Formel, Sport, Chic, etc.)" },
          season: { type: Type.STRING, description: "Saison (Printemps, Été, Automne, Hiver, Toutes saisons)" },
          brand: { type: Type.STRING, description: "Marque du vêtement si visible ou reconnaissable, sinon laisser vide" },
          description: { type: Type.STRING, description: "Une brève description du vêtement" },
          careInstructions: { type: Type.STRING, description: "Conseils d'entretien (lavage, séchage, etc.) basés sur le type de tissu probable" },
          box_2d: { 
            type: Type.ARRAY, 
            items: { type: Type.NUMBER },
            description: "Coordonnées de la boîte englobante [ymin, xmin, ymax, xmax] normalisées à 1000 pour localiser l'objet dans l'image."
          },
        },
        required: ["name", "category", "type", "color", "style", "season", "brand", "description", "careInstructions", "box_2d"],
      }
    }
  },
  required: ["items", "poeticSuggestedTitle"],
};

export const outfitSuggestionSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      items: { type: Type.ARRAY, items: { type: Type.STRING } },
      explanation: { type: Type.STRING },
    },
    required: ["name", "items", "explanation"],
  },
};

/**
 * Reconnaître les vêtements dans une image avec Gemini
 * @param base64Image - Image en base64
 * @param allowedColors - Liste des couleurs autorisées
 * @returns Objet avec poeticSuggestedTitle et items (vêtements détectés)
 */
export async function recognizeClothing(base64Image: string, allowedColors: string[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1] || base64Image,
            },
          },
          {
            text: `Analyse cette image. S'il y a plusieurs vêtements, identifie-les tous séparément. 
            Détecte précisément la boîte englobante [ymin, xmin, ymax, xmax] pour chaque vêtement identifié.
            Calcule aussi un titre poétique et évocateur pour le look global.
            IMPORTANT pour la couleur: Choisis UNIQUEMENT la couleur dominante parmi cette liste: ${allowedColors.join(", ")}. 
            Si le vêtement a plusieurs couleurs, choisis la plus présente dans la liste. 
            Ne retourne AUCUNE autre couleur que celles de la liste.
            Retourne les détails au format JSON.`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: clothingRecognitionSchema,
    },
  });

  const data = JSON.parse(response.text);
  return data;
}

/**
 * Suggérer des tenues basées sur la garde-robe
 * @param wardrobe - Liste des vêtements disponibles
 * @param occasion - Occasion (ex: "Soirée", "Bureau", etc)
 * @param weatherInfo - Information météo (optionnel)
 * @param seedItem - Un vêtement à inclure obligatoirement (optionnel)
 * @returns Tableau de 3 suggestions d'outfits
 */
export async function suggestOutfits(
  wardrobe: any[], 
  occasion: string, 
  weatherInfo?: string, 
  seedItem?: any
) {
  const wardrobeContext = wardrobe
    .map(item => `- ${item.name} (${item.type}, ${item.color}, ${item.style})`)
    .join('\n');
  
  const weatherContext = weatherInfo 
    ? `\n\nNote: La météo actuelle est : ${weatherInfo}.` 
    : "";
  
  const seedItemContext = seedItem 
    ? `\n\nIMPORTANT: Chaque tenue suggérée DOIT ABSOLUMENT inclure le vêtement suivant de ma garde-robe : "${seedItem.name}" (${seedItem.type}, ${seedItem.color}). Construis les tenues AUTOUR de cette pièce maîtresse.`
    : "";
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview"
    contents: `Voici ma garde-robe :\n${wardrobeContext}${weatherContext}${seedItemContext}\n\nSuggère-moi 3 tenues adaptées pour l'occasion suivante : ${occasion}. Pour chaque tenue, donne un nom, la liste des vêtements à utiliser et une brève explication du style. Réponds en français au format JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: outfitSuggestionSchema,
    },
  });

  return JSON.parse(response.text);
}
