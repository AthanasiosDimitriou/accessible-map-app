# Accessible Map Application

Μια εφαρμογή χάρτη για την υποστήριξη προσβασιμότητας για άτομα με αναπηρίες.

## Χαρακτηριστικά

- **Διαδρομές για Πεζούς**: Υπολογισμός διαδρομών για πεζούς με βάση προσβασιμότητα χρησιμοποιώντας OSRM online server
- **Χάρτης με Leaflet**: Interactive χάρτης με προσαρμοσμένα εικονίδια προσβασιμότητας
- **Firebase Authentication**: Σύστημα εγγραφής και σύνδεσης χρηστών
- **Firestore Database**: Αποθήκευση δεδομένων χρηστών και τοποθεσιών
- **Admin Dashboard**: Διαχείριση χρηστών και ρόλων
- **Responsive Design**: Προσαρμογή σε διαφορετικές συσκευές

## Προαπαιτούμενα

- Node.js (v14 ή νεότερη)
- Docker (για OSRM server)
- Firebase Project
- Google Maps API Key

## Εγκατάσταση

1. **Clone το repository**:
```bash
git clone <repository-url>
cd clean-accessible-map-app
```

2. **Εγκατάσταση dependencies**:
```bash
npm install
```

3. **Ρύθμιση Firebase**:
   - Δημιουργήστε ένα Firebase project
   - Αντικαταστήστε τα credentials στο `src/firebase.js`:
     - `YOUR_FIREBASE_API_KEY`
     - `YOUR_PROJECT_ID`
     - `YOUR_MESSAGING_SENDER_ID`
     - `YOUR_APP_ID`
     - `YOUR_MEASUREMENT_ID`

4. **Ρύθμιση Google Maps API Key**:
   - Δημιουργήστε ένα Google Maps API key
   - Χρησιμοποιήστε το για geocoding λειτουργίες

5. **Εκκίνηση OSRM Server** (προαιρετικά):
```bash
prepare-osrm.bat
start-osrm-servers.bat
```

6. **Εκκίνηση της εφαρμογής**:
```bash
npm start
```

## Χρήση

### Τρόποι Διαδρομής:
- **Πεζός**: Για διαδρομές πεζών με OSRM foot profile
- **Οδηγός ΑΜΕΑ (Αυτοκίνητο)**: Για διαδρομές αυτοκινήτου

### Λειτουργίες:
- **Αναζήτηση**: Εισαγωγή διεύθυνσης για geocoding
- **Διαδρομή**: Υπολογισμός βέλτιστης διαδρομής
- **Προσθήκη Τοποθεσίας**: Αποθήκευση προσβάσιμων τοποθεσιών
- **Διαχείριση Λογαριασμού**: Επεξεργασία προφίλ χρήστη

## Αρχιτεκτονική

```



- **Frontend**: React.js, Leaflet
- **Backend**: Firebase (Firestore, Authentication)
- **Routing**: OSRM online server για πεζούς
- **Maps**: Leaflet με προσαρμοσμένα tiles
- **Styling**: CSS με responsive design

## Σημειώσεις Ασφαλείας

- Όλα τα API keys και credentials έχουν αφαιρεθεί από το repository
- Χρησιμοποιήστε environment variables για ευαίσθητα δεδομένα
- Το `serviceAccountKey.json` δεν περιλαμβάνεται για ασφάλεια


