const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db  = getFirestore();
const fcm = getMessaging();

// Roda todo minuto — verifica lembretes no horário exato
exports.checkReminders = onSchedule("* * * * *", async () => {
  const now   = new Date();
  const hh    = now.getHours().toString().padStart(2, "0");
  const mm    = now.getMinutes().toString().padStart(2, "0");
  const timeNow = hh + ":" + mm;

  // Data de hoje como dateKey
  const todayKey = now.getFullYear() + "-" +
                   (now.getMonth() + 1) + "-" +
                   now.getDate();

  // Busca todos os lembretes com o horário atual
  const snap = await db.collection("reminders")
    .where("time", "==", timeNow)
    .where("dateKey", "==", todayKey)
    .get();

  if (snap.empty) return null;

  const promises = [];

  for (const docSnap of snap.docs) {
    const rem = docSnap.data();
    if (!rem.ownerUid) continue;

    // Busca todos os tokens FCM do usuário
    const tokensSnap = await db.collection("fcm_tokens")
      .where("uid", "==", rem.ownerUid)
      .get();

    if (tokensSnap.empty) continue;

    tokensSnap.forEach(tokenDoc => {
      const token = tokenDoc.data().token;
      const msg = {
        token,
        notification: {
          title: "⏰ Lembrete — TDAHAHA!",
          body:  rem.time + " — " + rem.text,
        },
        webpush: {
          notification: {
            icon:  "/icon-192.png",
            badge: "/icon-192.png",
            vibrate: [200, 100, 200],
            tag: "reminder-" + docSnap.id,
            renotify: true,
          },
          fcmOptions: {
            link: "/"
          }
        }
      };
      promises.push(
        fcm.send(msg).catch(err => {
          // Token inválido — remove do banco
          if (err.code === "messaging/registration-token-not-registered") {
            return tokenDoc.ref.delete();
          }
          console.error("FCM send error:", err);
        })
      );
    });
  }

  await Promise.all(promises);
  return null;
});
