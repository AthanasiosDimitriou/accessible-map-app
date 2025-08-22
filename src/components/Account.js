import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile, updateEmail } from 'firebase/auth';
import './Account.css';

const Account = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [activeTab, setActiveTab] = useState('profile');
  const navigate = useNavigate();

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
      setUser(user);
        setDisplayName(user.displayName || '');
        setEmail(user.email || '');
        setLoading(false);
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const showMessage = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showMessage('Το όνομα είναι υποχρεωτικό', 'error');
      return;
    }

    try {
      setLoading(true);
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim()
      });
      
      // Update in Firestore if user document exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
          displayName: displayName.trim(),
          updatedAt: new Date()
        });
      }

      showMessage('Το προφίλ ενημερώθηκε επιτυχώς!');
    } catch (error) {
      showMessage('Σφάλμα: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    if (!email.trim() || email === user.email) {
      showMessage('Παρακαλώ εισάγετε ένα διαφορετικό email', 'error');
      return;
    }

    try {
      setLoading(true);
      await updateEmail(auth.currentUser, email.trim());
      
      // Update in Firestore if user document exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
          email: email.trim(),
          updatedAt: new Date()
        });
      }

      showMessage('Το email ενημερώθηκε επιτυχώς!');
    } catch (error) {
      showMessage('Σφάλμα: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      showMessage('Παρακαλώ συμπληρώστε όλα τα πεδία', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('Οι κωδικοί δεν ταιριάζουν', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showMessage('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες', 'error');
      return;
    }

    try {
      setLoading(true);
      await auth.currentUser.updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      showMessage('Ο κωδικός ενημερώθηκε επιτυχώς!');
    } catch (error) {
      showMessage('Σφάλμα: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
    await auth.signOut();
    navigate('/');
    } catch (error) {
      showMessage('Σφάλμα κατά την αποσύνδεση', 'error');
    }
  };

  if (loading) {
    return (
      <div className="account-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Φόρτωση...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-container">
      <div className="account-wrapper">
        <div className="account-content">
        <div className="account-header">
          <h1>Ο Λογαριασμός μου</h1>
          <p>Διαχείριση προφίλ και ρυθμίσεων</p>
        </div>

        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <div className="account-tabs">
          <button 
            className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Προφίλ
          </button>
          <button 
            className={`tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            Ασφάλεια
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'profile' && (
            <div className="profile-section">
              <div className="user-info">
                <div className="avatar">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <h3>{user.displayName || 'Χωρίς όνομα'}</h3>
                  <p>{user.email}</p>
                  <span className="member-since">
                    Μέλος από: {user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('el-GR') : 'Άγνωστο'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleProfileUpdate} className="profile-form">
                <div className="form-group">
                  <label>Όνομα Εμφάνισης</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Εισάγετε το όνομά σας"
                    disabled={loading}
                  />
                </div>
                <button type="submit" disabled={loading} className="save-button">
                  {loading ? 'Αποθήκευση...' : 'Αποθήκευση Προφίλ'}
                </button>
              </form>

              <form onSubmit={handleEmailUpdate} className="email-form">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Εισάγετε το email σας"
                    disabled={loading}
                  />
                </div>
                <button type="submit" disabled={loading} className="save-button">
                  {loading ? 'Αποθήκευση...' : 'Ενημέρωση Email'}
                </button>
              </form>
        </div>
      )}

          {activeTab === 'security' && (
            <div className="security-section">
              <div className="security-info">
                <h3>Αλλαγή Κωδικού</h3>
                <p>Εισάγετε τον νέο κωδικό σας για να ενημερώσετε την ασφάλεια του λογαριασμού σας.</p>
              </div>

              <form onSubmit={handlePasswordChange} className="password-form">
                <div className="form-group">
                  <label>Νέος Κωδικός</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Εισάγετε τον νέο κωδικό"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label>Επιβεβαίωση Κωδικού</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Επαναλάβετε τον νέο κωδικό"
                    disabled={loading}
        />
                </div>
                <button type="submit" disabled={loading} className="save-button">
                  {loading ? 'Αποθήκευση...' : 'Αλλαγή Κωδικού'}
                </button>
      </form>
            </div>
          )}
        </div>

        <div className="account-actions">
          <button onClick={handleLogout} className="logout-button" disabled={loading}>
            Αποσύνδεση
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Account; 