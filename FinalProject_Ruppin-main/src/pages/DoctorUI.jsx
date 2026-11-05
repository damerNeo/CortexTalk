import React, { useState, useEffect, useMemo } from "react";
import { db } from "../firebase/firebaseConfig";
import { ref, get, push, set } from "firebase/database";
import { useNavigate } from "react-router-dom";
import "./DoctorUI.css";



function DoctorUI() {
  // Patients
    const [patients, setPatients] = useState([]);
    const [doctorId, setDoctorId] = useState(null);

    // Modales / flows
    const [showModal, setShowModal] = useState(false);              
    const [showManageSets, setShowManageSets] = useState(false);     
    const [showSetWizard, setShowSetWizard] = useState(false);       
    const [showImageLibrary, setShowImageLibrary] = useState(false);  

    // Wizard état
    const [currentStep, setCurrentStep] = useState(1); 
    const [isEditingSet, setIsEditingSet] = useState(false);
    const [currentSetName, setCurrentSetName] = useState("");
    const [category, setCategory] = useState("");
    const [numWords, setNumWords] = useState(1);
    const [wordInputs, setWordInputs] = useState([]);
    const [nextSetNumber, setNextSetNumber] = useState(1);
	
    // Form patient
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [id, setId] = useState("");
    const [phone, setPhone] = useState("");

    const [existingSets, setExistingSets] = useState({}); 
    const [librarySelection, setLibrarySelection] = useState({ set: "", index: 0 });
    const [targetWordIndexForLibrary, setTargetWordIndexForLibrary] = useState(null);

    // Draft
    const DRAFT_KEY = "doctorUI_setDraft";

    const navigate = useNavigate();

    // Helpers
    const emptyWord = () => ({
        word: "",
        image: "",               // URL ou DataURL(base64)
        clues: ["", "", ""],
        synonyms: [],
        sourceType: "url",
        localFileName: "",
    });

    // ---------- Auth & patients ----------
    useEffect(() => {
        const storedDoctorId = localStorage.getItem("doctorId");
        if (storedDoctorId) {
        setDoctorId(storedDoctorId);
        fetchPatients(storedDoctorId);
        } else {
        navigate("/loginDoctor");
        }
    }, []);

    const fetchPatients = async (docId) => {
        if (!docId) return;
        try {
        const patientsRef = ref(db, `Doctors/${docId}/Patients`);
        const snapshot = await get(patientsRef);
        setPatients(snapshot.exists() ? Object.values(snapshot.val()) : []);
        } catch (e) {
        console.error("Error fetching patients", e);
        }
    };

    // ---------- Existing Sets / numerotation ----------
    const refreshExistingSets = async () => {
        try {
        const snapshot = await get(ref(db, "Images"));
        setExistingSets(snapshot.exists() ? snapshot.val() : {});
        } catch (e) {
        console.error("Failed to fetch existing sets", e);
        }
    };

    useEffect(() => {
        if (showManageSets || showImageLibrary) refreshExistingSets();
    }, [showManageSets, showImageLibrary]);

    useEffect(() => {
        const fetchNext = async () => {
        const snapshot = await get(ref(db, "Images"));
        if (snapshot.exists()) {
            const names = Object.keys(snapshot.val());
            const last = names
            .map((n) => parseInt(n.match(/\d+/)?.[0] || 0))
            .sort((a, b) => b - a)[0] || 0;
            setNextSetNumber(last + 1);
        } else {
            setNextSetNumber(1);
        }
        };
        if (showSetWizard) fetchNext();
    }, [showSetWizard]);

    // ---------- Draft (localStorage) ----------
	const saveDraft = ({ exit = false, silent = false } = {}) => {
	  const payload = { isEditingSet, currentSetName, category, numWords, wordInputs, currentStep };
	  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));

	  if (!silent) alert("טיוטה נשמרה");

	  if (exit) {
		setShowSetWizard(false); // יוצאים מהעריכה אבל לא מוחקים טיוטה
		setCurrentStep(1);
		setIsEditingSet(false);
	  }
	};
	
    const clearDraft = () => localStorage.removeItem(DRAFT_KEY);
	const resetWizardState = () => {
	  setIsEditingSet(false);
	  setCurrentSetName("");
	  setCategory("");
	  setNumWords(1);
	  setWordInputs([]);
	  setCurrentStep(1);
	};

	const cancelWizard = () => {
	  // מוחק טיוטה קיימת (אם נשמרה)
	  clearDraft();
	  // מאפס את כל ה-wizard כדי שלא ימשיך עם נתונים ישנים
	  resetWizardState();
	  // סוגר את החלון
	  setShowSetWizard(false);
	};
    const hasDraft = useMemo(() => !!localStorage.getItem(DRAFT_KEY), [showSetWizard]);
    const resumeDraft = () => {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        try {
        const d = JSON.parse(raw);
        setIsEditingSet(!!d.isEditingSet);
        setCurrentSetName(d.currentSetName || "");
        setCategory(d.category || "");
        setNumWords(d.numWords || 1);
        setWordInputs(Array.isArray(d.wordInputs) ? d.wordInputs : []);
        setCurrentStep(d.currentStep || 1);
        setShowSetWizard(true);
        } catch (e) {
        console.warn("Failed to parse draft", e);
        }
    };

    useEffect(() => {
        const onBeforeUnload = (e) => {
        if (showSetWizard) {
            saveDraft({ silent: true });
            e.preventDefault();
            e.returnValue = "";
        }
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [showSetWizard, isEditingSet, currentSetName, category, numWords, wordInputs, currentStep]);

    // ---------- creation/edition ----------
    const startCreateNewSet = () => {
        setIsEditingSet(false);
        setCurrentSetName("");
        setCategory("");
        setNumWords(1);
        setWordInputs([emptyWord()]);
        setCurrentStep(1);
        setShowSetWizard(true);
    };

    const loadSetIntoEditor = (setName) => {
        const s = existingSets[setName];
        if (!s || !s.words) return;
        setIsEditingSet(true);
        setCurrentSetName(setName);
        const match = setName.split(" - ");
        setCategory(match[1] || "");
        setWordInputs(
        s.words.map((w) => ({
            word: w.word || "",
            image: w.image || "",
            clues: Array.isArray(w.clues)
            ? w.clues.slice(0, 3).concat(["", "", ""]).slice(0, 3)
            : ["", "", ""],
            synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
            sourceType: /^data:image\//.test(w.image || "") ? "upload" : "url",
            localFileName: "",
        }))
        );
        setNumWords(s.words.length || 1);
        setCurrentStep(1);
        setShowManageSets(false);
        setShowSetWizard(true);
    };

    // ---------- Validation ----------
    const validateWordAt = (idx) => {
        const w = wordInputs[idx];
        if (!w) return false;
        if (!w.word.trim()) { alert(`המילה חסרה בפריט מספר ${idx + 1}`); return false; }
        if (!w.image || !w.image.trim()) { alert(`תמונה חסרה בפריט מספר ${idx + 1}`); return false; }
        const filled = (w.clues || []).filter((c) => c && c.trim());
        if (filled.length < 3) { alert(`יש למלא שלושה רמזים בפריט מספר ${idx + 1}`); return false; }
        return true;
    };

    const handleNextStep = () => {
        if (!category.trim()) { alert("נא להזין קטגוריה"); return; }
        if (numWords < 1) { alert("יש להזין מספר מילים חוקי"); return; }
        if (wordInputs.length !== numWords) {
        const merged = Array.from({ length: numWords }, (_, i) => wordInputs[i] || emptyWord());
        setWordInputs(merged);
        }
        setCurrentStep(2);
    };

	const goNextWord = () => {
	  const idx = currentStep - 2; // step 2 == index 0
	  if (idx < numWords - 1) setCurrentStep((s) => s + 1);
	};
    const goPrevWord = () => { if (currentStep > 2) setCurrentStep((s) => s - 1); };

    // ---------- Sauvegarde set ----------
    const finishAndSaveSet = async () => {
  for (let i = 0; i < numWords; i++) {
    if (!validateWordAt(i)) return false; // ❗ לא לסגור – רק להחזיר "נכשל"
  }

  const setName =
    isEditingSet && currentSetName
      ? currentSetName
      : `Set ${nextSetNumber} - ${category}`;

  try {
    await set(ref(db, `Images/${setName}/words`), wordInputs);
    alert(isEditingSet ? "השינויים נשמרו בהצלחה!" : "הסט נשמר בהצלחה!");
    setIsEditingSet(false);
    setCurrentSetName("");
    return true; // ✅ הצלחה
  } catch (e) {
    console.error("Error saving image set", e);
    alert("אירעה שגיאה בשמירת הסט.");
    return false; // ❌ שמירה נכשלה
  }
};


    // ---------- Mutateurs champs ----------
    const setWordField = (index, field, value) => {
        setWordInputs((prev) => { const next = [...prev]; next[index] = { ...next[index], [field]: value }; return next; });
    };

    const setClueField = (index, clueIdx, value) => {
        setWordInputs((prev) => {
        const next = [...prev];
        const clues = [...(next[index].clues || ["", "", ""])];
        clues[clueIdx] = value;
        next[index] = { ...next[index], clues };
        return next;
        });
    };

      const handleSynonymsInput = (index, value) => {
      // נשמור את המחרוזת כמו שהיא בלי לפרק אותה עדיין
      setWordInputs((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          synonymsInput: value, // שמירה זמנית
        };
        return next;
      });
    };


    const finalizeSynonymsInput = (index) => {
      setWordInputs((prev) => {
        const next = [...prev];
        const raw = next[index].synonymsInput || "";

        const parsed = raw
          .split(/[;,]/)      // מפריד פסיק או נקודה־פסיק
          .map((s) => s.trim())
          .filter(Boolean);

        next[index] = {
          ...next[index],
          synonyms: parsed,
        };

        return next;
      });
    };

    const addWordRow = () => {
	  setWordInputs((prev) => {
		const next = [...prev, emptyWord()];
		// לעבור מיד לפריט החדש (האחרון)
		setCurrentStep(2 + (next.length - 1)); // step 2 == index 0
		return next;
	  });

	  setNumWords((n) => n + 1);
	};
    const removeWordRow = (idx) => {
      // Demande de confirmation
      const ok = window.confirm("האם אתה בטוח שברצונך למחוק פריט זה?");
      if (!ok) return;

      setWordInputs((prev) => prev.filter((_, i) => i !== idx));
      setNumWords((n) => Math.max(1, n - 1));

      if (currentStep > numWords) {
        setCurrentStep(2);
      }
    };


    // ---------- Gestion images ----------
    const handleImageFile = (index, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
        const dataUrl = e.target?.result || "";
        setWordInputs((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], image: String(dataUrl), sourceType: "upload", localFileName: file.name };
            return next;
        });
        };
        reader.readAsDataURL(file);
    };

    const openLibraryForIndex = (index) => { setTargetWordIndexForLibrary(index); setShowImageLibrary(true); };

    const applyLibraryImage = () => {
        const { set: setName, index } = librarySelection;
        const img = existingSets?.[setName]?.words?.[index]?.image;
        if (!img || targetWordIndexForLibrary == null) return;
        setWordInputs((prev) => {
        const next = [...prev];
        next[targetWordIndexForLibrary] = {
            ...next[targetWordIndexForLibrary],
            image: img,
            sourceType: /^data:image\//.test(img) ? "upload" : "url",
            localFileName: ""
        };
        return next;
        });
        setShowImageLibrary(false);
        setTargetWordIndexForLibrary(null);
    };

    const setImageUrl = (index, url) => {
        setWordInputs((prev) => { const next = [...prev]; next[index] = { ...next[index], image: url, sourceType: "url" }; return next; });
    };

    // ---------- Computed ----------
    const computedSetName = useMemo(
        () => (isEditingSet && currentSetName) ? currentSetName : `Set ${nextSetNumber} - ${category}`,
        [isEditingSet, currentSetName, nextSetNumber, category]
    );

    // ---------- UI ----------
    return (
        <div className="doctor-ui">
        <header className="dashboard-header">
            <h2 className="dashboard-title">Doctor Dashboard</h2>
            <div className="button-container">
            <button className="logout-btn" onClick={() => { localStorage.removeItem("doctorId"); navigate("/loginDoctor"); }}>Logout</button>
            <div className="button-add-container" style={{ display: "flex", gap: 12 }}>
                <button className="add-patient-btn" onClick={() => setShowModal(true)}>+ הוספת מטופל חדש</button>
                <button className="add-image-btn" onClick={startCreateNewSet}>+ הוספת סט תמונות חדש</button>
                <button className="manage-sets-btn" onClick={() => setShowManageSets(true)}>ניהול / עריכת סטים</button>
                {hasDraft && (<button className="resume-draft-btn" onClick={resumeDraft}>המשך טיוטה</button>)}
            </div>
            </div>
        </header>

        {/* Patients table */}
        <div className="table-container">
            <table className="patient-table">
            <thead>
                <tr>
                <th>תעודת זהות</th>
                <th>שם פרטי</th>
                <th>שם משפחה</th>
                <th>מספר טלפון</th>
                </tr>
            </thead>
            <tbody>
                {patients.length > 0 ? (
                patients.map((p, i) => (
                    <tr key={i} onClick={() => navigate(`/patient/${p.id}`)} className="clickable-row">
                    <td>{p.id}</td>
                    <td>{p.firstName}</td>
                    <td>{p.lastName}</td>
                    <td>{p.phone}</td>
                    </tr>
                ))
                ) : (
                <tr><td colSpan="4">No patients found</td></tr>
                )}
            </tbody>
            </table>
        </div>

        {/* Add Patient Modal */}
        {showModal && (
            <div className="modal-overlay">
            <div className="modal-content" style={{ maxHeight: "80vh", overflowY: "auto", padding: 20, borderRadius: 20, background: "#fff", boxShadow: "0 10px 40px rgba(0,0,0,.25)" }}>
                <h3 className="modal-title" style={{ textAlign: "center", marginBottom: 10 }}>הוספת מטופל חדש</h3>
                <div className="modal-inputs" style={{ display: "grid", gap: 10 }}>
                <div className="modal-input-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input type="text" placeholder="שם משפחה" className="modal-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    <input type="text" placeholder="שם פרטי" className="modal-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <input type="text" placeholder="תעודת זהות" className="modal-input" value={id} onChange={(e) => setId(e.target.value)} />
                <input type="tel" placeholder="טלפון" className="modal-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="modal-buttons" style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
                <button
                    className="modal-btn add"
                    onClick={async () => {
                      if (!doctorId || !firstName || !lastName || !id || !phone) {
                        alert("נא למלא את כל השדות");
                        return;
                      }

                      try {
                        // CHECK 1 : L’ID existe déjà dans Users ?
                        const userRef = ref(db, `Users/${id}`);
                        const userSnap = await get(userRef);

                        if (userSnap.exists()) {
                          alert("מטופל עם תעודת זהות זו כבר קיים במערכת.");
                          return;
                        }

                        // CHECK 2 : L’ID existe déjà chez ce docteur ?
                        const doctorPatientsRef = ref(db, `Doctors/${doctorId}/Patients`);
                        const doctorSnap = await get(doctorPatientsRef);

                        if (doctorSnap.exists()) {
                          const patientsObj = doctorSnap.val();
                          const exists = Object.values(patientsObj).some(
                            (p) => p.id === id
                          );

                          if (exists) {
                            alert("מטופל זה כבר רשום אצלך.");
                            return;
                          }
                        }

                        // OK → Création du patient
                        const newPatient = { id, firstName, lastName, phone, doctorId };
                        const newRef = push(ref(db, `Doctors/${doctorId}/Patients`));

                        await set(newRef, newPatient);
                        await set(userRef, {
                          firstName,
                          lastName,
                          phone,
                          role: "patient",
                          doctorId
                        });

                        fetchPatients(doctorId);
                        setShowModal(false);

                        // reset form
                        setFirstName("");
                        setLastName("");
                        setId("");
                        setPhone("");

                        alert("המטופל נוסף בהצלחה!");

                      } catch (err) {
                        console.error("❌ Error creating patient:", err);
                        alert("שגיאה בהוספת המטופל.");
                      }
                    }}

                    style={{ background: "#28a745", color: "#fff", padding: "8px 18px", borderRadius: 10, border: "none" }}
                >
                    הוספה
                </button>
                <button className="modal-btn cancel" onClick={() => setShowModal(false)} style={{ background: "#6c757d", color: "#fff", padding: "8px 18px", borderRadius: 10, border: "none" }}>
                    ביטול
                </button>
                </div>
            </div>
            </div>
        )}

        {/* Manage / Edit Sets Modal */}
        {showManageSets && (
            <div className="modal-overlay">
            <div className="modal-content large" style={{ maxHeight: "80vh", overflowY: "auto", padding: 20, borderRadius: 20, background: "#fff", boxShadow: "0 10px 40px rgba(0,0,0,.25)" }}>
                <h3 className="modal-title" style={{ textAlign: "center", marginBottom: 10 }}>ניהול סטים קיימים</h3>
                <div className="sets-list" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.keys(existingSets || {}).length === 0 && <p>לא נמצאו סטים</p>}
                {Object.keys(existingSets || {}).map((name) => (
                    <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid #e6e6e6", background: "#f8f9fa", borderRadius: 12 }}>
                    <div><strong>{name}</strong><span style={{ marginInlineStart: 8, color: "#888" }}>({existingSets[name]?.words?.length || 0} מילים)</span></div>
                    <button className="modal-btn" style={{ background: "#0d6efd", color: "#fff", border: "none", borderRadius: 10, padding: "6px 12px" }} onClick={() => loadSetIntoEditor(name)}>עריכה</button>
                    </div>
                ))}
                </div>
                <div style={{ textAlign: "center", marginTop: 16 }}>
                <button className="modal-btn cancel" onClick={() => setShowManageSets(false)} style={{ background: "#6c757d", color: "#fff", padding: "8px 18px", borderRadius: 10, border: "none" }}>סגור</button>
                </div>
            </div>
            </div>
        )}

{/* Image Library Picker (RTL, style conservé, selects alignés, preview réduite) */}
{showImageLibrary && (
  <div className="modal-overlay library" style={{ zIndex: 2000 }}>
    <div
      className="modal-content large"
      style={{
        maxHeight: "80vh",
        overflowY: "auto",
        padding: 20,
        borderRadius: 20,
        background: "#fff",
        boxShadow: "0 10px 40px rgba(0,0,0,.3)",
      }}
      dir="rtl" // 👈 maintient le sens RTL
    >
      <h3 className="modal-title" style={{ textAlign: "right", marginBottom: 12 }}>
        בחר תמונה מסט קיים
      </h3>

      <div className="library-controls" style={{ display: "grid", gap: 12 }}>
        {/* Ligne 1 : set */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,                   // espace entre le texte et le select
            justifyContent: "flex-start",
            textAlign: "right",
          }}
        >
          <span style={{ minWidth: 60 }}>סט:</span>
          <select
            className="modal-input"   // 👈 on garde le style existant
            style={{ width: "75%" }}  // largeur identique à avant
            value={librarySelection.set}
            onChange={(e) => setLibrarySelection({ set: e.target.value, index: 0 })}
          >
            <option value="">בחר</option>
            {Object.keys(existingSets || {}).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        {/* Ligne 2 : item */}
        {!!librarySelection.set && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: "flex-start",
              textAlign: "right",
            }}
          >
            <span style={{ minWidth: 60 }}>פריט:</span>
            <select
              className="modal-input"
              style={{ width: "75%" }}
              value={librarySelection.index}
              onChange={(e) =>
                setLibrarySelection((s) => ({ ...s, index: Number(e.target.value) }))
              }
            >
              {(existingSets[librarySelection.set]?.words || []).map((w, i) => (
                <option key={i} value={i}>{`${i + 1}. ${w.word || "(ללא מילה)"}`}</option>
              ))}
            </select>
          </label>
        )}
      </div>

{/* Aperçu réduit en conservant le ratio */}
{!!librarySelection.set && (
  <div className="library-preview" style={{ textAlign: "center", marginTop: 16 }}>
    {existingSets[librarySelection.set]?.words?.[librarySelection.index]?.image ? (
      <div
        style={{
          display: "inline-block",
          maxWidth: 220,      // largeur max de l'aperçu
          maxHeight: 160,     // hauteur max de l'aperçu
          padding: 0,
          borderRadius: 12,
          border: "1px solid #eee",
          background: "#f7f7f7",
          overflow: "hidden",
        }}
      >
        <img
          alt="preview"
          src={existingSets[librarySelection.set].words[librarySelection.index].image}
          style={{
            display: "block",
            maxWidth: 220,     // limite l'image sans déformer
            maxHeight: 160,
            width: "auto",     // garde le ratio
            height: "auto",    // garde le ratio
          }}
        />
      </div>
    ) : (
      <p>אין תצוגה מקדימה</p>
    )}
  </div>
)}


      <div
        className="modal-buttons"
        style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 18 }}
      >
        <button
          className="modal-btn2 add"
          onClick={applyLibraryImage}
          style={{ background: "#198754", color: "#fff", padding: "8px 20px", borderRadius: 10, border: "none", width: "fit-content" }}
        >
          השתמש בתמונה
        </button>
        <button
          className="modal-btn2 cancel"
          onClick={() => setShowImageLibrary(false)}
          style={{ background: "#dc3545", color: "#fff", padding: "8px 20px", borderRadius: 10, border: "none", width: "fit-content" }}
        >
          ביטול
        </button>
      </div>
    </div>
  </div>
)}


        {/* Set Wizard */}
        {showSetWizard && (
            <div className="modal-overlay">
            <div className="modal-content xlarge" style={{ maxHeight: "85vh", overflowY: "auto", padding: 20, borderRadius: 20, background: "#fff", boxShadow: "0 10px 40px rgba(0,0,0,.3)", width: "min(820px, 95vw)" }}>
                <div className="modal-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, direction: "rtl" }}>
                  <h3 className="modal-title" style={{ display: "flex", gap: 10, alignItems: "center", direction: "rtl" }}>
                      {isEditingSet ? (
                          <>
                              <span>עריכת סט</span>
                              <span style={{ color: "#0d6efd", fontWeight: "bold" }}>
                                  {currentSetName}
                              </span>
                          </>
                      ) : (
                          "סט תמונות חדש"
                      )}
                  </h3>
                  <div className="modal-header-actions" style={{ display: "flex", gap: 8 }}>
                      <button className="modal-btn" onClick={() => saveDraft({ exit: true })} style={{ background: "#0d6efd", color: "#fff", padding: "8px 14px", borderRadius: 10, border: "none" }}>שמור טיוטה</button>
                  </div>
                </div>

                {/* Step 1: meta */}
                {currentStep === 1 && (
                <>
                    <div className="modal-inputs" style={{ display: "grid", gap: 10 }}>
                    <input type="text" value={computedSetName} className="modal-input" readOnly />
                    <input type="text" placeholder="קטגוריה" className="modal-input" value={category} onChange={(e) => setCategory(e.target.value)} />
                    <input type="number" placeholder="מספר מילים בסט" className="modal-input" value={numWords} readOnly />
                    </div>
                    <div className="modal-buttons" style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
                    <button className="modal-btn add" onClick={handleNextStep} style={{ background: "#198754", color: "#fff", padding: "8px 18px", borderRadius: 10, border: "none" }}>הבא</button>
                    <button className="modal-btn cancel" onClick={cancelWizard} style={{ background: "#dc3545", color: "#fff", padding: "8px 18px", borderRadius: 10, border: "none" }}>ביטול</button>
                    </div>
                </>
                )}

                {/* Steps 2..N: word pages */}
                {currentStep >= 2 && currentStep <= numWords + 1 && (
                <>
                    {(() => {
                    const idx = currentStep - 2;
                    const w = wordInputs[idx] || emptyWord();
                    return (
                      <div className="word-editor" style={{ display: "grid", gap: 10 }}>
                        <div className="word-editor-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", direction: "rtl" }}>
                            <h4 style={{ margin: 0 }}>Word {idx + 1} / {numWords}</h4>
                            <div className="word-editor-actions" style={{ display: "flex", gap: 8 }}>
                            <button className="modal-btn2" onClick={addWordRow} style={{ background: "#0d6efd", color: "#fff", padding: "12px 20px", borderRadius: 10, border: "none", width: "fit-content" }}>+ הוספת פריט</button>
                            {numWords > 1 && (
                                <button className="modal-btn2" onClick={() => removeWordRow(idx)} style={{ background: "#dc3545", color: "#fff", padding: "6px 12px", borderRadius: 10, border: "none", width: "fit-content" }}> הסר פריט זה </button>
                            )}
                            </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl" }}>
                          <label className="source-label" style={{direction: "rtl", minWidth: "140px", textAlign: "right", display: "inline-block"}}> מילה:</label>
                          <input type="text" placeholder="מילה" className="modal-input2" value={w.word} onChange={(e) => setWordField(idx, "word", e.target.value)} />
                        </div>

                        {/* Source image via SELECT */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl" }}>
                          <label className="source-label" style={{direction: "rtl", minWidth: "140px", textAlign: "right", display: "inline-block"}}>מקור תמונה:</label>
                          <select style={{ direction: "rtl", width: "73%" }}
                              className="modal-input2"
                              value={w.sourceType}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setWordField(idx, "sourceType", val);
                                  if (val === "library") openLibraryForIndex(idx);
                              }}
                              >
                              <option value="url">קישור לתמונה</option>
                              <option value="upload">העלאה מהמחשב</option>
                              <option value="library">מספריית סט קיים</option>
                          </select>
                        </div>

							{/* URL input */}
							{w.sourceType === "url" && (
							  <>
								<div
								  style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									direction: "rtl",
								  }}
								>
								  <label
									className="source-label"
									style={{
									  direction: "rtl",
									  minWidth: "140px",
									  textAlign: "right",
									  display: "inline-block",
									}}
								  >
									קישור לתמונה:
								  </label>

								  <input
									type="text"
									style={{ direction: "ltr", textAlign: "left" }}
									placeholder="קישור לתמונה"
									className="modal-input2"
									value={w.image}
									onChange={(e) => setImageUrl(idx, e.target.value)}
								  />
								</div>

								{/* Hint for online images */}
								<div
								  style={{
									marginTop: 6,
									direction: "rtl",
									textAlign: "right",
									fontSize: 13,
									color: "#6c757d",
									lineHeight: 1.4,
								  }}
								>
								  מומלץ להשתמש בתמונות מאתרים מוכרים (למשל Wikipedia/Wikimedia, אתרי תוכן ציבוריים וכו׳).
								  בחלק מהאתרים יש חסימות שעלולות לגרום לכך שהתמונה לא תוצג היטב במערכת או בדו״ח PDF.
								</div>
							  </>
							)}


                        {/* File upload */}
                        {w.sourceType === "upload" && (
                            <div className="file-upload-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input type="file" accept="image/*" onChange={(e) => handleImageFile(idx, e.target.files?.[0])} />
                            {w.localFileName && <span className="file-name" style={{ color: "#666" }}>{w.localFileName}</span>}
                            </div>
                        )}

                        {/* Preview image avec ratio conservé et taille réduite */}
                        <div className="image-preview" style={{ textAlign: "center", marginTop: 12 }}>
                        {w.image ? (
                            <div
                            style={{
                                display: "inline-block",
                                maxWidth: 250,   // largeur maximale du cadre
                                maxHeight: 180,  // hauteur maximale du cadre
                                borderRadius: 12,
                                border: "1px solid #eee",
                                background: "#f7f7f7",
                                overflow: "hidden",
                            }}
                            >
                            <img
                                src={w.image}
                                alt="preview"
                                style={{
                                display: "block",
                                maxWidth: "100%",
                                maxHeight: "100%",
                                width: "auto",
                                height: "auto",
                                objectFit: "contain", // garde les proportions originales
                                }}
                            />
                            </div>
                        ) : (
                            <p style={{ color: "#999" }}>אין תצוגה מקדימה</p>
                        )}
                        </div>


                        {/* Clues */}
                        <div className="clues-grid" style={{ display: "grid", gap: 8 }}>
                            {[0, 1, 2].map((c) => (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl" }}>
                                <label className="source-label" style={{direction: "rtl", minWidth: "140px", textAlign: "right", display: "inline-block"}}> {`רמז ${c + 1}`} :</label>
                                  <input
                                      key={c}
                                      type="text"
                                      placeholder={`רמז ${c + 1}`}
                                      className="modal-input2"
                                      value={w.clues[c] || ""}
                                      onChange={(e) => setClueField(idx, c, e.target.value)}
                                  />
                              </div>
                            ))}
                        </div>

                        {/* Synonyms */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", direction: "rtl" }}>
                          <label className="source-label" style={{direction: "rtl", minWidth: "140px", textAlign: "right", display: "inline-block"}}>מילים נרדפות :</label>
                          <input
                            type="text"
                            placeholder="מילים נרדפות (מופרדות בפסיק או ;)"
                            className="modal-input2"
                            value={w.synonymsInput ?? (w.synonyms || []).join(", ")}
                            onChange={(e) => handleSynonymsInput(idx, e.target.value)}
                            onBlur={() => finalizeSynonymsInput(idx)}
                          />
                        </div>
                      </div>
                    );
                    })()}

                    {/* FOOTER BUTTONS — always visible */}
                    <div
                      className="modal-buttons"
                      style={{
                        display: "flex",
                        gap: 10,
                        justifyContent: "center",
                        marginTop: 20,
                        paddingTop: 12,
                        borderTop: "1px solid #eee",
                      }}
                    >
                      {/* PREV WORD */}
                      <button
                        className="modal-btn2 back"
                        onClick={goPrevWord}
                        disabled={currentStep <= 2}
                        style={{
                          background: currentStep <= 2 ? "#adb5bd" : "#6c757d",
                          cursor: currentStep <= 2 ? "not-allowed" : "pointer",
                          color: "#fff",
                          padding: "8px 18px",
                          borderRadius: 10,
                          border: "none",
                        }}
                      >
                        מילה קודמת
                      </button>

                      {/* NEXT WORD */}
                      <button
                        className="modal-btn2 next"
                        onClick={goNextWord}
                        disabled={currentStep - 2 >= numWords - 1}
                        style={{
                          background:
                            currentStep - 2 >= numWords - 1 ? "#adb5bd" : "#0d6efd",
                          cursor:
                            currentStep - 2 >= numWords - 1 ? "not-allowed" : "pointer",
                          color: "#fff",
                          padding: "8px 18px",
                          borderRadius: 10,
                          border: "none",
                        }}
                      >
                        מילה הבאה
                      </button>

                      {/* SAVE */}
                      <button
                        className="modal-btn2 add"
						onClick={async () => {
						  const ok = await finishAndSaveSet();
						  if (!ok) return;        // ❗ נשארים בעריכה אם יש שגיאה
						  setShowSetWizard(false);
						  clearDraft();
						}}
                        style={{
                          background: "#198754",
                          cursor: "pointer",
                          color: "#fff",
                          padding: "8px 18px",
                          borderRadius: 10,
                          border: "none",
                        }}
                      >
                        {isEditingSet ? "שמור שינויים" : "שמור סט"}
                      </button>

                      {/* CANCEL */}
                      <button
                        className="modal-btn2 cancel"
                        onClick={cancelWizard}
                        style={{
                          background: "#dc3545",
                          color: "#fff",
                          padding: "8px 18px",
                          borderRadius: 10,
                          border: "none",
                        }}
                      >
                        ביטול
                      </button>
                    </div>

                </>
                )}
            </div>
            </div>
        )}
        </div>
    );
}

export default DoctorUI;
