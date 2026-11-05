import React, { useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { ref, get } from "firebase/database";
import { useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs";
import logo from "../assets/CortexTalk.png";

function LoginDoctor() {
    const [id, setId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

const handleLogin = async () => {
    if (!id.trim() || !password.trim()) {
        setError("Please enter both ID and password.");
        return;
    }

    try {
        const doctorRef = ref(db, `Doctors/${id}`);
        const snapshot = await get(doctorRef);

        if (snapshot.exists()) {
            const doctorData = snapshot.val();

            // Compare entered password with stored hashed password
            const isPasswordCorrect = await bcrypt.compare(password, doctorData.password);

            if (isPasswordCorrect) {
                localStorage.setItem("doctorId", id); 
                navigate("/doctorDashboard"); 
            } else {
                setError("Incorrect password. Please try again.");
            }
        } else {
            setError("Doctor ID not found. Please check your ID.");
        }
    } catch (error) {
        setError("An error occurred. Please try again.");
    }
};

    const handlePatientLogin = () => {
        navigate("/login"); 
    };

    const handleRegister = () => {
        navigate("/registerDoctor");
    };

    return (
        <div className="wrapper">
            <button className="doctor-login-btn" onClick={handlePatientLogin}>אני מטופל</button>
            <div className="login-container">
                <img src={logo} width="300px" className="login-logo" />
                {error && <p className="error-message">{error}</p>}
                <input 
                    type="text" 
                    placeholder="תעודת זהות" 
                    className="login-input"
                    onChange={(e) => setId(e.target.value)} 
                />
                <input 
                    type="password" 
                    placeholder="סיסמא" 
                    className="login-input"
                    onChange={(e) => setPassword(e.target.value)} 
                />
                <button className="login-btn" onClick={handleLogin}>התחברות</button>

                <p className="register-link"> פעם ראשונה ? <a onClick={handleRegister}>הרשמה</a></p>
            </div>
        </div>
    );
}

export default LoginDoctor;
