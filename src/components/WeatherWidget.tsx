import { useState, useEffect } from "react";
import { fetchWeather, WeatherData } from "@/lib/weather";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WeatherWidgetProps {
  onWeatherChange?: (data: WeatherData | null) => void;
}

export default function WeatherWidget({ onWeatherChange }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Géolocalisation non supportée");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await fetchWeather(position.coords.latitude, position.coords.longitude);
          setWeather(data);
          onWeatherChange?.(data);
        } catch (err) {
          setError("Erreur météo");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError("Accès position refusé");
        setLoading(false);
      }
    );
  }, []);

  if (loading) return null;
  if (error) return null;
  if (!weather) return null;

  return (
    <Card 
      onClick={() => setIsExpanded(!isExpanded)}
      className={`rounded-2xl border-none shadow-sm bg-white/80 backdrop-blur-sm cursor-pointer transition-all duration-300 overflow-hidden ${isExpanded ? 'p-5' : 'py-2 px-4'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xl flex items-center justify-center w-8 h-8 bg-zinc-50 rounded-lg">
            {weather.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900">{weather.temp}°C</span>
              {!isExpanded && (
                <span className="text-[10px] text-zinc-500 font-medium truncate max-w-[80px]">
                  {weather.condition}
                </span>
              )}
            </div>
            {isExpanded && (
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{weather.condition}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-zinc-400" />
            <span className="text-[10px] font-bold text-zinc-600 truncate max-w-[100px]">
              {weather.city || "Ma Position"}
            </span>
          </div>
          {isExpanded && <span className="text-[8px] uppercase tracking-tighter text-zinc-400 opacity-70">Référence météo</span>}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && weather.periods && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-3 gap-2">
              {weather.periods.map((p) => (
                <div key={p.label} className="flex flex-col items-center text-center p-2 rounded-xl bg-zinc-50/50">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{p.label}</span>
                  <span className="text-lg mb-1">{p.icon}</span>
                  <span className="text-xs font-bold text-zinc-900">{p.temp}°C</span>
                  <span className="text-[8px] text-zinc-500 leading-tight mt-0.5 line-clamp-1">{p.condition}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
