/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Camera, Shirt, Image as ImageIcon, Sparkles, RotateCcw } from "lucide-react";
import Scanner from "@/components/Scanner";
import Wardrobe from "@/components/Wardrobe";
import OutfitGallery from "@/components/OutfitGallery";
import OutfitGenerator from "@/components/OutfitGenerator";
import WeatherWidget from "@/components/WeatherWidget";
import { motion, AnimatePresence } from "motion/react";
import { WeatherData } from "@/lib/weather";

export default function App() {
  const [user] = useState<any>({
    uid: "local-user",
    displayName: "Mon Dressing",
    isAnonymous: true,
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("scanner");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [reScanPhoto, setReScanPhoto] = useState<string | null>(null);
  const [galleryFilterItemId, setGalleryFilterItemId] = useState<string | null>(null);
  const [generatorSeedItemId, setGeneratorSeedItemId] = useState<string | null>(null);
  
  // Lifted Generator State
  const [generatorOccasion, setGeneratorOccasion] = useState("");
  const [generatorSuggestions, setGeneratorSuggestions] = useState<any[]>([]);
  const [generatorSelectedDates, setGeneratorSelectedDates] = useState<Date[]>([new Date()]);
  const [generatorIgnoredIds, setGeneratorIgnoredIds] = useState<Set<string>>(new Set());

  const getLogoColor = () => {
    if (!weather) return "bg-zinc-900";
    const icon = weather.icon;
    if (["☀️", "🌤️"].includes(icon)) return "bg-amber-500";
    if (["🌧️", "⛈️", "🌊"].includes(icon)) return "bg-sky-500";
    if (["❄️"].includes(icon)) return "bg-indigo-400";
    if (["☁️", "⛅", "🌫️"].includes(icon)) return "bg-zinc-500";
    return "bg-zinc-900";
  };

  const handleReScan = (p: string) => {
    setReScanPhoto(p);
    setActiveTab("scanner");
  };

  const clearData = () => {
    if (confirm("Voulez-vous vraiment supprimer toutes vos données locales ? Cette action est irréversible.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-800 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setActiveTab("scanner")}>
            <div className={`w-8 h-8 ${getLogoColor()} rounded-lg flex items-center justify-center transition-all duration-500 group-hover:scale-110`}>
              <Shirt className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg sm:text-xl tracking-tight group-hover:text-zinc-600 transition-colors">StyleScan</span>
          </div>
          <Button variant="ghost" size="icon" onClick={clearData} title="Réinitialiser" className="rounded-full">
            <RotateCcw className="w-5 h-5 text-zinc-500" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <AnimatePresence mode="wait">
            <TabsContent key="scanner" value="scanner">
              <Scanner 
                user={user} 
                onTabChange={setActiveTab} 
                reScanPhoto={reScanPhoto}
                onClearReScan={() => setReScanPhoto(null)} 
                weather={weather}
              />
            </TabsContent>
            <TabsContent key="wardrobe" value="wardrobe">
              <Wardrobe 
                user={user} 
                onSeeOutfits={(itemId) => {
                  setGalleryFilterItemId(itemId);
                  setActiveTab("gallery");
                }} 
                onSeeAI={(itemId) => {
                  setGeneratorSeedItemId(itemId);
                  setActiveTab("generator");
                }}
              />
            </TabsContent>
            <TabsContent key="gallery" value="gallery">
              <OutfitGallery 
                user={user} 
                onReScan={handleReScan} 
                filterItemId={galleryFilterItemId}
                onClearFilter={() => setGalleryFilterItemId(null)}
              />
            </TabsContent>
            <TabsContent key="generator" value="generator">
              <OutfitGenerator 
                user={user} 
                weather={weather}
                savedOccasion={generatorOccasion}
                setSavedOccasion={setGeneratorOccasion}
                savedSuggestions={generatorSuggestions}
                setSavedSuggestions={setGeneratorSuggestions}
                savedDates={generatorSelectedDates}
                setSavedDates={setGeneratorSelectedDates}
                ignoredIds={generatorIgnoredIds}
                setIgnoredIds={setGeneratorIgnoredIds}
                seedItemId={generatorSeedItemId}
                onClearSeed={() => setGeneratorSeedItemId(null)}
                setSeedItemId={setGeneratorSeedItemId}
              />
            </TabsContent>
          </AnimatePresence>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100/80 px-4 py-2 pb-6 z-50 backdrop-blur-lg">
            <TabsList className="max-w-2xl mx-auto h-16 bg-transparent border-0 gap-0 w-full flex justify-around items-center">
              <TabsTrigger 
                value="scanner" 
                className="flex-1 flex flex-col items-center gap-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none group"
              >
                <div className="px-5 py-1.5 rounded-full transition-all duration-300 group-data-[state=active]:bg-zinc-100 mb-0.5">
                  <Camera className="w-6 h-6 text-zinc-400 group-data-[state=active]:text-black" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-data-[state=active]:text-black">Scanner</span>
              </TabsTrigger>
              <TabsTrigger 
                value="wardrobe" 
                className="flex-1 flex flex-col items-center gap-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none group"
              >
                <div className="px-5 py-1.5 rounded-full transition-all duration-300 group-data-[state=active]:bg-zinc-100 mb-0.5">
                  <Shirt className="w-6 h-6 text-zinc-400 group-data-[state=active]:text-black" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-data-[state=active]:text-black">Dressing</span>
              </TabsTrigger>
              <TabsTrigger 
                value="gallery" 
                className="flex-1 flex flex-col items-center gap-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none group"
              >
                <div className="px-5 py-1.5 rounded-full transition-all duration-300 group-data-[state=active]:bg-zinc-100 mb-0.5">
                  <ImageIcon className="w-6 h-6 text-zinc-400 group-data-[state=active]:text-black" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-data-[state=active]:text-black">Outfits</span>
              </TabsTrigger>
              <TabsTrigger 
                value="generator" 
                className="flex-1 flex flex-col items-center gap-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none group"
              >
                <div className="px-5 py-1.5 rounded-full transition-all duration-300 group-data-[state=active]:bg-zinc-100 mb-0.5">
                  <Sparkles className="w-6 h-6 text-zinc-400 group-data-[state=active]:text-black" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-data-[state=active]:text-black">IA</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
