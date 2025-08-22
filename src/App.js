import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import WelcomePage from "./components/WelcomePage";
import HomePage from "./components/HomePage";
import AddLocationPage from "./components/AddLocationPage";
import AddRoute from "./components/AddRoute"; 
import AdminDashboard from "./components/AdminDashboard"; 
import Account from "./components/Account"; 
import Menu from "./components/Menu";
import "./App.css";
import NavigationPage from './components/NavigationPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const App = () => {
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    
    const seenWelcome = localStorage.getItem('hasSeenWelcome');
    setHasSeenWelcome(!!seenWelcome);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return <div>Φόρτωση...</div>;
  }

  return (
    <Router>
      <Menu />
      <div className="container">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/add-location" element={<AddLocationPage />} />
          <Route path="/add-route" element={<AddRoute />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/account" element={<Account />} />
          <Route path="/navigation" element={<NavigationPage />} />
        </Routes>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </Router>
  );
};

export default App;
 