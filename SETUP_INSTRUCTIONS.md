# Οδηγίες Εγκατάστασης - Accessible Map Application

## Προαπαιτούμενα

1. **Node.js** (v14 ή νεότερη έκδοση)
2. **Docker** (για OSRM server)
3. **Firebase Project**
4. **Google Maps API Key**

## Βήματα Εγκατάστασης

### 1. Εγκατάσταση Dependencies
```bash
npm install
```

### 2. Ρύθμιση Firebase

1. Πηγαίνετε στο [Firebase Console](https://console.firebase.google.com/)
2. Δημιουργήστε ένα νέο project
3. Ενεργοποιήστε το Authentication (Email/Password)
4. Ενεργοποιήστε το Firestore Database
5. Από το Project Settings > General, αντιγράψτε τα credentials
6. Αντικαταστήστε στο `src/firebase.js`:
   - `YOUR_FIREBASE_API_KEY` → το πραγματικό API key
   - `YOUR_PROJECT_ID` → το project ID
   - `YOUR_MESSAGING_SENDER_ID` → το messaging sender ID
   - `YOUR_APP_ID` → το app ID
   - `YOUR_MEASUREMENT_ID` → το measurement ID

### 3. Ρύθμιση Google Maps API

1. Πηγαίνετε στο [Google Cloud Console](https://console.cloud.google.com/)
2. Δημιουργήστε ένα project ή επιλέξτε υπάρχον
3. Ενεργοποιήστε το Maps JavaScript API
4. Ενεργοποιήστε το Geocoding API
5. Δημιουργήστε ένα API key
6. Χρησιμοποιήστε το API key στις geocoding λειτουργίες

### 4. Εκκίνηση OSRM Server (Προαιρετικά)

Για τοπικό routing server:

```bash
# Windows
prepare-osrm.bat
start-osrm-servers.bat

# Linux/Mac
docker-compose up -d
```

### 5. Εκκίνηση της Εφαρμογής

```bash
npm start
```

Η εφαρμογή θα είναι διαθέσιμη στο `http://localhost:3000`

## Δομή Project

```
clean-accessible-map-app/
├── src/
│   ├── components/          # React components
│   │   ├── Account.js       # Διαχείριση λογαριασμού
│   │   ├── AddLocationPage.js # Προσθήκη τοποθεσίας
│   │   ├── AddRoute.js      # Σχεδιασμός διαδρομής
│   │   ├── AdminDashboard.js # Διαχείριση admin
│   │   ├── HomePage.js      # Κύριο σελίδα
│   │   ├── LoginPage.js     # Σύνδεση
│   │   ├── Menu.js          # Μενού πλοήγησης
│   │   └── NavigationPage.js # Σελίδα πλοήγησης
│   ├── styles/              # CSS αρχεία
│   ├── utils/               # Βοηθητικές συναρτήσεις
│   │   ├── accessibilityIcons.js # Εικονίδια προσβασιμότητας
│   │   ├── geocoding.js     # Geocoding utilities
│   │   └── ThemeContext.js  # Διαχείριση θέματος
│   └── firebase.js          # Firebase configuration
├── public/                  # Static αρχεία
├── package.json             # Dependencies
├── README.md               # Κύριες οδηγίες
└── ΟΔΗΓΙΕΣ_ΧΡΗΣΗΣ.md      # Οδηγίες χρήσης
```

## Λειτουργίες

### Κύριοες Λειτουργίες:
- **Αναζήτηση Διεύθυνσης**: Geocoding με Google Maps API
- **Σχεδιασμός Διαδρομής**: Υπολογισμός βέλτιστης διαδρομής
- **Προσθήκη Τοποθεσίας**: Αποθήκευση προσβάσιμων σημείων
- **Διαχείριση Χρηστών**: Admin dashboard για διαχείριση ρόλων

### Τρόποι Διαδρομής:
- **Πεζός**: Για διαδρομές πεζών
- **Οδηγός ΑΜΕΑ**: Για διαδρομές αυτοκινήτου

## Σημειώσεις Ασφαλείας

- Όλα τα API keys έχουν αφαιρεθεί από το repository
- Χρησιμοποιήστε environment variables για ευαίσθητα δεδομένα
- Το `serviceAccountKey.json` δεν περιλαμβάνεται

## Αντιμετώπιση Προβλημάτων

### Συνήθη Προβλήματα:

1. **Firebase Connection Error**:
   - Ελέγξτε τα credentials στο `src/firebase.js`
   - Βεβαιωθείτε ότι το Authentication είναι ενεργοποιημένο

2. **Geocoding Error**:
   - Ελέγξτε το Google Maps API key
   - Βεβαιωθείτε ότι το Geocoding API είναι ενεργοποιημένο

3. **OSRM Server Error**:
   - Ελέγξτε ότι το Docker τρέχει
   - Επανεκκινήστε τους servers με `stop-osrm-servers.bat` και `start-osrm-servers.bat`

## Επικοινωνία

Για ερωτήσεις ή προβλήματα, επικοινωνήστε με τον developer.
