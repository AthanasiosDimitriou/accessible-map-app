import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

const ManageRoles = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      setUsers(usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchUsers();
  }, []);

  const changeRole = async (id, newRole) => {
    await updateDoc(doc(db, "users", id), { role: newRole });
    alert("Role updated!");
  };

  return (
    <div>
      <h2>Manage Roles</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.email} - {user.role}
            <button onClick={() => changeRole(user.id, "admin")}>Make Admin</button>
            <button onClick={() => changeRole(user.id, "user")}>Make User</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ManageRoles;
 
