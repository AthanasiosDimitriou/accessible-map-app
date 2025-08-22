import React, { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const AddLocationPage = () => {
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      await addDoc(collection(db, "locations"), {
        name,
        coordinates: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
        description,
        createdAt: new Date(),
      });
      alert("Τοποθεσία προστέθηκε!");
      navigate("/home");
    } catch (error) {
      alert("Σφάλμα: " + error.message);
    }
  };

  return (
    <div>
      <h1>Προσθήκη Νέας Τοποθεσίας</h1>
      <input
        type="text"
        placeholder="Όνομα"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Γεωγραφικό Πλάτος"
        value={latitude}
        onChange={(e) => setLatitude(e.target.value)}
      />
      <input
        type="text"
        placeholder="Γεωγραφικό Μήκος"
        value={longitude}
        onChange={(e) => setLongitude(e.target.value)}
      />
      <textarea
        placeholder="Περιγραφή"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button onClick={handleSubmit}>Προσθήκη</button>
    </div>
  );
};

export default AddLocationPage;
 
