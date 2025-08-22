// Εναλλακτικές λύσεις για geocoding

// 1. Χρήση του Google Geocoding API (απαιτεί API key)
export const searchWithGoogle = async (address, apiKey) => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return [location.lat, location.lng];
    }
    throw new Error("Δεν βρέθηκε η διεύθυνση");
  } catch (error) {
    throw error;
  }
};

// 2. Χρήση του MapBox Geocoding API (απαιτεί access token)
export const searchWithMapbox = async (address, accessToken) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${accessToken}&limit=1`
    );
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return [lat, lng];
    }
    throw new Error("Δεν βρέθηκε η διεύθυνση");
  } catch (error) {
    throw error;
  }
};

// 3. Χρήση του Photon API (δωρεάν, αλλά με περιορισμούς)
export const searchWithPhoton = async (address) => {
  try {
    const response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].geometry.coordinates;
      return [lat, lng];
    }
    throw new Error("Δεν βρέθηκε η διεύθυνση");
  } catch (error) {
    throw error;
  }
};

// 4. Χρήση του LocationIQ API (απαιτεί API key)
export const searchWithLocationIQ = async (address, apiKey) => {
  try {
    const response = await fetch(
      `https://us1.locationiq.com/v1/search.php?key=${apiKey}&q=${encodeURIComponent(address)}&format=json&limit=1`
    );
    const data = await response.json();
    
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
    throw new Error("Δεν βρέθηκε η διεύθυνση");
  } catch (error) {
    throw error;
  }
};

// 5. Εναλλακτική λύση με Nominatim μέσω διαφορετικού proxy
export const searchWithNominatimProxy = async (address) => {
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`)}`,
    `https://cors-anywhere.herokuapp.com/https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
    `https://thingproxy.freeboard.io/fetch/https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
  ];

  for (const proxyUrl of proxies) {
    try {
      const response = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'AccessibleMapApp/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
      }
    } catch (error) {
      console.log(`Proxy ${proxyUrl} απέτυχε:`, error.message);
      continue;
    }
  }
  
  throw new Error("Δεν ήταν δυνατή η αναζήτηση διευθύνσεων");
};

// 6. Τοπική λύση με προκαθορισμένες διευθύνσεις (για testing)
export const searchWithLocalData = async (address) => {
  const localAddresses = {
    'αθήνα': [37.9838, 23.7275],
    'θεσσαλονίκη': [40.6401, 22.9444],
    'πάτρα': [38.2466, 21.7346],
    'ηράκλειο': [35.3387, 25.1442],
    'λαρίσα': [39.6390, 22.4191],
    'βόλος': [39.3622, 22.9422],
    'ιωάννινα': [39.6653, 20.8537],
    'χαλκίδα': [38.4636, 23.5994],
    'αλεξανδρούπολη': [40.8497, 25.8764],
    'κομοτηνή': [41.1193, 25.4054]
  };

  const searchTerm = address.toLowerCase().trim();
  
  for (const [key, coords] of Object.entries(localAddresses)) {
    if (searchTerm.includes(key)) {
      return coords;
    }
  }
  
  throw new Error("Δεν βρέθηκε η διεύθυνση στις τοπικές βάσεις δεδομένων");
}; 