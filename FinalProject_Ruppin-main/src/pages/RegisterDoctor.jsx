import React, { useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { ref, set, get } from "firebase/database";
import { useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs";
import logo from "../assets/CortexTalk.png";

function RegisterDoctor() {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");
    const [id, setId] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = () => {
        navigate("/loginDoctor");
    };

    const handleRegister = async () => {
        if (!id.trim() || !firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim() || !password.trim()) {
            setError("All fields are required.");
            return;
        }

        try {
            // Check if doctor already exists
            const doctorRef = ref(db, `Doctors/${id}`);
            const snapshot = await get(doctorRef);

            if (snapshot.exists()) {
                setError("Doctor ID already exists. Please use a different ID.");
                return;
            }

            // Hash the password before storing
            const hashedPassword = await bcrypt.hash(password, 10);

            // Save new doctor in Firebase
            await set(doctorRef, {
                firstName,
                lastName,
                phone,
                email,
                password: hashedPassword,
            });

            navigate("/loginDoctor"); 
        } catch (error) {
            setError("An error occurred. Please try again.");
        }
    };

    return (
        <div className="wrapper">
            <div className="login-container">
                <img src={logo} width="300px" className="login-logo" />
                {error && <p className="error-message">{error}</p>}
                <div className="input-row">
                    <input 
                        type="text" 
                        placeholder="שם משפחה" 
                        className="login-input"
                        onChange={(e) => setLastName(e.target.value)} 
                    />
                    <input 
                        type="text" 
                        placeholder="שם פרטי" 
                        className="login-input"
                        onChange={(e) => setFirstName(e.target.value)} 
                    />
                </div>
                <input 
                    type="text" 
                    placeholder="תעודת זהות" 
                    className="login-input"
                    onChange={(e) => setId(e.target.value)} 
                />
                <input 
                    type="tel" 
                    placeholder="טלפון" 
                    className="login-input"
                    onChange={(e) => setPhone(e.target.value)} 
                />
                <input 
                    type="email" 
                    placeholder="אימייל" 
                    className="login-input"
                    onChange={(e) => setEmail(e.target.value)} 
                />
                <input 
                    type="password" 
                    placeholder="סיסמא" 
                    className="login-input"
                    onChange={(e) => setPassword(e.target.value)} 
                />
                <button className="login-btn" onClick={handleRegister}>הרשמה</button>

                <p className="login-link"> יש לך חשבון ? <a onClick={handleLogin}>התחברות</a></p>

            </div>
        </div>
    );
}

export default RegisterDoctor;
