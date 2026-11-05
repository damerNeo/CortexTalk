import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { ref, get } from "firebase/database";
import { useNavigate } from "react-router-dom";

function PatientDashboard() {
    const [sessions, setSessions] = useState([]);
    const [upcomingSessions, setUpcomingSessions] = useState([]);
    const navigate = useNavigate();
    const todayDate = new Date().toISOString().split("T")[0];

    useEffect(() => {
        const fetchSessions = async () => {
            const userId = localStorage.getItem("patientId");
            if (!userId) {
                navigate("/login");
                return;
            }

            try {
                const sessionsRef = ref(db, `Users/${userId}/Sessions`);
                const snapshot = await get(sessionsRef);

                if (snapshot.exists()) {
                    const sessionList = Object.entries(snapshot.val()).map(([id, data]) => ({
                        id,
                        ...data,
                    }));

                    // ---------- TRI PAR DATE (récent → ancien) ----------
                    const sorted = sessionList.sort((a, b) => {
                        const da = new Date(a.date);
                        const db = new Date(b.date);
                        return db - da; // du plus récent au plus ancien
                    });

                    // ---------- Séparer upcoming / completed ----------
                    const upcoming = sorted.filter(s => s.status === "Scheduled");
                    const completed = sorted.filter(s => s.status === "Completed");

                    setUpcomingSessions(upcoming);
                    setSessions(completed);
                }
            } catch (error) {
                console.error("Error fetching sessions:", error);
            }
        };


        fetchSessions();
    }, [navigate]);

    const handleStartSession = (sessionId) => {
        localStorage.setItem("sessionId", sessionId);
        navigate("/patientSession");
    };

    // 🧩 Fonction utilitaire pour afficher les sets proprement
    const renderImageSets = (session) => {
        if (!session) return "-";
        if (Array.isArray(session.imageSets))
            return session.imageSets.join(", ");
        if (typeof session.imageSet === "string")
            return session.imageSet;
        return "-";
    };

    return (
        <div className="patient-dashboard">
            <button className="go-back-btn" onClick={() => navigate("/login")}>← חזור</button>

            <h2>Patient Dashboard</h2>

            {/* Table: Upcoming Sessions */}
            <div className="patient-dashboard-section">
                <h3>טיפולים הבאים</h3>
                <table className="patient-session-table">
                    <thead>
                        <tr>
                            <th>תוקף</th>
                            <th>סט תמונות</th>
                            <th>פעולה</th>
                        </tr>
                    </thead>
                    <tbody>
                        {upcomingSessions.length > 0 ? (
                            upcomingSessions.map((session, index) => (
                                <tr key={index}>
                                    <td>{session.date}</td>
                                    <td>{renderImageSets(session)}</td>
                                    <td>
                                        {session.date >= todayDate ? (
                                            <button
                                                className="patient-session-start-btn"
                                                onClick={() => handleStartSession(session.id)}
                                            >
                                                התחל
                                            </button>
                                        ) : (
                                            <button
                                                className="patient-session-start-btn2 disabled-btn"
                                                disabled
                                            >
                                                התחל
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="3">אין טיפולים פעילים</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Table: Completed Sessions */}
            <div className="patient-dashboard-section">
                <h3>טיפולים שהושלמו</h3>
                <table className="patient-session-table">
                    <thead>
                        <tr>
                            <th>תוקף</th>
                            <th>סט תמונות</th>
                            <th>ציון</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.length > 0 ? (
                            sessions.map((session, index) => (
                                <tr key={index}>
                                    <td>{session.date || "לא צוין"}</td>
                                    <td>{renderImageSets(session)}</td>
                                    <td>{session.grade !== undefined ? `${session.grade}%` : "-"}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="3">No completed sessions</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default PatientDashboard;
