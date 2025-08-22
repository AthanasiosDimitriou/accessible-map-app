import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from 'leaflet';
import "./AdminDashboard.css";

const AdminDashboard = () => {
  const [routes, setRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const navigate = useNavigate();

  
  const pointIcons = {
    ramp: new L.Icon({
      iconUrl: '/images/disabled-sign_2852495.png', 
      iconSize: [25, 25],
    }),
    stairs: new L.Icon({
      iconUrl: '/icons/stairs.png',
      iconSize: [25, 25],
    }),
    obstacle: new L.Icon({
      iconUrl: '/icons/obstacle.png',
      iconSize: [25, 25],
    }),
    crossing: new L.Icon({
      iconUrl: '/icons/crossing.png',
      iconSize: [25, 25],
    }),
    elevator: new L.Icon({
      iconUrl: '/icons/elevator.png',
      iconSize: [25, 25],
    }),
    narrow: new L.Icon({
      iconUrl: '/icons/narrow.png',
      iconSize: [25, 25],
    }),
    default: new L.Icon({
      iconUrl: '/icons/default.png',
      iconSize: [25, 25],
    })
  };

  // Έλεγχος αν ο χρήστης είναι admin
  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;

      if (!user) {
        navigate("/");
        return;
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().role === "admin") {
        setIsAdmin(true);
      } else {
        alert("Δεν έχετε δικαίωμα πρόσβασης.");
        navigate("/home");
      }
    };

    checkAdmin();
  }, [navigate]);

  // Φόρτωση των διαδρομών
  useEffect(() => {
    if (isAdmin) {
      const fetchRoutes = async () => {
        const querySnapshot = await getDocs(collection(db, "proposedRoutes"));
        const routesData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRoutes(routesData);
        setFilteredRoutes(routesData);
      };

      fetchRoutes();
    }
  }, [isAdmin]);

  // Φιλτράρισμα διαδρομών
  useEffect(() => {
    if (activeFilter === "all") {
      setFilteredRoutes(routes);
    } else {
      const filtered = routes.filter(route => route.status === activeFilter);
      setFilteredRoutes(filtered);
    }
  }, [activeFilter, routes]);

  const handleApproval = async (routeId, status) => {
    try {
      await updateDoc(doc(db, "proposedRoutes", routeId), {
        status,
      });
      alert(`Η διαδρομή ${status === "approved" ? "εγκρίθηκε" : "απορρίφθηκε"}!`);
      
      // Ανανέωση της λίστας διαδρομών
      const querySnapshot = await getDocs(collection(db, "proposedRoutes"));
      const routesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRoutes(routesData);
    } catch (error) {
      alert("Σφάλμα κατά την ενημέρωση: " + error.message);
    }
  };

  const getPointIcon = (type) => {
    return pointIcons[type] || pointIcons.default;
  };

  if (!isAdmin) {
    return null;
  }

  // Υπολογισμός στατιστικών
  const stats = {
    all: routes.length,
    pending: routes.filter(r => r.status === "pending").length,
    approved: routes.filter(r => r.status === "approved").length,
    rejected: routes.filter(r => r.status === "rejected").length
  };

  return (
    <div className="admin-dashboard">
      <h1>Πίνακας Διαχείρισης Διαδρομών</h1>
      
      <div className="dashboard-container">
        {/* Φίλτρα */}
        <div className="filters-sidebar">
          <h3>Φίλτρα Καταστάσεων</h3>
          
          <div className="filter-options">
            <button 
              className={`filter-button ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              <div className="filter-icon all-icon">📋</div>
              <div className="filter-content">
                <span className="filter-label">Όλες οι Διαδρομές</span>
                <span className="filter-count">{stats.all}</span>
              </div>
            </button>

            <button 
              className={`filter-button ${activeFilter === "pending" ? "active" : ""}`}
              onClick={() => setActiveFilter("pending")}
            >
              <div className="filter-icon pending-icon">⏳</div>
              <div className="filter-content">
                <span className="filter-label">Σε Εκκρεμότητα</span>
                <span className="filter-count">{stats.pending}</span>
              </div>
            </button>

            <button 
              className={`filter-button ${activeFilter === "approved" ? "active" : ""}`}
              onClick={() => setActiveFilter("approved")}
            >
              <div className="filter-icon approved-icon">✅</div>
              <div className="filter-content">
                <span className="filter-label">Εγκεκριμένες</span>
                <span className="filter-count">{stats.approved}</span>
              </div>
            </button>

            <button 
              className={`filter-button ${activeFilter === "rejected" ? "active" : ""}`}
              onClick={() => setActiveFilter("rejected")}
            >
              <div className="filter-icon rejected-icon">❌</div>
              <div className="filter-content">
                <span className="filter-label">Απορριφθείσες</span>
                <span className="filter-count">{stats.rejected}</span>
              </div>
            </button>
          </div>

          <div className="filter-stats">
            <h4>Στατιστικά</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-number">{stats.pending}</span>
                <span className="stat-label">Σε Εκκρεμότητα</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.approved}</span>
                <span className="stat-label">Εγκεκριμένες</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{stats.rejected}</span>
                <span className="stat-label">Απορριφθείσες</span>
              </div>
            </div>
          </div>
        </div>

        {/* Λίστα Διαδρομών */}
        <div className="routes-content">
          <div className="routes-header">
            <h2>
              {activeFilter === "all" && "Όλες οι Διαδρομές"}
              {activeFilter === "pending" && "Διαδρομές σε Εκκρεμότητα"}
              {activeFilter === "approved" && "Εγκεκριμένες Διαδρομές"}
              {activeFilter === "rejected" && "Απορριφθείσες Διαδρομές"}
            </h2>
            <span className="routes-count">({filteredRoutes.length} διαδρομές)</span>
          </div>

          <div className="routes-list">
            {filteredRoutes.map((route) => (
              <div key={route.id} className={`route-item route-${route.status}`}>
                <div className="route-info">
                  <h3>Διαδρομή #{route.id.slice(0, 6)}</h3>
                  <div className={`status-badge status-${route.status}`}>
                    {route.status === "pending" && "⏳ Σε Εκκρεμότητα"}
                    {route.status === "approved" && "✅ Εγκεκριμένη"}
                    {route.status === "rejected" && "❌ Απορριφθείσα"}
                  </div>
                  <p><strong>Σημεία Διαδρομής:</strong> {route.waypoints.length}</p>
                  <p><strong>Σημεία Ενδιαφέροντος:</strong> {route.points?.length || 0}</p>
                  <p><strong>Σημειώσεις:</strong> {route.notes}</p>
                  <p><strong>Ημερομηνία:</strong> {route.createdAt?.toDate().toLocaleDateString()}</p>
                </div>

                <div className="route-map">
                  <MapContainer
                    center={route.waypoints[0] ? [route.waypoints[0].lat, route.waypoints[0].lng] : [38.1234, 23.1234]}
                    zoom={15}
                    style={{ height: "400px", width: "100%" }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    
                    {/* Διαδρομή */}
                    {route.geometry ? (
                      <Polyline
                        positions={JSON.parse(route.geometry).coordinates.map(([lng, lat]) => [lat, lng])}
                        color={route.status === "approved" ? "green" : route.status === "rejected" ? "red" : "blue"}
                      />
                    ) : (
                    <Polyline
                      positions={route.waypoints.map((point) => [point.lat, point.lng])}
                      color={route.status === "approved" ? "green" : route.status === "rejected" ? "red" : "blue"}
                    />
                    )}

                    {/* Σημεία Ενδιαφέροντος */}
                    {route.points?.map((point, idx) => (
                      <Marker
                        key={idx}
                        position={[point.lat, point.lng]}
                        icon={getPointIcon(point.type)}
                      >
                        <Popup>
                          <div>
                            <strong>Τύπος:</strong> {point.type}<br />
                            <strong>Περιγραφή:</strong> {point.description}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>

                {route.status === "pending" && (
                  <div className="route-actions">
                    <button 
                      onClick={() => handleApproval(route.id, "approved")}
                      className="approve-button"
                    >
                      Έγκριση
                    </button>
                    <button 
                      onClick={() => handleApproval(route.id, "rejected")}
                      className="reject-button"
                    >
                      Απόρριψη
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
 
