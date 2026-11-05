import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase/firebaseConfig";
import { ref, get, update } from "firebase/database";
import { useNavigate } from "react-router-dom";
import successSound from "../assets/success.mp3";
import Confetti from "react-confetti";
import { useWindowSize } from "@react-hook/window-size";
import endScreenImg from "../assets/end_screen.png";


function PatientUI() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState(null);
  const [nextSession, setNextSession] = useState(null);

  const [imageSet, setImageSet] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentClueIndex, setCurrentClueIndex] = useState(-1);

  const [listening, setListening] = useState(false);
  const [sessionReport, setSessionReport] = useState([]);
  const [attemptsLog, setAttemptsLog] = useState([]);
  const [currentAttempts, setCurrentAttempts] = useState(1);

  let idleTimer = null;

  const [silentCount, setSilentCount] = useState(0); // << NEW
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const nextWordLockRef = useRef(false);
  const nextWordMsgTimerRef = useRef(null);

  const [showNextWordMessage, setShowNextWordMessage] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [showIdleReminder, setShowIdleReminder] = useState(false);
  const [isButtonBlinking, setIsButtonBlinking] = useState(false);

  const [windowWidth, windowHeight] = useWindowSize();
  const audio = new Audio(successSound);

  // Shuffle Util
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  useEffect(() => {
    const storedPatientId = localStorage.getItem("patientId");
    const sessionId = localStorage.getItem("sessionId");

    if (storedPatientId) {
      setPatientId(storedPatientId);
      fetchSessionDetails(storedPatientId, sessionId);
    } else {
      navigate("/login");
    }
  }, []);

  const fetchSessionDetails = async (pid, sessionId) => {
    try {
      const sessionRef = ref(db, `Users/${pid}/Sessions/${sessionId}`);
      const snapshot = await get(sessionRef);
      if (!snapshot.exists()) return;

      const data = snapshot.val();
      setNextSession({ id: sessionId, ...data });

      const sets = Array.isArray(data.imageSets)
        ? data.imageSets
        : data.imageSet ? [data.imageSet] : [];

      const mix = typeof data.mixImages === "boolean" ? data.mixImages : true;

      await fetchImagesForSets(sets, mix);
    } catch (error) {
      console.error("Error fetching session:", error);
    }
  };

  const fetchImagesForSets = async (setNames, mix) => {
    try {
      if (!Array.isArray(setNames) || setNames.length === 0) return;

      const all = [];
      for (const setName of setNames) {
        const imagesRef = ref(db, `Images/${setName}/words`);
        const snap = await get(imagesRef);
        if (snap.exists()) all.push(...Object.values(snap.val()));
      }

      setImageSet(mix ? shuffle(all) : all);
      setCurrentIndex(0);
      setCurrentClueIndex(-1);
      setCurrentAttempts(1);
      setSilentCount(0);
    } catch (error) {
      console.error("Error fetching images:", error);
    }
  };

  // Idle Reminder
  useEffect(() => {
    if (imageSet.length === 0) return;

    const idleTimer = setTimeout(() => {
      setIsButtonBlinking(true);
      setShowIdleReminder(true);
    }, 20000);

    return () => clearTimeout(idleTimer);
  }, [currentIndex, imageSet]);

  // --------------------------
  // LOGIQUE SILENCE x2 = 1 ERREUR
  // --------------------------
  const handleSilentAttempt = () => {
    setSilentCount(prev => {
      if (prev + 1 === 2) {
        // 2 silences → 1 ERREUR
		// רושמים ניסיון "אין קלט" בדוח של המילה הנוכחית
		const updatedAttempts = [...(attemptsLog[currentIndex] || []), "אין קלט"];
		
		setAttemptsLog((p) => {
		  const copy = [...p];
		  copy[currentIndex] = updatedAttempts;
		  return copy;
		});
		 
        processWrongAttempt(updatedAttempts);  
        return 0; // reset silence counter
      }
      return prev + 1; // first silence → rien
    });
  };


  const handleDetectedSpeech = (transcript) => {
    setSilentCount(0); // 🔁 reset chaîne de silence

    const currentImage = imageSet[currentIndex];
    const synonyms = currentImage.synonyms || [];

    const isCorrect =
      transcript === currentImage.word ||
      synonyms.includes(transcript);

    if (isCorrect) {
      processSpeechResult(transcript); // ✅ succès
    } else {
      processWrongAttempt();           // ❌ erreur immédiate
    }
  };


  // --------------------------
  // FONCTION GESTION ERREUR
  // --------------------------
const processWrongAttempt = (updatedAttemptsForThisWord = null) => {
  const currentImage = imageSet[currentIndex];
  const clues = currentImage.clues || [];

  // רמזים: 0,1,2  (רמז 1/2/3)
  const nextClueIdx =
    currentClueIndex < clues.length - 1 ? currentClueIndex + 1 : currentClueIndex;

  // currentAttempts אצלך הוא "מספר הניסיון הנוכחי" (מתחיל ב-1)
  // לכן: אם אנחנו כבר בניסיון 4 והרמז כבר על 3 -> טעות נוספת מסיימת את המילה
  const shouldFinishWord = nextClueIdx >= 2 && currentAttempts >= 4;

  // תמיד מעדכנים את הרמז (כדי להציג רמז 1/2/3 לפי הטעויות)
  setCurrentClueIndex(nextClueIdx);

  // אם לא סיימנו עדיין – פשוט עוברים לניסיון הבא (מקסימום עד 4)
  if (!shouldFinishWord) {
    setCurrentAttempts(currentAttempts + 1);
    return;
  }

  // כאן זה "טעות רביעית" => מסיימים מילה ועוברים הלאה
  const attemptsString =
    (updatedAttemptsForThisWord && updatedAttemptsForThisWord.join(", ")) ||
    (attemptsLog[currentIndex] && attemptsLog[currentIndex].join(", ")) ||
    "שקט";

  const entry = {
    מילה: currentImage.word,
    ניסיונות: attemptsString,
    ניסיונותמספר: currentAttempts, // נשאר 4 (לא 5)
    ציון: 0,
    תמונה: currentImage.image,
  };

  setShowNextWordMessage(currentIndex + 1 < imageSet.length);

	if (nextWordMsgTimerRef.current) {
	  clearTimeout(nextWordMsgTimerRef.current);
	}

	nextWordMsgTimerRef.current = setTimeout(() => {
	  nextWordMsgTimerRef.current = null;

	  const isLastImage = currentIndex + 1 >= imageSet.length;
	  setShowNextWordMessage(false);

	  if (isLastImage) {
		setSessionReport((prev) => {
		  const finalReport = [...prev, entry];
		  finishSession(finalReport);
		  return finalReport;
		});
		return;
	  }

	  setSessionReport((prev) => [...prev, entry]);
	  goToNextWordSafe();
	}, 2500);
};


  // --------------------------
  // PASSER AU MOT SUIVANT
  // --------------------------
  const goToNextWordSafe = () => {
    if (nextWordLockRef.current) return; // already moved
    nextWordLockRef.current = true;

    goToNextWord();

    // unlock shortly after state updates kick in
    setTimeout(() => {
    nextWordLockRef.current = false;
    }, 0);
  };

  const goToNextWord = () => {
    // cancel pending "next word" message timer (so it won't stick)
    if (nextWordMsgTimerRef.current) {
      clearTimeout(nextWordMsgTimerRef.current);
      nextWordMsgTimerRef.current = null;
    }
	
    // Reset visuels
    setCurrentClueIndex(-1);
    setCurrentAttempts(1);
    setSilentCount(0);
    setShowTimeoutMessage(false);
    setShowReminder(false);
    setShowIdleReminder(false);
    setShowNextWordMessage(false);
    setIsButtonBlinking(false);

    // Reset logs for next word
    setAttemptsLog(prev => {
      const copy = [...prev];
      copy[currentIndex + 1] = [];
      return copy;
    });

    setCurrentIndex((p) => p + 1);
  };

  // --------------------------
  // BOUTON ויתרתי → skip manuel
  // --------------------------
const skipWord = () => {
  const currentImage = imageSet[currentIndex];

  const spokenWords = attemptsLog[currentIndex]?.join(", ");

  const entry = {
    מילה: currentImage.word,
    ניסיונות: spokenWords
      ? `${spokenWords} | ויתרתי`
      : "ויתרתי",
    ניסיונותמספר: currentAttempts,
    ציון: 0,
    תמונה: currentImage.image,
  };

  // אם זו המילה האחרונה – מסיימים טיפול
  if (currentIndex + 1 >= imageSet.length) {
    const finalReport = [...sessionReport, entry];
    setSessionReport(finalReport);
    finishSession(finalReport);
    return;
  }

  // אחרת ממשיכים כרגיל
  setSessionReport((prev) => [...prev, entry]);

  setIsButtonBlinking(false);
  setShowIdleReminder(false);
  setShowTimeoutMessage(false);
  setShowReminder(false);

  goToNextWordSafe();
};



  // --------------------------
  // RECONNAISSANCE VOCALE
  // --------------------------
  const recognizeSpeech = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech recognition not supported.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "he-IL";
    recognition.continuous = false;
    recognition.interimResults = false;

    let hasHeardSound = false;
    let hasResult = false;

    setListening(true);
    setShowTimeoutMessage(false);
    setShowReminder(false);
    setIsButtonBlinking(false);
    setShowIdleReminder(false);

    let timeoutId;
    let reminderTimeout;

    // 🔊 Windows / Mac : son détecté
    recognition.onspeechstart = () => {
      hasHeardSound = true;
    };

    // ⏱️ Rappel visuel
    reminderTimeout = setTimeout(() => {
      setShowReminder(true);
    }, 5000);

    // ⏱️ Timeout principal
    timeoutId = setTimeout(() => {
      recognition.stop();
    }, 10000);

    // 🎙️ Résultat vocal
    recognition.onresult = (event) => {
      hasResult = true;

      clearTimeout(timeoutId);
      clearTimeout(reminderTimeout);
      setShowReminder(false);

      const transcript = event.results[0][0].transcript.trim();

      setListening(false);

      if (!transcript) {
        // 🔴 Son mais pas de mot reconnu
        processWrongAttempt();
        return;
      }

      // 🟢 Mot reconnu → logique métier existante
      setSilentCount(0);
      processSpeechResult(transcript);
    };

    // 🔚 Fin reconnaissance (CRUCIAL POUR WINDOWS)
    recognition.onend = () => {
      clearTimeout(timeoutId);
      clearTimeout(reminderTimeout);

      setListening(false);

      // 🔍 DEBUG (ICI)
      console.log("🎙️ Speech end:", {
        hasHeardSound,
        hasResult
      });

      if (!hasHeardSound) {
        // 🔵 Silence réel
        setShowTimeoutMessage(true);
        handleSilentAttempt();
        return;
      }

      if (hasHeardSound && !hasResult) {
        // 🔴 Son détecté mais aucun mot reconnu
        processWrongAttempt();
      }
    };


    recognition.onerror = () => {
      clearTimeout(timeoutId);
      clearTimeout(reminderTimeout);
      setListening(false);
    };

    recognition.start();
  };



  // --------------------------
  // TRAITER UN MOT PARLÉ
  // --------------------------
  
const normalizeText = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // מסיר סימני פיסוק (תומך עברית)
    .replace(/\s+/g, " ");

const normalizeTranscriptForTarget = (transcript, targetWord) => {
  const t = normalizeText(transcript);
  const target = normalizeText(targetWord);

  // אם היעד הוא 2+ מילים — חייבים התאמה מלאה (לא "לכווץ" חזרות)
  if (target.split(" ").length > 1) return t;

  // יעד של מילה אחת:
  // אם התמלול הוא חזרות של אותה מילה ("ירח ירח") → נחזיר רק "ירח"
  const parts = t.split(" ").filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => p === parts[0])) {
    return parts[0];
  }

  // אחרת — מחזירים רגיל
  return t;
};

const containsToken = (transcript, targetWord) => {
  const tokens = normalizeText(transcript).split(" ").filter(Boolean);
  const target = normalizeText(targetWord);
  return tokens.includes(target);
};

const processSpeechResult = (transcript) => {
  const currentImage = imageSet[currentIndex];
  const synonyms = currentImage.synonyms || [];

  // Build attempts locally (do not rely on async state timing)
  const prevAttempts = attemptsLog[currentIndex] || [];
  const updatedAttempts = [...prevAttempts, transcript];
  const attemptsText = updatedAttempts.join(", ");

  // Save attemptsLog exactly as we use it in the report
  setAttemptsLog((prev) => {
    const copy = [...prev];
    copy[currentIndex] = updatedAttempts;
    return copy;
  });

	const targetWord = currentImage.word || "";
	const targetNorm = normalizeText(targetWord);
	const normTranscript = normalizeTranscriptForTarget(transcript, targetWord);

	const targetIsMultiWord = targetNorm.split(" ").length > 1;

	const synonymMatch =
	  (synonyms || []).some((syn) => normTranscript === normalizeText(syn));

	const directMatch = normTranscript === targetNorm;

	// אם היעד מילה אחת – מותר שתופיע כחלק ממשפט ("ביי בית")
	const tokenMatchForSingleWord =
	  !targetIsMultiWord && (
		normTranscript.split(" ").includes(targetNorm) ||
		(synonyms || []).some((syn) =>
		  normTranscript.split(" ").includes(normalizeText(syn))
		)
	  );

	const correct = directMatch || synonymMatch || tokenMatchForSingleWord;


	if (!correct) {
	  processWrongAttempt(updatedAttempts);
	  return;
	}

  const grade =
    currentClueIndex === -1 ? 100 :
    currentClueIndex === 0 ? 90 :
    currentClueIndex === 1 ? 80 :
    currentClueIndex === 2 ? 70 : 60;

  audio.play();
  setShowSuccess(true);
  setTimeout(() => setShowSuccess(false), 600);

  const entry = {
    מילה: currentImage.word,
    ניסיונות: attemptsText,
    ניסיונותמספר: currentAttempts,
    ציון: grade,
    תמונה: currentImage.image,
  };

  // last word
  if (currentIndex + 1 >= imageSet.length) {
    const finalReport = [...sessionReport, entry];
    setSessionReport(finalReport);
    finishSession(finalReport);
    return;
  }

  // normal flow
  setSessionReport((prev) => [...prev, entry]);
  goToNextWordSafe();
};



  // --------------------------
  // FIN DE SESSION
  // --------------------------
  const finishSession = (finalReport) => {
    setShowConfetti(true);

    setTimeout(async () => {
      setShowConfetti(false);

      const grades = finalReport.map(e => e.ציון);
      const avg = Math.round(grades.reduce((a, b) => a + b, 0) / grades.length);

      await update(ref(db, `Users/${patientId}/Sessions/${nextSession.id}`), {
        status: "Completed",
        grade: avg,
        report: finalReport,
		completedAt: new Date().toISOString(),
      });

      navigate("/patientDashboard");
    }, 6000);
  };


  // --------------------------
  // AFFICHAGE
  // --------------------------
  const headerSetsText =
    nextSession?.imageSets?.length ? nextSession.imageSets.join(" | ") :
    nextSession?.imageSet || "";

	  return (
	  <div className="wrapper">
		<div className="login-container">
			{showConfetti && (
			  <Confetti
				width={windowWidth}
				height={windowHeight}
				numberOfPieces={300}
				recycle={false}
				gravity={0.3}
				style={{
				  position: "fixed",
				  top: 0,
				  left: 0,
				  zIndex: 9999,
				  pointerEvents: "none",
				}}
			  />
			)}
		  {showSuccess && !showConfetti && (
			<div
			  style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				backgroundColor: "rgba(0,255,0,0.3)",
				zIndex: 999,
				transition: "opacity 0.5s ease",
			  }}
			/>
		  )}

		  {nextSession ? (
			<>
			  <button
				className="go-back-btn"
				onClick={() => navigate("/patientDashboard")}
			  >
				← חזור
			  </button>

			  <h3 style={{ direction: "rtl", fontSize: 26 }}>
				תמונות: {headerSetsText}
			  </h3>

			  {imageSet.length > 0 && currentIndex < imageSet.length && (
				<div className="image-display" style={{ textAlign: "center" }}>
				  {/* תמונה - גדולה יותר במסך סיום */}
					<div
					  style={{
						width: showConfetti ? 500 : 350,
						height: showConfetti ? 500 : 350,
						margin: "0 auto",
						borderRadius: 14,
						border: "1px solid #eee",
						background: "#fafafa",
						overflow: "hidden",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					  }}
					>
					<img
					  src={
						showConfetti
						  ? endScreenImg
						  : imageSet[currentIndex]?.image
					  }
					  alt="Session"
					  style={{
						display: "block",
						width: "100%",
						height: "100%",
						objectFit: "contain",
					  }}
					/>
				  </div>

				  {/* כל הטקסטים + הכפתורים יוצגו רק אם זה לא מסך סיום */}
				  {!showConfetti && (
					<>
					  {showTimeoutMessage && (
						<p
						  style={{
							direction: "rtl",
							fontSize: 20,
							color: "red",
							fontWeight: "bold",
							marginTop: 10,
						  }}
						>
						  הזמן הסתיים - לחץ שוב והתחל כאשר אתה מוכן לדבר.
						</p>
					  )}

					  {showReminder && (
						<p
						  style={{
							direction: "rtl",
							fontSize: 22,
							color: "orange",
							fontWeight: "bold",
							marginTop: 10,
						  }}
						>
						  אל תשכח לומר את המילה!
						</p>
					  )}

					  {currentClueIndex >= 0 && (
						<p
						  style={{
							direction: "rtl",
							fontSize: 30,
							color: "blue",
							fontWeight: "bold",
						  }}
						>
						  רמז: {imageSet[currentIndex]?.clues[currentClueIndex]}
						</p>
					  )}

					  {showNextWordMessage && (
						<p
						  style={{
							direction: "rtl",
							fontSize: 28,
							color: "darkred",
							fontWeight: "bold",
							marginTop: 20,
						  }}
						>
						  נעבור למילה הבאה...
						</p>
					  )}

					  <button
						className={`login-btn ${
						  isButtonBlinking ? "blinking" : ""
						}`}
						style={{
						  width: "70%",
						  padding: "10px 20px",
						  color: "white",
						  borderRadius: 10,
						  border: "none",
						  fontSize: 17,
						}}
						onClick={recognizeSpeech}
						disabled={listening}
					  >
						{listening ? "...מקשיב" : "לחץ כאן כשתהיה מוכן "}
					  </button>

					  <button
						className="skip-btn"
						style={{
						  width: "25%",
						  marginLeft: 10,
						  padding: "10px 20px",
						  background: "#dc3545",
						  color: "white",
						  borderRadius: 10,
						  border: "none",
						  fontSize: 17,
						}}
						onClick={skipWord}
					  >
						ויתרתי
					  </button>
					</>
				  )}
				</div>
			  )}
			</>
		  ) : (
			<p>No upcoming sessions found.</p>
		  )}
		</div>

		{imageSet.length > 0 && !showConfetti && (
		  <div
			className="progress-container"
			style={{
			  height: "6px",
			  width: "50%",
			}}
		  >
			<div
			  className="progress-bar"
			  style={{
				height: "6px",
				width: `${(currentIndex / imageSet.length) * 100}%`,
			  }}
			>
			  {currentIndex}/{imageSet.length}
			</div>
		  </div>
		)}
	  </div>
	);

}

export default PatientUI;
