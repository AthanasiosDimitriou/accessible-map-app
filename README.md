# Accessible Map Application

Μια ολοκληρωμένη εφαρμογή χάρτη για την υποστήριξη προσβασιμότητας για άτομα με αναπηρίες, που προσφέρει έξυπνες διαδρομές και πληροφορίες προσβασιμότητας σε πραγματικό χρόνο.

## Κύρια Χαρακτηριστικά

### **Interactive Χάρτης**
- **OpenStreetMap Tiles**: Χρήση δωρεάν OpenStreetMap tiles για τον χάρτη
- **Leaflet Map Integration**: Προηγμένος χάρτης με προσαρμοσμένα εικονίδια
- **Real-time Location Tracking**: Παρακολούθηση θέσης χρήστη σε πραγματικό χρόνο
- **Custom Accessibility Icons**: Ειδικά εικονίδια για σημεία προσβασιμότητας
- **Responsive Design**: Προσαρμογή σε όλες τις συσκευές

### **Έξυπνες Διαδρομές**
- **OSRM Online Server**: Υπολογισμός διαδρομών με `https://router.project-osrm.org/route/v1/`
- **Foot Profile**: Διαδρομές για πεζούς με προσβασιμότητα
- **Car Profile**: Διαδρομές για αυτοκίνητο με parking spots
- **Accessible Route Combination**: Συνδυασμός κανονικών και προσβάσιμων διαδρομών
- **Real-time Navigation**: Οδηγίες βήμα-προς-βήμα με voice guidance

### **Προηγμένη Αναζήτηση**
- **Multi-source Geocoding**: Χρήση πολλαπλών APIs για geocoding
- **Nominatim Proxy**: Χρήση Nominatim μέσω διαφορετικών proxies
- **Photon API**: Εναλλακτικό geocoding service
- **Local Data Fallback**: Τοπικές διευθύνσεις για testing
- **Search History**: Αποθήκευση προηγούμενων αναζητήσεων
- **Current Location Detection**: Αυτόματη ανίχνευση θέσης

### **Accessibility Features**
- **Accessibility Points**: Ράμπες, ανελκυστήρες, διάβαση πεζών
- **Obstacle Detection**: Εντοπισμός εμποδίων και στενών περασμάτων
- **Parking Spots**: Προσβάσιμοι χώροι στάθμευσης
- **Accessibility Icons**: Προσαρμοσμένα εικονίδια για κάθε τύπο προσβασιμότητας

### **User Management**
- **Firebase Authentication**: Ασφαλής εγγραφή και σύνδεση
- **User Roles**: Admin και regular users
- **Profile Management**: Επεξεργασία προφίλ χρήστη
- **Admin Dashboard**: Διαχείριση χρηστών και διαδρομών

### **Location Management**
- **Add Custom Locations**: Προσθήκη προσβάσιμων σημείων
- **Route Submission**: Υποβολή νέων διαδρομών για έγκριση
- **Community Contributions**: Συμμετοχή της κοινότητας
- **Location Database**: Firestore για αποθήκευση δεδομένων

### **User Experience**
- **Welcome Page**: Εισαγωγική σελίδα με animations
- **Dark/Light Theme**: Προσαρμοσμένα θέματα
- **Toast Notifications**: Ειδοποιήσεις για actions
- **Loading States**: Visual feedback για operations

## Τεχνολογίες

### **Frontend**
- **React.js 18.3.1**: Modern UI framework
- **React Router DOM 7.0.1**: Client-side routing
- **Leaflet 1.9.4**: Interactive maps
- **React Leaflet 4.2.1**: React wrapper for Leaflet
- **Leaflet Routing Machine 3.2.12**: Route planning
- **React Toastify 11.0.5**: Notifications

### **Backend & Services**
- **Firebase 11.0.2**: Authentication & Database
- **Firestore**: NoSQL database
- **Firebase Admin 13.0.1**: Server-side operations

### **APIs & External Services**
- **OSRM Online Server**: `https://router.project-osrm.org/route/v1/`
  - Foot profile: `/foot/` για διαδρομές πεζών
  - Car profile: `/car/` για διαδρομές αυτοκινήτου
- **OpenStreetMap Tiles**: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Nominatim Geocoding**: Χρήση μέσω proxies για CORS bypass
- **Photon API**: `https://photon.komoot.io/api/` για geocoding

### **Development Tools**
- **React Scripts 5.0.1**: Development environment
- **Docker**: OSRM server containerization 
- **Web Vitals 2.1.4**: Performance monitoring

## Προαπαιτούμενα

- **Node.js** (v14 ή νεότερη)
- **Docker** (για τοπικό OSRM server)
- **Firebase Project** (Authentication & Firestore)

## Εγκατάσταση

### 1. **Clone το Repository**
```bash
git clone https://github.com/AthanasiosDimitriou/accessible-map-app.git
cd accessible-map-app
```

### 2. **Εγκατάσταση Dependencies**
```bash
npm install
```

### 3. **Ρύθμιση Firebase**
1. Δημιουργήστε project στο [Firebase Console](https://console.firebase.google.com/)
2. Ενεργοποιήστε Authentication (Email/Password)
3. Ενεργοποιήστε Firestore Database
4. Αντικαταστήστε στο `src/firebase.js`:
   ```javascript
   apiKey: "YOUR_FIREBASE_API_KEY"
   authDomain: "YOUR_PROJECT_ID.firebaseapp.com"
   projectId: "YOUR_PROJECT_ID"
   storageBucket: "YOUR_PROJECT_ID.firebasestorage.app"
   messagingSenderId: "YOUR_MESSAGING_SENDER_ID"
   appId: "YOUR_APP_ID"
   measurementId: "YOUR_MEASUREMENT_ID"
   ```

### 4. **Εκκίνηση OSRM Server (Προαιρετικά)**
```bash
# Windows
prepare-osrm.bat
start-osrm-servers.bat

# Linux/Mac
docker-compose up -d
```

### 5. **Εκκίνηση της Εφαρμογής**
```bash
npm start
```

Η εφαρμογή θα είναι διαθέσιμη στο `http://localhost:3000`

## Χρήση της Εφαρμογής

### **Κύριες Σελίδες**

#### **HomePage** - Κύριο Interface
- **OpenStreetMap Display**: Interactive χάρτης με OpenStreetMap tiles
- **Mode Selection**: Επιλογή μεταξύ πεζού και αυτοκινήτου
- **Location Input**: Αναζήτηση αφετηρίας και προορισμού
- **Route Calculation**: Υπολογισμός βέλτιστης διαδρομής με OSRM
- **Accessibility Points**: Εμφάνιση προσβάσιμων σημείων
- **Parking Spots**: Προσβάσιμοι χώροι στάθμευσης

#### **NavigationPage** - Πλοήγηση
- **Real-time Navigation**: Οδηγίες σε πραγματικό χρόνο
- **Voice Guidance**: Φωνητικές οδηγίες
- **Route Visualization**: Προβολή διαδρομής στον χάρτη
- **Accessibility Alerts**: Ειδοποιήσεις για προσβασιμότητα
- **Deviation Detection**: Ανίχνευση αποκλίσεων από τη διαδρομή

#### **AddRoute** - Προσθήκη Διαδρομής
- **Interactive Route Creation**: Σχεδίαση διαδρομής στον χάρτη
- **Accessibility Points**: Προσθήκη σημείων προσβασιμότητας
- **Route Validation**: Έλεγχος εγκυρότητας διαδρομής
- **Submission System**: Υποβολή για έγκριση

#### **AddLocationPage** - Προσθήκη Τοποθεσίας
- **Location Input**: Εισαγωγή συντεταγμένων
- **Description**: Λεπτομερείς περιγραφή
- **Database Storage**: Αποθήκευση στο Firestore

#### **Account** - Διαχείριση Λογαριασμού
- **Profile Management**: Επεξεργασία προφίλ
- **Settings**: Ρυθμίσεις εφαρμογής
- **History**: Ιστορικό αναζητήσεων

#### **AdminDashboard** - Διαχείριση Admin
- **Route Management**: Έγκριση/απόρριψη διαδρομών
- **User Management**: Διαχείριση χρηστών
- **Statistics**: Στατιστικά εφαρμογής
- **Filtering System**: Φίλτρα κατάστασης

### **Λειτουργίες**

#### **Αναζήτηση & Geocoding**
- **Multi-source Search**: Nominatim (μέσω proxies) και Photon APIs
- **Proxy Fallbacks**: Χρήση διαφορετικών CORS proxies για Nominatim
- **Local Data**: Τοπικές διευθύνσεις για testing
- **Current Location**: Αυτόματη ανίχνευση με Geolocation API
- **Search History**: Αποθήκευση αναζητήσεων

#### **Route Planning**
- **OSRM Integration**: Υπολογισμός διαδρομών με online server
- **Foot Profile**: `/foot/` για διαδρομές πεζών με προσβασιμότητα
- **Car Profile**: `/car/` για διαδρομές αυτοκινήτου
- **Accessibility Combination**: Συνδυασμός με προσβάσιμες διαδρομές
- **Parking Integration**: Προσθήκη parking spots
- **Route Optimization**: Βελτιστοποίηση διαδρομής

#### **Accessibility Features**
- **Accessibility Icons**: Προσαρμοσμένα εικονίδια
- **Point Types**: Ράμπες, ανελκυστήρες, διάβαση πεζών


#### **UI/UX Features**
- **Responsive Design**: Προσαρμογή σε όλες τις συσκευές
- **Animations**: Smooth transitions
- **Loading States**: Visual feedback



## Ασφάλεια

- **API Keys Protection**: Όλα τα credentials έχουν αφαιρεθεί
- **Environment Variables**: Χρήση για ευαίσθητα δεδομένα
- **Firebase Security Rules**: Προστασία Firestore
- **Input Validation**: Έλεγχος εισόδου χρήστη
- **CORS Handling**: Χρήση proxies για external APIs

## Performance

- **Lazy Loading**: Φόρτωση components on demand
- **Route Caching**: Αποθήκευση διαδρομών
- **Image Optimization**: Συμπιεσμένες εικόνες
- **Bundle Optimization**: Συμπίεση JavaScript
- **Proxy Fallbacks**: Εναλλακτικές για geocoding

---

**AccessibleMap** - Κάνουμε την πόλη προσβάσιμη για όλους! 


