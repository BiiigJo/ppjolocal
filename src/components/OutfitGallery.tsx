import { useState, useEffect, useMemo } from "react";
import { Outfit, ClothingItem } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Calendar as CalendarIcon, MapPin, Filter, X, Share2, MessageCircle, RefreshCw, Search, Sparkles, ChevronLeft, ChevronRight, Share } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDate, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localDatabase } from "@/lib/local-db";

interface OutfitGalleryProps {
  user: any;
  onReScan?: (photo: string) => void;
  filterItemId?: string | null;
  onClearFilter?: () => void;
}

function ImageWithLoading({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-100 animate-pulse flex items-center justify-center">
          <Search className="w-6 h-6 text-zinc-200" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

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

export default function OutfitGallery({ user, onReScan, filterItemId, onClearFilter }: OutfitGalleryProps) {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [clothingItems, setClothingItems] = useState<Record<string, ClothingItem>>({});
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const handleUpdateName = async (outfit: Outfit) => {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }

    try {
      localDatabase.updateOutfit(outfit.id!, { name: editingName });
      setOutfits(localDatabase.getOutfits());
      toast.success("Titre mis à jour");
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setEditingId(null);
    }
  };

  const handleShare = async (outfit: Outfit) => {
    const shareData = {
      title: outfit.name,
      text: `Regarde cette tenue StyleScan : ${outfit.name}${outfit.occasion ? ` pour ${outfit.occasion}` : ''}!`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast.success("Lien de partage copié dans le presse-papier !");
      } catch (err) {
        toast.error("Impossible de partager");
      }
    }
  };

  // Filter states
  const [filterColor, setFilterColor] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeason, setFilterSeason] = useState<string>("all");
  const [filterOccasion, setFilterOccasion] = useState<string>("all");

  // Local date for navigation if no outfits are present
  const [navDate, setNavDate] = useState<Date>(new Date());

  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  useEffect(() => {
    if (outfits.length > 0 && !expandedMonth && !hasAutoExpanded) {
      setExpandedMonth(format(new Date(outfits[0].date), "MMMM yyyy", { locale: fr }));
      setHasAutoExpanded(true);
    }
  }, [outfits, expandedMonth, hasAutoExpanded]);

  useEffect(() => {
    const refresh = () => {
      const items: Record<string, ClothingItem> = {};
      localDatabase.getClothing().forEach(item => {
        items[item.id] = item;
      });
      setClothingItems(items);
      
      const newOutfits = localDatabase.getOutfits();
      // Local sort
      newOutfits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOutfits(newOutfits);
      setLoading(false);
    };
    refresh();
    return localDatabase.subscribe(refresh);
  }, []);

  const deleteOutfit = async (id: string) => {
    try {
      localDatabase.deleteOutfit(id);
      setOutfits(localDatabase.getOutfits());
      toast.success("Tenue supprimée");
    } catch (err) {
      toast.error("Erreur lors de la suppression");
      console.error(err);
    }
  };

  // Extract filter options
  const filterOptions = useMemo(() => {
    const colors = new Set<string>();
    const types = new Set<string>();
    const seasons = new Set<string>();
    const occasions = new Set<string>();

    Object.values(clothingItems).forEach(item => {
      if (item.color) colors.add(item.color);
      if (item.type) types.add(item.type);
      if (item.season) seasons.add(item.season);
    });

    outfits.forEach(outfit => {
      if (outfit.occasion) occasions.add(outfit.occasion);
    });

    return {
      colors: Array.from(colors).sort(),
      types: Array.from(types).sort(),
      seasons: Array.from(seasons).sort(),
      occasions: Array.from(occasions).sort(),
    };
  }, [clothingItems, outfits]);

  const filteredOutfits = useMemo(() => {
    return outfits.filter(outfit => {
      const items = outfit.itemIds.map(id => clothingItems[id]).filter(Boolean);
      const outfitDate = new Date(outfit.date);
      
      const matchesColor = filterColor === "all" || 
        (outfit.dominantColor ? outfit.dominantColor === filterColor : items.some(item => item.color === filterColor));
      const matchesType = filterType === "all" || items.some(item => item.type === filterType);
      const matchesSeason = filterSeason === "all" || items.some(item => item.season === filterSeason);
      const matchesOccasion = filterOccasion === "all" || outfit.occasion === filterOccasion;
      const matchesDate = !selectedDate || isSameDay(outfitDate, selectedDate);
      const matchesGalleryItem = !filterItemId || outfit.itemIds.includes(filterItemId);

      return matchesColor && matchesType && matchesSeason && matchesOccasion && matchesDate && matchesGalleryItem;
    });
  }, [outfits, clothingItems, filterColor, filterType, filterSeason, filterOccasion, selectedDate, filterItemId]);

  const resetFilters = () => {
    setFilterColor("all");
    setFilterType("all");
    setFilterSeason("all");
    setFilterOccasion("all");
    setSelectedDate(null);
    if (onClearFilter) onClearFilter();
  };

  const groupedOutfits = useMemo(() => {
    const groups: Record<string, Outfit[]> = {};
    filteredOutfits.forEach(outfit => {
      const month = format(new Date(outfit.date), "MMMM yyyy", { locale: fr });
      if (!groups[month]) groups[month] = [];
      groups[month].push(outfit);
    });
    return groups;
  }, [filteredOutfits]);

  const goToNext = (e: React.MouseEvent, baseMonth: string) => {
    e.stopPropagation();
    const availableMonths = Object.keys(groupedOutfits);
    const currentIndex = availableMonths.indexOf(baseMonth);
    
    // In our descending list (Future at top), "Next" (future) is at currentIndex - 1
    if (currentIndex > 0) {
      const targetMonth = availableMonths[currentIndex - 1];
      setExpandedMonth(targetMonth);
      const el = document.getElementById(`month-${targetMonth}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      // If we are at the top, maybe try to go to the next chronological month even if empty?
      // For now, toast is better to avoid "dead" jumps
      toast.info("C'est déjà le mois le plus récent avec du contenu", { duration: 2000 });
    }
  };

  const goToPrev = (e: React.MouseEvent, baseMonth: string) => {
    e.stopPropagation();
    const availableMonths = Object.keys(groupedOutfits);
    const currentIndex = availableMonths.indexOf(baseMonth);
    
    // In our descending list (Past at bottom), "Prev" (past) is at currentIndex + 1
    if (currentIndex !== -1 && currentIndex < availableMonths.length - 1) {
      const targetMonth = availableMonths[currentIndex + 1];
      setExpandedMonth(targetMonth);
      const el = document.getElementById(`month-${targetMonth}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      toast.info("C'est déjà le mois le plus ancien avec du contenu", { duration: 2000 });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4">
        {filterItemId && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 text-white p-4 rounded-3xl flex items-center justify-between shadow-xl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/20">
                {clothingItems[filterItemId] && (
                  <img src={clothingItems[filterItemId].imageUrl} className="w-full h-full object-cover" alt="Filter" />
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase opacity-60">Filtré par vêtement</p>
                <p className="font-bold">{clothingItems[filterItemId]?.name || "Vêtement"}</p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={onClearFilter}
              className="rounded-full h-8 px-4 font-bold"
            >
              Enlever
            </Button>
          </motion.div>
        )}

        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900">Ma Galerie</h2>
          <Button 
            variant={showFilters ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-full"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtres
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="p-4 rounded-2xl border-zinc-100 bg-white shadow-sm space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Couleur</label>
                    <Select value={filterColor} onValueChange={setFilterColor}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white border-zinc-100 shadow-sm">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-100 shadow-xl">
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full border border-zinc-100 bg-zinc-200" />
                             Tous
                          </div>
                        </SelectItem>
                        {filterOptions.colors.map(c => (
                          <SelectItem key={c} value={c}>
                            <div className="flex items-center gap-2 capitalize">
                               <div className="w-3 h-3 rounded-full border border-black/5" style={{ background: getColorHex(c) }} />
                               {c}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Type</label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white border-zinc-100 shadow-sm">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-100 shadow-xl">
                        <SelectItem value="all">Tous</SelectItem>
                        {filterOptions.types.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Saison</label>
                    <Select value={filterSeason} onValueChange={setFilterSeason}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white border-zinc-100 shadow-sm">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-100 shadow-xl">
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="Printemps">Printemps</SelectItem>
                        <SelectItem value="Été">Été</SelectItem>
                        <SelectItem value="Automne">Automne</SelectItem>
                        <SelectItem value="Hiver">Hiver</SelectItem>
                        <SelectItem value="4 Saisons">4 Saisons</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Occasion</label>
                    <Select value={filterOccasion} onValueChange={setFilterOccasion}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white border-zinc-100 shadow-sm">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-100 shadow-xl">
                        <SelectItem value="all">Tous</SelectItem>
                        {filterOptions.occasions.map(o => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={resetFilters} className="w-full text-xs text-zinc-500 hover:text-zinc-900">
                  <X className="w-3 h-3 mr-2" />
                  Réinitialiser les filtres
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {filteredOutfits.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200 px-6">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-zinc-300" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 mb-1">Aucune tenue trouvée</h3>
          <p className="text-zinc-400 text-sm mb-6">
            {filterItemId 
              ? "Vous n'avez pas encore enregistré de photo avec ce vêtement."
              : "Aucune tenue ne correspond à vos filtres sélectionnés."}
          </p>
          {(filterColor !== "all" || filterType !== "all" || filterSeason !== "all" || filterOccasion !== "all" || selectedDate || filterItemId) && (
            <Button variant="outline" onClick={resetFilters} className="rounded-xl border-zinc-200 font-bold">
              Effacer tous les filtres
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedOutfits).map(([month, monthOutfits]) => {
            const isExpanded = expandedMonth === month;
            const monthDate = new Date(monthOutfits[0].date);
            const daysInMonth = eachDayOfInterval({
              start: startOfMonth(monthDate),
              end: endOfMonth(monthDate)
            });

            return (
              <div key={month} id={`month-${month}`} className="space-y-4 scroll-mt-20">
                <div className="flex items-center justify-between px-1">
                  <button 
                    onClick={() => setExpandedMonth(isExpanded ? null : month)}
                    className="flex items-center gap-2 group cursor-pointer text-left focus:outline-none"
                  >
                    <h2 className="text-lg sm:text-xl font-bold text-zinc-900 capitalize group-hover:text-zinc-500 transition-colors">
                      {month}
                    </h2>
                    <CalendarIcon className={`w-4 h-4 text-zinc-300 group-hover:text-zinc-900 transition-all ${isExpanded ? 'scale-125 text-zinc-900' : ''}`} />
                  </button>
                  
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full w-8 h-8 hover:bg-zinc-100"
                      onClick={(e) => goToPrev(e, month)}
                    >
                      <ChevronLeft className="w-4 h-4 text-zinc-400" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full w-8 h-8 hover:bg-zinc-100"
                      onClick={(e) => goToNext(e, month)}
                    >
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </Button>
                  </div>
                </div>

                 <AnimatePresence mode="popLayout">
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, scale: 0.98 }}
                      animate={{ opacity: 1, height: 'auto', scale: 1 }}
                      exit={{ opacity: 0, height: 0, scale: 0.98 }}
                      className="overflow-hidden"
                    >
                      <div className="relative group/calendar">
                        {/* Scroll Arrows Desktop */}
                        <div className="hidden md:flex absolute inset-y-0 left-0 items-center justify-start pointer-events-none z-10">
                          <Button 
                            variant="secondary" 
                            size="icon" 
                            className="rounded-full w-8 h-8 ml-2 pointer-events-auto shadow-md opacity-0 group-hover/calendar:opacity-100 transition-opacity"
                            onClick={(e) => {
                              const container = e.currentTarget.parentElement?.nextElementSibling as HTMLElement;
                              container.scrollBy({ left: -200, behavior: 'smooth' });
                            }}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="hidden md:flex absolute inset-y-0 right-0 items-center justify-end pointer-events-none z-10">
                          <Button 
                            variant="secondary" 
                            size="icon" 
                            className="rounded-full w-8 h-8 mr-2 pointer-events-auto shadow-md opacity-0 group-hover/calendar:opacity-100 transition-opacity"
                            onClick={(e) => {
                              const container = e.currentTarget.parentElement?.previousElementSibling as HTMLElement;
                              container.scrollBy({ left: 200, behavior: 'smooth' });
                            }}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex gap-2 p-2 overflow-x-auto scrollbar-hide bg-zinc-50 rounded-3xl mb-4 border border-zinc-100 scroll-smooth snap-x">
                          {daysInMonth.map(day => {
                            const hasOutfits = outfits.some(o => isSameDay(new Date(o.date), day));
                            const isSelected = selectedDate && isSameDay(day, selectedDate);
                            
                            return (
                              <button
                                key={day.toISOString()}
                                disabled={!hasOutfits}
                                onClick={() => setSelectedDate(isSelected ? null : day)}
                                className={`flex flex-col items-center justify-center h-12 rounded-2xl transition-all snap-start ${
                                  hasOutfits ? 'min-w-[38px] cursor-pointer' : 'min-w-[28px] cursor-default'
                                } ${
                                  isSelected 
                                    ? 'bg-zinc-900 text-white shadow-lg' 
                                    : hasOutfits 
                                      ? 'bg-white hover:bg-zinc-100 text-zinc-400' 
                                      : 'bg-transparent text-zinc-200'
                                }`}
                              >
                                <span className={`text-[9px] font-bold uppercase opacity-60 ${!hasOutfits ? 'scale-75' : ''}`}>
                                  {format(day, "eee", { locale: fr }).substring(0, 1)}
                                </span>
                                <div className={`relative flex items-center justify-center w-6 h-6 mt-0.5 rounded-full ${
                                  hasOutfits && !isSelected ? 'border-2 border-zinc-900/10' : ''
                                }`}>
                                  <span className={`text-sm font-bold ${!hasOutfits ? 'scale-75' : ''}`}>{getDate(day)}</span>
                                  {hasOutfits && (
                                    <div className={`absolute -bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-zinc-900'}`} />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4">
                  {monthOutfits.map((outfit) => (
                    <Card key={outfit.id || `outfit-${outfit.createdAt}-${Math.random()}`} className="overflow-hidden rounded-3xl border-none shadow-sm bg-white">
                        <div className="p-4 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                                <CalendarIcon className="w-3 h-3" />
                                <span>{format(new Date(outfit.date), "EEEE d MMMM", { locale: fr })}</span>
                              </div>
                              <div className="flex flex-col">
                                {editingId === outfit.id ? (
                                  <div className="flex items-center gap-2 mt-1">
                                    <Input 
                                      autoFocus
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      onBlur={() => handleUpdateName(outfit)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateName(outfit);
                                        if (e.key === 'Escape') setEditingId(null);
                                      }}
                                      className="h-8 font-bold text-base bg-zinc-50 border-zinc-200"
                                    />
                                  </div>
                                ) : (
                                  <span 
                                    className="text-zinc-900 font-bold text-base leading-tight cursor-text py-1"
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setEditingId(outfit.id!);
                                      setEditingName(outfit.name);
                                    }}
                                  >
                                    {outfit.name}
                                  </span>
                                )}
                                {outfit.occasion && outfit.occasion !== "" && (
                                  <div className="flex items-center gap-1 text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                    <MapPin className="w-3 h-3" />
                                    <span>{outfit.occasion}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50"
                            onClick={() => handleShare(outfit)}
                          >
                            <Share className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50"
                            onClick={() => setConfirmDeleteId(outfit.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {outfit.photoUrl && (
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-50 group cursor-pointer" onClick={() => setSelectedOutfitId(outfit.id || null)}>
                          <ImageWithLoading 
                            src={outfit.photoUrl} 
                            alt={outfit.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                            <p className="text-white text-xs font-bold uppercase tracking-widest mb-1">Photo originale du scan</p>
                            <p className="text-white/70 text-[10px]">Cliquer pour agrandir</p>
                          </div>
                        </div>
                      )}

                      {outfit.hashtags && outfit.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {outfit.hashtags.map((tag, idx) => (
                            <span key={`${outfit.id}-${tag}-${idx}`} className="text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {outfit.itemIds.length > 0 ? outfit.itemIds.map((itemId, index) => {
                          const item = clothingItems[itemId];
                          if (!item) return null;
                          return (
                            <div key={`${outfit.id}-${itemId}-${index}`} className="flex-shrink-0 w-28 space-y-2">
                              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-50 border border-zinc-100 shadow-sm">
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                              </div>
                              <p className="text-[10px] font-bold text-zinc-500 truncate text-center uppercase tracking-tighter">{item.name}</p>
                            </div>
                          );
                        }) : !outfit.photoUrl && (
                          <div className="w-full py-8 border-2 border-dashed border-zinc-100 rounded-2xl flex flex-col items-center justify-center text-zinc-300">
                             <Filter className="w-8 h-8 opacity-20 mb-2" />
                             <p className="text-xs uppercase tracking-widest font-bold">Aucun vêtement spécifié</p>
                          </div>
                        )}
                      </div>
                    </div>
                </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {selectedOutfitId && (() => {
          const currentIndex = filteredOutfits.findIndex(o => o.id === selectedOutfitId);
          const outfit = filteredOutfits[currentIndex];
          if (!outfit) return null;

          const goToNext = () => {
            const nextIdx = (currentIndex + 1) % filteredOutfits.length;
            setSelectedOutfitId(filteredOutfits[nextIdx].id!);
          };
          const goToPrev = () => {
            const prevIdx = (currentIndex - 1 + filteredOutfits.length) % filteredOutfits.length;
            setSelectedOutfitId(filteredOutfits[prevIdx].id!);
          };

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4"
            >
              <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none z-10">
                <Button 
                  variant="secondary" 
                  size="icon" 
                  onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                  className="rounded-full w-12 h-12 bg-white/10 backdrop-blur-md border-white/20 text-white pointer-events-auto"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button 
                  variant="secondary" 
                  size="icon" 
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  className="rounded-full w-12 h-12 bg-white/10 backdrop-blur-md border-white/20 text-white pointer-events-auto"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </div>

              <div className="relative w-full max-w-4xl max-h-full flex flex-col items-center">
                <motion.img 
                  key={outfit.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={outfit.photoUrl} 
                  className="max-h-[85vh] w-auto object-contain rounded-2xl shadow-2xl" 
                  alt="Zoom" 
                />
                
                <div className="mt-4 text-center">
                  <h3 className="text-white font-bold text-lg">{outfit.name}</h3>
                  <p className="text-white/60 text-xs">{format(new Date(outfit.date), "EEEE d MMMM yyyy", { locale: fr })}</p>
                </div>

                <div className="absolute top-0 right-0 p-4 flex gap-2 z-20">
                  <Button
                    size="icon"
                    className="rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white relative"
                    onClick={() => {
                      if (onReScan && outfit.photoUrl) onReScan(outfit.photoUrl);
                      setSelectedOutfitId(null);
                    }}
                    title="Rescanner cette photo"
                  >
                    <Search className="w-5 h-5" />
                    <Sparkles className="w-2.5 h-2.5 absolute top-1.5 right-1.5 text-amber-400 fill-amber-400" />
                  </Button>
                  <Button
                    size="icon"
                    className="rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 text-white"
                    onClick={() => setSelectedOutfitId(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white p-6 rounded-3xl shadow-2xl w-full max-w-sm space-y-4"
            >
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold">Supprimer la tenue ?</h3>
                <p className="text-zinc-500 text-sm">
                  Cette action est irréversible. La photo et l'association des vêtements seront perdues.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="ghost" 
                  className="flex-1 h-12 rounded-xl font-bold"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Annuler
                </Button>
                <Button 
                  className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 font-bold text-white"
                  onClick={() => {
                    deleteOutfit(confirmDeleteId);
                    setConfirmDeleteId(null);
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
