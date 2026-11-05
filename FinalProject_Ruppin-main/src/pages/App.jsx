import React from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import './App.css'
import PatientUI from './pages/PatientUI'
import DoctorUI from './pages/DoctorUI'
import Login from './pages/Login'
import LoginDoctor from "./pages/LoginDoctor";
import RegisterDoctor from "./pages/RegisterDoctor";
import PatientPage from "./pages/PatientPage";
import PatientDashboard from "./pages/PatientDashboard";
import ProtectedRouteDoctor from "./routes/ProtectedRouteDoctor";

function App() {
  return (
    <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/patientSession" element={<PatientUI />} />
          <Route path="/patientDashboard" element={<PatientDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/loginDoctor" element={<LoginDoctor />} />
          <Route path="/registerDoctor" element={<RegisterDoctor />} />
          <Route path="/doctorDashboard" element={<DoctorUI />} />
          <Route
			  path="/patient/:patientId"
			  element={
				<ProtectedRouteDoctor>
				  <PatientPage />
				</ProtectedRouteDoctor>
			  }
			/>
        </Routes>
    </Router>
  );
}

export default App
