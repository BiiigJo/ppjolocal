import { useState, useEffect, useRef } from "react";
import { ClothingItem } from "@/types";
import { suggestOutfits } from "@/lib/gemini";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2, Plus, Calendar as CalendarIcon, Shirt, X, Check, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { localDatabase } from "@/lib/local-db";
import WeatherWidget from "./WeatherWidget";

import { WeatherData } from "@/lib/weather";

interface OutfitGeneratorProps {
  user: any;
  weather?: WeatherData | null;
  savedOccasion: string;
  setSavedOccasion: (o: string) => void;
  savedSuggestions: any[];
  setSavedSuggestions: (s: any[]) => void;
  savedDates: Date[];
  setSavedDates: (d: Date[]) => void;
  ignoredIds: Set<string>;
  setIgnoredIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  seedItemId?: string | null;
  onClearSeed?: () => void;
  setSeedItemId?: (id: string | null) => void;
}

export default function OutfitGenerator({ 
  user, 
  weather,
  savedOccasion,
  setSavedOccasion,
  savedSuggestions,
  setSavedSuggestions,
  savedDates,
  setSavedDates,
  ignoredIds,
  setIgnoredIds,
  seedItemId,
  onClearSeed,
  setSeedItemId
}: OutfitGeneratorProps) {
  const [wardrobe, setWardrobe] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDailySuggestion, setIsDailySuggestion] = useState(false);
  const [savedOutfitsMap, setSavedOutfitsMap] = useState<Record<string, string>>({});
  const generateBtnRef = useRef<HTMLDivElement>(null);
  const [internalWeather, setInternalWeather] = useState<WeatherData | null>(weather || null);
  const [lastCriteria, setLastCriteria] = useState<{ occasion: string, dates: string[], seedItemId: string | null } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("last_outfit_generation");
    if (saved) {
      try {
        setLastCriteria(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse last criteria", e);
      }
    }
  }, []);

  useEffect(() => {
    if (weather) setInternalWeather(weather);
  }, [weather]);

  // Sync saved outfits status
  useEffect(() => {
    const updateMap = () => {
      const outfits = localDatabase.getOutfits();
      const map: Record<string, string> = {};
      outfits.forEach(o => {
        if (o.name) map[o.name] = o.id || "";
      });
      setSavedOutfitsMap(map);
    };

    updateMap();
    return localDatabase.subscribe(updateMap);
  }, []);

  useEffect(() => {
    const refresh = () => {
      setWardrobe(localDatabase.getClothing());
    };
    refresh();
    return localDatabase.subscribe(refresh);
  }, []);

  // Daily suggestion logic (Manual trigger only)
  /* Removed auto-trigger useEffect */

  const generateDailySuggestion = async () => {
    // Diagnostic log
    console.log("generateDailySuggestion called", { wardrobeLength: wardrobe.length, loading });

    if (loading) return;

    if (wardrobe.length < 3) {
      toast.error("Dressing trop vide", {
        description: "Ajoutez au moins 3 vêtements pour que l'IA puisse créer des tenues."
      });
      return;
    }

    const toastId = toast.loading("L'IA prépare votre tenue du jour...");
    setLoading(true);
    setIsDailySuggestion(true);
    
    try {
      // Save criteria to history
      const criteria = {
        occasion: "Ma tenue du jour (Style quotidien)",
        dates: (savedDates || [new Date()]).map(d => d instanceof Date ? d.toISOString() : new Date(d).toISOString()),
        seedItemId: seedItemId || null
      };
      localStorage.setItem("last_outfit_generation", JSON.stringify(criteria));
      setLastCriteria(criteria);

      // Scroll to the results area
      if (generateBtnRef.current) {
        generateBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      const weatherText = internalWeather ? `${internalWeather.temp}°C, ${internalWeather.condition}` : undefined;
      const seedItem = seedItemId ? wardrobe.find(i => i.id === seedItemId) : undefined;
      
      const res = await suggestOutfits(wardrobe, "Ma tenue du jour (Style quotidien)", weatherText, seedItem);
      
      if (!res || !Array.isArray(res) || res.length === 0) {
        throw new Error("Réponse vide de l'IA");
      }
      
      setSavedSuggestions(res);
      toast.success("Votre look du jour est prêt !", { id: toastId });
    } catch (err: any) {
      console.error("Daily generation error:", err);
      const errorMessage = err?.message?.includes("API_KEY") 
        ? "Configuration IA manquante" 
        : "L'IA est momentanément indisponible";
      
      toast.error(errorMessage, { 
        id: toastId,
        description: "Réessayez dans quelques instants."
      });
    } finally {
      setLoading(false);
    }
  };

  const generate = async () => {
    if (loading) return;

    if (!savedOccasion) {
      toast.error("Précisez l'occasion", { description: "Ex: Un mariage, une soirée..." });
      return;
    }
    if (wardrobe.length < 3) {
      toast.error("Dressing trop vide", { description: "Ajoutez au moins 3 vêtements." });
      return;
    }

    const toastId = toast.loading("Génération en cours...");
    setLoading(true);
    setIsDailySuggestion(false);
    
    try {
      const criteria = {
        occasion: savedOccasion,
        dates: (savedDates || [new Date()]).map(d => d instanceof Date ? d.toISOString() : new Date(d).toISOString()),
        seedItemId: seedItemId || null
      };
      localStorage.setItem("last_outfit_generation", JSON.stringify(criteria));
      setLastCriteria(criteria);

      const weatherText = internalWeather ? `${internalWeather.temp}°C, ${internalWeather.condition}` : undefined;
      const seedItem = seedItemId ? wardrobe.find(i => i.id === seedItemId) : undefined;
      
      const res = await suggestOutfits(wardrobe, savedOccasion, weatherText, seedItem);
      
      if (!res || !Array.isArray(res) || res.length === 0) {
        throw new Error("Réponse vide de l'IA");
      }

      setSavedSuggestions(res);
      toast.success("Suggestions générées !", { id: toastId });
    } catch (err: any) {
      console.error("Generation error:", err);
      toast.error("Erreur de génération", { 
        id: toastId,
        description: "Vérifiez votre connexion ou réessayez plus tard."
      });
    } finally {
      setLoading(false);
    }
  };

  const saveOutfit = async (suggestion: any) => {
    if (!user) return;
    
    // Match suggestion items with wardrobe IDs
    const itemIds = suggestion.items.map((itemName: string) => {
      const match = wardrobe.find(w => w.name.toLowerCase().includes(itemName.toLowerCase()) || 
                                       itemName.toLowerCase().includes(w.name.toLowerCase()));
      return match?.id;
    }).filter(Boolean);

    if (itemIds.length === 0) {
      toast.error("Impossible de faire correspondre les vêtements suggérés avec votre dressing");
      return;
    }

    try {
      const newOutfits = savedDates.map(date => ({
        name: suggestion.name,
        itemIds,
        date: format(date, "yyyy-MM-dd"),
        photoUrl: "", // Virtual outfit
        photoHash: `virtual-${suggestion.name}-${date.getTime()}`,
        hashtags: ["#suggestion", "#style"],
        dominantColor: "Virtual",
        occasion: isDailySuggestion ? "Look du jour" : savedOccasion,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      }));

      newOutfits.forEach(outfit => {
        const docId = Math.random().toString(36).substr(2, 9);
        localDatabase.saveOutfit({ ...outfit, id: docId });
      });
      toast.success(`Tenue enregistrée pour ${savedDates.length} jour(s) dans votre galerie !`);
      setSavedOutfitsMap(prev => ({ ...prev, [suggestion.name]: "local-saved" }));
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
      console.error(err);
    }
  };

  const removeOutfit = async (suggestionName: string) => {
    // Note: When multiple dates were selected, we might have multiple docs.
    // For simplicity, we just clear the local state to allow re-saving.
    // In a real app, we'd find and delete all matching docs for these dates.
    setSavedOutfitsMap(prev => {
      const next = { ...prev };
      delete next[suggestionName];
      return next;
    });
    toast.info("État réinitialisé. Pour supprimer physiquement, allez dans l'onglet Outfits.");
  };

  const toggleSave = (suggestion: any) => {
    if (savedOutfitsMap[suggestion.name]) {
      removeOutfit(suggestion.name);
    } else {
      // Clear ignore if saving
      setIgnoredIds(prev => {
        const next = new Set(prev);
        next.delete(suggestion.name);
        return next;
      });
      saveOutfit(suggestion);
    }
  };

  const getMatchedItem = (itemName: string) => {
    return wardrobe.find(w => 
      w.name.toLowerCase().includes(itemName.toLowerCase()) || 
      itemName.toLowerCase().includes(w.name.toLowerCase())
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <WeatherWidget onWeatherChange={setInternalWeather} />

      <AnimatePresence>
        {seedItemId && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-zinc-900 text-white p-4 rounded-3xl shadow-xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Shirt className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Suggérer pour</p>
                <p className="text-sm font-bold truncate max-w-[150px]">
                  {wardrobe.find(i => i.id === seedItemId)?.name || "Vêtement"}
                </p>
              </div>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={onClearSeed}
              className="rounded-full hover:bg-white/10 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={generateDailySuggestion}
          disabled={loading}
          className="flex-1 h-12 rounded-2xl border-amber-100 bg-amber-50/50 text-amber-900 hover:bg-amber-100 transition-all font-bold group"
        >
          <Sparkles className="w-5 h-5 mr-2 text-amber-500 group-hover:scale-110 transition-transform" />
          Proposition du jour
        </Button>
      </div>

      <Card className="p-6 rounded-3xl border-none shadow-sm bg-white space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-900">Pour quel événement ?</label>
          <Input
            placeholder="Ex: Un mariage, un entretien, une soirée..."
            value={savedOccasion}
            onChange={(e) => setSavedOccasion(e.target.value)}
            className="rounded-xl border-zinc-100 h-12"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-900">Pour quel(s) jour(s) ?</label>
          <Popover>
            <PopoverTrigger className="w-full justify-start text-left font-normal h-12 rounded-xl border border-zinc-100 px-4 flex items-center gap-2 bg-white hover:bg-zinc-50 transition-colors">
              <CalendarIcon className="h-4 w-4 text-zinc-400" />
              <div className="flex-1 truncate">
                {savedDates?.length > 0 ? (
                  savedDates.length === 1 
                    ? format(savedDates[0], "PPP", { locale: fr })
                    : `${savedDates.length} jours sélectionnés`
                ) : (
                  <span>Choisir des dates</span>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="multiple"
                captionLayout="dropdown"
                selected={savedDates}
                onSelect={(dates) => dates && setSavedDates(dates)}
                fromYear={2020}
                toYear={2100}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div ref={generateBtnRef}>
          <Button 
            onClick={generate} 
            disabled={loading || !savedOccasion} 
            className="w-full h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-5 h-5 mr-2" />
            )}
            Générer des tenues
          </Button>
        </div>

        {lastCriteria && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-2 border-t border-zinc-50"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Dernière recherche</p>
            <button
              onClick={() => {
                setSavedOccasion(lastCriteria.occasion);
                setSavedDates(lastCriteria.dates.map(d => new Date(d)));
                if (setSeedItemId) setSeedItemId(lastCriteria.seedItemId);
                toast.info("Critères chargés !");
              }}
              className="w-full text-left p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors group"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <RotateCcw className="w-3 h-3 text-zinc-400 group-hover:rotate-[-45deg] transition-transform" />
                <p className="text-xs font-medium text-zinc-600 truncate flex-1">
                  {lastCriteria.occasion} 
                  <span className="mx-1.5 opacity-30">•</span>
                  {lastCriteria.dates.length}j
                  {lastCriteria.seedItemId && (
                    <>
                      <span className="mx-1.5 opacity-30">•</span>
                      {wardrobe.find(i => i.id === lastCriteria.seedItemId)?.name || "Vêtement"}
                    </>
                  )}
                </p>
              </div>
            </button>
          </motion.div>
        )}
      </Card>

      <div className="space-y-6 pb-20">
        <AnimatePresence mode="popLayout">
          {savedSuggestions.map((suggestion, idx) => (
            <motion.div
              key={`${suggestion.name}-${idx}`}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <SuggestionCard 
                suggestion={suggestion}
                isDailySuggestion={isDailySuggestion}
                isSaved={!!savedOutfitsMap[suggestion.name]}
                isIgnored={ignoredIds.has(suggestion.name)}
                onToggleSave={() => toggleSave(suggestion)}
                onIgnore={() => {
                  setIgnoredIds(prev => {
                    const next = new Set(prev);
                    if (next.has(suggestion.name)) {
                      next.delete(suggestion.name);
                    } else {
                      next.add(suggestion.name);
                    }
                    return next;
                  });
                }}
                getMatchedItem={getMatchedItem}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function SuggestionCard({ 
  suggestion, 
  isDailySuggestion, 
  isSaved, 
  isIgnored,
  onToggleSave,
  onIgnore,
  getMatchedItem 
}: { 
  suggestion: any;
  isDailySuggestion: boolean;
  isSaved: boolean;
  isIgnored: boolean;
  onToggleSave: () => void;
  onIgnore: () => void;
  getMatchedItem: (name: string) => any;
}) {
  const x = useMotionValue(0);
  const opacityLeft = useTransform(x, [-100, -50], [1, 0]);
  const opacityRight = useTransform(x, [50, 100], [0, 1]);
  const scaleLeft = useTransform(x, [-100, -50], [1.2, 1]);
  const scaleRight = useTransform(x, [50, 100], [1, 1.2]);

  return (
    <div className="relative">
      {/* Swipe Indicators */}
      <div className="absolute inset-0 rounded-[2rem] overflow-hidden flex justify-between pointer-events-none">
        <motion.div 
          style={{ opacity: opacityLeft }}
          className="w-1/2 bg-zinc-100 flex items-center justify-start pl-8 text-zinc-400"
        >
          <motion.div style={{ scale: scaleLeft }}>
            <Trash2 className="w-8 h-8" />
          </motion.div>
        </motion.div>
        <motion.div 
          style={{ opacity: opacityRight }}
          className="w-1/2 bg-green-50 flex items-center justify-end pr-8 text-green-500"
        >
          <motion.div style={{ scale: scaleRight }}>
            <Check className="w-8 h-8" />
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        layout
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={(_, info) => {
          if (info.offset.x > 100) {
            // Swipe right: Always clear ignore, and save if not already saved
            if (isIgnored) onIgnore();
            if (!isSaved) onToggleSave();
          } else if (info.offset.x < -100) {
            onIgnore();
          }
        }}
        className={`touch-pan-y select-none cursor-grab active:cursor-grabbing transition-opacity duration-300 ${isIgnored ? 'opacity-60 grayscale-[0.3]' : 'opacity-100'}`}
      >
        <Card className="overflow-hidden rounded-[2rem] border-none shadow-lg bg-white group/card relative">
          <div className="p-6 space-y-6">
            {/* Header: Title above */}
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-zinc-900 tracking-tight leading-tight">
                  {suggestion.name}
                </h3>
                {isDailySuggestion && (
                  <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest pl-0.5">
                    Proposition du jour
                  </span>
                )}
              </div>
              <Button 
                size="sm" 
                variant={isIgnored ? "outline" : isSaved ? "secondary" : "default"}
                className={`rounded-full h-9 px-4 text-xs font-bold transition-all duration-300 ${
                  isIgnored ? 'border-zinc-200 text-zinc-400 bg-zinc-50 hover:bg-zinc-100' :
                  isSaved ? 'bg-zinc-100 text-zinc-500' : 
                  'bg-zinc-900 text-white hover:scale-105'
                }`}
                onClick={isIgnored ? onIgnore : onToggleSave}
              >
                {isIgnored ? "Ignoré" : isSaved ? "Enregistré" : <><Plus className="w-4 h-4 mr-1.5" />Enregistrer</>}
              </Button>
            </div>
            
            {/* Visual Composition: Responsive Grid */}
            <div className="grid grid-cols-3 gap-3">
              {suggestion.items.length > 0 && (() => {
                const firstItem = getMatchedItem(suggestion.items[0]);
                const sideItems = suggestion.items.slice(1, 3);
                
                return (
                  <>
                    {/* Main Image: Enforced square aspect ratio to match side items perfectly */}
                    <div className="col-span-2 row-span-2 relative aspect-square rounded-3xl overflow-hidden bg-zinc-50 border border-zinc-100 shadow-sm group">
                      {firstItem ? (
                        <img 
                          src={firstItem.imageUrl} 
                          alt={suggestion.items[0]} 
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-300 gap-2">
                          <Shirt className="w-8 h-8 opacity-20" />
                        </div>
                      )}
                    </div>

                    {/* Side Items: One per column (stacks in col 3 on tablet+) */}
                    {sideItems.map((itemName: string, i: number) => {
                      const matched = getMatchedItem(itemName);
                      return (
                        <div key={i} className="col-span-1 relative aspect-square rounded-2xl overflow-hidden bg-zinc-50 border border-zinc-100 shadow-sm group">
                          {matched ? (
                            <img 
                              src={matched.imageUrl} 
                              alt={itemName} 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-200">
                              <Shirt className="w-6 h-6 opacity-30" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            {/* Footer: Description under images */}
            <div className="space-y-3">
              <p className="text-zinc-500 text-sm leading-snug italic pr-2">
                "{suggestion.explanation}"
              </p>
              
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestion.items.map((itemName: string, i: number) => (
                  <span key={i} className="text-[9px] font-bold text-zinc-400 bg-zinc-50/50 border border-zinc-100 px-2.5 py-0.5 rounded-full uppercase tracking-tighter">
                    {itemName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
