import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/WelcomePage.css';

const WelcomePage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  const features = [
    {
      icon: "🗺️",
      title: "Χάρτης Προσβασιμότητας",
      description: "Εξερευνήστε προσβάσιμες διαδρομές και σημεία στην πόλη σας"
    },
    {
      icon: "♿",
      title: "Προσβάσιμες Διαδρομές",
      description: "Βρείτε ειδικά σχεδιασμένες διαδρομές για άτομα με κινητικές δυσκολίες"
    },
    {
      icon: "🎯",
      title: "Έξυπνη Πλοήγηση",
      description: "Λάβετε οδηγίες σε πραγματικό χρόνο για την καλύτερη διαδρομή"
    },
    {
      icon: "🔍",
      title: "Αναζήτηση Σημείων",
      description: "Ανακαλύψτε ράμπες, ανελκυστήρες και άλλα προσβάσιμα σημεία"
    },
    {
      icon: "🅿️",
      title: "Προσβάσιμα Parking Spots",
      description: "Βρείτε ειδικούς χώρους στάθμευσης για άτομα με αναπηρία"
    }
  ];

  useEffect(() => {
    // Αρχικοποίηση animations
    setIsVisible(true);
    
    // Αυτόματη εναλλαγή βημάτων
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % features.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [features.length]);

  const handleGetStarted = () => {
    // Αποθήκευση ότι ο χρήστης έχει δει την εισαγωγική σελίδα
    localStorage.setItem('hasSeenWelcome', 'true');
    navigate('/home');
  };

  return (
    <div className="welcome-container">
      {/* Background Animation */}
      <div className="background-animation">
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="welcome-content">
        {/* Header */}
        <div className="welcome-header">
          <div className="logo-container">
            <img src="/images/logo.png" alt="AccessibleMap Logo" className="logo-icon" />
            <h1 className="app-title">AccessibleMap</h1>
          </div>
          <p className="app-subtitle">Κάνουμε την πόλη προσβάσιμη για όλους</p>
        </div>

        {/* Features Carousel */}
        <div className="features-section">
          <div className="features-carousel">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`feature-card ${index === currentStep ? 'active' : ''} ${isVisible ? 'visible' : ''}`}
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Dots Indicator */}
          <div className="dots-indicator">
            {features.map((_, index) => (
              <div
                key={index}
                className={`dot ${index === currentStep ? 'active' : ''}`}
                onClick={() => setCurrentStep(index)}
              ></div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="cta-section">
          <button 
            className="get-started-btn"
            onClick={handleGetStarted}
          >
            <span className="btn-text">Ας ξεκινήσουμε</span>
            <span className="btn-icon">→</span>
          </button>
          <p className="cta-subtitle">
            Ξεκινήστε την εξερεύνηση της προσβάσιμης πόλης σας
          </p>
        </div>

        {/* Footer */}
        <div className="welcome-footer">
          <p className="footer-text">
            Δημιουργήθηκε με ❤️ για μια πιο προσβάσιμη κοινωνία
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage; 