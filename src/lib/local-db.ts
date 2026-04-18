import { ClothingItem, Outfit } from "@/types";

const CLOTHING_KEY = "stylescan_clothing";
const OUTFITS_KEY = "stylescan_outfits";

let listeners: (() => void)[] = [];

const notify = () => {
  listeners.forEach(l => l());
};

export const localDatabase = {
  subscribe: (listener: () => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },
  getClothing: (): ClothingItem[] => {
    const data = localStorage.getItem(CLOTHING_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveClothing: (item: ClothingItem) => {
    const items = localDatabase.getClothing();
    items.unshift(item);
    localStorage.setItem(CLOTHING_KEY, JSON.stringify(items));
    notify();
  },
  deleteClothing: (id: string) => {
    const items = localDatabase.getClothing().filter(i => i.id !== id);
    localStorage.setItem(CLOTHING_KEY, JSON.stringify(items));
    notify();
  },
  getOutfits: (): Outfit[] => {
    const data = localStorage.getItem(OUTFITS_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveOutfit: (outfit: Outfit) => {
    const outfits = localDatabase.getOutfits();
    const hash = outfit.photoHash;
    if (outfits.some(o => o.photoHash === hash)) return;
    
    outfits.unshift(outfit);
    localStorage.setItem(OUTFITS_KEY, JSON.stringify(outfits));
    notify();
  },
  deleteOutfit: (id: string) => {
    const outfits = localDatabase.getOutfits().filter(o => o.id !== id);
    localStorage.setItem(OUTFITS_KEY, JSON.stringify(outfits));
    notify();
  },
  updateOutfit: (id: string, updates: Partial<Outfit>) => {
    const outfits = localDatabase.getOutfits().map(o => o.id === id ? { ...o, ...updates } : o);
    localStorage.setItem(OUTFITS_KEY, JSON.stringify(outfits));
    notify();
  },
  updateClothing: (id: string, updates: Partial<ClothingItem>) => {
    const items = localDatabase.getClothing().map(i => i.id === id ? { ...i, ...updates } : i);
    localStorage.setItem(CLOTHING_KEY, JSON.stringify(items));
    notify();
  }
};
