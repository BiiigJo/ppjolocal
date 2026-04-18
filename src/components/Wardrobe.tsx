import { useState, useEffect, useMemo } from "react";
import { ClothingItem } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Trash2, 
  Search, 
  Filter, 
  ExternalLink, 
  Copy, 
  ShoppingBag, 
  ArrowUpDown, 
  X, 
  ImageIcon, 
  Calendar as CalendarIcon,
  RotateCcw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Info,
  Pencil,
  Save
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { localDatabase } from "@/lib/local-db";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface WardrobeProps {
  user: any;
  onSeeOutfits?: (itemId: string) => void;
  onSeeAI?: (itemId: string) => void;
}

function ImageWithLoading({ src, alt, className, motionProps }: { src: string; alt: string; className: string; motionProps?: any }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-100 animate-pulse flex items-center justify-center">
          <ShoppingBag className="w-6 h-6 text-zinc-200" />
        </div>
      )}
      <motion.img
        key={src} // Change key when src changes for transitions
        src={src}
        alt={alt}
        {...motionProps}
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

export default function Wardrobe({ user, onSeeOutfits, onSeeAI }: WardrobeProps) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string>("");
  const [filterStyle, setFilterStyle] = useState<string>("");
  const [filterSeason, setFilterSeason] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState<{ type: 'single' | 'bulk', id?: string } | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'oldest' | 'az' | 'za'>('date');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClothingItem>>({});

  const handleStartEdit = (item: ClothingItem) => {
    setEditForm(item);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedItemId) return;
    
    try {
      localDatabase.updateClothing(selectedItemId, editForm);
      toast.success("Vêtement mis à jour");
      setIsEditing(false);
    } catch (err) {
      toast.error("Erreur lors de la mise à jour");
      console.error(err);
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedItemId(null);
        setIsEditing(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    const refresh = () => {
      const newItems = localDatabase.getClothing();
      newItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(newItems);
      setLoading(false);
    };
    refresh();
    return localDatabase.subscribe(refresh);
  }, []);

  const deleteItem = async (id: string) => {
    try {
      localDatabase.deleteClothing(id);
      toast.success("Vêtement supprimé");
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setShowConfirm(null);
    }
  };

  const deleteBulk = async () => {
    try {
      const ids = Array.from(selectedIds);
      ids.forEach(id => localDatabase.deleteClothing(id));
      toast.success(`${ids.length} vêtements supprimés`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error("Erreur lors de la suppression groupée");
    } finally {
      setShowConfirm(null);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const prepareForVinted = (item: ClothingItem) => {
    const description = `
✨ À VENDRE : ${item.name} ✨

📏 Type : ${item.type}
🏷️ Marque : ${item.brand || "Non précisée"}
🎨 Couleur : ${item.color}
👗 Style : ${item.style}
☀️ Saison : ${item.season}

📝 Description :
${item.description || "Très beau vêtement bien entretenu."}

🧼 Conseils d'entretien :
${item.careInstructions || "Lavage standard."}

#Vinted #Mode #StyleScan #Dressing #AcheterD'Occasion
    `.trim();

    navigator.clipboard.writeText(description).then(() => {
      toast.success("Description copiée ! Redirection vers Vinted...", {
        description: "Collez la description dans le champ dédié sur Vinted.",
        duration: 4000,
      });
      
      // Open Vinted upload page after a short delay
      setTimeout(() => {
        window.open("https://www.vinted.fr/items/new", "_blank");
      }, 1500);
    }).catch(err => {
      console.error("Failed to copy:", err);
      toast.error("Erreur lors de la copie de la description");
    });
  };

  const categories = Array.from(new Set(items.map(i => i.category)));

  const filterOptions = useMemo(() => {
    const colors = new Set<string>();
    const styles = new Set<string>();
    const seasons = new Set<string>();
    
    items.forEach(item => {
      if (item.color && item.color.trim()) colors.add(item.color.trim());
      if (item.style && item.style.trim()) styles.add(item.style.trim());
      if (item.season && item.season.trim()) seasons.add(item.season.trim());
    });

    return {
      colors: Array.from(colors).sort(),
      styles: Array.from(styles).sort(),
      seasons: Array.from(seasons).sort()
    };
  }, [items]);

  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                            item.type.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const matchesColor = !filterColor || filterColor === "all" || (item.color && item.color.toLowerCase().trim() === filterColor.toLowerCase().trim());
      const matchesStyle = !filterStyle || filterStyle === "all" || (item.style && item.style.toLowerCase().trim() === filterStyle.toLowerCase().trim());
      const matchesSeason = !filterSeason || filterSeason === "all" || (item.season && item.season.toLowerCase().trim() === filterSeason.toLowerCase().trim());
      
      return matchesSearch && matchesCategory && matchesColor && matchesStyle && matchesSeason;
    })
      .sort((a, b) => {
        if (sortBy === 'az') return a.name.localeCompare(b.name);
        if (sortBy === 'za') return b.name.localeCompare(a.name);
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

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
      <div className="space-y-4">
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="flex items-center justify-between bg-zinc-900 text-white p-3 rounded-2xl shadow-xl overflow-hidden"
          >
            <span className="text-sm font-bold pl-2">{selectedIds.size} sélectionné(s)</span>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedIds(new Set())}
                className="text-white hover:bg-white/10 h-8 font-bold text-xs"
              >
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setShowConfirm({ type: 'bulk' })}
                className="h-8 font-bold text-xs bg-red-500 hover:bg-red-600"
              >
                Tout supprimer
              </Button>
            </div>
          </motion.div>
        )}
        <div className="flex gap-2 items-center">
          <div className="relative flex-[2]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl bg-white border-zinc-100 h-10"
            />
          </div>
          <div className="flex-1 min-w-[100px]">
            <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
              <SelectTrigger className="w-full rounded-xl h-10 border-zinc-100 bg-white shadow-sm overflow-hidden text-xs">
                <ArrowUpDown className="w-3 h-3 mr-1 text-zinc-400 shrink-0" />
                <div className="truncate flex-1 text-left">
                  <SelectValue placeholder="Trier" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-zinc-100 shadow-xl">
                <SelectItem value="date">Plus récents</SelectItem>
                <SelectItem value="oldest">Plus anciens</SelectItem>
                <SelectItem value="az">Titre A-Z</SelectItem>
                <SelectItem value="za">Titre Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-xl h-10 w-10 border-zinc-100 ${showFilters ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-400'}`}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="p-4 rounded-2xl border-zinc-100 bg-white shadow-sm space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Couleur</label>
                    <Select value={filterColor} onValueChange={setFilterColor}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white border-zinc-100 shadow-sm">
                        <SelectValue placeholder="Toutes" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-100 shadow-xl">
                        <SelectItem value="">
                          <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full border border-zinc-100 bg-zinc-200" />
                             Toutes
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
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Saison</label>
                    <Select value={filterSeason} onValueChange={setFilterSeason}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white border-zinc-100 shadow-sm">
                        <SelectValue placeholder="Toutes" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-100 shadow-xl">
                        <SelectItem value="">Toutes</SelectItem>
                        <SelectItem value="Printemps">Printemps</SelectItem>
                        <SelectItem value="Été">Été</SelectItem>
                        <SelectItem value="Automne">Automne</SelectItem>
                        <SelectItem value="Hiver">Hiver</SelectItem>
                        <SelectItem value="4 Saisons">4 Saisons</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Style</label>
                    <Select value={filterStyle} onValueChange={setFilterStyle}>
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-white border-zinc-100 shadow-sm">
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-zinc-100 shadow-xl">
                        <SelectItem value="">Tous</SelectItem>
                        <SelectItem value="Casual">Casual 👕</SelectItem>
                        <SelectItem value="Street">Street 🧥</SelectItem>
                        <SelectItem value="Chic">Chic 🤵</SelectItem>
                        <SelectItem value="Sport">Sport 👟</SelectItem>
                        <SelectItem value="Boho">Boho 🌸</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setFilterColor("");
                    setFilterSeason("");
                    setFilterStyle("");
                    setSelectedCategory(null);
                  }} 
                  className="w-full text-xs text-zinc-500 hover:text-zinc-900"
                >
                  <RotateCcw className="w-3 h-3 mr-2" />
                  Réinitialiser les filtres
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              !selectedCategory 
                ? 'bg-zinc-900 text-white shadow-md' 
                : 'bg-white text-zinc-500 border border-zinc-100 hover:bg-zinc-50'
            }`}
          >
            Tous
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap capitalize ${
                selectedCategory === cat 
                  ? 'bg-zinc-900 text-white shadow-md' 
                  : 'bg-white text-zinc-500 border border-zinc-100 hover:bg-zinc-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200">
          <p className="text-zinc-400">Aucun vêtement trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Card className={`group relative overflow-hidden rounded-[2.5rem] border border-zinc-100/50 transition-all duration-500 bg-white ${
                  selectedIds.has(item.id) ? 'ring-2 ring-zinc-900 ring-offset-4 shadow-xl translate-y-[-4px]' : 'shadow-sm hover:shadow-xl hover:translate-y-[-4px]'
                }`}>
                  {/* Image Section: Full bleed with subtle inner shadow */}
                  <div className="relative aspect-[4/5] overflow-hidden cursor-pointer bg-[#F8F8F8] group-hover:bg-[#F2F2F2] flex items-center justify-center transition-colors duration-500 shadow-inner" onClick={() => setSelectedItemId(item.id)}>
                    {/* Selection Checkbox: Premium look */}
                    <div className="absolute top-5 left-5 z-10">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        className="w-6 h-6 rounded-xl border-2 border-zinc-200/50 bg-white/50 accent-zinc-900 backdrop-blur-md cursor-pointer transition-all hover:scale-110 shadow-sm"
                      />
                    </div>

                    <div className="relative w-full h-full">
                      <ImageWithLoading
                        src={item.imageUrl}
                        alt={item.name}
                        className={`w-full h-full object-cover transition-transform duration-700 ${selectedIds.has(item.id) ? 'scale-105 brightness-95' : 'group-hover:scale-110'}`}
                      />
                    </div>
                  </div>

                  {/* Info Section: White bottom part with refined typography */}
                  <div className="p-3.5 sm:p-6 pt-2 sm:pt-5 space-y-2.5 sm:space-y-4">
                    <div className="cursor-pointer space-y-0.5 sm:space-y-1.5" onClick={() => setSelectedItemId(item.id)}>
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-bold text-[13px] sm:text-base tracking-tight text-zinc-900 line-clamp-2 leading-tight min-h-[2.25rem] sm:min-h-[2.5rem]">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.15em]">{item.brand || "Maison"}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-200" />
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{item.season || "4 Saisons"}</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-50 rounded-full w-fit mt-1">
                        <div className="w-2 h-2 rounded-full border border-black/5" style={{ background: getColorHex(item.color || '') }} />
                        <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">{item.color}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-300" />
                        <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">{item.type}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-12 rounded-[1.25rem] border-zinc-100 text-zinc-900 hover:bg-zinc-900 hover:text-white transition-all shadow-sm group/ai"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSeeAI) onSeeAI(item.id);
                        }}
                      >
                        <Sparkles className="w-5 h-5 group-hover/ai:scale-110 transition-transform" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          prepareForVinted(item);
                        }}
                        className="w-12 h-12 rounded-[1.25rem] border-zinc-100 font-bold text-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm group/btn"
                      >
                        <span className="group-hover/btn:scale-110 transition-transform tracking-tighter">€</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-12 h-12 rounded-[1.25rem] text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowConfirm({ type: 'single', id: item.id });
                        }}
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wardrobe Item Details Modal */}
      <AnimatePresence>
        {selectedItemId && (() => {
          const currentIndex = filteredItems.findIndex(i => i.id === selectedItemId);
          const item = filteredItems[currentIndex];
          if (!item) return null;

          const goToNext = () => {
            const nextIdx = (currentIndex + 1) % filteredItems.length;
            setSelectedItemId(filteredItems[nextIdx].id);
          };
          const goToPrev = () => {
            const prevIdx = (currentIndex - 1 + filteredItems.length) % filteredItems.length;
            setSelectedItemId(filteredItems[prevIdx].id);
          };

          return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedItemId(null)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-100 flex-shrink-0">
                  <ImageWithLoading 
                    src={item.imageUrl} 
                    alt={item.name}
                    className="w-full h-full object-cover"
                    motionProps={{
                      initial: { opacity: 0, x: 20 },
                      animate: { opacity: 1, x: 0 },
                      transition: { duration: 0.3 }
                    }}
                  />
                  
                  <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                      className="rounded-full w-12 h-12 bg-white/20 backdrop-blur-md border-white/30 text-white pointer-events-auto"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      onClick={(e) => { e.stopPropagation(); goToNext(); }}
                      className="rounded-full w-12 h-12 bg-white/20 backdrop-blur-md border-white/30 text-white pointer-events-auto"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  </div>

                  <div className="absolute top-6 right-6 flex gap-2 z-50">
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEditing) {
                          handleSaveEdit();
                        } else {
                          handleStartEdit(item);
                        }
                      }}
                      className={`rounded-full w-12 h-12 backdrop-blur-md border-white/20 text-white shadow-lg pointer-events-auto transition-all transition-colors ${isEditing ? 'bg-green-600/80 border-green-400/50' : 'bg-black/40 hover:bg-black/60'}`}
                      title={isEditing ? "Enregistrer" : "Modifier"}
                    >
                      {isEditing ? <Save className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItemId(null);
                        setIsEditing(false);
                      }}
                      className="rounded-full w-12 h-12 bg-black/40 backdrop-blur-md border-white/20 text-white hover:bg-black/60 shadow-lg pointer-events-auto"
                      title="Fermer"
                    >
                      <X className="w-6 h-6" />
                    </Button>
                  </div>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Nom du vêtement</label>
                        <Input 
                          value={editForm.name || ""} 
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          className="rounded-xl border-zinc-200"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Marque</label>
                        <Input 
                          value={editForm.brand || ""} 
                          onChange={(e) => setEditForm(prev => ({ ...prev, brand: e.target.value }))}
                          className="rounded-xl border-zinc-200"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Catégorie</label>
                          <Input 
                            value={editForm.category || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                            className="rounded-xl border-zinc-200"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Type</label>
                          <Input 
                            value={editForm.type || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value }))}
                            className="rounded-xl border-zinc-200"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Couleur</label>
                          <Input 
                            value={editForm.color || ""} 
                            onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                            className="rounded-xl border-zinc-200"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Style</label>
                          <Select 
                            value={editForm.style || "Casual"} 
                            onValueChange={(val) => setEditForm(prev => ({ ...prev, style: val }))}
                          >
                            <SelectTrigger className="rounded-xl border-zinc-200 h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-zinc-100">
                              <SelectItem value="Casual">Casual 👕</SelectItem>
                              <SelectItem value="Street">Street 🧥</SelectItem>
                              <SelectItem value="Chic">Chic 🤵</SelectItem>
                              <SelectItem value="Sport">Sport 👟</SelectItem>
                              <SelectItem value="Boho">Boho 🌸</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Saison</label>
                        <Select 
                          value={editForm.season || "4 Saisons"} 
                          onValueChange={(val) => setEditForm(prev => ({ ...prev, season: val }))}
                        >
                          <SelectTrigger className="rounded-xl border-zinc-200 h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-zinc-100">
                            <SelectItem value="Printemps">Printemps</SelectItem>
                            <SelectItem value="Été">Été</SelectItem>
                            <SelectItem value="Automne">Automne</SelectItem>
                            <SelectItem value="Hiver">Hiver</SelectItem>
                            <SelectItem value="4 Saisons">4 Saisons</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Description</label>
                        <Textarea 
                          value={editForm.description || ""} 
                          onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                          className="rounded-xl border-zinc-200 min-h-[100px]"
                        />
                      </div>
                      <div className="pt-2 flex gap-3">
                        <Button 
                          variant="ghost" 
                          onClick={() => setIsEditing(false)}
                          className="flex-1 rounded-xl h-12"
                        >
                          Annuler
                        </Button>
                        <Button 
                          onClick={handleSaveEdit}
                          className="flex-1 rounded-xl h-12 bg-zinc-900 text-white hover:bg-zinc-800"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{item.name}</h2>
                          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">{item.brand || "Sans marque"}</p>
                        </div>
                        {onSeeOutfits && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="rounded-full border-zinc-100 font-bold"
                            onClick={() => onSeeOutfits(item.id)}
                          >
                            <ImageIcon className="w-3 h-3 mr-2" />
                            Voir les tenues
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-50 p-4 rounded-3xl space-y-1">
                          <p className="text-[10px] font-bold uppercase text-zinc-400">Catégorie</p>
                          <p className="text-sm font-semibold">{item.category}</p>
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-3xl space-y-1">
                          <p className="text-[10px] font-bold uppercase text-zinc-400">Type</p>
                          <p className="text-sm font-semibold">{item.type}</p>
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-3xl space-y-1">
                          <p className="text-[10px] font-bold uppercase text-zinc-400">Couleur</p>
                          <p className="text-sm font-semibold">{item.color}</p>
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-3xl space-y-1">
                          <p className="text-[10px] font-bold uppercase text-zinc-400">Style</p>
                          <p className="text-sm font-semibold">{item.style}</p>
                        </div>
                      </div>

                      {item.description && (
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold uppercase text-zinc-400 px-1">Description</p>
                           <p className="text-sm text-zinc-600 px-1 leading-relaxed">{item.description}</p>
                        </div>
                      )}

                      <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-zinc-400">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          <span className="text-xs font-medium">Ajouté le {format(new Date(item.createdAt), "d MMMM yyyy", { locale: fr })}</span>
                        </div>
                        <Badge variant="outline" className="rounded-full border-zinc-100 text-[10px] font-bold uppercase">{item.season}</Badge>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Custom Confirmation Dialog */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(null)}
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
                <h3 className="text-lg font-bold">Confirmer la suppression</h3>
                <p className="text-zinc-500 text-sm">
                  {showConfirm.type === 'bulk' 
                    ? `Êtes-vous sûr de vouloir supprimer ces ${selectedIds.size} vêtements ? Cette action est irréversible.`
                    : "Êtes-vous sûr de vouloir supprimer ce vêtement ? Cette action est irréversible."}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button 
                  variant="ghost" 
                  className="flex-1 h-12 rounded-xl font-bold"
                  onClick={() => setShowConfirm(null)}
                >
                  Annuler
                </Button>
                <Button 
                  variant="destructive"
                  className="flex-1 h-12 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    if (showConfirm.type === 'bulk') deleteBulk();
                    else if (showConfirm.id) deleteItem(showConfirm.id);
                  }}
                >
                  Confirmer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
