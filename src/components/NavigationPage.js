import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap, Popup, Polyline } from "react-leaflet";
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import '../styles/NavigationPage.css';

// Προσθήκη των εικονιδίων
const userIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149060.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const destinationIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const parkingIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

// Εικονίδια για σημεία προσβασιμότητας
const accessibilityIcons = {
  ramp: new L.Icon({
    iconUrl: "/images/disabled-sign_2852495.png",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  }),
  elevator: new L.Icon({
    iconUrl: "/images/down_15890976.png",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  }),
  crossing: new L.Icon({
    iconUrl: "/images/pedestrian-crossing_3897532.png",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  }),
  accessible: new L.Icon({
    iconUrl: "/images/accessibility_1512806.png",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  })
};

function RoutingMachineControl({ start, end, accessibleRoutes, setInstructions, routePath }) {
  const map = useMap();
  const routingControl = useRef(null);

  const generateInstructions = (route, accessibleRoutes) => {
    const instructions = [];
    route.instructions.forEach((instruction, index) => {
      const segment = route.coordinates[index];
      const accessibleSegment = accessibleRoutes.find(ar => ar.path.some(p => calculateDistance(p[0], p[1], segment.lat, segment.lng) < 50));
      if (accessibleSegment) {
        instructions.push(`Ακολουθήστε την προσβάσιμη διαδρομή στα δεξιά σας για ${instruction.distance} μέτρα.`);
      } else {
        instructions.push(instruction.text);
      }
    });
    return instructions;
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  useEffect(() => {
    if (!map || !start || !end || !routePath) return;

    if (routingControl.current) {
      map.removeControl(routingControl.current);
    }

    const waypoints = [
      L.latLng(start[0], start[1]),
      ...routePath.map(point => L.latLng(point[0], point[1])),
      L.latLng(end[0], end[1])
    ];

    routingControl.current = L.Routing.control({
      waypoints: waypoints,
      routeWhileDragging: false,
      showAlternatives: false,
      lineOptions: {
        styles: [{ color: '#ff0000', weight: 4, opacity: 0.7 }]
      },
      createMarker: function() { return null; },
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1'
      }),
      formatter: new L.Routing.Formatter({
        language: 'el',
        units: 'metric'
      })
    }).on('routesfound', function(e) {
      const route = e.routes[0];
      const instructions = generateInstructions(route, accessibleRoutes);
      setInstructions(instructions);
    }).addTo(map);

    return () => {
      if (routingControl.current) {
        map.removeControl(routingControl.current);
      }
    };
  }, [map, start, end, routePath, accessibleRoutes, setInstructions]);

  return null;
}

const NavigationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const ACCESSIBLE_ROUTE_THRESHOLD = 500; // μέτρα - απόσταση για να θεωρείται μια διαδρομή προσβάσιμη
  const [currentPosition, setCurrentPosition] = useState(null);
  const [destination, setDestination] = useState(null);
  const [accessibleRoutes, setAccessibleRoutes] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [routePath, setRoutePath] = useState(null);
  const [startPosition, setStartPosition] = useState(null);
  const [speechSynthesis, setSpeechSynthesis] = useState(null);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [distanceToNext, setDistanceToNext] = useState(null);
  const [lastSpokenTime, setLastSpokenTime] = useState(0);
  const [isRouteVisible, setIsRouteVisible] = useState(true);
  const [parkingSpot, setParkingSpot] = useState(null);
  const [accessibilityPoints, setAccessibilityPoints] = useState([]);
  const [highlightedSegment, setHighlightedSegment] = useState(null);
  
  const watchPositionId = useRef(null);
  const mapRef = useRef(null);

  // Προσθήκη νέων hooks για βελτιστοποίηση
  const [lastRouteUpdate, setLastRouteUpdate] = useState(Date.now());
  const ROUTE_UPDATE_INTERVAL = 5000; // 5 δευτερόλεπτα
  const DEVIATION_THRESHOLD = 100; // μέτρα
  const ROUTE_SIMPLIFICATION_THRESHOLD = 50; // μέτρα

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Υπολογισμός bearing (κατεύθυνσης) μεταξύ δύο σημείων
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    const bearing = Math.atan2(y, x) * 180/Math.PI;
    return (bearing + 360) % 360; // Νορμαλοποίηση σε 0-360
  };

  const isPointNearAccessibleRoute = (point, accessibleRoutes) => {
    for (const route of accessibleRoutes) {
      for (const routePoint of route.path) {
        const distance = calculateDistance(
          point[0], point[1],
          routePoint[0], routePoint[1]
        );
        if (distance <= ACCESSIBLE_ROUTE_THRESHOLD) { // Χρησιμοποιούμε τη νέα σταθερά
          return true;
        }
      }
    }
    return false;
  };

  const fetchRouteInstructions = async () => {
    if (!routePath || routePath.length < 2) {
      return;
    }

    try {
      
      const start = routePath[0];
      const end = routePath[routePath.length - 1];
      const waypointsStr = `${start[1]},${start[0]};${end[1]},${end[0]}`;
      
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/foot/${waypointsStr}?steps=true&geometries=geojson&overview=full&annotations=true`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.routes || !data.routes.length) {
        throw new Error("Δεν βρέθηκαν διαδρομές");
      }

      const route = data.routes[0];
      const segmentInstructions = [];

      // Αρχική οδηγία
      segmentInstructions.push({
        text: 'Ξεκινήστε τη διαδρομή',
        icon: '⭐',
        distance: 0,
        isAccessible: false,
        location: start,
        maneuver: { type: 'depart' }
      });

      route.legs.forEach(leg => {
        leg.steps.forEach(step => {
          const location = step.geometry.coordinates[0];
          const isNearAccessible = isPointNearAccessibleRoute(
            [location[1], location[0]],
            accessibleRoutes
          );

          let instruction = '';
          let icon = '';
          let accessibilityInfo = '';

          // Προσθήκη πληροφοριών προσβασιμότητας
          if (isNearAccessible) {
            const nearestRoute = accessibleRoutes.find(ar => 
              ar.path.some(p => calculateDistance(p[0], p[1], location[1], location[0]) < 50)
            );
            
            if (nearestRoute) {
              accessibilityInfo = ` Υπάρχει προσβάσιμη διαδρομή στα δεξιά σας.`;
            }
          }

          // Μετατροπή της απόστασης σε μέτρα
          const distance = Math.round(step.distance);

          // Προσθήκη ονόματος οδού αν υπάρχει
          const streetName = step.name ? ` στην ${step.name}` : '';

          switch (step.maneuver.type) {
            case 'turn':
              switch (step.maneuver.modifier) {
                case 'left':
                  instruction = `Στρίψτε αριστερά${streetName}${accessibilityInfo}`;
                  icon = '↰';
                  break;
                case 'right':
                  instruction = `Στρίψτε δεξιά${streetName}${accessibilityInfo}`;
                  icon = '↱';
                  break;
                case 'slight left':
                  instruction = `Στρίψτε ελαφρώς αριστερά${streetName}${accessibilityInfo}`;
                  icon = '↖';
                  break;
                case 'slight right':
                  instruction = `Στρίψτε ελαφρώς δεξιά${streetName}${accessibilityInfo}`;
                  icon = '↗';
                  break;
                case 'sharp left':
                  instruction = `Στρίψτε απότομα αριστερά${streetName}${accessibilityInfo}`;
                  icon = '⬉';
                  break;
                case 'sharp right':
                  instruction = `Στρίψτε απότομα δεξιά${streetName}${accessibilityInfo}`;
                  icon = '⬈';
                  break;
                case 'uturn':
                  instruction = `Κάντε αναστροφή${streetName}${accessibilityInfo}`;
                  icon = '⮌';
                  break;
                default:
                  instruction = `Συνεχίστε ευθεία${streetName}${accessibilityInfo}`;
                  icon = '↑';
              }
              break;
            case 'new name':
            case 'continue':
              instruction = `Συνεχίστε ευθεία${streetName}${accessibilityInfo}`;
              icon = '↑';
              break;
            case 'depart':
              instruction = `Ξεκινήστε τη διαδρομή${streetName}${accessibilityInfo}`;
              icon = '⭐';
              break;
            case 'arrive':
              instruction = `Έχετε φτάσει στον προορισμό σας${accessibilityInfo}`;
              icon = '🏁';
              break;
            default:
              instruction = `Συνεχίστε την πορεία σας${streetName}${accessibilityInfo}`;
              icon = '→';
          }

          // Προσθήκη της οδηγίας μόνο αν έχει σημαντική απόσταση
          if (distance > 20) {
            segmentInstructions.push({
              text: instruction,
              icon: icon,
              distance: distance,
              isAccessible: isNearAccessible,
              maneuver: step.maneuver,
              location: [location[1], location[0]],
              streetName: step.name
            });
          }
        });
      });

      // Τελική οδηγία
      segmentInstructions.push({
        text: 'Έχετε φτάσει στον προορισμό σας',
        icon: '🏁',
        distance: 0,
        isAccessible: false,
        location: end,
        maneuver: { type: 'arrive' }
      });

      // Αφαιρούμε διπλότυπες οδηγίες
      const uniqueInstructions = removeDuplicateInstructions(segmentInstructions);
      setInstructions(uniqueInstructions);

    } catch (error) {
      console.error("Σφάλμα κατά τη λήψη οδηγιών:", error);
      // Σε περίπτωση σφάλματος, κρατάμε τις βασικές οδηγίες
      const basicInstructions = createBasicInstructions(routePath);
      setInstructions(basicInstructions);
    }
  };

  const cleanRoutePath = (path) => {
    if (!path || path.length < 2) return path;

    // Αφαιρούμε διπλότυπα σημεία
    const uniquePoints = path.filter((point, index, self) =>
      index === 0 || index === self.length - 1 || 
      calculateDistance(point[0], point[1], self[index - 1][0], self[index - 1][1]) > 10
    );

    return uniquePoints;
  };

  const splitRouteIntoSegments = (path) => {
    if (!path || path.length < 2) return path;

    const segments = [];
    const segmentLength = Math.max(2, Math.floor(path.length / 10)); // Μέγιστο 10 τμήματα

    for (let i = 0; i < path.length; i += segmentLength) {
      segments.push(path[i]);
    }

    // Προσθέτουμε πάντα το τελευταίο σημείο
    if (segments[segments.length - 1] !== path[path.length - 1]) {
      segments.push(path[path.length - 1]);
    }

    return segments;
  };

  const removeDuplicateInstructions = (instructions) => {
    return instructions.filter((instruction, index, self) => {
      if (index === 0) return true;
      const prev = self[index - 1];
      
      // Αφαιρούμε διαδοχικές παρόμοιες οδηγίες
      return !(
        instruction.text === prev.text &&
        instruction.distance < 50 && // Αγνοούμε μικρές αποστάσεις
        instruction.maneuver.type === prev.maneuver.type
      );
    });
  };

  const simplifyRoute = useCallback((coordinates) => {
    if (coordinates.length <= 2) return coordinates;

    const simplified = [coordinates[0]];
    let lastPoint = coordinates[0];

    for (let i = 1; i < coordinates.length - 1; i++) {
      const distance = calculateDistance(
        lastPoint[0], lastPoint[1],
        coordinates[i][0], coordinates[i][1]
      );

      if (distance > ROUTE_SIMPLIFICATION_THRESHOLD) {
        simplified.push(coordinates[i]);
        lastPoint = coordinates[i];
      }
    }

    simplified.push(coordinates[coordinates.length - 1]);
    return simplified;
  }, []);

  const createBasicInstructions = (path) => {
    const instructions = [];
    
    // Αρχική οδηγία
    instructions.push({
      text: 'Ξεκινήστε τη διαδρομή',
      icon: '⭐',
      distance: 0,
      isAccessible: false,
      location: path[0]
    });

    // Ενδιάμεσες οδηγίες
    for (let i = 1; i < path.length - 1; i += Math.floor(path.length / 5)) {
      const isNearAccessible = isPointNearAccessibleRoute(path[i], accessibleRoutes);
      instructions.push({
        text: isNearAccessible ? 
          'Συνεχίστε στην προσβάσιμη διαδρομή' : 
          'Συνεχίστε στην πορεία σας',
        icon: '↑',
        distance: calculateDistance(
          path[i][0], path[i][1],
          path[i-1][0], path[i-1][1]
        ),
        isAccessible: isNearAccessible,
        location: path[i]
      });
    }

    // Τελική οδηγία
    instructions.push({
      text: 'Έχετε φτάσει στον προορισμό σας',
      icon: '🏁',
      distance: 0,
      isAccessible: false,
      location: path[path.length - 1]
    });

    return instructions;
  };

  const updateRouteWithAccessiblePaths = async (currentPosition, destination) => {
    if (!currentPosition || !destination) return;

    try {

      // Βρίσκουμε τη συντομότερη διαδρομή
      const waypointsStr = `${currentPosition[1]},${currentPosition[0]};${destination[1]},${destination[0]}`;
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/foot/${waypointsStr}?steps=true&geometries=geojson&overview=full&annotations=true`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.routes || !data.routes.length) {
        throw new Error("Δεν βρέθηκαν διαδρομές");
      }

      const route = data.routes[0];
      const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
      
      // Διαχωρίζουμε τη διαδρομή σε τμήματα
      const segments = [];
      let currentSegment = [];
      let lastPoint = null;

      for (const point of coordinates) {
        if (lastPoint) {
          const distance = calculateDistance(
            lastPoint[0], lastPoint[1],
            point[0], point[1]
          );

          // Αν η απόσταση είναι μεγάλη, ξεκινάμε νέο τμήμα
          if (distance > 100) { // 100 μέτρα
            if (currentSegment.length > 0) {
              segments.push(currentSegment);
              currentSegment = [];
            }
          }
        }
        currentSegment.push(point);
        lastPoint = point;
      }
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }

      // Ελέγχουμε κάθε τμήμα για προσβάσιμες διαδρομές
      const finalRoute = [];
      for (const segment of segments) {
        const startPoint = segment[0];
        const endPoint = segment[segment.length - 1];
        
        // Ελέγχουμε αν υπάρχει προσβάσιμη διαδρομή κοντά
        const accessibleRoute = accessibleRoutes.find(ar => {
          const startNearAccessible = ar.path.some(p => 
            calculateDistance(p[0], p[1], startPoint[0], startPoint[1]) < ACCESSIBLE_ROUTE_THRESHOLD
          );
          const endNearAccessible = ar.path.some(p => 
            calculateDistance(p[0], p[1], endPoint[0], endPoint[1]) < ACCESSIBLE_ROUTE_THRESHOLD
          );
          return startNearAccessible && endNearAccessible;
        });

        if (accessibleRoute) {
          // Προσθέτουμε την προσβάσιμη διαδρομή
          finalRoute.push(...accessibleRoute.path);
        } else {
          // Προσθέτουμε την κανονική διαδρομή
          finalRoute.push(...segment);
        }
      }

      // Αφαιρούμε διπλότυπα σημεία
      const cleanRoute = finalRoute.filter((point, index, self) =>
        index === self.findIndex(p => 
          calculateDistance(p[0], p[1], point[0], point[1]) < 1
        )
      );

      setRoutePath(cleanRoute);

    } catch (error) {
      console.error("Σφάλμα κατά την ενημέρωση της διαδρομής:", error);
    }
  };

  // Προσθήκη νέας συνάρτησης για το focus του χάρτη
  const focusMapOnRoute = useCallback((path) => {
    if (!mapRef.current || !path || path.length < 2) {
      return;
    }

    const map = mapRef.current;
    
    try {
    const bounds = L.latLngBounds(path.map(point => L.latLng(point[0], point[1])));
    
    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 18,
      animate: true,
      duration: 1
    });
      
    } catch (error) {
      console.error("Σφάλμα κατά το focus:", error);
    }
  }, []);

  // Ενημέρωση του useEffect για το location.state
  useEffect(() => {
    if (!location.state || !location.state.route) {
      navigate('/');
      return;
    }


    setDestination(location.state.destination);
    setRoutePath(location.state.route.path);
    setStartPosition(location.state.start);
    setAccessibleRoutes(location.state.nearbyRoutes || []);
    setParkingSpot(location.state.parkingSpot || null);
    setAccessibilityPoints(location.state.accessibilityPoints || []);
    
    // Debug: Εμφάνιση parking spot info
    if (location.state.parkingSpot) {
    }

    // Focus στον χάρτη με τη διαδρομή - με μικρή καθυστέρηση για να φορτώσει ο χάρτης
    setTimeout(() => {
    focusMapOnRoute(location.state.route.path);
    }, 500);

    // Χρήση των οδηγιών από το state
    if (location.state.route.instructions) {
      const processedInstructions = location.state.route.instructions.map(instruction => {
        let text = instruction.text;
        let icon = '→';
        let isAccessible = false;

        // Αν είναι προσβάσιμη διαδρομή
        if (text.includes('προσβάσιμη')) {
          icon = '♿';
          isAccessible = true;
          // Αφαίρεση διπλότυπων λέξεων
          text = text.replace(/διαδρομή.*διαδρομή/, 'διαδρομή');
          text = text.replace(/στην.*στην/, 'στην');
          text = text.replace(/Καλλιθέας.*Καλλιθέας/, 'Καλλιθέας');
        } else {
          // Μετατροπή αγγλικών λέξεων και απλοποίηση οδηγιών
          text = text.replace(/left/gi, 'αριστερά')
                    .replace(/right/gi, 'δεξιά')
                    .replace(/straight/gi, 'ευθεία')
                    .replace(/slight/gi, 'ελαφρώς')
                    .replace(/sharp/gi, 'απότομα')
                    .replace(/uturn/gi, 'αναστροφή');

          if (text.includes('ευθεία')) {
            icon = '↑';
            text = 'Συνεχίστε ευθεία';
          } else if (text.includes('αριστερά')) {
            icon = '↰';
            text = 'Στρίψτε αριστερά';
          } else if (text.includes('δεξιά')) {
            icon = '↱';
            text = 'Στρίψτε δεξιά';
          } else if (text.includes('αναστροφή')) {
            icon = '⮌';
            text = 'Κάντε αναστροφή';
          }

          // Προσθήκη ονόματος οδού αν υπάρχει
          if (instruction.text.includes('στην')) {
            const streetName = instruction.text.split('στην')[1]?.trim();
            if (streetName) {
              // Αφαίρεση διπλότυπων ονομάτων οδών
              const cleanStreetName = streetName.replace(/Καλλιθέας.*Καλλιθέας/, 'Καλλιθέας');
              text = `${text} στην ${cleanStreetName}`;
            }
          }
        }

        // Τελικός καθαρισμός του κειμένου
        text = text.replace(/στην.*στην/, 'στην')
                  .replace(/διαδρομή.*διαδρομή/, 'διαδρομή')
                  .replace(/Καλλιθέας.*Καλλιθέας/, 'Καλλιθέας');

        return {
          text,
          icon,
          distance: Math.round(instruction.distance),
          isAccessible,
          location: instruction.location,
          maneuver: { type: 'continue' }
        };
      });

      // Αφαίρεση διπλότυπων και απλοποίηση οδηγιών
      const filteredInstructions = processedInstructions.reduce((acc, instruction, index, array) => {
        if (index === 0) {
          acc.push(instruction);
          return acc;
        }

        const prev = array[index - 1];
        
        // Αφαιρούμε διπλότυπες οδηγίες
        if (instruction.text === prev.text) return acc;
        
        // Αφαιρούμε μικρές αποστάσεις (λιγότερο από 30 μέτρα) - ΕΚΤΟΣ από προσβάσιμες διαδρομές
        if (instruction.distance < 30 && !instruction.isAccessible) return acc;
        
        // Συνδυάζουμε διαδοχικές στροφές στην ίδια κατεύθυνση
        if (instruction.text === prev.text && 
            (instruction.text.includes('αριστερά') || 
             instruction.text.includes('δεξιά') || 
             instruction.text.includes('ευθεία'))) {
          prev.distance += instruction.distance;
          return acc;
        }

        acc.push(instruction);
        return acc;
      }, []);

      // Προσθήκη αρχικής και τελικής οδηγίας
      const finalInstructions = [
        {
          text: 'Ξεκινήστε τη διαδρομή',
          icon: '⭐',
          distance: 0,
          isAccessible: false,
          location: location.state.start,
          maneuver: { type: 'depart' }
        },
        ...filteredInstructions,
        {
          text: 'Έχετε φτάσει στον προορισμό',
          icon: '🏁',
          distance: 0,
          isAccessible: false,
          location: location.state.destination,
          maneuver: { type: 'arrive' }
        }
      ];

      setInstructions(finalInstructions);
    }
  }, [location.state, navigate, focusMapOnRoute]);

  // Επιπλέον useEffect για να κάνει focus όταν ο χάρτης είναι έτοιμος
  useEffect(() => {
    if (mapRef.current && routePath && routePath.length > 0) {
      setTimeout(() => {
        focusMapOnRoute(routePath);
      }, 100);
    }
  }, [mapRef.current, routePath, focusMapOnRoute]);

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition([position.coords.latitude, position.coords.longitude]);
      },
      (error) => console.error("Error getting location:", error),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Αρχικοποίηση του Speech Synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setSpeechSynthesis(window.speechSynthesis);
      // Φόρτωση ελληνικής φωνής αν υπάρχει
      window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        const greekVoice = voices.find(voice => voice.lang.includes('el'));
        if (greekVoice) {
        }
      };
    }
  }, []);

  // Βελτιωμένη συνάρτηση εκφώνησης οδηγιών
  const speakInstruction = useCallback((instruction, priority = false) => {
    if (!speechSynthesis || !instruction) return;

    const now = Date.now();
    // Αποφυγή συχνών επαναλήψεων (τουλάχιστον 3 δευτερόλεπτα διαφορά)
    if (!priority && now - lastSpokenTime < 3000) return;

    speechSynthesis.cancel(); // Ακύρωση προηγούμενης εκφώνησης
    
    const utterance = new SpeechSynthesisUtterance(instruction.text);
    utterance.lang = 'el-GR';
    utterance.volume = 1;
    utterance.rate = 0.9; // Ελαφρώς πιο αργή εκφώνηση για καλύτερη κατανόηση
    
    utterance.onend = () => {
      setLastSpokenTime(Date.now());
    };

    speechSynthesis.speak(utterance);
  }, [speechSynthesis, lastSpokenTime]);

  // Βελτιστοποιημένη συνάρτηση για τον υπολογισμό της διαδρομής
  const calculateOptimizedRoute = useCallback(async (start, end) => {
    try {
      const waypointsStr = `${start[1]},${start[0]};${end[1]},${end[0]}`;
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/foot/${waypointsStr}?steps=true&geometries=geojson&overview=full&annotations=true`
      );

      if (!response.ok) throw new Error("Σφάλμα υπολογισμού διαδρομής");
      
      const data = await response.json();
      if (!data.routes?.length) throw new Error("Δεν βρέθηκε διαδρομή");

      const route = data.routes[0];
      const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
      
      // Απλοποίηση διαδρομής
      const simplifiedRoute = simplifyRoute(coordinates);
      
      // Έλεγχος για προσβάσιμες διαδρομές
      const finalRoute = await optimizeRouteWithAccessiblePaths(simplifiedRoute);
      
      return {
        path: finalRoute,
        instructions: generateInstructions(route, accessibleRoutes)
      };
    } catch (error) {
      console.error("Σφάλμα υπολογισμού διαδρομής:", error);
      throw error;
    }
  }, [accessibleRoutes]);

  // Βελτιστοποιημένη συνάρτηση για την ενημέρωση του χάρτη
  const updateMapView = useCallback((bounds) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const currentBounds = map.getBounds();
    
    // Ενημέρωση μόνο αν τα νέα όρια είναι σημαντικά διαφορετικά
    if (!currentBounds.contains(bounds) || 
        currentBounds.getNorth() - currentBounds.getSouth() > bounds.getNorth() - bounds.getSouth() * 1.5) {
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 18,
        animate: true,
        duration: 1
      });
    }
  }, []);

  // Βελτιστοποιημένη συνάρτηση checkDistanceToNextInstruction
  const checkDistanceToNextInstruction = useCallback((position) => {
    if (!instructions[currentInstructionIndex] || !position) return;

    const nextInstruction = instructions[currentInstructionIndex];
    const distance = calculateDistance(
      position[0], position[1],
      nextInstruction.location[0], nextInstruction.location[1]
    );

    setDistanceToNext(distance);

    // Έλεγχος για απόκλιση και επανυπολογισμό διαδρομής
    if (distance > DEVIATION_THRESHOLD) {
      const now = Date.now();
      // Περιορισμός συχνότητας επανυπολογισμού
      if (now - lastRouteUpdate > ROUTE_UPDATE_INTERVAL) {
        setLastRouteUpdate(now);
        
        calculateOptimizedRoute(position, destination)
          .then(({ path, instructions: newInstructions }) => {
            setRoutePath(path);
            setInstructions(newInstructions);
            setCurrentInstructionIndex(0);
            
            // Ενημέρωση του χάρτη με νέα όρια
            const bounds = L.latLngBounds(path.map(point => L.latLng(point[0], point[1])));
            updateMapView(bounds);
            
            speakInstruction({
              text: "Επανυπολογισμός διαδρομής από την τρέχουσα θέση"
            }, true);
          })
          .catch(error => {
            console.error("Σφάλμα επανυπολογισμού:", error);
            speakInstruction({
              text: "Δεν ήταν δυνατός ο επανυπολογισμός της διαδρομής"
            }, true);
          });
      }
    } else {
              // Κανονική εκφώνηση οδηγιών
    if (distance <= 30) {
      speakInstruction(nextInstruction, true);
      setCurrentInstructionIndex(prev => prev + 1);
    } else if (distance <= 100) {
      speakInstruction({
        text: `Σε ${Math.round(distance)} μέτρα ${nextInstruction.text}`
      });
    }
    
    // Google Maps style: Αυτόματο tracking της θέσης κατά τη διάρκεια πλοήγησης
    if (isNavigating && mapRef.current) {
      const map = mapRef.current;
      
      // Αυτόματο zoom και tracking στη θέση του χρήστη
      map.setView(position, 18, {
        animate: true,
        duration: 0.5
      });
      
    }
    }
  }, [
    instructions, 
    currentInstructionIndex, 
    speakInstruction, 
    destination, 
    lastRouteUpdate,
    calculateOptimizedRoute,
    updateMapView
  ]);

  // Ενημέρωση του useEffect για την παρακολούθηση θέσης
  useEffect(() => {
    if (!isNavigating) return;

    let lastValidPosition = null;
    let accuracyThreshold = 50; // μέτρα
    let positionTimeout = null;
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 1000; // 1 δευτερόλεπτο

    watchPositionId.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        // Περιορισμός συχνότητας ενημερώσεων
        if (now - lastUpdate < UPDATE_INTERVAL) return;
        lastUpdate = now;

        if (position.coords.accuracy > accuracyThreshold) {
          return;
        }

        const newPosition = [position.coords.latitude, position.coords.longitude];
        
        // Φιλτράρισμα σημάτων και υπολογισμός bearing
        if (lastValidPosition) {
          const distance = calculateDistance(
            lastValidPosition[0], lastValidPosition[1],
            newPosition[0], newPosition[1]
          );
          
          if (distance > 100) {
            return;
          }
          
          // Υπολογισμός bearing (κατεύθυνσης) - για μελλοντική χρήση
          const bearing = calculateBearing(
            lastValidPosition[0], lastValidPosition[1],
            newPosition[0], newPosition[1]
          );
          // setUserBearing(bearing); // Αφαιρέθηκε - δεν υποστηρίζεται από Leaflet
        }

        lastValidPosition = newPosition;
        setCurrentPosition(newPosition);
        checkDistanceToNextInstruction(newPosition);

        // Focus στον χάρτη με την τρέχουσα θέση και τη διαδρομή
        if (routePath) {
          const allPoints = [newPosition, ...routePath];
          focusMapOnRoute(allPoints);
        }

        // Εκκαθάριση του timeout
        if (positionTimeout) {
          clearTimeout(positionTimeout);
        }

        // Ορισμός νέου timeout
        positionTimeout = setTimeout(() => {
          speakInstruction({
            text: "Προσοχή: Δεν εντοπίζεται κίνηση"
          }, true);
        }, 30000);
      },
      (error) => {
        console.error("Σφάλμα εντοπισμού:", error);
        speakInstruction({
          text: "Προσοχή: Χάθηκε το σήμα GPS"
        }, true);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );

    return () => {
      if (watchPositionId.current) {
        navigator.geolocation.clearWatch(watchPositionId.current);
      }
      if (positionTimeout) {
        clearTimeout(positionTimeout);
      }
    };
  }, [isNavigating, checkDistanceToNextInstruction, routePath, focusMapOnRoute]);

  // Έναρξη/Παύση πλοήγησης
  const toggleNavigation = () => {
    setIsNavigating(prev => !prev);
    if (!isNavigating) {
      // Έναρξη πλοήγησης
      setCurrentInstructionIndex(0);
      if (instructions.length > 0) {
        speakInstruction(instructions[0], true);
      }
      
      // Google Maps style: Zoom in στη θέση του χρήστη
      if (mapRef.current && currentPosition) {
        const map = mapRef.current;
        
        // Zoom in στη θέση του χρήστη
        map.setView(currentPosition, 18, {
          animate: true,
          duration: 1
        });
        
      }
    } else {
      // Παύση πλοήγησης
      speechSynthesis?.cancel();
      
      // Επιστροφή σε κανονική όψη
      if (mapRef.current) {
        const map = mapRef.current;
        
        // Επιστροφή σε zoom out για να δεις όλη τη διαδρομή
        if (routePath && routePath.length > 0) {
          const bounds = L.latLngBounds(routePath.map(point => L.latLng(point[0], point[1])));
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 16,
            animate: true,
            duration: 1
          });
        }
        
      }
    }
  };



  // Έλεγχος αν ένα σημείο βρίσκεται κοντά σε μια διαδρομή
  const isPointNearRoute = useCallback((point, route, threshold = 50) => {
    if (!route || !route.length) return false;

    for (let i = 0; i < route.length - 1; i++) {
      const distance = calculateDistance(
        point[0], point[1],
        route[i][0], route[i][1]
      );
      
      if (distance <= threshold) return true;
    }
    
    return false;
  }, []);

  // Εύρεση του πλησιέστερου σημείου σε μια διαδρομή
  const findNearestPoint = useCallback((point, route) => {
    if (!route || !route.length) return null;

    let nearestPoint = null;
    let minDistance = Infinity;

    for (const routePoint of route) {
      const distance = calculateDistance(
        point[0], point[1],
        routePoint[0], routePoint[1]
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = routePoint;
      }
    }

    return nearestPoint;
  }, []);

  // Εύρεση προσβάσιμου τμήματος διαδρομής για highlight
  const findAccessibleRouteSegment = useCallback((location) => {
    if (!accessibleRoutes || !accessibleRoutes.length) return null;
    
    // Βρίσκουμε την προσβάσιμη διαδρομή που είναι πιο κοντά στο σημείο
    let nearestRoute = null;
    let minDistance = Infinity;
    
    for (const route of accessibleRoutes) {
      for (const point of route.path) {
        const distance = calculateDistance(
          location[0], location[1],
          point[0], point[1]
        );
        
        if (distance < minDistance && distance < 100) { // 100 μέτρα ακτίνα
          minDistance = distance;
          nearestRoute = route;
        }
      }
    }
    
    return nearestRoute ? nearestRoute.path : null;
  }, [accessibleRoutes]);

  // Εύρεση προσβάσιμης διαδρομής μεταξύ δύο σημείων
  const findAccessiblePath = useCallback(async (start, end) => {
    if (!accessibleRoutes || !accessibleRoutes.length) return null;

    // Έλεγχος αν τα σημεία είναι ήδη σε προσβάσιμη διαδρομή
    const startRoute = accessibleRoutes.find(route => isPointNearRoute(start, route));
    const endRoute = accessibleRoutes.find(route => isPointNearRoute(end, route));

    if (startRoute && endRoute && startRoute === endRoute) {
      // Τα σημεία είναι στην ίδια προσβάσιμη διαδρομή
      return [start, end];
    }

    // Αναζήτηση συντομότερης προσβάσιμης διαδρομής
    let shortestPath = null;
    let minDistance = Infinity;

    for (const route of accessibleRoutes) {
      const startPoint = findNearestPoint(start, route);
      const endPoint = findNearestPoint(end, route);
      
      if (startPoint && endPoint) {
        const distance = calculateDistance(
          startPoint[0], startPoint[1],
          endPoint[0], endPoint[1]
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          shortestPath = [start, startPoint, endPoint, end];
        }
      }
    }

    return shortestPath;
  }, [accessibleRoutes, isPointNearRoute, findNearestPoint]);

  // Βελτιστοποίηση διαδρομής με προσβάσιμες διαδρομές
  const optimizeRouteWithAccessiblePaths = useCallback(async (route) => {
    if (!route || route.length < 2) return route;

    const optimizedRoute = [route[0]];
    
    for (let i = 1; i < route.length; i++) {
      const currentPoint = route[i];
      const prevPoint = optimizedRoute[optimizedRoute.length - 1];
      
      // Έλεγχος για προσβάσιμες διαδρομές μεταξύ των σημείων
      const accessiblePath = await findAccessiblePath(prevPoint, currentPoint);
      
      if (accessiblePath) {
        optimizedRoute.push(...accessiblePath.slice(1));
      } else {
        optimizedRoute.push(currentPoint);
      }
    }
    
    return optimizedRoute;
  }, [findAccessiblePath]);

  // Δημιουργία οδηγιών από τη διαδρομή
  const generateInstructions = useCallback((route, accessibleRoutes) => {
    if (!route || !route.legs || !route.legs[0] || !route.legs[0].steps) {
      return [];
    }

    return route.legs[0].steps.map(step => {
      const location = [step.maneuver.location[1], step.maneuver.location[0]];
      const distance = step.distance;
      const duration = step.duration;
      
      // Έλεγχος για προσβάσιμες διαδρομές
      const isAccessible = accessibleRoutes.some(route => 
        isPointNearRoute(location, route)
      );

      return {
        text: `${step.maneuver.modifier || ''} ${step.maneuver.type}`,
        location,
        distance,
        duration,
        isAccessible
      };
    });
  }, [accessibleRoutes]);

  useEffect(() => {
    const fetchAccessibilityPoints = async () => {
      try {
        const pointsRef = collection(db, "accessibilityPoints");
        const q = query(pointsRef);
        const querySnapshot = await getDocs(q);
        
        const points = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          points.push({
            id: doc.id,
            ...data,
            position: [data.latitude, data.longitude],
            icon: accessibilityIcons[data.type] || accessibilityIcons.accessible
          });
        });
        
        setAccessibilityPoints(points);
      } catch (error) {
        console.error("Error fetching accessibility points:", error);
      }
    };

    fetchAccessibilityPoints();
  }, []);

  return (
    <div className="navigation-container">
      <div className="navigation-content">
        <div className="map-section">
          <MapContainer
            ref={mapRef}
            center={startPosition || [37.9838, 23.7275]}
            zoom={15}
            className="map-container"
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {isRouteVisible && routePath && (
              <Polyline
                positions={routePath}
                color={location.state?.route?.color || 'purple'}
                weight={4}
                opacity={0.7}
              />
            )}

            {/* Highlighted προσβάσιμο τμήμα */}
            {highlightedSegment && (
              <Polyline
                positions={highlightedSegment}
                color="#34a853"
                weight={8}
                opacity={0.9}
                dashArray="10, 5"
              />
            )}

            {currentPosition && (
              <Marker position={currentPosition} icon={userIcon}>
                <Popup>Η τρέχουσα θέση σας</Popup>
              </Marker>
            )}

            {startPosition && (
              <Marker position={startPosition} icon={userIcon}>
                <Popup>Αφετηρία</Popup>
              </Marker>
            )}

            {destination && (
              <Marker position={destination} icon={destinationIcon}>
                <Popup>Προορισμός</Popup>
              </Marker>
            )}

            {parkingSpot && (
              <Marker position={[parkingSpot.lat, parkingSpot.lng]} icon={parkingIcon}>
                <Popup>
                  <div>
                    <h3>{parkingSpot.type === 'accessible_parking' ? 'Προσβάσιμος Χώρος Στάθμευσης' : 'Χώρος Στάθμευσης'}</h3>
                    {parkingSpot.description && <p>{parkingSpot.description}</p>}
                  </div>
                </Popup>
              </Marker>
            )}

            {accessibilityPoints.map((point) => (
              <Marker
                key={point.id}
                position={[point.lat, point.lng]}
                icon={L.icon({
                  iconUrl: point.type === 'ramp' ? "/images/disabled-sign_2852495.png" : 
                         point.type === 'elevator' ? "/images/down_15890976.png" : 
                         point.type === 'crossing' ? "/images/pedestrian-crossing_3897532.png" : 
                         "/images/accessibility_1512806.png",
                  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
                  iconSize: [24, 24],
                  iconAnchor: [12, 24],
                  popupAnchor: [1, -24],
                  shadowSize: [41, 41]
                })}
              >
                <Popup>
                  <div>
                    <h3>{point.type === 'ramp' ? 'Ράμπα' : point.type === 'elevator' ? 'Ανελκυστήρας' : point.type === 'crossing' ? 'Διαβάσεις' : 'Προσβάσιμο σημείο'}</h3>
                    <p>{point.description}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          <div className="map-controls">
            <button
              onClick={toggleNavigation}
              className={`map-control-button ${isNavigating ? 'danger' : 'active'}`}
            >
              {isNavigating ? '⏸️ Παύση Πλοήγησης' : '🚀 Έναρξη Πλοήγησης'}
            </button>
            
            <button
              onClick={() => setIsRouteVisible(prev => !prev)}
              className="map-control-button"
            >
              {isRouteVisible ? '👁️ Απόκρυψη Διαδρομής' : '👁️ Εμφάνιση Διαδρομής'}
            </button>

            {highlightedSegment && (
              <button
                onClick={() => setHighlightedSegment(null)}
                className="map-control-button"
                style={{ backgroundColor: '#34a853', color: 'white' }}
              >
                🚫 Καθαρισμός Highlight
              </button>
            )}
          </div>

        </div>

        <div className="instructions-panel">
          <div className="instructions-header">
            <h2>Οδηγίες Πλοήγησης</h2>
          </div>
          
          {distanceToNext && (
            <div className="distance-info">
              <div className="distance-icon">→</div>
              <div className="distance-label">Επόμενη στροφή σε:</div>
              <div className="distance-value">
                  {distanceToNext >= 1000 
                    ? `${(distanceToNext/1000).toFixed(1)} χλμ`
                    : `${Math.round(distanceToNext)} μ`}
              </div>
            </div>
          )}

                  <div className="instructions-list">
          {instructions.map((instruction, index) => (
            <div 
              key={index} 
              className={`instruction-item ${index === currentInstructionIndex ? 'active' : ''} ${instruction.isAccessible ? 'accessible' : ''}`}
              onClick={() => {
                if (instruction.isAccessible) {
                  // Βρίσκουμε το προσβάσιμο τμήμα της διαδρομής
                  const accessibleSegment = findAccessibleRouteSegment(instruction.location);
                  setHighlightedSegment(accessibleSegment);
                  
                  // Αφαιρούμε το highlight μετά από 5 δευτερόλεπτα
                  setTimeout(() => {
                    setHighlightedSegment(null);
                  }, 5000);
                  
                  // Εκφώνηση της οδηγίας
                  speakInstruction(instruction, true);
                }
              }}
              style={{ cursor: instruction.isAccessible ? 'pointer' : 'default' }}
            >
                <div className="instruction-icon">
                  <span>{instruction.icon}</span>
                </div>
                              <div className="instruction-content">
                <div className="instruction-text">
                  {instruction.text}
                  {instruction.isAccessible && (
                    <span style={{ 
                      fontSize: '0.8rem', 
                      color: '#34a853', 
                      marginLeft: '8px',
                      fontStyle: 'italic'
                    }}>
                      (κάντε κλικ για highlight)
                    </span>
                  )}
                </div>
                {instruction.distance > 0 && (
                  <div className="instruction-distance">
                    <span className="distance-dot"></span>
                    {instruction.distance >= 1000 
                      ? `${(instruction.distance/1000).toFixed(1)} χλμ` 
                      : `${instruction.distance} μ`}
                  </div>
                )}
              </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationPage; 
 
