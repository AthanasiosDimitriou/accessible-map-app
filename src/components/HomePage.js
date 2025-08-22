import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from "react-leaflet";
import L from "leaflet";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { accessibilityIcons } from '../utils/accessibilityIcons';
import { searchWithNominatimProxy, searchWithPhoton, searchWithLocalData } from '../utils/geocoding';
import '../styles/HomePage.css';

const userIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149060.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const startIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1828/1828640.png", // Πράσινο marker για αφετηρία
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const destinationIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const CenterMap = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
};

// Προσθήκη custom εικονιδίων για τα σημεία προσβασιμότητας
const createAccessibilityIcon = (type) => {
  return L.divIcon({
    html: `<div class="accessibility-marker ${type}">
            <img src="${accessibilityIcons[type]?.icon}" alt="${accessibilityIcons[type]?.description}" style="width: 24px; height: 24px;" />
           </div>`,
    className: 'accessibility-marker-container',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });
};

const HomePage = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [startLocation, setStartLocation] = useState("");
  const [startCoords, setStartCoords] = useState(null);
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [route, setRoute] = useState([]);
  const [accessibleRoutes, setAccessibleRoutes] = useState([]);
  const [nearbyAccessibleRoutes, setNearbyAccessibleRoutes] = useState([]);
  const [showNavigationButton, setShowNavigationButton] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [combinedRoute, setCombinedRoute] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);

  const [showLegend, setShowLegend] = useState(true);
  const [mode, setMode] = useState('foot'); // 'foot' ή 'drive'
  const [parkingSpots, setParkingSpots] = useState([]);
  const [selectedParkingSpot, setSelectedParkingSpot] = useState(null);
  const [showParkingSpots, setShowParkingSpots] = useState(false);
  const [nearbyParkingSpots, setNearbyParkingSpots] = useState([]);
  const [calculatedAccessibleRoutes, setCalculatedAccessibleRoutes] = useState([]);
  const mapRef = useRef(null);
  const navigate = useNavigate();



  const initializeUserLocation = useCallback(async () => {
    try {
      setIsLocating(true);
      
      // Έλεγχος αν το geolocation είναι διαθέσιμο
      if (!navigator.geolocation) {
        toast.error("Η λειτουργία εντοπισμού τοποθεσίας δεν υποστηρίζεται στον browser σας.");
        setUseCurrentLocation(false);
        return;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000, // Αύξηση του timeout σε 10 δευτερόλεπτα
          maximumAge: 60000 // Επιτρέπει χρήση cached position μέχρι 1 λεπτό
        });
      });
      
      const coords = [position.coords.latitude, position.coords.longitude];
      setUserLocation(coords);
      if (useCurrentLocation) {
        setStartCoords(coords);
      }
      toast.success("Η τοποθεσία σας εντοπίστηκε επιτυχώς!");
    } catch (error) {
      console.error("Σφάλμα εντοπισμού τοποθεσίας:", error);
      
      // Πιο συγκεκριμένα μηνύματα σφάλματος
      let errorMessage = "Δεν ήταν δυνατός ο εντοπισμός της θέσης σας.";
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "Η πρόσβαση στην τοποθεσία σας απορρίφθηκε. Παρακαλώ ενεργοποιήστε την τοποθεσία στις ρυθμίσεις του browser σας.";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = "Οι πληροφορίες τοποθεσίας δεν είναι διαθέσιμες αυτή τη στιγμή. Παρακαλώ δοκιμάστε ξανά.";
          break;
        case error.TIMEOUT:
          errorMessage = "Η αίτηση εντοπισμού τοποθεσίας έληξε. Παρακαλώ δοκιμάστε ξανά.";
          break;
        default:
          errorMessage = "Προέκυψε σφάλμα κατά τον εντοπισμό της τοποθεσίας σας. Παρακαλώ ελέγξτε τις ρυθμίσεις τοποθεσίας.";
      }
      
      toast.error(errorMessage);
      setUseCurrentLocation(false);
    } finally {
      setIsLocating(false);
    }
  }, [useCurrentLocation]);

  // Συνάρτηση για υπολογισμό πραγματικών διαδρομών μεταξύ waypoints
  const calculateAccessibleRoutePaths = useCallback(async (routes) => {
    try {
      const calculatedRoutes = [];
      
      for (const route of routes) {
        if (route.path.length < 2) continue;
        
        const routeSegments = [];
        
        // Υπολογισμός διαδρομής μεταξύ διαδοχικών waypoints
        for (let i = 0; i < route.path.length - 1; i++) {
          const start = route.path[i];
          const end = route.path[i + 1];
          
          try {
            const response = await fetch(
              `http://localhost:5000/route/v1/foot/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=false&continue_straight=true&steps=true`
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.routes && data.routes.length > 0) {
                const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                routeSegments.push({
                  path: coordinates,
                  color: 'blue',
                  weight: 3,
                  opacity: 0.6,
                  dashArray: '10, 5'
                });
              }
            }
          } catch (error) {
            // Επιστροφή σε ευθεία γραμμή σε περίπτωση σφάλματος
            routeSegments.push({
              path: [start, end],
              color: 'blue',
              weight: 3,
              opacity: 0.6,
              dashArray: '10, 5'
            });
          }
        }
        
        calculatedRoutes.push({
          ...route,
          calculatedPath: routeSegments
        });
      }
      
      setCalculatedAccessibleRoutes(calculatedRoutes);
    } catch (error) {
      console.error("Σφάλμα υπολογισμού διαδρομών προσβασιμότητας:", error);
    }
  }, []);

  const fetchAccessibleRoutes = useCallback(async () => {
    try {
      const routesRef = collection(db, "proposedRoutes");
      const routesQuery = query(routesRef, where("status", "==", "approved"));
      
      const routesSnapshot = await getDocs(routesQuery);
      
      const routes = routesSnapshot.docs.map(doc => ({
        id: doc.id,
        path: doc.data().waypoints.map(point => [point.lat, point.lng]),
        points: doc.data().waypoints.map(point => ({
          lat: point.lat,
          lng: point.lng,
          type: point.type || 'accessible',
          description: point.description || ''
        })),
        description: doc.data().description || '',
        type: doc.data().type || 'standard',
        rating: doc.data().rating || 0
      }));
      
      setAccessibleRoutes(routes);
      
      // Υπολογισμός πραγματικών διαδρομών για τα waypoints
      await calculateAccessibleRoutePaths(routes);
      
      // Εξαγωγή parking spots από τις διαδρομές
      const spots = [];
      routes.forEach(route => {
        route.points.forEach(point => {
          if (point.type === 'parking' || point.type === 'accessible_parking') {
            spots.push({
              id: `${route.id}-${point.lat}-${point.lng}`,
              lat: point.lat,
              lng: point.lng,
              type: point.type,
              description: point.description,
              routeId: route.id
            });
          }
        });
      });
      setParkingSpots(spots);
    } catch (error) {
      console.error("Σφάλμα κατά τη φόρτωση των προσβάσιμων διαδρομών:", error);
            toast.error(`Σφάλμα κατά τη φόρτωση των προσβάσιμων διαδρομών: ${error.message}`);
    }
  }, []);

  const searchAddress = async (address) => {
    try {
      
      // Δοκιμή με τοπικά δεδομένα πρώτα (γρήγορη λύση)
      try {
        const localResult = await searchWithLocalData(address);
        return localResult;
      } catch (localError) {
      }
      
      // Δοκιμή με Nominatim proxy
      try {
        const proxyResult = await searchWithNominatimProxy(address);
        return proxyResult;
      } catch (proxyError) {
      }
      
      // Δοκιμή με Photon API
      try {
        const photonResult = await searchWithPhoton(address);
        return photonResult;
      } catch (photonError) {
      }
      
      // Τελική δοκιμή με απευθείας Nominatim
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=5`,
          {
            mode: 'no-cors'
          }
        );
        throw new Error("Δεν είναι δυνατή η απευθείας πρόσβαση");
      } catch (directError) {
        throw new Error("Δεν ήταν δυνατή η αναζήτηση διευθύνσεων με καμία διαθέσιμη μέθοδο");
      }
      
    } catch (error) {
      console.error("Σφάλμα αναζήτησης:", error);
      throw error;
    }
  };

  const calculateRoute = async (start, end) => {
    try {
      setIsLoading(true);
      
      // Αν είναι car mode, χρησιμοποιούμε απλή διαδρομή χωρίς προσβάσιμες διαδρομές
      if (mode === 'drive') {
        await calculateCarRoute(start, end);
        return;
      }
      
      // ΒΕΛΤΙΩΜΕΝΟΣ ΑΛΓΟΡΙΘΜΟΣ ΓΙΑ ΑΜΕΑ
      let currentPoint = start;
      let segments = [];
      let usedRouteIds = new Set();
      let maxIterations = 15; // Αύξηση επαναλήψεων για καλύτερη αναζήτηση
      const ACCESSIBLE_DISTANCE_THRESHOLD = 80; // ΜΕΙΩΣΗ σε 80μ για ασφάλεια
      const MAX_ROUTE_DETOUR = 1.5; // Μέγιστη απόκλιση 50% από την ευθεία διαδρομή

      // Υπολογισμός ευθείας απόστασης για σύγκριση
      const directDistance = calculateDistance(start[0], start[1], end[0], end[1]);
      let totalRouteDistance = 0;

      while (maxIterations-- > 0) {

        
        // 1. Υπολογισμός της κοντινότερης διαδρομής από το τρέχον σημείο
        const profile = 'foot';
        const port = '5000';
        const response = await fetch(
          `http://localhost:${port}/route/v1/${profile}/${currentPoint[1]},${currentPoint[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=false&continue_straight=true&steps=true`
        );
        
        if (!response.ok) {
          throw new Error("Σφάλμα υπολογισμού διαδρομής");
        }

        const data = await response.json();
        if (!data.routes || data.routes.length === 0) {
          throw new Error("Δεν βρέθηκε διαδρομή");
        }

        const osrmPath = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
                if (osrmPath.length < 2) {
          break;
        }

        // 2. ΒΕΛΤΙΩΜΕΝΟΣ ΕΛΕΓΧΟΣ ΓΙΑ ΠΡΟΣΒΑΣΙΜΕΣ ΔΙΑΔΡΟΜΕΣ
        let foundAccessibleRoute = false;
        let bestRoute = null;
        let bestEntryPoint = null;
        let bestExitPoint = null;
        let bestScore = -Infinity; // Σύστημα βαθμολόγησης

        // Έλεγχος κάθε προσβάσιμης διαδρομής
        for (const route of accessibleRoutes) {
          if (usedRouteIds.has(route.id)) {
            continue;
          }

          // Έλεγχος κάθε σημείου της προσβάσιμης διαδρομής
          for (let i = 0; i < route.path.length; i++) {
            const accPoint = route.path[i];
            
            // Έλεγχος απόστασης από κάθε σημείο της τρέχουσας διαδρομής
            for (let j = 0; j < osrmPath.length; j++) {
              const dist = calculateDistance(
                accPoint[0], accPoint[1],
                osrmPath[j][0], osrmPath[j][1]
              );

              if (dist < ACCESSIBLE_DISTANCE_THRESHOLD) {
                // ΒΕΛΤΙΩΜΕΝΟ ΣΥΣΤΗΜΑ ΒΑΘΜΟΛΟΓΗΣΗΣ
                const routeScore = calculateRouteScore(
                  route, 
                  accPoint, 
                  currentPoint, 
                  end, 
                  dist,
                  totalRouteDistance,
                  directDistance,
                  ACCESSIBLE_DISTANCE_THRESHOLD
                );


                if (routeScore > bestScore) {
                  bestScore = routeScore;
                  bestRoute = route;
                  bestEntryPoint = route.path[0];
                  bestExitPoint = route.path[route.path.length - 1];
                  foundAccessibleRoute = true;
                }
              }
            }
          }
        }

        if (foundAccessibleRoute) {
          
          // Έλεγχος αν η διαδρομή δεν είναι πολύ μεγάλη
          const routeDistance = bestRoute.path.reduce((total, point, i) => 
            i > 0 ? total + calculateDistance(
              point[0], point[1],
              bestRoute.path[i-1][0], bestRoute.path[i-1][1]
            ) : 0, 0
          );

          const distanceToEntry = calculateDistance(
            currentPoint[0], currentPoint[1],
            bestEntryPoint[0], bestEntryPoint[1]
          );

          const totalNewDistance = totalRouteDistance + distanceToEntry + routeDistance;
          const detourRatio = totalNewDistance / directDistance;

          if (detourRatio > MAX_ROUTE_DETOUR) {
            break;
          }

          // 3. Προσθήκη του τμήματος μέχρι την προσβάσιμη διαδρομή
          const toEntryResponse = await fetch(
            `http://localhost:5000/route/v1/foot/${currentPoint[1]},${currentPoint[0]};${bestEntryPoint[1]},${bestEntryPoint[0]}?overview=full&geometries=geojson&alternatives=false&continue_straight=true&steps=true`
          );

          if (toEntryResponse.ok) {
            const toEntryData = await toEntryResponse.json();
            if (toEntryData.routes && toEntryData.routes.length > 0) {
              const toEntryPath = toEntryData.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
              
              segments.push({
                path: toEntryPath,
                color: 'red',
                instructions: toEntryData.routes[0].legs[0].steps.map(step => ({
                  text: step.maneuver.type === 'new name' ? 
                    `Συνεχίστε στην ${step.name || 'διαδρομή'}` :
                    `Στρίψτε ${step.maneuver.modifier || 'ευθεία'}`,
                  distance: step.distance,
                  location: [step.geometry.coordinates[0][1], step.geometry.coordinates[0][0]]
                }))
              });
              
              totalRouteDistance += toEntryData.routes[0].distance;
            }
          }

          // 4. Προσθήκη της προσβάσιμης διαδρομής
          segments.push({
            path: bestRoute.path,
            color: 'blue',
            instructions: [{
              text: `🚶‍♂️ Ακολουθήστε την προσβάσιμη διαδρομή: ${bestRoute.description || ''}`,
              distance: routeDistance,
              location: bestRoute.path[0]
            }]
          });

          usedRouteIds.add(bestRoute.id);
          currentPoint = bestExitPoint;
          totalRouteDistance += routeDistance;
          
          
          // Έλεγχος αν είμαστε αρκετά κοντά στον προορισμό
          const distanceToDestination = calculateDistance(
            currentPoint[0], currentPoint[1],
            end[0], end[1]
          );
          
          if (distanceToDestination < 100) { // Αν είμαστε πολύ κοντά, τερματίζουμε
            break;
          }
          
          continue;
        }

        // 5. Αν δεν βρέθηκε προσβάσιμη διαδρομή, προσθήκη του υπόλοιπου τμήματος
        segments.push({
          path: osrmPath,
          color: 'red',
          instructions: data.routes[0].legs[0].steps.map(step => ({
            text: step.maneuver.type === 'new name' ? 
              `Συνεχίστε στην ${step.name || 'διαδρομή'}` :
              `Στρίψτε ${step.maneuver.modifier || 'ευθεία'}`,
            distance: step.distance,
            location: [step.geometry.coordinates[0][1], step.geometry.coordinates[0][0]]
          }))
        });
        
        totalRouteDistance += data.routes[0].distance;
        break;
      }

      // Συνδυασμός όλων των τμημάτων
      const fullPath = segments.reduce((acc, segment) => acc.concat(segment.path), []);
      setRoute(fullPath);
      // Χρησιμοποιούμε τη διαδρομή που υπολογίσαμε εδώ
      setCombinedRoute(segments);
             setNearbyAccessibleRoutes(Array.from(usedRouteIds).map(id => 
         accessibleRoutes.find(route => route.id === id)
       ).filter(Boolean));

      // Υπολογισμός συνολικής απόστασης
      const totalDistance = segments.reduce((total, segment) => 
        total + (segment.instructions?.reduce((segTotal, inst) => segTotal + inst.distance, 0) || 0), 0
      );

      const historyItem = {
        start: useCurrentLocation ? "Τρέχουσα τοποθεσία" : startLocation,
        destination,
        timestamp: new Date().toISOString(),
        mode: mode,
        distance: totalDistance,
        accessibleSegments: segments.filter(s => s.color === 'blue').length,
        hasOneWayStreets: segments.some(segment => 
          segment.instructions.some(instruction => 
            instruction.text.includes('στροφή') || 
            instruction.text.includes('αριστερά') || 
            instruction.text.includes('δεξιά')
          )
        )
      };
      setSearchHistory(prev => [historyItem, ...prev].slice(0, 5));

      // Εμφάνιση στατιστικών
      const accessibleCount = segments.filter(s => s.color === 'blue').length;
      const regularCount = segments.filter(s => s.color === 'red').length;
      
      toast.success(
        `Διαδρομή βρέθηκε! 📏 ${(totalDistance / 1000).toFixed(2)} km, ` +
        `🚶‍♂️ ${accessibleCount} προσβάσιμα τμήματα, ` +
        `🛣️ ${regularCount} κανονικά τμήματα`
      );

    } catch (error) {
      toast.error(error.message);
      setRoute([]);
      setNearbyAccessibleRoutes([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ΝΕΑ ΣΥΝΑΡΤΗΣΗ ΓΙΑ ΒΑΘΜΟΛΟΓΗΣΗ ΔΙΑΔΡΟΜΩΝ
  const calculateRouteScore = (route, entryPoint, currentPoint, destination, distance, totalDistance, directDistance, threshold = 80) => {
    let score = 0;
    
    // 1. Βαθμολογία απόστασης (όσο πιο κοντά, τόσο καλύτερα)
    const distanceScore = Math.max(0, 100 - (distance / threshold) * 100);
    score += distanceScore * 0.3;
    
    // 2. Βαθμολογία ποιότητας διαδρομής (αν έχει περιγραφή, είναι καλύτερη)
    const qualityScore = route.description ? 50 : 20;
    score += qualityScore * 0.2;
    
    // 3. Βαθμολογία απόστασης από προορισμό
    const routeEndPoint = route.path[route.path.length - 1];
    const distanceToDestination = calculateDistance(
      routeEndPoint[0], routeEndPoint[1],
      destination[0], destination[1]
    );
    const destinationScore = Math.max(0, 100 - (distanceToDestination / 1000) * 50);
    score += destinationScore * 0.3;
    
    // 4. Βαθμολογία συνολικής απόστασης (ποινή για μεγάλες διαδρομές)
    const routeDistance = route.path.reduce((total, point, i) => 
      i > 0 ? total + calculateDistance(
        point[0], point[1],
        route.path[i-1][0], route.path[i-1][1]
      ) : 0, 0
    );
    const totalNewDistance = totalDistance + routeDistance;
    const detourPenalty = Math.max(0, (totalNewDistance / directDistance - 1) * 50);
    score -= detourPenalty * 0.2;
    
    return score;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!destination) return;

    try {
      const coords = await searchAddress(destination);
      setDestinationCoords(coords);

             const start = useCurrentLocation ? userLocation : startCoords;
       if (start) {
        
        if (mode === 'drive') {
          // Για αυτοκίνητο, χρησιμοποιούμε τη calculateCarRoute με parking spot αν έχει επιλεγεί
          await calculateCarRoute(start, coords, selectedParkingSpot);
          
          // Εύρεση πλησιέστερων parking spots
          const nearbySpots = findNearbyParkingSpots(coords);
          setNearbyParkingSpots(nearbySpots);
          
          if (nearbySpots.length > 0) {
            toast.info(`Βρέθηκαν ${nearbySpots.length} parking spots κοντά στον προορισμό σας. Κάντε κλικ σε ένα για να αλλάξετε τη διαδρομή.`);
          }
        } else {
          // Για πεζό, χρησιμοποιούμε τη calculateRoute
          await calculateRoute(start, coords);
        }
      } else {
        toast.error("Δεν έχει βρεθεί η τοποθεσία σας. Παρακαλώ ενεργοποιήστε την τοποθεσία ή εισάγετε μια διεύθυνση εκκίνησης.");
        return;
      }

      setShowNavigationButton(true);
    } catch (error) {
      console.error("Σφάλμα αναζήτησης:", error);
      
      let errorMessage = "Παρουσιάστηκε πρόβλημα κατά την αναζήτηση.";
      
      if (error.message.includes("Δεν βρέθηκε η διεύθυνση")) {
        errorMessage = "Δεν βρέθηκε η διεύθυνση που αναζητήσατε. Παρακαλώ δοκιμάστε με διαφορετικούς όρους αναζήτησης.";
      } else if (error.message.includes("CORS") || error.message.includes("blocked")) {
        errorMessage = "Πρόβλημα σύνδεσης με τον server αναζήτησης. Παρακαλώ δοκιμάστε ξανά αργότερα.";
      } else if (error.message.includes("network") || error.message.includes("fetch")) {
        errorMessage = "Πρόβλημα δικτύου. Παρακαλώ ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.";
      }
      
      toast.error(errorMessage);
    }
  };

  const handleStartSearch = async (e) => {
    e.preventDefault();
    
    // Έλεγχος αν η αφετηρία είναι κενή
    if (!startLocation || startLocation.trim() === '') {
      toast.error("Παρακαλώ εισάγετε μια διεύθυνση αφετηρίας.");
      return;
    }

    try {
      setIsLoading(true);
      
      const coords = await searchAddress(startLocation.trim());
      setStartCoords(coords);
      
             // Καθαρισμός προηγούμενης διαδρομής όταν αλλάζει η αφετηρία
       setRoute([]);
       setCombinedRoute([]);
       setNearbyAccessibleRoutes([]);
       setShowNavigationButton(false);
      
      toast.success(`Η αφετηρία "${startLocation}" εντοπίστηκε επιτυχώς!`);
      
      // Εμφάνιση των συντεταγμένων στο console για debugging
      
    } catch (error) {
      console.error("Σφάλμα αναζήτησης αφετηρίας:", error);
      
      let errorMessage = "Παρουσιάστηκε πρόβλημα κατά την αναζήτηση της αφετηρίας.";
      
      if (error.message.includes("Δεν βρέθηκε η διεύθυνση")) {
        errorMessage = `Δεν βρέθηκε η διεύθυνση "${startLocation}". Παρακαλώ δοκιμάστε με διαφορετικούς όρους αναζήτησης ή πιο συγκεκριμένη διεύθυνση.`;
      } else if (error.message.includes("CORS") || error.message.includes("blocked")) {
        errorMessage = "Πρόβλημα σύνδεσης με τον server αναζήτησης. Παρακαλώ δοκιμάστε ξανά αργότερα.";
      } else if (error.message.includes("network") || error.message.includes("fetch")) {
        errorMessage = "Πρόβλημα δικτύου. Παρακαλώ ελέγξτε τη σύνδεσή σας και δοκιμάστε ξανά.";
      } else if (error.message.includes("τοπικές βάσεις")) {
        errorMessage = `Η διεύθυνση "${startLocation}" δεν βρέθηκε στις τοπικές βάσεις δεδομένων. Δοκιμάστε με μια μεγάλη πόλη της Ελλάδας (π.χ. Αθήνα, Θεσσαλονίκη, Πάτρα).`;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNavigation = () => {
    if (!combinedRoute || combinedRoute.length === 0) {
      toast.error("Δεν υπάρχει έγκυρη διαδρομή για πλοήγηση");
      return;
    }
    
    // Δημιουργούμε ένα ενιαίο path από όλα τα τμήματα
    const fullPath = combinedRoute.reduce((acc, segment) => {
      return acc.concat(segment.path);
    }, []);

    // Συνδυάζουμε τις οδηγίες από όλα τα τμήματα
    const allInstructions = combinedRoute.reduce((acc, segment) => {
      return acc.concat(segment.instructions || []);
    }, []);
    
    navigate('/navigation', {
      state: {
        route: {
          path: fullPath,
          color: mode === 'drive' ? 'green' : 'purple', // Πράσινο για αυτοκίνητο, μωβ για πεζό
          instructions: allInstructions
        },
        start: startCoords || userLocation,
        destination: destinationCoords,
        nearbyRoutes: mode === 'foot' ? nearbyAccessibleRoutes : [], // Μόνο για πεζό υπάρχουν προσβάσιμες διαδρομές
        isAccessibleRoute: mode === 'foot', // Μόνο για πεζό είναι προσβάσιμη διαδρομή
        mode: mode, // Προσθήκη του mode για να ξέρει η σελίδα πλοήγησης
        parkingSpot: selectedParkingSpot, // Προσθήκη πληροφοριών parking spot
        searchInfo: {
          startAddress: useCurrentLocation ? "Τρέχουσα τοποθεσία" : startLocation,
          destinationAddress: destination
        }
      }
    });
  };

  // Βοηθητική συνάρτηση για φιλτράρισμα διπλότυπων διαδρομών
  function filterDuplicateRoutes(routes) {
    const seen = new Set();
    return routes.filter(route => {
      const key = route.id || JSON.stringify(route.path);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Βοηθητική συνάρτηση για έλεγχο φοράς
  function isDirectionAligned(mainRoute, accessibleRoute, intersectionPoint) {
    const startDist = calculateDistance(
      intersectionPoint[0], intersectionPoint[1],
      accessibleRoute.path[0][0], accessibleRoute.path[0][1]
    );
    const endDist = calculateDistance(
      intersectionPoint[0], intersectionPoint[1],
      accessibleRoute.path[accessibleRoute.path.length-1][0],
      accessibleRoute.path[accessibleRoute.path.length-1][1]
    );
    return startDist < endDist;
  }

  

  

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // μέτρα
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // η απόσταση σε μέτρα
  };

  // διαδρομές αυτοκινήτου (χωρίς προσβάσιμες διαδρομές)
  const calculateCarRoute = async (start, end, parkingSpot = null) => {
    try {
      if (parkingSpot) {
      }
      
      // Κατασκευή waypoints για τη διαδρομή
      let waypoints = `${start[1]},${start[0]}`;
      if (parkingSpot) {
        waypoints += `;${parkingSpot.lng},${parkingSpot.lat}`;
      }
      waypoints += `;${end[1]},${end[0]}`;
      
      // Χρήση online OSRM server με car profile (fallback στο τοπικο)
      let response;
      try {
        response = await fetch(
          `https://router.project-osrm.org/route/v1/car/${waypoints}?overview=full&geometries=geojson&alternatives=false&continue_straight=true&steps=true`
        );
      } catch (error) {
        response = await fetch(
          `http://localhost:5000/route/v1/foot/${waypoints}?overview=full&geometries=geojson&alternatives=false&continue_straight=true&steps=true`
        );
      }
      
      if (!response.ok) {
        throw new Error("Σφάλμα υπολογισμού διαδρομής αυτοκινήτου");
      }

      const data = await response.json();
      if (!data.routes || data.routes.length === 0) {
        throw new Error("Δεν βρέθηκε διαδρομή αυτοκινήτου");
      }

      const route = data.routes[0];
      const carPath = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      

      // Δημιουργία διαδρομής χωρίς προσβάσιμες διαδρομές
      const carSegment = {
        path: carPath,
        color: 'green', 
        instructions: route.legs[0].steps.map(step => ({
          text: step.maneuver.type === 'new name' ? 
            `Συνεχίστε στην ${step.name || 'διαδρομή'}` :
            `Στρίψτε ${step.maneuver.modifier || 'ευθεία'}`,
          distance: step.distance,
          location: [step.geometry.coordinates[0][1], step.geometry.coordinates[0][0]]
        }))
      };

             setRoute(carPath);
       setCombinedRoute([carSegment]);
       setNearbyAccessibleRoutes([]); // Δεν υπάρχουν προσβάσιμες διαδρομές για αυτοκίνητο

      // Προσθήκη στο ιστορικό αναζητήσεων
      const historyItem = {
        start: useCurrentLocation ? "Τρέχουσα τοποθεσία" : startLocation,
        destination,
        timestamp: new Date().toISOString(),
        mode: mode, // Χρησιμοποιούμε το τρέχον mode
        distance: route.distance,
        duration: route.duration,
        hasOneWayStreets: carSegment.instructions.some(instruction => 
          instruction.text.includes('στροφή') || 
          instruction.text.includes('αριστερά') || 
          instruction.text.includes('δεξιά')
        )
      };
      setSearchHistory(prev => [historyItem, ...prev].slice(0, 5));

      const parkingMessage = parkingSpot ? 
        ` με parking spot (${parkingSpot.type === 'accessible_parking' ? 'Προσβάσιμος Χώρος' : 'Χώρος Στάθμευσης'})` : '';
      toast.success(`Διαδρομή αυτοκινήτου βρέθηκε!${parkingMessage} Απόσταση: ${(route.distance / 1000).toFixed(2)} km, Χρόνος: ${Math.round(route.duration / 60)} λεπτά`);

    } catch (error) {
      console.error("Σφάλμα υπολογισμού διαδρομής αυτοκινήτου:", error);
      toast.error(`Σφάλμα υπολογισμού διαδρομής αυτοκινήτου: ${error.message}`);
      setRoute([]);
      setCombinedRoute([]);
      setNearbyAccessibleRoutes([]);
    }
  };

  // εύρεση πλησιέστερων parking spots
  const findNearbyParkingSpots = (destination) => {
    if (!destination || parkingSpots.length === 0) return [];
    
    const MAX_DISTANCE = 2000; // 2km απόσταση
    const nearbySpots = parkingSpots
      .map(spot => ({
        ...spot,
        distance: calculateDistance(
          destination[0], destination[1],
          spot.lat, spot.lng
        )
      }))
      .filter(spot => spot.distance <= MAX_DISTANCE)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10); // Μέγιστο 10 parking spots
    
    return nearbySpots;
  };

  

  // κλικ σε parking spot στον χάρτη
  const handleMapParkingSpotClick = async (spot) => {
    if (!destinationCoords) {
      toast.error("Παρακαλώ αναζητήστε πρώτα έναν προορισμό");
      return;
    }

    // Έλεγχος αν το parking spot είναι ήδη επιλεγμένο
    if (selectedParkingSpot?.id === spot.id) {
      // Αποεπιλογή - επιστροφή στον αρχικό προορισμό που αναζήτησα
      try {
        setIsLoading(true);
        setSelectedParkingSpot(null);
        
        const start = useCurrentLocation ? userLocation : startCoords;
        if (start) {
          // Επαναυπολογισμός διαδρομής στον αρχικό προορισμό
          await calculateCarRoute(start, destinationCoords, null);
          
          toast.success("Αποεπιλέχθηκε το parking spot! Η διαδρομή τώρα οδηγεί στον αρχικό προορισμό.");
        }
      } catch (error) {
        console.error("Σφάλμα αποεπιλογής parking spot:", error);
        toast.error("Σφάλμα κατά την αποεπιλογή του parking spot");
      } finally {
        setIsLoading(false);
      }
    } else {
      // Επιλογή νέου parking spot
      try {
        setIsLoading(true);
        setSelectedParkingSpot(spot);
        
        const start = useCurrentLocation ? userLocation : startCoords;
        if (start) {
          // Υπολογισμός διαδρομής μέχρι το parking spot
          await calculateCarRoute(start, [spot.lat, spot.lng], null);
          
          toast.success(`Επιλέχθηκε parking spot! Η διαδρομή τώρα οδηγεί στο ${spot.type === 'accessible_parking' ? 'προσβάσιμο χώρο στάθμευσης' : 'χώρο στάθμευσης'}`);
        }
      } catch (error) {
        console.error("Σφάλμα επιλογής parking spot:", error);
        toast.error("Σφάλμα κατά την επιλογή του parking spot");
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initializeUserLocation();
      } catch (error) {
        console.error("Σφάλμα κατά την αρχικοποίηση τοποθεσίας:", error);
      }
      
      try {
        await fetchAccessibleRoutes();
      } catch (error) {
        console.error("Σφάλμα κατά την αρχική φόρτωση διαδρομών:", error);
        
        // Αν υπάρχει πρόβλημα με το Firestore, δοκιμάζουμε ξανά μετά από λίγο
        if (error.message.includes('blocked') || error.message.includes('network')) {
          setTimeout(() => {
            fetchAccessibleRoutes().catch(retryError => {
              console.error("Επανασύνδεση απέτυχε:", retryError);
              toast.error("Πρόβλημα σύνδεσης με τη βάση δεδομένων. Παρακαλώ ελέγξτε τη σύνδεσή σας.");
            });
          }, 5000);
        }
      }
    };
    
    initializeApp();
  }, [initializeUserLocation, fetchAccessibleRoutes]);

  // Καθαρισμός διαδρομής όταν αλλάζει το mode
  useEffect(() => {
         setRoute([]);
     setCombinedRoute([]);
     setNearbyAccessibleRoutes([]);
     setShowNavigationButton(false);
     setSelectedParkingSpot(null); // Καθαρισμός επιλεγμένου parking spot
     setNearbyParkingSpots([]); // Καθαρισμός πλησιέστερων parking spots
    
    // Δεν καθαρίζουμε την αφετηρία για να μην χάνεται η εργασία του χρήστη
  }, [mode]);

  // Αφαιρούμε το useEffect που επαναυπολογίζει τη διαδρομή
  // Η calculateRoute ήδη υπολογίζει τη σωστή διαδρομή

  

  // Προσθήκη Legend component
  const Legend = () => (
    <div className="map-legend">
      <h4>Υπόμνημα</h4>
      <div className="legend-items">
        {Object.entries(accessibilityIcons).map(([key, value]) => (
          <div key={key} className="legend-item">
            <span className="legend-icon">
              <img src={value.icon} alt={value.description} style={{ width: '24px', height: '24px' }} />
            </span>
            <span className="legend-text">{value.description}</span>
          </div>
        ))}
      </div>
      <button 
        className="legend-toggle"
        onClick={() => setShowLegend(prev => !prev)}
      >
        {showLegend ? 'Απόκρυψη' : 'Εμφάνιση'} Υπομνήματος
      </button>
    </div>
  );

  // Αλλαγή του useEffect για το focus του χάρτη
  useEffect(() => {
    if (route.length > 0) {
      if (!useCurrentLocation) {
        // Αν δεν χρησιμοποιείται η τρέχουσα τοποθεσία, κάνε focus στη διαδρομή
        const bounds = L.latLngBounds(route);
        mapRef.current?.fitBounds(bounds, { padding: [50, 50] });
      } else {
        // Αν χρησιμοποιείται η τρέχουσα τοποθεσία, κάνε focus στην τρέχουσα τοποθεσία
        mapRef.current?.setView(userLocation, 13);
      }
    }
  }, [route, useCurrentLocation, userLocation]);

  return (
    <div className="home-container">
      <h1 style={{ marginBottom: '80px' }}>Αναζήτηση Προσβάσιμης Διαδρομής</h1>
      <div className="mode-selector">
        <label>
          <input
            type="radio"
            name="mode"
            value="foot"
            checked={mode === 'foot'}
            onChange={() => setMode('foot')}
          />
          🚶 Πεζός
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="drive"
            checked={mode === 'drive'}
            onChange={() => setMode('drive')}
          />
          🚗 Αυτοκίνητο
        </label>

      </div>
      {mode === 'drive' && (
        <div style={{
          textAlign: 'center',
          margin: '10px 0',
          padding: '10px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #2196f3',
          color: '#1976d2'
        }}>
          🚗 Λειτουργία αυτοκινήτου: Η διαδρομή θα υπολογιστεί για οδήγηση και δεν θα περιλαμβάνει προσβάσιμες διαδρομές για πεζούς.
        </div>
      )}

      <div className="location-type-selector">
        <label className="radio-label">
          <input
            className="radio-input"
            type="radio"
            checked={useCurrentLocation}
            onChange={() => {
              setUseCurrentLocation(true);
              setStartCoords(null); // Καθαρισμός αφετηρίας όταν επιλέγεται τρέχουσα τοποθεσία
            }}
          />
          Χρήση τρέχουσας τοποθεσίας
        </label>
        <label className="radio-label">
          <input
            type="radio"
            checked={!useCurrentLocation}
            onChange={() => setUseCurrentLocation(false)}
          />
          Εισαγωγή αφετηρίας
        </label>
        {useCurrentLocation && (
          <div className="location-actions">
            <button
              type="button"
              onClick={initializeUserLocation}
              className="retry-location-button"
              disabled={isLocating}
              style={{
                marginLeft: '10px',
                padding: '5px 10px',
                backgroundColor: isLocating ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isLocating ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              {isLocating ? 'Εντοπισμός...' : 'Επανεντοπισμός Τοποθεσίας'}
            </button>
            {!userLocation && (
              <div style={{ 
                marginLeft: '10px', 
                fontSize: '12px', 
                color: '#666',
                fontStyle: 'italic',
                maxWidth: '300px'
              }}>
                <div>Παρακαλώ επιτρέψτε την πρόσβαση στην τοποθεσία σας</div>
                <div style={{ marginTop: '5px', fontSize: '11px' }}>
                  💡 Συμβουλή: Ελέγξτε τις ρυθμίσεις του browser σας και βεβαιωθείτε ότι η τοποθεσία είναι ενεργοποιημένη
                </div>
              </div>
            )}
            {userLocation && (
              <div style={{ 
                marginLeft: '10px', 
                fontSize: '12px', 
                color: '#28a745',
                fontWeight: 'bold'
              }}>
                ✅ Τοποθεσία εντοπίστηκε επιτυχώς!
              </div>
            )}
          </div>
        )}
      </div>

      <div className="search-forms">
        {!useCurrentLocation && (
          <form onSubmit={handleStartSearch} className="search-form">
            <input
              type="text"
              placeholder="Εισάγετε αφετηρία..."
              value={startLocation}
              onChange={(e) => setStartLocation(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-button" disabled={isLoading}>
              {isLoading ? 'Αναζήτηση...' : 'Αναζήτηση Αφετηρίας'}
            </button>
          </form>
        )}

        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Αναζήτηση προορισμού..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button" disabled={isLoading}>
            {isLoading ? 'Αναζήτηση...' : 'Αναζήτηση Προορισμού'}
          </button>
        </form>
      </div>

      {/* Parking Spots - Μόνο για αυτοκίνητο */}
      {mode === 'drive' && parkingSpots.length > 0 && (
        <div className="parking-spots-section">
          <div className="parking-spots-header">
            <h3>🅿️ Διαθέσιμοι Χώροι Στάθμευσης</h3>
            <button 
              className="toggle-parking-button"
              onClick={() => setShowParkingSpots(!showParkingSpots)}
            >
              {showParkingSpots ? 'Απόκρυψη' : 'Εμφάνιση'} Όλων των Parking Spots
            </button>
          </div>
          
          {showParkingSpots && (
            <div className="parking-spots-list">
              <p className="parking-info-text">
                💡 Επιλέξτε ένα parking spot για να συμπεριληφθεί στη διαδρομή σας:
              </p>
              <div className="parking-spots-grid">
                {parkingSpots.map((spot, index) => (
                  <div 
                    key={spot.id}
                    className={`parking-spot-item ${selectedParkingSpot?.id === spot.id ? 'selected' : ''}`}
                    onClick={() => handleMapParkingSpotClick(spot)}
                  >
                    <div className="parking-spot-icon">
                      {spot.type === 'accessible_parking' ? '♿🅿️' : '🅿️'}
                    </div>
                    <div className="parking-spot-info">
                      <div className="parking-spot-type">
                        {spot.type === 'accessible_parking' ? 'Προσβάσιμος Χώρος' : 'Χώρος Στάθμευσης'}
                      </div>
                      {spot.description && (
                        <div className="parking-spot-description">
                          {spot.description}
                        </div>
                      )}
                    </div>
                    {selectedParkingSpot?.id === spot.id && (
                      <div className="parking-spot-selected">✓</div>
                    )}
                  </div>
                ))}
              </div>
              {selectedParkingSpot && (
                <div className="selected-parking-info">
                  <p>✅ Επιλεγμένο: {selectedParkingSpot.type === 'accessible_parking' ? 'Προσβάσιμος Χώρος' : 'Χώρος Στάθμευσης'}</p>
                  <button 
                    className="clear-parking-button"
                    onClick={() => {
                      setSelectedParkingSpot(null);
                      // Επαναυπολογισμός διαδρομής στον αρχικό προορισμό
                      if (destinationCoords) {
                        const start = useCurrentLocation ? userLocation : startCoords;
                        if (start) {
                          calculateCarRoute(start, destinationCoords, null);
                        }
                      }
                    }}
                  >
                    Καθαρισμός Επιλογής
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Πλησιέστερα Parking Spots Section */}
      {mode === 'drive' && nearbyParkingSpots.length > 0 && (
        <div className="nearby-parking-section" style={{
          margin: '15px 0',
          padding: '15px',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          border: '1px solid #ffeaa7'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>
            🎯 Πλησιέστερα Parking Spots στον Προορισμό
          </h3>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#856404' }}>
            Κάντε κλικ σε ένα parking spot στον χάρτη για να αλλάξετε τη διαδρομή σας:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {nearbyParkingSpots.slice(0, 5).map((spot) => (
              <div 
                key={spot.id}
                style={{
                  padding: '8px 12px',
                  backgroundColor: selectedParkingSpot?.id === spot.id ? '#28a745' : '#fff',
                  color: selectedParkingSpot?.id === spot.id ? '#fff' : '#856404',
                  border: `2px solid ${selectedParkingSpot?.id === spot.id ? '#28a745' : '#ffeaa7'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: selectedParkingSpot?.id === spot.id ? 'bold' : 'normal'
                }}
                onClick={() => handleMapParkingSpotClick(spot)}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                  {spot.type === 'accessible_parking' ? '♿🅿️' : '🅿️'} 
                  {spot.type === 'accessible_parking' ? 'Προσβάσιμος' : 'Κανονικός'}
                </div>
                <div>📏 {(spot.distance / 1000).toFixed(2)} km</div>
                {selectedParkingSpot?.id === spot.id && <div>❌ Επιλεγμένο (κάντε κλικ για αποεπιλογή)</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="map-container">
        <MapContainer
          center={userLocation || [37.9838, 23.7275]}
          zoom={13}
          style={{ height: "500px", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {userLocation && (
            <>
              <CenterMap position={userLocation} />
              <Marker position={userLocation} icon={userIcon}>
                <Popup>Η τρέχουσα θέση σας</Popup>
              </Marker>
            </>
          )}

          {startCoords && !useCurrentLocation && (
            <Marker position={startCoords} icon={startIcon}>
              <Popup>
                <div style={{ textAlign: 'center' }}>
                  <strong>🚀 Αφετηρία</strong><br/>
                  {startLocation}
                </div>
              </Popup>
            </Marker>
          )}

          {destinationCoords && (
            <Marker position={destinationCoords} icon={destinationIcon}>
              <Popup>Προορισμός</Popup>
            </Marker>
          )}

          {combinedRoute.map((segment, index) => (
            <Polyline
              key={index}
              positions={segment.path}
              color={segment.color}
              weight={4}
              opacity={0.7}
            />
          ))}

          {/* Εμφάνιση προσβάσιμων διαδρομών για πεζό */}
          {mode === 'foot' && calculatedAccessibleRoutes.map(route => (
            <div key={route.id}>
              {/* Γραμμές που συνδέουν τα waypoints με πραγματικές διαδρομές */}
              {route.calculatedPath && route.calculatedPath.map((segment, segmentIndex) => (
                <Polyline
                  key={`${route.id}-segment-${segmentIndex}`}
                  positions={segment.path}
                  color={segment.color}
                  weight={segment.weight}
                  opacity={segment.opacity}
                  dashArray={segment.dashArray}
                />
              ))}
              
              {/* Εικονίδια των waypoints */}
              {route.points.map((point, idx) => (
                <Marker
                  key={`${route.id}-point-${idx}`}
                  position={[point.lat, point.lng]}
                  icon={createAccessibilityIcon(point.type)}
                >
                  <Popup>
                    <div className="accessibility-popup">
                      <span className="popup-icon">
                        <img src={accessibilityIcons[point.type]?.icon} alt={accessibilityIcons[point.type]?.description} style={{ width: '24px', height: '24px' }} />
                      </span>
                      <h3>{accessibilityIcons[point.type]?.description}</h3>
                      <p>{point.description}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </div>
          ))}

          {/* Εμφάνιση πλησιέστερων parking spots για αυτοκίνητο */}
          {mode === 'drive' && nearbyParkingSpots.length > 0 && nearbyParkingSpots.map((spot) => (
            <Marker
              key={spot.id}
              position={[spot.lat, spot.lng]}
              icon={L.icon({
                iconUrl: selectedParkingSpot?.id === spot.id 
                  ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png"
                  : "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
                shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              })}
              eventHandlers={{
                click: () => handleMapParkingSpotClick(spot)
              }}
            >
              <Popup>
                <div className="parking-popup">
                  <div className="parking-popup-icon">
                    {spot.type === 'accessible_parking' ? '♿🅿️' : '🅿️'}
                  </div>
                  <h3>{spot.type === 'accessible_parking' ? 'Προσβάσιμος Χώρος Στάθμευσης' : 'Χώρος Στάθμευσης'}</h3>
                  {spot.description && <p>{spot.description}</p>}
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                    📏 Απόσταση: {(spot.distance / 1000).toFixed(2)} km από τον προορισμό
                  </p>
                  <button 
                    className="select-parking-button"
                    onClick={() => handleMapParkingSpotClick(spot)}
                    style={{
                      backgroundColor: selectedParkingSpot?.id === spot.id ? '#dc3545' : '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      width: '100%',
                      marginTop: '8px'
                    }}
                  >
                    {selectedParkingSpot?.id === spot.id ? '❌ Αποεπιλογή' : 'Επιλογή Parking Spot'}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Εμφάνιση όλων των parking spots όταν είναι ενεργοποιημένο το showParkingSpots */}
          {mode === 'drive' && showParkingSpots && parkingSpots.map((spot) => (
            <Marker
              key={`all-${spot.id}`}
              position={[spot.lat, spot.lng]}
              icon={L.icon({
                iconUrl: selectedParkingSpot?.id === spot.id 
                  ? "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png"
                  : "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
                shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              })}
              eventHandlers={{
                click: () => handleMapParkingSpotClick(spot)
              }}
            >
              <Popup>
                <div className="parking-popup">
                  <div className="parking-popup-icon">
                    {spot.type === 'accessible_parking' ? '♿🅿️' : '🅿️'}
                  </div>
                  <h3>{spot.type === 'accessible_parking' ? 'Προσβάσιμος Χώρος Στάθμευσης' : 'Χώρος Στάθμευσης'}</h3>
                  {spot.description && <p>{spot.description}</p>}
                  <button 
                    className="select-parking-button"
                    onClick={() => handleMapParkingSpotClick(spot)}
                    style={{
                      backgroundColor: selectedParkingSpot?.id === spot.id ? '#dc3545' : '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      width: '100%',
                      marginTop: '8px'
                    }}
                  >
                    {selectedParkingSpot?.id === spot.id ? '❌ Αποεπιλογή' : 'Επιλογή Parking Spot'}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Προσθήκη υπομνήματος μόνο για πεζό */}
          {showLegend && mode === 'foot' && <Legend />}
        </MapContainer>
      </div>

      {showNavigationButton && (
        <div className="route-info">
          <h3>🎯 Διαδρομή βρέθηκε!</h3>
                {mode === 'drive' ? (
        <div>
          <p>🚗 Διαδρομή αυτοκινήτου υπολογίστηκε επιτυχώς!</p>
          {selectedParkingSpot && (
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '8px' }}>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#fff' }}>
                🎯 Προορισμός: {selectedParkingSpot.type === 'accessible_parking' ? 'Προσβάσιμος Χώρος Στάθμευσης' : 'Χώρος Στάθμευσης'}
              </p>
              {selectedParkingSpot.description && (
                <p style={{ margin: '5px 0', fontSize: '12px', color: '#ddd' }}>
                  {selectedParkingSpot.description}
                </p>
              )}
              <p style={{ margin: '5px 0', fontSize: '12px', color: '#ddd' }}>
                📏 Απόσταση από αρχικό προορισμό: {(selectedParkingSpot.distance / 1000).toFixed(2)} km
              </p>
            </div>
          )}
          {combinedRoute.length > 0 && combinedRoute[0].instructions && (
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              <p>📏 Απόσταση: {(combinedRoute[0].instructions.reduce((total, inst) => total + inst.distance, 0) / 1000).toFixed(2)} km</p>
              <p>⏱️ Εκτιμώμενος χρόνος: {Math.round(combinedRoute[0].instructions.reduce((total, inst) => total + inst.distance, 0) / 1000 * 2)} λεπτά</p>
            </div>
          )}
          {nearbyParkingSpots.length > 0 && !selectedParkingSpot && (
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(255,193,7,0.2)', borderRadius: '8px', border: '1px solid rgba(255,193,7,0.3)' }}>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#856404' }}>
                💡 Βρέθηκαν {nearbyParkingSpots.length} parking spots κοντά στον προορισμό σας. Κάντε κλικ σε ένα στον χάρτη για να αλλάξετε τη διαδρομή!
              </p>
            </div>
          )}
        </div>
      ) : (
            <div>
              {combinedRoute.length > 0 && (
                <div style={{ marginBottom: '15px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '10px',
                    padding: '10px',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}>
                    <div>
                      <p style={{ margin: '5px 0', fontSize: '16px', fontWeight: 'bold' }}>
                        📊 Στατιστικά Διαδρομής
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}>
                        📏 Συνολική απόσταση: {(combinedRoute.reduce((total, segment) => 
                          total + (segment.instructions?.reduce((segTotal, inst) => segTotal + inst.distance, 0) || 0), 0
                        ) / 1000).toFixed(2)} km
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}>
                        🚶‍♂️ Προσβάσιμα τμήματα: {combinedRoute.filter(s => s.color === 'blue').length}
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '14px' }}>
                        🛣️ Κανονικά τμήματα: {combinedRoute.filter(s => s.color === 'red').length}
                      </p>
                    </div>
                    <div style={{ 
                      textAlign: 'center',
                      padding: '10px',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      minWidth: '80px'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                        {Math.round((combinedRoute.filter(s => s.color === 'blue').length / combinedRoute.length) * 100)}%
                      </div>
                      <div style={{ fontSize: '12px' }}>Προσβάσιμα</div>
                    </div>
                  </div>
                  
                  {nearbyAccessibleRoutes.length > 0 ? (
                    <p style={{ 
                      color: '#4CAF50', 
                      fontWeight: 'bold',
                      fontSize: '16px',
                      textAlign: 'center',
                      padding: '10px',
                      backgroundColor: 'rgba(76, 175, 80, 0.1)',
                      borderRadius: '8px',
                      border: '1px solid rgba(76, 175, 80, 0.3)'
                    }}>
                      ✅ Βρέθηκαν {nearbyAccessibleRoutes.length} προσβάσιμες διαδρομές στην πορεία σας!
                    </p>
                  ) : (
                    <p style={{ 
                      color: '#FF9800', 
                      fontWeight: 'bold',
                      fontSize: '16px',
                      textAlign: 'center',
                      padding: '10px',
                      backgroundColor: 'rgba(255, 152, 0, 0.1)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 152, 0, 0.3)'
                    }}>
                      ⚠️ Δεν βρέθηκαν προσβάσιμες διαδρομές στην πορεία σας.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleStartNavigation}
            className="start-navigation-button"
            disabled={isLoading}
          >
            {mode === 'drive' ? '🚗 Έναρξη Πλοήγησης Αυτοκινήτου' : '🚶‍♂️ Έναρξη Πλοήγησης'}
          </button>
        </div>
      )}

      {searchHistory.length > 0 && (
        <div className="search-history">
          <h3>Πρόσφατες Αναζητήσεις</h3>
          <ul>
            {searchHistory.map((item, index) => (
              <li key={index}>
                <span>
                  {item.mode === 'drive' ? '🚗' : '🚶'} {item.start} → {item.destination}
                  {item.mode === 'drive' && item.distance && (
                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                      ({(item.distance / 1000).toFixed(2)} km)
                    </span>
                  )}
                </span>
                <small>{new Date(item.timestamp).toLocaleString()}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default HomePage;
