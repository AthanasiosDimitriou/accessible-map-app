import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { setDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import "./LoginPage.css";


const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async () => {
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        
        const role = email === "athanasiosdimitriou201@gmail.com" ? "admin" : "user";

        
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email,
          role,
        });

        alert("Επιτυχής εγγραφή!");
        
        // Για νέους χρήστες, πήγαινε στην εισαγωγική σελίδα
        navigate("/welcome");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Επιτυχής σύνδεση!");
        
        // Έλεγχος αν ο χρήστης έχει δει την εισαγωγική σελίδα
        const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
        if (hasSeenWelcome) {
        navigate("/home");
        } else {
          navigate("/welcome");
        }
      }
    } catch (error) {
      alert("Σφάλμα: " + error.message);
    }
  };

  return (
    <div className="login-container">
      {/* Floating Background Elements */}
      <div className="floating-element"></div>
      <div className="floating-element"></div>
      <div className="floating-element"></div>
      
      <div className="login-form">
      <h1>{isSignUp ? "Εγγραφή" : "Σύνδεση"}</h1>
        
        <div className="form-group">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
        </div>
        
        <div className="form-group">
      <input
        type="password"
        placeholder="Κωδικός"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
        </div>
        
        <button className="login-button" onClick={handleAuth}>
          {isSignUp ? "Εγγραφή" : "Σύνδεση"}
        </button>
        
        <p className="toggle-mode" onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? "Έχετε ήδη λογαριασμό; Συνδεθείτε." : "Δεν έχετε λογαριασμό; Εγγραφείτε."}
      </p>
      </div>
    </div>
  );
};

export default LoginPage;
