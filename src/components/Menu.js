import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import "./Menu.css";
import { auth, db } from "../firebase";
import { getDoc, doc } from "firebase/firestore";

const Menu = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkUserRole = async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().role === "admin") {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      checkUserRole(user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Κλείσιμο mobile menu όταν αλλάζει route
  useEffect(() => {
    const closeMenu = () => setMenuOpen(false);
    window.addEventListener('resize', closeMenu);
    return () => window.removeEventListener('resize', closeMenu);
  }, []);

  const handleLogout = () => {
    auth.signOut();
    navigate("/");
  };

  const handleMenuLinkClick = (to) => {
    setMenuOpen(false);
    navigate(to);
  };

  // Μην εμφανίζεις το menu στο login και welcome pages
  if (location.pathname === '/' || location.pathname === '/welcome') {
    return null;
  }

  return (
    <nav className="menu">
      <div className="logo-container">
        <img 
          src="/images/logo.png" 
          alt="AccessMap Logo" 
          className="logo-img"
        />
      </div>
      <div className={`burger ${menuOpen ? 'active' : ''}`} onClick={() => setMenuOpen((prev) => !prev)}>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <ul className={menuOpen ? "open" : ""}>
        <li>
          <span onClick={() => handleMenuLinkClick("/home")}>Αρχική</span>
        </li>
        <li>
          <span onClick={() => handleMenuLinkClick("/add-route")}>Προσθήκη Διαδρομής</span>
        </li>
        {isAdmin && (
          <li>
            <span onClick={() => handleMenuLinkClick("/admin")}>Πίνακας Διαχείρισης</span>
          </li>
        )}
      </ul>
      <div className="user-menu" ref={dropdownRef}>
        <img
          src="/images/square_11546433.png"
          alt="User Menu"
          style={{ width: 36, height: 36, borderRadius: '8px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
          onClick={() => setShowDropdown((prev) => !prev)}
        />
        {showDropdown && (
          <div className="user-dropdown" style={{
            position: 'absolute',
            right: 0,
            top: 45,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: '180px',
            zIndex: 2000
          }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: '10px 0', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', box: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <li style={{ padding: '8px 20px', cursor: 'pointer' }} onClick={() => { setShowDropdown(false); navigate('/account'); }}>Επεξεργασία λογαριασμού</li>
              <li style={{ padding: '8px 20px', cursor: 'pointer' }} onClick={handleLogout}>Αποσύνδεση</li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Menu;
 
