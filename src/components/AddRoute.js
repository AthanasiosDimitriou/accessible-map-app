import React, { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";

// Δημιουργία του custom marker icon
const customIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/149/149060.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

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

  return R * c;
};

const MIN_DISTANCE_BETWEEN_POINTS = 10; // μέτρα

const startIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const waypointIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const parkingIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const accessibilityIcons = {
  crossing: {
    icon: '🚶',
    description: 'Διάβαση πεζών'
  },
  ramp: {
    icon: '🛗',
    description: 'Ράμπα'
  },
  stairs: {
    icon: '🪜',
    description: 'Σκάλες'
  },
  obstacle: {
    icon: '⚠️',
    description: 'Εμπόδιο'
  },
  elevator: {
    icon: '🛗',
    description: 'Ανελκυστήρας'
  },
  narrow: {
    icon: '↔️',
    description: 'Στενό Πέρασμα'
  },
  parking: {
    icon: '🅿️',
    description: 'Χώρος Στάθμευσης'
  },
  accessible_parking: {
    icon: '♿🅿️',
    description: 'Προσβάσιμος Χώρος Στάθμευσης'
  }
};

const AddRoute = () => {
  const [waypoints, setWaypoints] = useState([]);
  const [points, setPoints] = useState([]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [currentPoint, setCurrentPoint] = useState(null);
  const [pointType, setPointType] = useState("");
  const [pointDescription, setPointDescription] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewRoute, setPreviewRoute] = useState(null);
  const [editingPoint, setEditingPoint] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [routeMode, setRouteMode] = useState('foot'); // 'foot' ή 'drive'
  const mapRef = useRef(null);

  // Καθαρισμός σημείων όταν αλλάζει το mode
  useEffect(() => {
    setWaypoints([]);
    setPoints([]);
    setMessage("");
  }, [routeMode]);

  const isPointOnRoad = async (lat, lng) => {
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `[out:json][timeout:25];
          way(around:5,${lat},${lng})
          ["highway"]
          ["highway"!~"footway|cycleway|path|service|track"];
          out geom;`
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      
      if (!data.elements || data.elements.length === 0) {
        return false;
      }

      // Έλεγχος αν το σημείο είναι κοντά σε κάποιον δρόμο
      for (const way of data.elements) {
        if (way.geometry) {
          for (let i = 0; i < way.geometry.length - 1; i++) {
            const point1 = way.geometry[i];
            const point2 = way.geometry[i + 1];
            
            const distance = pointToLineDistance(
              lat, lng,
              point1.lat, point1.lon,
              point2.lat, point2.lon
            );
            
            if (distance < 0.00015) { // περίπου 15 μέτρα
              return true;
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking road:", error);
      return false;
    }
  };

  const pointToLineDistance = (lat, lng, lat1, lon1, lat2, lon2) => {
    const A = lat - lat1;
    const B = lng - lon1;
    const C = lat2 - lat1;
    const D = lon2 - lon1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = lat1;
      yy = lon1;
    } else if (param > 1) {
      xx = lat2;
      yy = lon2;
    } else {
      xx = lat1 + param * C;
      yy = lon1 + param * D;
    }

    const dx = lat - xx;
    const dy = lng - yy;

    return Math.sqrt(dx * dx + dy * dy);
  };

  const isPointTooClose = (newPoint, existingPoints) => {
    for (const point of existingPoints) {
      const distance = calculateDistance(
        newPoint.lat, newPoint.lng,
        point.lat, point.lng
      );
      if (distance < MIN_DISTANCE_BETWEEN_POINTS) {
        return true;
      }
    }
    return false;
  };

  const handleMapClick = async (e) => {
    setIsLoading(true);
    setMessage("");

    try {
      const isRoad = await isPointOnRoad(e.latlng.lat, e.latlng.lng);
      
      if (!isRoad) {
        setMessage("Παρακαλώ επιλέξτε ένα σημείο πάνω σε δρόμο.");
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
      
      if (isPointTooClose(newPoint, waypoints)) {
        setMessage("Το σημείο είναι πολύ κοντά σε άλλο σημείο της διαδρομής.");
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      setWaypoints((prev) => [...prev, newPoint]);
      setCurrentPoint(newPoint);
      
      // Για αυτοκίνητο, το πρώτο σημείο γίνεται αυτόματα parking spot
      if (routeMode === 'drive' && waypoints.length === 0) {
        // Αυτόματη προσθήκη parking spot
        setPoints((prev) => [...prev, {
          ...newPoint,
          type: 'parking',
          description: 'Αυτόματος χώρος στάθμευσης'
        }]);
        setShowModal(false);
        setMessage("✅ Προστέθηκε αυτόματα parking spot!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setShowModal(true);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Σφάλμα κατά τον έλεγχο του σημείου. Προσπαθήστε ξανά.");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPoint = () => {
    if (currentPoint && pointType) {
      setPoints((prev) => [...prev, {
        ...currentPoint,
        type: pointType,
        description: pointDescription
      }]);
      setPointType("");
      setPointDescription("");
      setShowModal(false);
    }
  };

  const validateRoute = async (waypoints) => {
    if (routeMode === 'drive' && waypoints.length < 1) {
      return { isValid: false, message: "Η διαδρομή αυτοκινήτου πρέπει να έχει τουλάχιστον 1 parking spot" };
    }
    
    if (routeMode === 'foot' && waypoints.length < 2) {
      return { isValid: false, message: "Η προσβάσιμη διαδρομή πρέπει να έχει τουλάχιστον 2 σημεία" };
    }

    // Έλεγχος αν η διαδρομή είναι συνεχής (μόνο για πεζό με πολλά σημεία)
    if (routeMode === 'foot' && waypoints.length > 1) {
      for (let i = 0; i < waypoints.length - 1; i++) {
        const start = waypoints[i];
        const end = waypoints[i + 1];
        
        try {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/${routeMode}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full`
          );
          const data = await response.json();
          
          if (!data.routes || data.routes.length === 0) {
            return { 
              isValid: false, 
              message: `Δεν υπάρχει διαδρομή μεταξύ των σημείων ${i+1} και ${i+2}` 
            };
          }
        } catch (error) {
          return { 
            isValid: false, 
            message: `Σφάλμα κατά τον έλεγχο της διαδρομής μεταξύ των σημείων ${i+1} και ${i+2}` 
          };
        }
      }
    }

    return { isValid: true };
  };

  const handleSubmit = async () => {
    if (routeMode === 'drive' && waypoints.length < 1) {
      setMessage("Προσθέστε τουλάχιστον 1 parking spot για να δημιουργήσετε μια διαδρομή αυτοκινήτου");
      return;
    }
    
    if (routeMode === 'foot' && waypoints.length < 2) {
      setMessage("Προσθέστε τουλάχιστον 2 σημεία για να δημιουργήσετε μια προσβάσιμη διαδρομή");
      return;
    }

    const validation = await validateRoute(waypoints);
    if (!validation.isValid) {
      setMessage(validation.message);
      return;
    }

    try {
      // Φτιάξε το string για το OSRM
      const waypointsStr = waypoints.map(point => `${point.lng},${point.lat}`).join(';');
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/${routeMode}/${waypointsStr}?overview=full&geometries=geojson`
      );
      const data = await response.json();

      let geometry = null;
      if (data.routes && data.routes.length > 0) {
        // Μετατρέπουμε το geometry σε string για να αποφύγουμε το πρόβλημα με τα nested arrays
        geometry = JSON.stringify(data.routes[0].geometry);
      }

      const routeData = {
        waypoints: waypoints.map(point => ({
          lat: point.lat,
          lng: point.lng,
          type: points.find(p => p.lat === point.lat && p.lng === point.lng)?.type || null,
          description: points.find(p => p.lat === point.lat && p.lng === point.lng)?.description || null
        })),
        description: notes,
        type: routeMode === 'drive' ? 'car' : 'accessible',
        status: "pending",
        createdAt: new Date(),
        accessibilityPoints: points.map(point => ({
          lat: point.lat,
          lng: point.lng,
          type: point.type,
          description: point.description,
          icon: accessibilityIcons[point.type]?.icon,
          iconDescription: accessibilityIcons[point.type]?.description
        })),
        geometry // Αποθηκεύουμε το geometry ως string
      };

      await addDoc(collection(db, "proposedRoutes"), routeData);
      const successMessage = routeMode === 'drive' ? 
        "Η διαδρομή αυτοκινήτου με parking spot υποβλήθηκε επιτυχώς" : 
        "Η προσβάσιμη διαδρομή υποβλήθηκε επιτυχώς";
      setMessage(successMessage);
      setWaypoints([]);
      setPoints([]);
      setNotes("");
    } catch (error) {
      console.error("Error submitting route:", error);
      const errorMessage = routeMode === 'drive' ? 
        "Σφάλμα κατά την υποβολή της διαδρομής αυτοκινήτου" : 
        "Σφάλμα κατά την υποβολή της προσβάσιμης διαδρομής";
      setMessage(errorMessage);
    }
  };

  useEffect(() => {
    const minWaypoints = routeMode === 'drive' ? 1 : 2;
    
    if (waypoints.length >= minWaypoints) {
      const updatePreviewRoute = async () => {
        try {
          const waypointsStr = waypoints.map(point => `${point.lng},${point.lat}`).join(';');
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/${routeMode}/${waypointsStr}?overview=full&geometries=geojson`
          );
          const data = await response.json();
          
          if (data.routes && data.routes.length > 0) {
            const coordinates = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            setPreviewRoute(coordinates);
          }
        } catch (error) {
          console.error("Error updating preview route:", error);
        }
      };

      updatePreviewRoute();
    } else {
      setPreviewRoute(null);
    }
  }, [waypoints, routeMode]);

  const handleEditPoint = (point) => {
    setEditingPoint(point);
    setPointType(point.type);
    setPointDescription(point.description);
    setShowEditModal(true);
  };

  const handleUpdatePoint = () => {
    if (editingPoint && pointType) {
      setPoints(prev => prev.map(p => 
        p.lat === editingPoint.lat && p.lng === editingPoint.lng
          ? { ...p, type: pointType, description: pointDescription }
          : p
      ));
      setPointType("");
      setPointDescription("");
      setShowEditModal(false);
      setEditingPoint(null);
    }
  };

  const handleDeletePoint = (point) => {
    setPoints(prev => prev.filter(p => 
      p.lat !== point.lat || p.lng !== point.lng
    ));
  };

  return (
    <div className="add-route-container">
      <h1>Προσθήκη Νέας Διαδρομής</h1>
      
      <div className="route-mode-selector">
        <h3>Επιλογή Τύπου Διαδρομής</h3>
        <div className="mode-buttons">
          <button 
            className={`mode-button ${routeMode === 'foot' ? 'active' : ''}`}
            onClick={() => setRouteMode('foot')}
          >
            🚶 Πεζός
          </button>
          <button 
            className={`mode-button ${routeMode === 'drive' ? 'active' : ''}`}
            onClick={() => setRouteMode('drive')}
          >
            🚗 Αυτοκίνητο
          </button>
        </div>
        {routeMode === 'drive' && (
          <div className="parking-info">
            <p>💡 Για διαδρομές αυτοκινήτου, το πρώτο σημείο που επιλέγετε θα γίνει αυτόματα parking spot.</p>
          </div>
        )}
      </div>
      
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            Έλεγχος σημείου...
          </div>
        </div>
      )}

      <div className="map-container">
        <MapContainer
          center={[37.9838, 23.7275]}
          zoom={13}
          style={{ height: "500px", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {previewRoute && (
            <Polyline
              positions={previewRoute}
              color="blue"
              weight={4}
              opacity={0.7}
            />
          )}

          {waypoints.map((point, index) => {
            // Επιλογή εικονιδίου ανάλογα με τον τύπο του σημείου
            let markerIcon = index === 0 ? startIcon : index === waypoints.length - 1 ? endIcon : waypointIcon;
            
            // Έλεγχος αν το σημείο είναι parking spot
            const pointData = points.find(p => p.lat === point.lat && p.lng === point.lng);
            if (pointData && (pointData.type === 'parking' || pointData.type === 'accessible_parking')) {
              markerIcon = parkingIcon;
            }
            
            return (
              <Marker
                key={index}
                position={[point.lat, point.lng]}
                icon={markerIcon}
              >
              <Popup>
                <div className="point-popup">
                  <h3>Σημείο {index + 1}</h3>
                  {points.find(p => p.lat === point.lat && p.lng === point.lng) && (
                    <div className="accessibility-info">
                      <div className="icon-container">
                        <span className="accessibility-icon">
                          {accessibilityIcons[points.find(p => p.lat === point.lat && p.lng === point.lng).type]?.icon}
                        </span>
                        <span className="accessibility-type">
                          {accessibilityIcons[points.find(p => p.lat === point.lat && p.lng === point.lng).type]?.description}
                        </span>
                      </div>
                      <div className="point-details">
                        <p><strong>Τύπος:</strong> {points.find(p => p.lat === point.lat && p.lng === point.lng).type}</p>
                        <p><strong>Περιγραφή:</strong> {points.find(p => p.lat === point.lat && p.lng === point.lng).description}</p>
                        <p><strong>Συντεταγμένες:</strong> {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )})}

          <MapClickHandler onClick={handleMapClick} />
        </MapContainer>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Προσθήκη Σημείου Ενδιαφέροντος</h3>
            <select 
              value={pointType} 
              onChange={(e) => setPointType(e.target.value)}
              className="point-type-select"
            >
              <option value="">Επιλέξτε τύπο σημείου</option>
              {routeMode === 'foot' && (
                <>
                  <option value="ramp">Ράμπα</option>
                  <option value="stairs">Σκαλιά</option>
                  <option value="obstacle">Εμπόδιο</option>
                  <option value="crossing">Διάβαση</option>
                  <option value="elevator">Ανελκυστήρας</option>
                  <option value="narrow">Στενό Πέρασμα</option>
                </>
              )}
              {routeMode === 'drive' && (
                <>
                  <option value="parking">Χώρος Στάθμευσης</option>
                  <option value="accessible_parking">Προσβάσιμος Χώρος Στάθμευσης</option>
                </>
              )}
            </select>
            <textarea
              value={pointDescription}
              onChange={(e) => setPointDescription(e.target.value)}
              placeholder="Περιγραφή σημείου..."
              className="point-description"
            />
            <div className="modal-buttons">
              <button onClick={handleAddPoint}>Προσθήκη</button>
              <button onClick={() => setShowModal(false)}>Ακύρωση</button>
            </div>
          </div>
        </div>
      )}

      <div className="points-list">
        <h3>{routeMode === 'drive' ? 'Σημεία Στάθμευσης' : 'Σημεία Προσβασιμότητας'}</h3>
        {points.map((point, index) => (
          <div key={index} className="point-item">
            <div className="point-info">
              <span className="point-type">{point.type}</span>
              <p className="point-description">{point.description}</p>
            </div>
            <div className="point-actions">
              <button onClick={() => handleEditPoint(point)}>Επεξεργασία</button>
              <button onClick={() => handleDeletePoint(point)}>Διαγραφή</button>
            </div>
          </div>
        ))}
      </div>

      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Επεξεργασία Σημείου</h3>
            <select 
              value={pointType} 
              onChange={(e) => setPointType(e.target.value)}
              className="point-type-select"
            >
              <option value="">Επιλέξτε τύπο σημείου</option>
              {routeMode === 'foot' && (
                <>
                  <option value="ramp">Ράμπα</option>
                  <option value="stairs">Σκαλιά</option>
                  <option value="obstacle">Εμπόδιο</option>
                  <option value="crossing">Διάβαση</option>
                  <option value="elevator">Ανελκυστήρας</option>
                  <option value="narrow">Στενό Πέρασμα</option>
                </>
              )}
              {routeMode === 'drive' && (
                <>
                  <option value="parking">Χώρος Στάθμευσης</option>
                  <option value="accessible_parking">Προσβάσιμος Χώρος Στάθμευσης</option>
                </>
              )}
            </select>
            <textarea
              value={pointDescription}
              onChange={(e) => setPointDescription(e.target.value)}
              placeholder="Περιγραφή σημείου..."
              className="point-description"
            />
            <div className="modal-buttons">
              <button onClick={handleUpdatePoint}>Ενημέρωση</button>
              <button onClick={() => {
                setShowEditModal(false);
                setEditingPoint(null);
                setPointType("");
                setPointDescription("");
              }}>Ακύρωση</button>
            </div>
          </div>
        </div>
      )}

      <div className="form-section">
        <textarea
          placeholder="Προσθέστε σημειώσεις για τη διαδρομή..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="route-notes"
        />
        <button onClick={handleSubmit} className="submit-button">
          Υποβολή {routeMode === 'drive' ? 'Διαδρομής Αυτοκινήτου' : 'Προσβάσιμης Διαδρομής'}
        </button>
        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
};

const MapClickHandler = ({ onClick }) => {
  useMapEvents({
    click: onClick,
  });
  return null;
};

export default AddRoute;
  