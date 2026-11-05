import React, { useState } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { ref, get } from "firebase/database";
import { useNavigate } from "react-router-dom";
import logo from "../assets/CortexTalk.png";

function Login() {
    const [id, setId] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = async () => {
        if (!id.trim()) {
            setError("Please enter your ID.");
            return;
        }

        try {
            const userRef = ref(db, `Users/${id}`);
            const snapshot = await get(userRef);

            if (snapshot.exists()) {
                localStorage.setItem("patientId", id); 
                navigate("/patientDashboard"); 
            } else {
                setError("ID not found. Please check your ID.");
            }
        } catch (error) {
            setError("An error occurred. Please try again.");
        }
    };

    const handleDoctorLogin = () => {
        navigate("/LoginDoctor"); 
    };

    return (
        <div className="wrapper wrapper_patient">
            <button className="doctor-login-btn" onClick={handleDoctorLogin}>אני קלינאי</button>
            <div className="login-container">
                <img src={logo} width="300px" className="login-logo" />
                {error && <p className="error-message">{error}</p>}
                <input 
                    type="text" 
                    placeholder="תעודת זהות" 
                    className="login-input"
                    onChange={(e) => setId(e.target.value)} 
                />
                <button className="login-btn" onClick={handleLogin}>התחברות</button>
            </div>
        </div>
    );
}

export default Login;
