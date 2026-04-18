export interface ClothingItem {
  id: string;
  name: string;
  category: string;
  type: string;
  color: string;
  style: string;
  season: string;
  brand?: string;
  description?: string;
  careInstructions?: string;
  imageUrl: string;
  userId: string;
  createdAt: string;
}

export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  date: string;
  photoUrl?: string;
  photoHash?: string;
  hashtags?: string[];
  dominantColor?: string;
  occasion: string;
  userId: string;
  createdAt: string;
}
