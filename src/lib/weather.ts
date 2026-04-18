export interface WeatherPeriod {
  label: string;
  temp: number;
  condition: string;
  icon: string;
}

export interface WeatherData {
  temp: number;
  condition: string;
  icon: string;
  city?: string;
  periods?: WeatherPeriod[];
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const [weatherRes, geoRes] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode`),
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
  ]);

  const data = await weatherRes.json();
  const geoData = await geoRes.json();
  
  const temp = Math.round(data.current_weather.temperature);
  const code = data.current_weather.weathercode;
  const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.municipality || "Ma Position";
  
  // Map WMO Weather interpretation codes to simple descriptions and icons
  // https://open-meteo.com/en/docs
  const weatherMap: Record<number, { condition: string; icon: string }> = {
    0: { condition: "Ciel dégagé", icon: "☀️" },
    1: { condition: "Principalement dégagé", icon: "🌤️" },
    2: { condition: "Partiellement nuageux", icon: "⛅" },
    3: { condition: "Couvert", icon: "☁️" },
    45: { condition: "Brouillard", icon: "🌫️" },
    48: { condition: "Brouillard givrant", icon: "🌫️" },
    51: { condition: "Bruine légère", icon: "🌧️" },
    53: { condition: "Bruine modérée", icon: "🌧️" },
    55: { condition: "Bruine dense", icon: "🌧️" },
    61: { condition: "Pluie légère", icon: "🌧️" },
    63: { condition: "Pluie modérée", icon: "🌧️" },
    65: { condition: "Pluie forte", icon: "🌧️" },
    71: { condition: "Neige légère", icon: "❄️" },
    73: { condition: "Neige modérée", icon: "❄️" },
    75: { condition: "Neige forte", icon: "❄️" },
    95: { condition: "Orage", icon: "⛈️" },
  };

  const { condition, icon } = weatherMap[code] || { condition: "Inconnu", icon: "🌡️" };

  // Calculate periods (Morning: 8h, Afternoon: 14h, Evening: 20h)
  const hourly = data.hourly;
  const periods: WeatherPeriod[] = [];
  
  if (hourly) {
    const periodHours = [
      { h: 8, label: "Matin" },
      { h: 14, label: "Après-midi" },
      { h: 20, label: "Soir" }
    ];

    periodHours.forEach(p => {
      // Find the index for today at hour p.h
      // Hourly data starts at 00:00 of the current day in the forecast
      const idx = p.h;
      if (hourly.temperature_2m && hourly.temperature_2m[idx] !== undefined) {
        const pCode = hourly.weathercode[idx];
        const pWeather = weatherMap[pCode] || { condition: "Inconnu", icon: "🌡️" };
        periods.push({
          label: p.label,
          temp: Math.round(hourly.temperature_2m[idx]),
          condition: pWeather.condition,
          icon: pWeather.icon
        });
      }
    });
  }

  return { temp, condition, icon, city, periods };
}
