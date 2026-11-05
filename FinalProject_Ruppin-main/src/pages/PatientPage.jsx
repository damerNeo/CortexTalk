import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebaseConfig";
import { ref, get, push, set, update } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import "react-datepicker/dist/react-datepicker.css";
import alefFont from "../assets/Alef-Regular-normal";
import "./PatientPage.css";


function PatientPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);


  // Modal EDIT PATIENT
  const [showEditPatientModal, setShowEditPatientModal] = useState(false);

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Modal + form state
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Image sets from DB, with counts
  // imageSets: [{ name: "Set 1 - ...", count: 12 }, ...]
  const [imageSets, setImageSets] = useState([]);
  // Selected sets (multi)
  const [selectedSets, setSelectedSets] = useState([]); // ["Set 1 - ...", ...]
  const [mixImages, setMixImages] = useState(true);

  // Édition date session existante
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingDate, setEditingDate] = useState("");

  useEffect(() => {
    fetchPatientData();
    fetchSessions();
    fetchImageSets();
  }, []);

  const fetchPatientData = async () => {
    try {
      const patientRef = ref(db, `Users/${patientId}`);
      const snapshot = await get(patientRef);
      if (snapshot.exists()) setPatient(snapshot.val());
    } catch (error) {
      console.error("Error fetching patient data:", error);
    }
  };

const fetchSessions = async () => {
  try {
    const sessionsRef = ref(db, `Users/${patientId}/Sessions`);
    const snapshot = await get(sessionsRef);

    if (!snapshot.exists()) {
      setUpcomingSessions([]);
      setCompletedSessions([]);
      return;
    }

    const sessionsData = snapshot.val();

    const sessionList = Object.entries(sessionsData).map(([id, data]) => ({
      id,
      ...data,
    }));

    const upcoming = sessionList.filter((s) => s.status === "Scheduled");
    const completed = sessionList.filter((s) => s.status === "Completed");

    // Scheduled: הקרוב קודם
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Completed: האחרון שבוצע קודם (completedAt), עם fallback לטיפולים ישנים
    completed.sort((a, b) => {
      const ta = new Date(a.completedAt || a.createdAt || a.date || 0).getTime();
      const tb = new Date(b.completedAt || b.createdAt || b.date || 0).getTime();
      return tb - ta;
    });

    setUpcomingSessions(upcoming);
    setCompletedSessions(completed);
  } catch (error) {
    console.error("❌ Error fetching sessions:", error);
    setUpcomingSessions([]);
    setCompletedSessions([]);
  }
};



  const fetchImageSets = async () => {
    try {
      const imageSetsRef = ref(db, "Images");
      const snapshot = await get(imageSetsRef);
      if (snapshot.exists()) {
        const obj = snapshot.val(); // { "Set 1 - בעלי חיים": { words: [...] }, ... }
        const asList = Object.keys(obj || {}).map((name) => ({
          name,
          count: Array.isArray(obj[name]?.words)
            ? obj[name].words.length
            : Object.values(obj[name]?.words || {}).length || 0,
        }));
        // tri simple par numéro croissant si présent
        asList.sort((a, b) => {
          const na = parseInt(a.name.match(/\d+/)?.[0] || "0", 10);
          const nb = parseInt(b.name.match(/\d+/)?.[0] || "0", 10);
          return na - nb || a.name.localeCompare(b.name);
        });
        setImageSets(asList);
      }
    } catch (error) {
      console.error("Error fetching image sets:", error);
    }
  };

  // 🔵 OUVRIR LA MODAL D’EDITION PATIENT
  const openEditPatientModal = () => {
    if (!patient) return;
    setEditFirstName(patient.firstName || "");
    setEditLastName(patient.lastName || "");
    setEditPhone(patient.phone || "");
    setShowEditPatientModal(true);
  };

  // 🔵 SAUVEGARDER PATIENT
  const savePatientEdits = async () => {
    try {
      await update(ref(db, `Users/${patientId}`), {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        phone: editPhone.trim(),
      });

      setShowEditPatientModal(false);
      fetchPatientData();
      alert("הנתונים עודכנו בהצלחה!");
    } catch (e) {
      console.error("Error updating patient:", e);
      alert("שגיאה בעדכון פרטי מטופל");
    }
  };

  // 🔴 DELETE PATIENT
  const deletePatient = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק את המטופל לצמיתות?")) return;

    try {
      // 1. Récupérer les infos du patient
      const patientRef = ref(db, `Users/${patientId}`);
      const snap = await get(patientRef);

      if (!snap.exists()) {
        alert("מטופל לא נמצא במסד הנתונים.");
        return;
      }

      const patientData = snap.val();
      const doctorId = patientData.doctorId;

      if (!doctorId) {
        alert("למטופל אין רופא משויך – מחיקה בוצעה רק מתיקיית המטופלים.");
      }

      // 2. Supprimer la liste de sessions
      await set(ref(db, `Users/${patientId}/Sessions`), null);

      // 3. Supprimer le patient complètement du dossier Users
      await set(ref(db, `Users/${patientId}`), null);

      // 4. Supprimer aussi chez הרופא/doctor
      if (doctorId) {
        const doctorPatientsRef = ref(db, `Doctors/${doctorId}/Patients`);
        const doctorPatientsSnap = await get(doctorPatientsRef);

        if (doctorPatientsSnap.exists()) {
          const patientsObj = doctorPatientsSnap.val();

          // Trouver la clé auto-générée du patient
          const patientKey = Object.keys(patientsObj).find(
            (key) => patientsObj[key].id === patientId
          );

          if (patientKey) {
            await set(ref(db, `Doctors/${doctorId}/Patients/${patientKey}`), null);
          }
        }
      }

      alert("המטופל נמחק בהצלחה מכל הרשומות.");
      navigate("/doctorDashboard");

    } catch (error) {
      console.error("❌ Error deleting patient everywhere:", error);
      alert("שגיאה במחיקת המטופל.");
    }
  };


  const handleAddSession = async () => {
    if (!selectedDate || selectedSets.length === 0) {
      alert("נא לבחור תוקף ולפחות סט תמונות אחד.");
      return;
    }

    const formattedDate =
      typeof selectedDate === "string"
        ? selectedDate
        : selectedDate.toISOString().split("T")[0];

    try {
      const sessionRef = push(ref(db, `Users/${patientId}/Sessions`));
      const sessionId = sessionRef.key;

      const newSession = {
        id: sessionId,
        date: formattedDate,
        imageSets: selectedSets, // multi-sets
        mixImages: !!mixImages,  // mélange oui/non
        status: "Scheduled",
      };

      await set(sessionRef, newSession);

      await fetchSessions();
      // reset form
      setSelectedSets([]);
      setMixImages(true);
      setSelectedDate(new Date());
      setShowModal(false);
    } catch (error) {
      console.error("Error adding session:", error);
    }
  };

  // Dupliquer une session (même date) — conserve ancien ou nouveau format
  const handleReplaySession = async (session) => {
    try {
      const newRef = push(ref(db, `Users/${patientId}/Sessions`));
      const newId = newRef.key;

      const cloned = {
        id: newId,
        date: new Date().toLocaleDateString("en-CA"),
        // Respecte le format existant
        ...(Array.isArray(session.imageSets) && session.imageSets.length
          ? { imageSets: session.imageSets, mixImages: !!session.mixImages }
          : { imageSet: session.imageSet }),
        status: "Scheduled",
        grade: 0,
        report: {},
        recreatedFrom: session.id,
        createdAt: new Date().toISOString(),
      };

      await set(newRef, cloned);
      await fetchSessions();
      alert("הטיפול נוצר מחדש בהצלחה!");
    } catch (e) {
      console.error("Error replaying session:", e);
      alert("אירעה שגיאה בחידוש הטיפול");
    }
  };

  // Edition de date
  const startEditDate = (session) => {
    setEditingSessionId(session.id);
    setEditingDate(session.date || "");
  };
  const cancelEditDate = () => {
    setEditingSessionId(null);
    setEditingDate("");
  };
  const saveEditDate = async () => {
    try {
      if (!editingSessionId || !editingDate) return;
      await update(ref(db, `Users/${patientId}/Sessions/${editingSessionId}`), {
        date: editingDate,
      });
      await fetchSessions();
      setEditingSessionId(null);
      setEditingDate("");
    } catch (err) {
      console.error("❌ Error updating session date:", err);
      alert("שגיאה בעדכון תוקף הטיפול");
    }
  };

// Try to turn an image URL into a DataURL so jsPDF can embed it.
// If CORS blocks it, it will throw and we will fallback to a clickable link.
const toDataUrl = async (url) => {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // data:*/*;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Decide image format for jsPDF addImage based on the dataURL header
const guessImgFormat = (dataUrlOrUrl) => {
  const s = String(dataUrlOrUrl || "").toLowerCase();
  if (s.startsWith("data:image/png")) return "PNG";
  if (s.startsWith("data:image/webp")) return "WEBP";
  return "JPEG"; // default
};


  // PDF report (inchangé, affiche entête selon format)
const handleDownloadReport = async (session) => {
  if (!session || !session.report) return;

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  pdf.addFileToVFS("Alef-Regular.ttf", alefFont);
  pdf.addFont("Alef-Regular.ttf", "Alef", "normal");
  pdf.setFont("Alef");
  pdf.setR2L(true);

  // -------- TITLE --------
  pdf.setFontSize(22);
  pdf.setTextColor(30, 30, 30);
  pdf.text("דוח סיכום טיפול", 105, 20, { align: "center" });

  // -------- HEADER BOX --------
  pdf.setDrawColor(50, 50, 50);
  pdf.setFillColor(245, 245, 245);
  pdf.roundedRect(10, 30, 190, 35, 3, 3, "F");

  pdf.setFontSize(12);
  pdf.setTextColor(20, 20, 20);

  pdf.text(`שם המטופל: ${patient?.firstName || ""} ${patient?.lastName || ""}`, 195, 40, { align: "right" });
  pdf.text(`תוקף המפגש: ${session.date}`, 195, 48, { align: "right" });
  pdf.text(`ציון כולל: ${session.grade}%`, 195, 56, { align: "right" });

  // Mix / Sets
  const headerSets = Array.isArray(session.imageSets)
    ? `סטים: ${session.imageSets.join(" | ")} | ערבוב: ${session.mixImages ? "כן" : "לא"}`
    : `סט: ${session.imageSet || "-"}`;

  pdf.text(headerSets, 195, 64, { align: "right" });

  // -------- SECTION TITLE --------
  pdf.setFontSize(16);
  pdf.setTextColor(40, 40, 40);
  pdf.text("פירוט ניסיונות:", 195, 82, { align: "right" });

  // -------- TABLE HEADER --------
  let y = 90;

  pdf.setFontSize(12);
  pdf.setFillColor(230, 230, 230);
  pdf.rect(10, y, 190, 10, "F");

  pdf.text("תמונה", 25, y + 7, { align: "center" });
  pdf.text("ניסיונות", 70, y + 7, { align: "center" });
  pdf.text("סה״כ ניסיונות", 115, y + 7, { align: "center" });
  pdf.text("ציון", 145, y + 7, { align: "center" });
  pdf.text("מילה", 180, y + 7, { align: "center" });

  y += 14;

  // -------- ENTRIES --------
  for (let index = 0; index < session.report.length; index++) {
    const entry = session.report[index];

    if (y > 270) {
      pdf.addPage();
      y = 20;
    }

    // Row background
    pdf.setFillColor(index % 2 === 0 ? 255 : 245);
    pdf.rect(10, y - 4, 190, 22, "F");

    // Image cell bounds
    const imgX = 13, imgY = y - 1, imgW = 18, imgH = 18;

    // Try embed image, otherwise show a clickable label
    if (entry.תמונה) {
      try {
        let imgData = entry.תמונה;

        // If it's a URL (http...), try fetch->dataURL
        if (/^https?:\/\//i.test(imgData)) {
          imgData = await toDataUrl(imgData);
        }

        const fmt = guessImgFormat(imgData);
        pdf.addImage(imgData, fmt, imgX, imgY, imgW, imgH);
      } catch (e) {
        // Fallback: clickable text (no URL printed)
        const linkText = "לחץ לתצוגת תמונה";
        pdf.setR2L(true);
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 255);

        // Put the text inside the image cell area
        // (center-ish)
        const tx = imgX + imgW / 2;
        const ty = y + 8;

        // Make it clickable (opens the URL)
        pdf.textWithLink(linkText, tx, ty, {
          align: "center",
          url: entry.תמונה,
        });

        // Reset color
        pdf.setTextColor(20, 20, 20);
        pdf.setFontSize(12);
      }
    }

    // Text fields
    pdf.setTextColor(20, 20, 20);
    pdf.setFontSize(12);

    pdf.text(entry.ניסיונות || "-", 70, y + 5, { align: "center" });
    pdf.text(String(entry.ניסיונותמספר || "-"), 115, y + 5, { align: "center" });

    pdf.setR2L(false);
    pdf.text(`${entry.ציון}%`, 145, y + 5, { align: "center" });

    pdf.setR2L(true);
    pdf.text(String(entry.מילה || "-"), 180, y + 5, { align: "center" });

    y += 22;
  }

  pdf.save(`דוח_טיפול_${session.date}.pdf`);
};





  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("Are you sure you want to delete this session?")) return;
    try {
      await set(ref(db, `Users/${patientId}/Sessions/${sessionId}`), null);
      fetchSessions();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  // Helpers UI for modal
  const toggleSet = (name) => {
    setSelectedSets((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const selectedSummary = selectedSets
    .map((n) => {
      const item = imageSets.find((s) => s.name === n);
      return item ? `${item.name} (${item.count})` : n;
    })
    .join(" | ");

  return (
    <div className="patient-page">
      <button className="go-back-btn" onClick={() => navigate(-1)}>
        ← חזור
      </button>

      {patient ? (
        <>
          <div className="patient-info">

            <h2 style={{direction:"rtl"}}>
              מטופל: {patient.firstName} {patient.lastName}
            </h2>
            <p>
              <strong>תעודת זהות:</strong> {patientId}
            </p>
            <p>
              <strong>מספר טלפון:</strong> {patient.phone}
            </p>

            <div style={{ display: "flex", gap: 10, marginTop: 20, marginBottom: 10, justifyContent: "flex-end" }}>
              <button className="session-edit-btn" onClick={openEditPatientModal}>
                עריכת המטופל
              </button>

              <button
                className="session-delete-btn"
                style={{ background: "#c62828" }}
                onClick={deletePatient}
              >
                מחיקת המטופל
              </button>
            </div>
          </div>

          <button className="add-session-btn" onClick={() => setShowModal(true)}>
            + הוספת טיפול חדש
          </button>

		<div className="session-history-container">
		  <h3 style={{ textAlign: "center" }}>הסטוריית טיפולים</h3>

		  {/* Upcoming / Scheduled */}
		  <h4 style={{ textAlign: "center", marginTop: 18 }}>טיפולים עתידיים (Scheduled)</h4>
		  <table className="session-table">
			<thead>
			  <tr>
				<th>תוקף</th>
				<th>סט(ים)</th>
				<th>סטטוס</th>
				<th>ציון (%)</th>
				<th>דו״ח</th>
				<th>פעולה</th>
			  </tr>
			</thead>
			<tbody>
			  {upcomingSessions.length > 0 ? (
				upcomingSessions.map((session) => {
				  const isMulti =
					Array.isArray(session.imageSets) &&
					session.imageSets.length > 0;

				  const setsText = isMulti
					? `${session.imageSets.join(" | ")} • ערבוב: ${session.mixImages ? "כן" : "לא"}`
					: session.imageSet || "-";

				  return (
					<tr key={session.id}>
					  {/* date + inline edit */}
					  <td style={{ minWidth: 180 }}>
						{editingSessionId === session.id ? (
						  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
							<input
							  type="date"
							  value={editingDate}
							  onChange={(e) => setEditingDate(e.target.value)}
							/>
							<button className="session-save-btn" onClick={saveEditDate}>
							  שמור
							</button>
							<button className="session-cancel-btn" onClick={cancelEditDate}>
							  בטל
							</button>
						  </div>
						) : (
						  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
							<span>{session.date || "-"}</span>
							<button
							  className="session-edit-btn"
							  onClick={() => startEditDate(session)}
							  title="עריכת תוקף הטיפול"
							>
							  ערוך
							</button>
						  </div>
						)}
					  </td>

					  <td style={{ direction: "rtl" }}>{setsText}</td>
					  <td>{session.status}</td>
					  <td>-</td>
					  <td></td>

					  <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						<button
						  className="session-delete-btn"
						  onClick={() => handleDeleteSession(session.id)}
						>
						  מחיקה
						</button>
					  </td>
					</tr>
				  );
				})
			  ) : (
				<tr>
				  <td colSpan="6">אין טיפולים עתידיים</td>
				</tr>
			  )}
			</tbody>
		  </table>

		  {/* Completed */}
		  <h4 style={{ textAlign: "center", marginTop: 28 }}>טיפולים שהושלמו (Completed)</h4>
		  <table className="session-table">
			<thead>
			  <tr>
				<th>תוקף</th>
				<th>סט(ים)</th>
				<th>סטטוס</th>
				<th>ציון (%)</th>
				<th>דו״ח</th>
				<th>פעולה</th>
			  </tr>
			</thead>
			<tbody>
			  {completedSessions.length > 0 ? (
				completedSessions.map((session) => {
				  const isMulti =
					Array.isArray(session.imageSets) &&
					session.imageSets.length > 0;

				  const setsText = isMulti
					? `${session.imageSets.join(" | ")} • ערבוב: ${session.mixImages ? "כן" : "לא"}`
					: session.imageSet || "-";

				  return (
					<tr key={session.id}>
					  <td style={{ minWidth: 180 }}>
						<span>{session.date || "-"}</span>
					  </td>

					  <td style={{ direction: "rtl" }}>{setsText}</td>
					  <td>{session.status}</td>
					  <td>{`${session.grade}%`}</td>
						<td>
						  {session.report && (
							<button
							  className="download-btn"
							  onClick={() => handleDownloadReport(session)}
							>
							  PDF הורדת
							</button>
						  )}
						</td>

					  <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						<button
						  className="session-replay-btn"
						  onClick={() => handleReplaySession(session)}
						  title="חידוש תוקף זה עם אותו סט תמונות"
						>
						  חידוש תוקף
						</button>
					  </td>
					</tr>
				  );
				})
			  ) : (
				<tr>
				  <td colSpan="6">אין טיפולים שהושלמו</td>
				</tr>
			  )}
			</tbody>
		  </table>
		</div>

        </>
      ) : (
        <p>Loading patient data.</p>
      )}

      {/* Modal: créer une session */}
      {showModal && (
        <div className="session-modal-overlay">
          <div className="session-modal-content">
            <h3 className="session-modal-title">הוספת טיפול חדש</h3>

            {/* Date */}
            <label
              className="session-modal-label"
              style={{ direction: "rtl", textAlign: "right" }}
            >
              תוקף הטיפול:
            </label>
            <input
              type="date"
              className="session-modal-input"
              value={
                typeof selectedDate === "string"
                  ? selectedDate
                  : selectedDate.toISOString().split("T")[0]
              }
              onChange={(e) => setSelectedDate(e.target.value)}
            />

            {/* Multi-sets selection with counts */}
            <label
              className="session-modal-label"
              style={{ direction: "rtl", textAlign: "right", marginTop: 10 }}
            >
              בחר סט תמונות (ניתן לבחור כמה):
            </label>

            <div
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 10,
                padding: "10px 12px",
                maxHeight: 240,
                overflowY: "auto",
                background: "#fafafa",
              }}
            >
              {imageSets.length === 0 && <div>לא נמצאו סטים</div>}
              {imageSets.map((s) => (
                <label 
                  key={s.name}
                  style={{
                    direction: "rtl",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "6px 0",
                    borderBottom: "1px dashed #eee",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={selectedSets.includes(s.name)}
                      onChange={() => toggleSet(s.name)}
                    />
                    <span style={{ direction: "rtl" }}>{s.name}</span>
                  </div>
                  <span style={{ color: "#666", whiteSpace: "nowrap" }}>
                    {s.count} תמונות
                  </span>
                </label>
              ))}
            </div>

            {/* Mix option */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 10,
                direction: "rtl",
                justifyContent: "flex-start",
              }}
              title="כאשר מופעל: כל התמונות מסודרות בערבוב. כאשר כבוי: נשמר סדר לפי קבוצות."
            >
              <input
                type="checkbox"
                checked={mixImages}
                onChange={(e) => setMixImages(e.target.checked)}
              />
              ערבב תמונות מסטים שונים
            </label>

            {/* Summary */}
            {selectedSets.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  background: "#f7f7f9",
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: "8px 10px",
                  direction: "rtl",
                }}
              >
                <strong>נבחר:</strong> {selectedSummary || "-"}
              </div>
            )}

            {/* Buttons */}
            <div className="session-modal-buttons">
              <button className="session-modal-btn add" onClick={handleAddSession}>
                הוספה
              </button>
              <button
                className="session-modal-btn cancel"
                onClick={() => {
                  setShowModal(false);
                  setSelectedSets([]);
                  setMixImages(true);
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditPatientModal && (
        <div className="session-modal-overlay">
          <div className="session-modal-content">
            <h3 className="session-modal-title">עריכת פרטי מטופל</h3>

            <label>שם פרטי:</label>
            <input
              className="session-modal-input"
              style={{ direction: "rtl",width:"90%" }}
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
            />
            <br />
            <label>שם משפחה:</label>
            <input
              className="session-modal-input"
              style={{ direction: "rtl",width:"90%" }}
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
            />

            <label>טלפון:</label>
            <input
              className="session-modal-input"
              style={{ direction: "rtl",width:"90%" }}
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />

            <div className="session-modal-buttons">
              <button className="session-modal-btn add" onClick={savePatientEdits}>
                שמור
              </button>
              <button
                className="session-modal-btn cancel"
                onClick={() => setShowEditPatientModal(false)}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PatientPage;
