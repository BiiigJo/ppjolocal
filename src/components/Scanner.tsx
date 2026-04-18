import { useState, useRef, useCallback, ChangeEvent, useEffect, useMemo } from "react";
import { Camera, RefreshCw, Check, X, Loader2, Upload, Plus, Crop as CropIcon, AlertCircle, Hash, MapPin as MapPinIcon, Type, Trash2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recognizeClothing } from "@/lib/gemini";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { Outfit } from "@/types";
import { localDatabase } from "@/lib/local-db";
import { WeatherData } from "@/lib/weather";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ReactCrop, { type Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import CryptoJS from "crypto-js";
import { compressImage } from "@/lib/image-utils";

const cropImageFromBox = (base64Str: string, box_2d: number[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      const [ymin, xmin, ymax, xmax] = box_2d;
      const x = (xmin / 1000) * img.width;
      const y = (ymin / 1000) * img.height;
      const width = ((xmax - xmin) / 1000) * img.width;
      const height = ((ymax - ymin) / 1000) * img.height;

      const paddingX = width * 0.15;
      const paddingY = height * 0.15;
      
      const targetX = Math.max(0, x - paddingX);
      const targetY = Math.max(0, y - paddingY);
      const targetWidth = Math.min(img.width - targetX, width + paddingX * 2);
      const targetHeight = Math.min(img.height - targetY, height + paddingY * 2);

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(img, targetX, targetY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = base64Str;
  });
};

interface ScannerProps {
  user: any;
  onTabChange: (tab: string) => void;
  reScanPhoto?: string | null;
  onClearReScan?: () => void;
  weather?: WeatherData | null;
}

const COLORS = [
  "Noir", "Blanc", "Gris", "Marine", "Bleu", "Rouge", "Vert", "Jaune", 
  "Marron", "Orange", "Violet", "Rose", "Beige", "Kaki", "Argent", "Or", "Multi"
];

const POPULAR_BRANDS_DEFAULT = [
  "Zara", "H&M", "Mango", "Nike", "Adidas", "Levi's", "Bershka", 
  "Stradivarius", "Pull&Bear", "Lacoste", "Ralph Lauren", 
  "Tommy Hilfiger", "ASOS", "Shein", "Primark", "Uniqlo", 
  "Massimo Dutti", "Vans", "Converse", "Puma"
].sort();

const BRAND_OTHER = "Autre / Sans marque";

const getColorHex = (colorName: string) => {
  const map: Record<string, string> = {
    'noir': '#000000',
    'blanc': '#FFFFFF',
    'bleu': '#3B82F6',
    'rouge': '#EF4444',
    'vert': '#10B981',
    'jaune': '#F59E0B',
    'gris': '#6B7280',
    'marron': '#78350F',
    'orange': '#F97316',
    'violet': '#8B5CF6',
    'rose': '#EC4899',
    'beige': '#F5F5DC',
    'navy': '#000080',
    'marine': '#000080',
    'kaki': '#F0E68C',
    'argent': '#C0C0C0',
    'or': '#FFD700',
    'multi': 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)'
  };
  const key = colorName.toLowerCase().trim();
  return map[key] || '#E4E4E7';
};

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

function ColorMultiSelect({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (val: string) => void 
}) {
  const selectedColors = value ? value.split(',').map(c => c.trim()) : [];
  
  const toggleColor = (color: string) => {
    let newColors;
    if (selectedColors.includes(color)) {
      newColors = selectedColors.filter(c => c !== color);
    } else {
      newColors = [...selectedColors, color];
    }
    onChange(newColors.join(', '));
  };

  return (
    <Popover>
      <PopoverTrigger>
        <div className="relative cursor-pointer group">
          <div className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm flex wrap gap-1 items-center hover:border-zinc-300 transition-colors">
            {selectedColors.length > 0 ? (
              selectedColors.map(color => (
                <Badge key={color} variant="secondary" className="px-1.5 py-0 h-5 text-[10px] font-bold gap-1">
                  <div className="w-2 h-2 rounded-full border border-black/5" style={{ background: getColorHex(color) }} />
                  {color}
                </Badge>
              ))
            ) : (
              <span className="text-zinc-400">Choisir couleurs...</span>
            )}
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 rounded-2xl" align="start">
        <div className="grid grid-cols-2 gap-1">
          {COLORS.map(color => (
            <button
              key={color}
              onClick={() => toggleColor(color)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedColors.includes(color) 
                  ? 'bg-zinc-900 text-white' 
                  : 'hover:bg-zinc-50 text-zinc-600'
              }`}
            >
              <div className="w-3 h-3 rounded-full border border-black/5" style={{ background: getColorHex(color) }} />
              {color}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ClothingCard({ 
  item, 
  id,
  isSaved, 
  isIgnored,
  onSave, 
  onIgnore, 
  onUndo,
  onUpdate, 
  popularBrands,
  isDuplicate,
  onAddBrand
}: { 
  item: any; 
  id: string;
  isSaved: boolean; 
  isIgnored: boolean;
  onSave: (id: string) => void; 
  onIgnore: (id: string) => void; 
  onUndo: (id: string) => void;
  onUpdate: (id: string, f: string, v: string) => void;
  popularBrands: string[];
  isDuplicate?: boolean;
  onAddBrand: (brand: string) => void;
}) {
  const [showCustomBrand, setShowCustomBrand] = useState(false);
  const [customBrand, setCustomBrand] = useState("");

  const x = useMotionValue(0);
  const opacityLeft = useTransform(x, [-100, -50], [1, 0]);
  const opacityRight = useTransform(x, [50, 100], [0, 1]);
  const scaleLeft = useTransform(x, [-100, -50], [1.2, 1]);
  const scaleRight = useTransform(x, [50, 100], [1, 1.2]);

  return (
    <div className={`relative group transition-opacity duration-300 ${isIgnored ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`}>
      {/* Swipe Background Indicators */}
      {!isSaved && !isIgnored && (
        <div className="absolute inset-0 rounded-3xl overflow-hidden flex justify-between pointer-events-none">
          <motion.div 
            style={{ opacity: opacityLeft }}
            className="w-1/2 bg-red-500/10 flex items-center justify-start pl-8 text-red-500"
          >
            <motion.div style={{ scale: scaleLeft }}>
              <X className="w-8 h-8" />
            </motion.div>
          </motion.div>
          <motion.div 
            style={{ opacity: opacityRight }}
            className="w-1/2 bg-green-500/10 flex items-center justify-end pr-8 text-green-500"
          >
            <motion.div style={{ scale: scaleRight }}>
              <Check className="w-8 h-8" />
            </motion.div>
          </motion.div>
        </div>
      )}

      <motion.div
        layout
        style={{ x }}
        drag={(!isSaved && !isIgnored) ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={(_, info) => {
          if (info.offset.x > 100) {
            onSave(id);
          } else if (info.offset.x < -100) {
            onIgnore(id);
          }
        }}
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: 200, scale: 0.8 }}
        whileDrag={{ scale: 1.02, zIndex: 50 }}
        className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-xl space-y-6 relative touch-pan-y select-none cursor-grab active:cursor-grabbing overflow-hidden"
      >
        {isSaved && (
          <div 
            className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 rounded-3xl flex flex-col items-center justify-center cursor-pointer group/overlay"
            onClick={() => onUndo(id)}
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-green-500 text-white px-4 py-2 rounded-full flex items-center gap-2 font-bold shadow-lg group-hover/overlay:rotate-2 group-hover/overlay:scale-105 transition-transform"
            >
              <Check className="w-5 h-5" />
              Ajouté
            </motion.div>
            <p className="mt-2 text-[10px] text-zinc-400 font-bold opacity-0 group-hover/overlay:opacity-100 transition-opacity">
              Cliquez pour annuler
            </p>
          </div>
        )}

        {isIgnored && (
          <div 
            className="absolute inset-0 bg-zinc-50/40 backdrop-blur-[1px] z-20 rounded-3xl flex flex-col items-center justify-center cursor-pointer group/overlay"
            onClick={() => onIgnore(id)} // Clicking again toggles off? No, user didn't request undo for ignore but it's nice.
          >
            <div className="bg-zinc-400 text-white px-4 py-2 rounded-full flex items-center gap-2 font-bold shadow-sm">
              <X className="w-5 h-5" />
              Ignoré
            </div>
            <p className="mt-2 text-[10px] text-zinc-400 font-bold opacity-0 group-hover/overlay:opacity-100 transition-opacity">
              Cliquez pour restaurer
            </p>
          </div>
        )}

        {isDuplicate && !isSaved && !isIgnored && (
          <div className="bg-amber-50 border border-amber-100 p-2 rounded-xl flex items-center gap-2 text-amber-800 text-[10px] font-bold uppercase tracking-tight">
            <AlertCircle className="w-3.5 h-3.5" />
            Déjà dans votre dressing
          </div>
        )}
        
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-50">
            <h3 className="font-bold text-sm uppercase tracking-tighter text-zinc-400">Vêtement</h3>
            {!isSaved && !isIgnored && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-zinc-300">Détails</span>
              </div>
            )}
          </div>

          {item.croppedUrl && (
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100 shadow-inner mb-4 border border-zinc-100">
              <img src={item.croppedUrl} className="w-full h-full object-cover" alt="Focus vêtement" referrerPolicy="no-referrer" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`name-${id}`}>Nom du vêtement</Label>
              <Input 
                id={`name-${id}`}
                value={item.name} 
                onChange={(e) => onUpdate(id, "name", e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Marque</Label>
              <div className="space-y-2">
                {!showCustomBrand && (
                  <Select 
                    value={popularBrands.includes(item.brand) ? item.brand : (item.brand ? "Custom" : "")} 
                    onValueChange={(val: string) => {
                      if (val === "Autre") {
                        setShowCustomBrand(true);
                      } else {
                        onUpdate(id, "brand", val);
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent>
                      {popularBrands.map(brand => (
                        <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                      ))}
                      <SelectItem value="Autre">Autre / Sans marque</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                
                {showCustomBrand && (
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Indiquer la marque..."
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      className="rounded-xl"
                    />
                    <Button 
                      size="sm" 
                      onClick={() => {
                        if (customBrand.trim()) {
                          onAddBrand(customBrand.trim());
                          onUpdate(id, "brand", customBrand.trim());
                          setShowCustomBrand(false);
                          setCustomBrand("");
                        }
                      }}
                    >
                      OK
                    </Button>
                  </div>
                )}

                {item.brand && !showCustomBrand && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      onUpdate(id, "brand", "");
                      setShowCustomBrand(false);
                    }}
                    className="text-[10px] h-6 text-zinc-400 w-full justify-start px-1"
                  >
                    Effacer la marque
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Input 
                value={item.category} 
                onChange={(e) => onUpdate(id, "category", e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Input 
                value={item.type} 
                onChange={(e) => onUpdate(id, "type", e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Couleurs</Label>
              <ColorMultiSelect 
                value={item.color || ''} 
                onChange={(val) => onUpdate(id, "color", val)} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={item.style} onValueChange={(val: string) => onUpdate(id, "style", val)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Casual">Casual 👕</SelectItem>
                  <SelectItem value="Street">Street 🧥</SelectItem>
                  <SelectItem value="Chic">Chic 🤵</SelectItem>
                  <SelectItem value="Sport">Sport 👟</SelectItem>
                  <SelectItem value="Boho">Boho 🌸</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saison</Label>
              <Select value={item.season} onValueChange={(val: string) => onUpdate(id, "season", val)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Saison" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Printemps">Printemps</SelectItem>
                  <SelectItem value="Été">Été</SelectItem>
                  <SelectItem value="Automne">Automne</SelectItem>
                  <SelectItem value="Hiver">Hiver</SelectItem>
                  <SelectItem value="4 Saisons">4 Saisons</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              value={item.description} 
              onChange={(e) => onUpdate(id, "description", e.target.value)}
              className="rounded-xl min-h-[80px]"
            />
          </div>

          <div className="space-y-2 text-zinc-500">
            <Label>Conseils d'entretien</Label>
            <Textarea 
              value={item.careInstructions} 
              onChange={(e) => onUpdate(id, "careInstructions", e.target.value)}
              className="rounded-xl min-h-[80px] text-xs"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-zinc-50">
          <Button 
            variant="ghost"
            size="icon"
            onClick={() => onIgnore(id)}
            className={`w-14 h-14 rounded-[1.25rem] transition-all ${isIgnored ? 'text-zinc-900 bg-zinc-100' : 'text-zinc-400 hover:text-red-500 hover:bg-red-50'}`}
            disabled={isSaved}
            title={isIgnored ? "Restaurer" : "Ignorer"}
          >
            <Trash2 className="w-6 h-6" />
          </Button>
          <Button 
            onClick={() => onSave(id)} 
            disabled={isSaved || isIgnored}
            className={`flex-1 h-14 rounded-[1.25rem] ${isSaved ? 'bg-green-500' : 'bg-zinc-900 hover:bg-zinc-800'} text-white transition-all shadow-lg flex items-center justify-center gap-2`}
          >
            {isSaved ? (
              <>
                <Check className="w-5 h-5" />
                <span className="font-bold text-sm">Ajouté</span>
              </>
            ) : (
              <>
                <div className="relative">
                  <Heart className="w-6 h-6 fill-current" />
                  <Plus className="w-3.5 h-3.5 absolute -top-1 -right-1 text-white stroke-[3.5px] bg-zinc-900 rounded-full" />
                </div>
                <span className="font-bold text-sm">Ajouter</span>
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Scanner({ user, onTabChange, reScanPhoto, onClearReScan, weather }: ScannerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedPhoto, setAnalyzedPhoto] = useState<string | null>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [poeticTitle, setPoeticTitle] = useState<string>("");
  const [editedResults, setEditedResults] = useState<{item: any, id: string, isIgnored: boolean}[] | null>(null);
  const [savedIndices, setSavedIndices] = useState<Set<string>>(new Set());
  const [savedDocIds, setSavedDocIds] = useState<Record<string, string>>({});
  
  // Duplicate detection
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([]);
  const [duplicateOutfit, setDuplicateOutfit] = useState<Outfit | null>(null);
  
  // Clothing duplicate detection
  const [allClothing, setAllClothing] = useState<any[]>([]);
  
  const [customBrands, setCustomBrands] = useState<string[]>([]);
  
  useEffect(() => {
    const saved = localStorage.getItem("stylescan_custom_brands");
    if (saved) {
      setCustomBrands(JSON.parse(saved));
    }
  }, []);

  const addCustomBrand = (brand: string) => {
    if (!customBrands.includes(brand) && !POPULAR_BRANDS_DEFAULT.includes(brand)) {
      const newBrands = [...customBrands, brand].sort();
      setCustomBrands(newBrands);
      localStorage.setItem("stylescan_custom_brands", JSON.stringify(newBrands));
    }
  };

  const combinedBrands = useMemo(() => {
    return Array.from(new Set([...POPULAR_BRANDS_DEFAULT, ...customBrands])).sort();
  }, [customBrands]);

  const checkIsDuplicate = (item: any) => {
    if (!item.name) return false;
    return allClothing.some(existing => 
      existing.name?.toLowerCase().trim() === item.name.toLowerCase().trim() &&
      (existing.brand || "").toLowerCase().trim() === (item.brand || "").toLowerCase().trim() &&
      (existing.category || "").toLowerCase().trim() === (item.category || "").toLowerCase().trim()
    );
  };

  // Outfit metadata
  const [outfitTitle, setOutfitTitle] = useState("");
  const [outfitHashtags, setOutfitHashtags] = useState("");
  const [outfitLocation, setOutfitLocation] = useState(weather?.city || "");

  useEffect(() => {
    if (weather?.city && !outfitLocation) {
      setOutfitLocation(weather.city);
    }
  }, [weather]);

  useEffect(() => {
    // Dynamic title update based on location if title is still following the default pattern or empty
    const dateStr = format(new Date(), "PP", { locale: fr });
    const expectedOldTitle = dateStr + (outfitLocation ? "" : ""); // simplified logic
    
    // If title is empty or looks like a default title (starts with date), update it with location
    if (!outfitTitle || outfitTitle.startsWith(dateStr)) {
      setOutfitTitle(dateStr + (outfitLocation ? ` - ${outfitLocation}` : ''));
    }
  }, [outfitLocation]);

  useEffect(() => {
    const refresh = () => {
      setAllOutfits(localDatabase.getOutfits());
      setAllClothing(localDatabase.getClothing());
    };
    refresh();
    return localDatabase.subscribe(refresh);
  }, []);

  useEffect(() => {
    if (reScanPhoto) {
      setPhoto(reScanPhoto);
      if (onClearReScan) onClearReScan();
    }
  }, [reScanPhoto, onClearReScan]);

  useEffect(() => {
    if (photo && allOutfits.length > 0) {
      const hash = CryptoJS.MD5(photo).toString();
      // Ignore duplicates that were created in the last 5 seconds (likely the background save)
      const duplicate = allOutfits.find(o => {
        if (o.photoHash !== hash) return false;
        const creationTime = new Date(o.createdAt).getTime();
        const now = new Date().getTime();
        return (now - creationTime) > 5000;
      });
      
      setDuplicateOutfit(duplicate || null);
      if (duplicate && !outfitTitle) {
        setOutfitTitle(duplicate.name);
        setOutfitLocation(duplicate.occasion);
        setOutfitHashtags(duplicate.hashtags?.join(' ') || "");
      }
    } else {
      setDuplicateOutfit(null);
    }
  }, [photo, allOutfits]);
  
  // Cropping states
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync stream to video element when it mounts
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      // Explicitly call play for Firefox/Opera compatibility
      videoRef.current.play().catch(err => {
        console.error("Error playing video stream:", err);
      });
    }
  }, [stream]);

  const switchCamera = async () => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    
    // Stop current stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Restart with new mode
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: newMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(mediaStream);
    } catch (err: any) {
      console.error("Error switching camera:", err);
      toast.error("Impossible de changer de caméra");
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Votre navigateur ne supporte pas l'accès à la caméra ou n'est pas dans un contexte sécurisé (HTTPS)");
      return;
    }

    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(mediaStream);
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      
      let errorMessage = "Impossible d'accéder à la caméra";
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = "Accès à la caméra refusé. Veuillez autoriser l'accès dans les réglages de votre navigateur.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = "Aucune caméra détectée sur cet appareil.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = "La caméra est déjà utilisée par une autre application.";
      }
      
      setCameraError(errorMessage);
      toast.error(errorMessage, {
        duration: 5000,
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const onImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (analyzing || results) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Auto center a crop square around click
    const size = 60; // 60% of image size for better detection
    const newCrop: Crop = {
      unit: '%',
      x: Math.max(0, Math.min(100 - size, x - size / 2)),
      y: Math.max(0, Math.min(100 - size, y - size / 2)),
      width: size,
      height: size
    };
    
    setCrop(newCrop);
    setIsCropping(true);
    toast.info("Cadrage activé. Ajustez les coins pour cibler un vêtement spécifique.", { duration: 3000 });
  };

  const capture = async () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      
      // Target size for performance and storage
      const MAX_WIDTH = 1024;
      const MAX_HEIGHT = 1024;
      
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        try {
          ctx.drawImage(video, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          
          setPhoto(compressed);
          stopCamera();
          
          // Set default title and background save
          const defaultTitle = format(new Date(), "PP", { locale: fr }) + (outfitLocation ? ` - ${outfitLocation}` : '');
          setOutfitTitle(defaultTitle);
          setTimeout(() => saveAsOutfit(compressed, true), 100);
        } catch (err) {
          console.error("Capture compression failed:", err);
          toast.error("Erreur technique lors de la capture : stockage saturé ou image trop grande");
        }
      }
    }
  };

  const analyze = async () => {
    if (!photo) return;
    
    let finalPhoto = photo;
    
    // Process crop if needed
    if (completedCrop && imgRef.current && completedCrop.width > 0 && completedCrop.height > 0) {
      const canvas = document.createElement('canvas');
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      
      canvas.width = completedCrop.width * scaleX;
      canvas.height = completedCrop.height * scaleY;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          image,
          completedCrop.x * scaleX,
          completedCrop.y * scaleY,
          completedCrop.width * scaleX,
          completedCrop.height * scaleY,
          0,
          0,
          canvas.width,
          canvas.height
        );
        finalPhoto = canvas.toDataURL('image/jpeg', 0.9);
      }
    }

    setAnalyzing(true);
    const isDemo = user?.uid === "demo-user";
    try {
      // Compress the image before analysis and storage
      const compressed = await compressImage(finalPhoto);
      setAnalyzedPhoto(compressed);
      
      const data = await recognizeClothing(compressed, COLORS);
      const analysisItems = data.items;
      
      // Generate crops for each item
      const itemsWithCrops = await Promise.all(analysisItems.map(async (item: any) => {
        if (item.box_2d) {
          try {
            const croppedUrl = await cropImageFromBox(compressed, item.box_2d);
            return { ...item, croppedUrl };
          } catch (e) {
            console.error("Cropping failed for item", item.name, e);
            return item;
          }
        }
        return item;
      }));

      setResults(itemsWithCrops);
      setEditedResults(itemsWithCrops.map((item, i) => ({ 
        item, 
        id: `scanned-${i}-${Date.now()}`,
        isIgnored: false 
      })));
      setSavedIndices(new Set());
      setIsCropping(false);
      
      if (data.poeticSuggestedTitle) {
        setPoeticTitle(data.poeticSuggestedTitle);
        setOutfitTitle(data.poeticSuggestedTitle);
        // Find background outfit and update its title if it was the default one
        const hash = CryptoJS.MD5(photo).toString();
        const backgroundOutfit = allOutfits.find(o => o.photoHash === hash);
        if (backgroundOutfit && backgroundOutfit.id) {
          localDatabase.updateOutfit(backgroundOutfit.id, { 
            name: data.poeticSuggestedTitle, 
            dominantColor: analysisItems[0]?.color || "Multi" 
          });
        }
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      toast.error("L'analyse a échoué");
    } finally {
      setAnalyzing(false);
    }
  };

  const addManualItem = () => {
    const newItem = {
      item: {
        name: "",
        brand: "",
        category: "",
        type: "",
        color: "",
        style: "",
        season: "",
        description: "",
        careInstructions: ""
      },
      id: `manual-${Date.now()}`,
      isIgnored: false
    };
    if (editedResults) {
      setEditedResults([...editedResults, newItem]);
    } else {
      setEditedResults([newItem]);
    }
  };

  const updateItem = (id: string, field: string, value: string) => {
    if (!editedResults) return;
    const newResults = editedResults.map(res => 
      res.id === id ? { ...res, item: { ...res.item, [field]: value } } : res
    );
    setEditedResults(newResults);
  };

  const saveItem = async (id: string) => {
    if (!editedResults || !photo || !user) return;
    const res = editedResults.find(r => r.id === id);
    if (!res || savedIndices.has(id)) return;
    const item = res.item;

    try {
      const newItem = {
        ...item,
        imageUrl: item.croppedUrl || analyzedPhoto || photo,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      };

      const docId = Math.random().toString(36).substr(2, 9);
      localDatabase.saveClothing({ ...newItem, id: docId });
      setSavedDocIds(prev => ({ ...prev, [id]: docId }));
      const savedId = docId;

      // Link to outfit
      const hash = CryptoJS.MD5(photo).toString();
      const outfit = allOutfits.find(o => o.photoHash === hash);
      if (outfit && outfit.id) {
        const newItemIds = [...(outfit.itemIds || []), savedId];
        localDatabase.updateOutfit(outfit.id, { itemIds: newItemIds });
      }

      const newSavedIndices = new Set(savedIndices);
      newSavedIndices.add(id);
      setSavedIndices(newSavedIndices);
      toast.success(`${item.name || "Vêtement"} ajouté au dressing !`);

      // Check if all are saved (excluding ignored)
      const nonIgnored = editedResults.filter(r => !r.isIgnored);
      if (nonIgnored.length === 1) {
        onTabChange("wardrobe");
        reset();
      } else if (newSavedIndices.size === nonIgnored.length) {
        setTimeout(() => {
          onTabChange("wardrobe");
          reset();
        }, 2000);
      }
    } catch (err) {
      toast.error("Erreur lors de l'ajout au dressing");
      console.error(err);
    }
  };

  const undoSaveItem = async (id: string) => {
    if (!user) return;
    const docId = savedDocIds[id];
    if (!docId) return;

    try {
      localDatabase.deleteClothing(docId);

      // Unlink from outfit
      const hash = CryptoJS.MD5(photo).toString();
      const outfit = allOutfits.find(o => o.photoHash === hash);
      if (outfit && outfit.id) {
        const newItemIds = (outfit.itemIds || []).filter(id => id !== docId);
        localDatabase.updateOutfit(outfit.id, { itemIds: newItemIds });
      }

      const newSavedIndices = new Set(savedIndices);
      newSavedIndices.delete(id);
      setSavedIndices(newSavedIndices);
      
      const newSavedDocIds = { ...savedDocIds };
      delete newSavedDocIds[id];
      setSavedDocIds(newSavedDocIds);
      
      toast.info("Validation annulée");
    } catch (err) {
      toast.error("Impossible d'annuler l'ajout");
      console.error(err);
    }
  };

  const ignoreItem = (id: string) => {
    if (!editedResults) return;
    const newResults = editedResults.map(res => 
      res.id === id ? { ...res, isIgnored: !res.isIgnored } : res
    );
    
    // Sort so ignored ones move to bottom
    const sorted = [...newResults].sort((a, b) => {
      if (a.isIgnored && !b.isIgnored) return 1;
      if (!a.isIgnored && b.isIgnored) return -1;
      return 0;
    });
    
    setEditedResults(sorted);
    
    // If all are ignored, we don't reset automatically anymore as requested
    const item = newResults.find(r => r.id === id);
    if (item?.isIgnored) {
      toast.info("Vêtement déplacé en bas", { duration: 2000 });
    } else {
      toast.success("Vêtement restauré");
    }
  };

  const reset = () => {
    setPhoto(null);
    setAnalyzedPhoto(null);
    setResults(null);
    setEditedResults(null);
    setSavedIndices(new Set());
    setAnalyzing(false);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setIsCropping(false);
  };

  const saveAsOutfit = async (customPhoto?: string, isBackground: boolean = false) => {
    const photoToSave = customPhoto || photo;
    if (!photoToSave || !user) return;
    
    try {
      const hash = CryptoJS.MD5(photoToSave).toString();
      const existingOutfit = allOutfits.find(o => o.photoHash === hash);
      
      // Prevent background duplicates
      if (isBackground && existingOutfit) return;

      const tags = outfitHashtags.split(/[,\s]+/).map(t => t.trim().startsWith('#') ? t.trim() : `#${t.trim()}`).filter(t => t !== '#');
      const dominant = results && results.length > 0 ? results[0].color : "Multi";
      const finalTitle = outfitTitle || poeticTitle || (format(new Date(), "PP", { locale: fr }) + (outfitLocation ? ` - ${outfitLocation}` : ''));

      const outfitData = {
        name: finalTitle,
        itemIds: savedDocIds ? Object.values(savedDocIds) : (existingOutfit?.itemIds || []), 
        date: existingOutfit?.date || new Date().toISOString(),
        photoUrl: photoToSave,
        photoHash: hash,
        hashtags: tags,
        dominantColor: dominant,
        occasion: outfitLocation || "",
        userId: user.uid,
        updatedAt: new Date().toISOString(),
      };

      if (existingOutfit) {
        localDatabase.updateOutfit(existingOutfit.id!, outfitData);
      } else {
        const docId = Math.random().toString(36).substr(2, 9);
        localDatabase.saveOutfit({ ...outfitData, id: docId, createdAt: new Date().toISOString() } as any);
      }
      
      if (isBackground) {
        if (!existingOutfit) toast.success("Copié dans la galerie Outfits");
      } else {
        toast.success(existingOutfit ? "Tenue mise à jour !" : "Tenue enregistrée dans votre galerie !");
        setOutfitTitle("");
        setOutfitHashtags("");
        setOutfitLocation("");
        onTabChange("gallery");
      }
    } catch (err) {
      if (!isBackground) {
        toast.error("Erreur lors de l'enregistrement de la tenue");
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        try {
          const compressed = await compressImage(dataUrl);
          setPhoto(compressed);
          
          // Set default title and background save
          const defaultTitle = format(new Date(), "PP", { locale: fr }) + (outfitLocation ? ` - ${outfitLocation}` : '');
          setOutfitTitle(defaultTitle);
          setTimeout(() => saveAsOutfit(compressed, true), 100);
        } catch (err) {
          toast.error("Format d'image non supporté");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col items-center gap-4">
        {!photo && !stream && (
          <Card className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-zinc-100 border-dashed border-2 border-zinc-300 rounded-3xl overflow-hidden p-6 text-center">
            {cameraError ? (
              <div className="space-y-4 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-900 font-bold">Caméra bloquée</p>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Le navigateur refuse l'accès à votre caméra. Cela arrive souvent lorsque l'app est ouverte dans un aperçu bridé.
                  </p>
                </div>
                <div className="pt-2 space-y-2">
                  <Button variant="default" className="w-full rounded-xl bg-blue-600 hover:bg-blue-700" onClick={() => window.open(window.location.href, '_blank')}>
                    Ouvrir dans un nouvel onglet
                  </Button>
                  <Button variant="ghost" className="w-full text-zinc-400 text-xs" onClick={() => setCameraError(null)}>
                    Réessayer
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Camera className="w-12 h-12 text-zinc-400 mb-4" />
                <div className="space-y-3 w-full max-w-xs">
                  <Button onClick={startCamera} className="w-full rounded-xl h-12">
                    Ouvrir la caméra
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-zinc-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-zinc-100 px-2 text-zinc-400">Ou</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="w-full rounded-xl h-12 border-zinc-200 text-zinc-600"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choisir une photo
                  </Button>
                </div>
              </>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </Card>
        )}

        {stream && !photo && (
          <div className="relative w-full aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={switchCamera}
                className="rounded-full w-10 h-10 bg-black/40 backdrop-blur-md border-white/20 text-white hover:bg-black/60"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={stopCamera}
                className="rounded-full w-10 h-10 bg-black/40 backdrop-blur-md border-white/20 text-white hover:bg-black/60"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <button
                onClick={capture}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 backdrop-blur-sm active:scale-90 transition-transform"
              >
                <div className="w-16 h-16 rounded-full bg-white shadow-lg" />
              </button>
            </div>
          </div>
        )}

        {photo && (
          <div className="w-full space-y-4">
            <div className="relative rounded-3xl overflow-hidden bg-black shadow-2xl min-h-[300px] flex items-center justify-center">
              {analyzing && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white z-[60]">
                  <Loader2 className="w-10 h-10 animate-spin mb-2" />
                  <p className="font-medium text-lg">Analyse en cours...</p>
                </div>
              )}
              {isCropping ? (
                <div className="relative w-full h-full flex items-center justify-center bg-zinc-900/90">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    className="max-h-[60vh]"
                    aspect={undefined}
                    keepSelection
                  >
                    <img 
                      ref={imgRef}
                      src={photo} 
                      alt="Crop source" 
                      className="max-h-[60vh] w-auto object-contain select-none"
                    />
                  </ReactCrop>
                  <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => {
                        setIsCropping(false);
                        setCrop(undefined);
                        setCompletedCrop(undefined);
                      }}
                      className="rounded-full shadow-lg h-9"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Réinitialiser
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="relative w-full h-full group cursor-crosshair"
                  onClick={onImageClick}
                >
                  <img 
                    src={photo} 
                    alt="Captured" 
                    className="w-full h-full max-h-[60vh] object-contain transition-all duration-300 group-hover:brightness-90"
                  />
                  {!results && !analyzing && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 flex items-center gap-3">
                        <CropIcon className="w-5 h-5 text-white" />
                        <span className="text-white font-bold text-sm tracking-tight">Cliquez pour cibler</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!results && !analyzing && (
              <div className="flex flex-col gap-4">
                {duplicateOutfit && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-start gap-3 text-amber-800 text-xs"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold mb-1">Attention : Déjà enregistré</p>
                      <p>Cette photo semble être déjà présente dans votre galerie sous le nom : <strong>{duplicateOutfit.name}</strong></p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-amber-900 font-bold underline mt-1"
                        onClick={() => onTabChange("gallery")}
                      >
                        Voir dans la galerie
                      </Button>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-4 bg-zinc-50 p-4 rounded-3xl border border-zinc-100">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase px-1">
                      <Type className="w-3 h-3" /> Titre de la tenue
                    </Label>
                    <Input 
                      placeholder="Ex: Look de soirée..." 
                      value={outfitTitle}
                      onChange={(e) => setOutfitTitle(e.target.value)}
                      className="rounded-xl border-zinc-200 h-10 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase px-1">
                        <MapPinIcon className="w-3 h-3" /> Lieu / Occasion
                      </Label>
                      <Input 
                        placeholder="Paris, France..." 
                        value={outfitLocation}
                        onChange={(e) => setOutfitLocation(e.target.value)}
                        className="rounded-xl border-zinc-200 h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase px-1">
                        <Hash className="w-3 h-3" /> Hashtags
                      </Label>
                      <Input 
                        placeholder="#chic #soirée..." 
                        value={outfitHashtags}
                        onChange={(e) => setOutfitHashtags(e.target.value)}
                        className="rounded-xl border-zinc-200 h-10 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={() => saveAsOutfit()}
                  className="w-full rounded-2xl h-14 bg-zinc-900 hover:bg-zinc-800 text-white font-bold shadow-xl transition-all"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Enregistrer dans ma galerie
                </Button>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={reset} className="flex-1 rounded-xl h-12 border-zinc-200">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Recommencer
                  </Button>
                  <Button 
                    onClick={() => analyze()} 
                    disabled={analyzing}
                    className="flex-1 rounded-xl h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-bold"
                  >
                    {analyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      isCropping ? "Analyser la sélection" : "Analyser tout"
                    )}
                  </Button>
                </div>
                {!isCropping && (
                  <p className="text-center text-[10px] text-zinc-400 font-medium">
                    💡 ASTUCE : Cliquez sur l'image pour cadrer le sujet comme sur Pinterest
                  </p>
                )}
              </div>
            )}

            {editedResults && (
              <div className="space-y-6 w-full max-w-sm mx-auto">
                <div className="px-1 mb-2 text-center">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                    Swipez à droite pour ajouter • Gauche pour ignorer
                  </p>
                </div>
                <AnimatePresence mode="popLayout">
                  {editedResults.map((res) => (
                    <ClothingCard 
                      key={res.id}
                      item={res.item}
                      id={res.id}
                      isSaved={savedIndices.has(res.id)}
                      isIgnored={res.isIgnored}
                      isDuplicate={checkIsDuplicate(res.item)}
                      onSave={saveItem}
                      onIgnore={ignoreItem}
                      onUndo={undoSaveItem}
                      onUpdate={updateItem}
                      onAddBrand={addCustomBrand}
                      popularBrands={combinedBrands}
                    />
                  ))}
                </AnimatePresence>

                <div className="flex flex-col gap-3 py-4">
                  <Button 
                    variant="outline" 
                    onClick={addManualItem}
                    className="w-full rounded-xl h-12 border-dashed border-2 border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un vêtement manuellement
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    onClick={reset}
                    className="w-full rounded-xl h-12 text-zinc-400"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tout recommencer
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
