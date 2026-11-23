// ============================================================================
// Trilingual Interface & Localization Engine (Arabic · English · Deutsch)
// Ensures exact 1:1 translation of all UI labels, dynamic phrases, and
// bidirectional RTL (Arabic) / LTR (English & German) layout synchronization.
// ============================================================================

const LANG_STORAGE_KEY = 'chunk-trainer-lang';
const SUPPORTED_LANGS = ['ar', 'en', 'de'];

let currentLang = 'ar';
try {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  if (saved && SUPPORTED_LANGS.includes(saved)) {
    currentLang = saved;
  }
} catch {}

// Exact Phrase Dictionary: Maps Arabic strings to exact [English, German]
const EXACT_PHRASES = new Map([
  // Brand & Topbar Navigation
  ['دفتر الشانكس', ['Chunk Notebook', 'Chunk-Heft']],
  ['ألماني من A1 لـ C1', ['German from A1 to C1', 'Deutsch von A1 bis C1']],
  ['الرئيسية', ['Home', 'Startseite']],
  ['المكتبة المصورة', ['Visual Library', 'Bildbibliothek']],
  ['المراجعة', ['Review', 'Wiederholung']],
  ['التقدم', ['Progress', 'Fortschritt']],
  ['الإنجازات', ['Achievements', 'Erfolge']],
  ['الطريقة', ['Method', 'Methode']],
  ['تشيل مود', ['Chill Mode', 'Chill-Modus']],
  ['ابدأ سلسلتك', ['Start your streak', 'Starte deine Serie']],
  ['لسه مفيش أيام متواصلة', ['No active streak yet', 'Noch keine aktive Serie']],
  ['الإعدادات', ['Settings', 'Einstellungen']],
  ['الصوت', ['Sound', 'Ton']],
  ['كتم / تشغيل الصوت', ['Mute / Unmute Sound', 'Ton ein- / ausschalten']],
  ['الصوت مكتوم — اضغط للتشغيل', ['Sound muted — click to unmute', 'Ton stumm — zum Einschalten klicken']],
  ['المؤثرات الصوتية مفعلة — اضغط للكتم', ['Sound effects on — click to mute', 'Soundeffekte aktiv — zum Stummschalten klicken']],
  ['تم تفعيل المؤثرات الصوتية 🔊', ['Sound effects enabled 🔊', 'Soundeffekte aktiviert 🔊']],
  ['تم كتم الصوت 🔇', ['Sound muted 🔇', 'Ton stummgeschaltet 🔇']],

  // Home Screen
  ['جلسة النهاردة', ["Today's Session", 'Heutige Sitzung']],
  ['كمّل', ['Continue', 'Mach weiter,']],
  ['من حيث وقفت', ['where you left off', 'wo du aufgehört hast']],
  ['اللي جاي جاهز', ['Up Next is Ready', 'Der nächste Chunk ist bereit']],
  ['ابدأ أول Chunk', ['Start Your First Chunk', 'Starte deinen ersten Chunk']],
  ['التطبيق بيحفظ كل خطوة وكل إنتاج — تقفل وترجع بعد أسبوع، هتلاقي نفسك واقف في نفس المكان بالظبط.', [
    'Every step and production is auto-saved — close the app and come back a week later to pick up right where you left off.',
    'Jeder Schritt und jede Produktion wird automatisch gespeichert — schließe die App und mach jederzeit genau dort weiter.',
  ]],
  ['افتح الجلسة', ['Open Session', 'Sitzung öffnen']],
  ['المكتبة المصورة (619 لوحة)', ['Visual Library (619 Boards)', 'Bildbibliothek (619 Tafeln)']],
  ['شوف المستويات', ['Browse Levels', 'Stufen ansehen']],
  ['أرقامك النهاردة', ["Today's Stats", 'Deine Zahlen heute']],
  ['مستحق للمراجعة', ['Due for Review', 'Zur Wiederholung fällig']],
  ['مستحق', ['due', 'fällig']],
  ['صفّي', ['all clear', 'alles erledigt']],
  ['إنتاجات النهاردة', ["Today's Productions", 'Heutige Produktionen']],
  ['جمل متقنة', ['Mastered Chunks', 'Gemeisterte Chunks']],
  ['هدفك اليومي', ['Daily Goal', 'Tagesziel']],
  ['خلصت هدف النهاردة', ['Daily Goal Completed!', 'Tagesziel erreicht!']],
  ['المستويات', ['CEFR Levels', 'GER-Stufen']],
  ['اختار مستوى، والبرنامج يمشي معاك جملة جملة على 6 خطوات.', [
    'Choose a level and master German sentence by sentence through the 6-step method.',
    'Wähle eine Stufe und meistere Deutsch Satz für Satz mit der 6-Schritte-Methode.',
  ]],
  ['ابدأ المراجعة', ['Start Review', 'Wiederholung starten']],
  ['مفيش مستحق', ['Nothing due', 'Nichts fällig']],
  ['لسه جديد', ['Not started', 'Noch neu']],
  ['الطريقة كاملة + جدول التكرار', ['Full Method + Spaced Schedule', 'Vollständige Methode + Wiederholungsplan']],
  ['اختبر نفسك: استدعاء، سرعة، كلام', ['Test yourself: recall, speed, speaking', 'Teste dich: Abruf, Tempo, freies Sprechen']],
  ['متقن ومراجعته جاية', ['Mastered — scheduled for review', 'Gemeistert — Wiederholung geplant']],

  // Level Names & Descriptions
  ['الأساسيات', ['Foundations', 'Grundlagen']],
  ['البناء الأولي', ['Elementary Building', 'Grundlegender Aufbau']],
  ['التعبير المستقل', ['Independent Expression', 'Selbstständiger Ausdruck']],
  ['الطلاقة', ['Fluency', 'Gewandtheit']],
  ['الإتقان', ['Mastery', 'Meisterschaft']],
  ['التواصل اليومي', ['Everyday Communication', 'Alltagskommunikation']],
  ['الاستقلالية', ['Independent Expression', 'Selbstständige Sprachverwendung']],
  ['الطلاقة المتقدمة', ['Advanced Fluency', 'Fortgeschrittene Gewandtheit']],
  ['الإتقان الأكاديمي والمهني', ['Academic & Professional Mastery', 'Fachkundige Sprachkenntnisse']],
  ['📐 المستويات والقواعد', ['📐 Levels & Grammar', '📐 Stufen & Grammatik']],
  ['💬 الكلمات والتعبيرات', ['💬 Vocab & Idioms', '💬 Wortschatz & Idiome']],
  ['🏛️ الأساطير والتاريخ', ['🏛️ Mythology & History', '🏛️ Mythologie & Geschichte']],
  ['🧠 الفلسفة وعلم النفس', ['🧠 Philosophy & Psychology', '🧠 Philosophie & Psychologie']],
  ['🎬 الأدب والثقافة والفن', ['🎬 Literature & Culture', '🎬 Literatur & Kultur']],
  ['أساسيات الكلام اليومي: طلبات، تعريف بنفسك، وأسئلة بسيطة.', [
    'Everyday essentials: polite requests, introducing yourself, and simple questions.',
    'Grundlagen des Alltags: Bitten, sich vorstellen und einfache Fragen.',
  ]],
  ['تمدّد في الحياة اليومية: مواعيد، سفر، شغل، وخطط قريبة.', [
    'Expanding daily life: appointments, travel, work, and near-future plans.',
    'Erweiterter Alltag: Termine, Reisen, Arbeit und nächste Pläne.',
  ]],
  ['تعبر عن رأيك وتشرح أسبابك في مواقف مألوفة.', [
    'Expressing opinions and explaining reasons in familiar situations.',
    'Meinungen äußern und Gründe in vertrauten Situationen erklären.',
  ]],
  ['تناقش موضوعات مركبة بطلاقة ودقة أعلى.', [
    'Discussing complex topics with higher fluency and precision.',
    'Komplexe Themen flüssig und präzise diskutieren.',
  ]],
  ['صياغات دقيقة للمناقشات والأفكار المعقدة.', [
    'Nuanced academic and professional formulations for complex arguments.',
    'Präzise Formulierungen für anspruchsvolle Diskussionen und komplexe Ideen.',
  ]],

  // 6 Stages
  ['افهم', ['Understand', 'Verstehen']],
  ['انطق', ['Speak', 'Sprechen']],
  ['درّب', ['Produce', 'Produzieren']],
  ['اختبر', ['Test', 'Testen']],
  ['التنويع', ['Vary', 'Variieren']],
  ['افهم الـChunk', ['Understand the Chunk', 'Chunk verstehen']],
  ['انطقه بصوت عالي', ['Speak it Out Loud', 'Laut aussprechen']],
  ['درّب عليه 30 إنتاج', ['Practice 30 Productions', '30 Produktionen üben']],
  ['اختبر نفسك', ['Test Yourself', 'Teste dich selbst']],
  ['المرحلة الختامية: غيّر كل مرة', ['Finale: Vary Every Time', 'Finale: Jedes Mal variieren']],
  ['اقرأ، افهم المعنى، شوف الوظيفة', ['Read, grasp the meaning, identify its function', 'Lesen, Bedeutung erfassen, Funktion erkennen']],
  ['بطيء، طبيعي، وبعدين من غير ما تبص', ['Slow, natural speed, then blind from memory', 'Langsam, natürlich und dann frei aus dem Gedächtnis']],
  ['10 + 5 + 5 + 5 + 5 على أيام', ['10 + 5 + 5 + 5 + 5 spaced across days', '10 + 5 + 5 + 5 + 5 verteilt über mehrere Tage']],
  ['استدعاء سريع، سرعة، كلام مرتجل', ['Active recall, speed sprint, spontaneous speech', 'Schneller Abruf, Sprint, freies Sprechen']],
  ['5 تنويعات شاملة لقالب المجموعة', ['5 comprehensive variations across group patterns', '5 umfassende Variationen der Gruppenmuster']],

  // Visual Library Hub
  ['مركز المحتوى المصور · Abdo & Friends Hub', ['Visual Content Center · Abdo & Friends Hub', 'Visuelles Wissenszentrum · Abdo & Friends Hub']],
  ['المكتبة', ['Comprehensive', 'Umfassende']],
  ['المصورة الشاملة', ['Visual Library', 'Bildbibliothek']],
  ['كل الأقسام', ['All Categories', 'Alle Kategorien']],
  ['🌟 كل الأقسام', ['🌟 All Categories', '🌟 Alle Kategorien']],
  ['المستويات والقواعد', ['Levels & Grammar', 'Stufen & Grammatik']],
  ['الكلمات والتعبيرات', ['Vocab & Idioms', 'Wortschatz & Idiome']],
  ['الأساطير والتاريخ', ['Mythology & History', 'Mythologie & Geschichte']],
  ['الفلسفة وعلم النفس', ['Philosophy & Psychology', 'Philosophie & Psychologie']],
  ['الأدب والثقافة والفن', ['Literature & Culture', 'Literatur & Kultur']],
  ['تقدمك في المكتبة', ['Your Library Progress', 'Dein Bibliotheksfortschritt']],
  ['إجمالي اللوحات', ['Total Visual Boards', 'Gesamtanzahl Tafeln']],
  ['لوحة', ['boards', 'Tafeln']],
  ['تمت قراءتها', ['Marked as Read', 'Als gelesen markiert']],
  ['في المفضلة', ['In Favorites', 'Unter Favoriten']],
  ['محفوظة', ['saved', 'gespeichert']],
  ['نسبة القراءة', ['Completion Rate', 'Lesefortschritt']],
  ['كل المستويات', ['All Levels', 'Alle Stufen']],
  ['الكل', ['All', 'Alle']],
  ['كل الموضوعات', ['All Topics', 'Alle Themen']],
  ['تكبير وقراءة', ['Zoom & Read', 'Vergrößern & Lesen']],
  ['مقروء', ['Read', 'Gelesen']],
  ['تمت قراءته', ['Marked Read', 'Gelesen']],
  ['علّم كمقروء', ['Mark as Read', 'Als gelesen markieren']],
  ['مفضلة', ['Favorite', 'Favorit']],
  ['المفضلة', ['Favorites', 'Favoriten']],
  ['عرض كل المكتبة', ['Show Entire Library', 'Gesamte Bibliothek anzeigen']],
  ['مفيش نتائج مطابقة للفلتر الحالي', ['No visual boards match the current filter', 'Keine Tafeln entsprechen dem aktuellen Filter']],
  ['جرّب تغيّر القسم أو المستوى أو تمسح كلمة البحث علشان تشوف كل البطاقات المصورة.', [
    'Try switching the category, level, or clearing the search box to see all visual boards.',
    'Wechsle die Kategorie oder Stufe oder lösche die Suche, um alle Tafeln zu sehen.',
  ]],
  ['تمت الإزالة من المفضلة', ['Removed from Favorites', 'Aus Favoriten entfernt']],
  ['تم الحفظ في المفضلة ✨', ['Saved to Favorites ✨', 'Zu Favoriten hinzugefügt ✨']],

  // Level Screen
  ['كمّل من غير المتقن', ['Continue Unfinished', 'Unvollendete fortsetzen']],
  ['متقن', ['Mastered', 'Gemeistert']],
  ['شغال عليه', ['In Progress', 'In Arbeit']],
  ['جديد', ['New', 'Neu']],
  ['الشرح المصور', ['Visual Guides', 'Bildtafeln']],
  ['فتح في المكتبة ↗', ['Open in Library ↗', 'In Bibliothek öffnen ↗']],
  ['متقنة بالكامل 🏆', ['Fully Mastered 🏆', 'Vollständig gemeistert 🏆']],
  ['5 تنويعات جاهزة ✓', ['5 Variations Ready ✓', '5 Variationen fertig ✓']],
  ['قيد التدريب', ['In Training', 'Im Training']],
  ['مجموعة جديدة', ['New Group', 'Neue Gruppe']],
  ['التنويعات جاهزة ✓', ['Variations Done ✓', 'Variationen fertig ✓']],
  ['المرحلة الختامية ⚡', ['Group Finale ⚡', 'Gruppenfinale ⚡']],
  ['إخفاء الجمل ▲', ['Hide Sentences ▲', 'Sätze ausblenden ▲']],

  // Practice Screen
  ['اقرأ الجملة، افهم معناها بالعربي، وحدد وظيفتها قبل أي تدريب.', [
    'Read the sentence, understand its meaning, and identify its communicative function before drilling.',
    'Lies den Satz, verstehe seine Bedeutung und bestimme seine Funktion vor dem Training.',
  ]],
  ['غطّي المعنى الأول... جرّب تفهمه بنفسك', ['Meaning hidden... try to understand it first', 'Bedeutung verdeckt... versuche es zuerst selbst zu verstehen']],
  ['شوف المعنى', ['Reveal Meaning', 'Bedeutung zeigen']],
  ['اقرأ الجملة بصوت واطي', ['Read the sentence quietly', 'Lies den Satz leise durch']],
  ['مرة واحدة كفاية — المهم تفهمها مش تحفظها', ['Once is enough — focus on understanding, not memorizing', 'Einmal genügt — Verstehen kommt vor dem Auswendiglernen']],
  ['افهم المعنى بالعربي', ['Understand the meaning', 'Verstehe die genaue Bedeutung']],
  ['شوف الترجمة وقارنها باللي فهمته', ['Check the translation and compare it with your guess', 'Prüfe die Übersetzung und vergleiche sie mit deinem Verständnis']],
  ['اعرف الوظيفة', ['Identify the function', 'Erkenne die Satzfunktion']],
  ['رأي؟ مقارنة؟ سبب؟ رد؟', ['Opinion? Comparison? Reason? Reply?', 'Meinung? Vergleich? Grund? Antwort?']],
  ['راقب ترتيب الكلمات', ['Observe the word order', 'Achte auf die Wortstellung (Satzbau)']],
  ['شوف إيه الثابت وإيه اللي بيتغير', ['Notice the fixed chunk template vs. the variable slot', 'Erkenne das feste Satzmuster und den variablen Teil']],
  ['وظيفة الجملة في الكلام', ['Communicative Function', 'Funktion des Satzes']],
  ['رأي', ['Opinion', 'Meinung']],
  ['مقارنة', ['Comparison', 'Vergleich']],
  ['سبب', ['Reason', 'Grund']],
  ['نتيجة', ['Result', 'Folge']],
  ['طلب', ['Request', 'Bitte']],
  ['رفض', ['Refusal', 'Ablehnung']],
  ['رد', ['Reply', 'Antwort']],
  ['اقتراح', ['Suggestion', 'Vorschlag']],
  ['افتح خريطة الكلمات', ['Open Word Map', 'Wortkarte öffnen']],
  ['خريطة الجملة', ['Sentence Word Map', 'Satzstruktur-Karte']],
  ['فهمت — يلا ننطقها', ['Understood — Let’s Speak It', 'Verstanden — Jetzt aussprechen']],
  ['اسمعه ببطء', ['Listen Slowly', 'Langsam anhören']],
  ['اسمعه طبيعي', ['Listen Natural', 'Natürlich anhören']],
  ['ردد في نفس الوقت', ['Shadow Along', 'Gleichzeitig mitsprechen']],
  ['1 · ببطء', ['1 · Slowly', '1 · Langsam']],
  ['2 · بسرعة طبيعية', ['2 · Natural Speed', '2 · Natürliches Tempo']],
  ['3 · من غير ما تبص', ['3 · Blind Recall', '3 · Ohne hinzusehen']],
  ['سجّل صوتك وقارنه (اختياري)', ['Record & compare your voice (optional)', 'Stimme aufnehmen & vergleichen (optional)']],
  ['ابدأ التسجيل', ['Start Recording', 'Aufnahme starten']],
  ['مسار الجملة', ['Chunk Path', 'Chunk-Pfad']],
  ['وقت الجلسة', ['Session Time', 'Sitzungszeit']],
  ['إنتاجات الجملة', ['Chunk Productions', 'Chunk-Produktionen']],
  ['آخر حفظ', ['Last Saved', 'Zuletzt gespeichert']],
  ['شوف القايمة كلها', ['View Full Level List', 'Gesamte Stufenliste']],
  ['محفوظ تلقائيًا', ['Auto-saved', 'Automatisch gespeichert']],

  // Review Screen
  ['مراجعة النهاردة', ["Today's Review", 'Heutige Wiederholung']],
  ['فاضل شغل بسيط وتبقى في السليم', ['A quick review session to lock in your memory', 'Noch eine kurze Wiederholung für dein Langzeitgedächtnis']],
  ['مفيش حاجة مستحقة النهاردة', ['Nothing Due Today!', 'Heute ist nichts fällig!']],
  ['مستحق النهاردة', ['Due Today', 'Heute fällig']],
  ['مفيش مراجعة مستحقة', ['No Reviews Due Right Now', 'Keine Wiederholungen fällig']],
  ['المراجعة بتظهر لوحدها في مواعيدها. تقدر تفتح جملة جديدة أو تراجع حاجة من المستويات.', [
    'Reviews appear automatically on schedule. You can start a new chunk or browse the levels.',
    'Wiederholungen erscheinen automatisch nach Zeitplan. Starte einen neuen Chunk oder wähle eine Stufe.',
  ]],
  ['افتح الجملة الحالية', ['Open Current Chunk', 'Aktuellen Chunk öffnen']],
  ['شوف تقدمك', ['View Your Progress', 'Fortschritt ansehen']],
  ['قايمة المراجعة', ['Review Queue', 'Wiederholungsliste']],
  ['مراجعة جملة متقنة', ['Mastered Chunk Review', 'Gemeisterten Chunk wiederholen']],
  ['إنتاج مستحق', ['Scheduled Production', 'Fällige Produktion']],
  ['استدعاء مؤجل', ['Delayed Recall', 'Verzögerter Abruf']],
  ['شوف الجملة', ['Show Sentence', 'Satz anzeigen']],
  ['نسيتها', ['Forgot', 'Vergessen']],
  ['تقريبًا', ['Almost', 'Fast']],
  ['عرفتها', ['Got It', 'Gewusst']],

  // Stats Screen
  ['تقدمك', ['Your Progress', 'Dein Fortschritt']],
  ['كل رقم هنا اتحسب من شغلك', ['Every metric is calculated directly from your real practice', 'Jede Zahl basiert direkt auf deinem echten Training']],
  ['التقدم بيتحفظ في ملف على جهازك — مفيش سيرفر ومفيش حساب.', [
    'Your progress is stored 100% locally on your device — no server, no account required.',
    'Dein Fortschritt wird lokal auf deinem Gerät gespeichert — kein Server, kein Konto nötig.',
  ]],
  ['صدّر', ['Export', 'Exportieren']],
  ['استورد', ['Import', 'Importieren']],
  ['إنتاج إجمالي', ['Total Productions', 'Gesamtproduktionen']],
  ['جملة متقنة', ['Mastered Chunks', 'Gemeisterte Chunks']],
  ['وقت تدريب تقديري', ['Estimated Practice Time', 'Geschätzte Trainingszeit']],
  ['أطول سلسلة', ['Longest Streak', 'Längste Serie']],
  ['نشاطك آخر 12 أسبوع', ['Activity Over Last 12 Weeks', 'Deine Aktivität der letzten 12 Wochen']],
  ['جدول تتبع مواعيد المراجعات (Spaced Repetition)', ['Spaced Repetition Schedule Tracker', 'Spaced-Repetition-Zeitplan']],
  ['كل المراجعات مجدولة', ['All Reviews Scheduled', 'Alle Wiederholungen geplant']],
  ['صفحة المراجعة', ['Review Page', 'Zur Wiederholung']],
  ['آخر حركة', ['Recent Activity', 'Letzte Aktivitäten']],
  ['لسه مفيش حركة — افتح أول جملة وابدأ.', ['No activity yet — open your first chunk and begin.', 'Noch keine Aktivität — öffne deinen ersten Chunk.']],

  // Trophies Screen
  ['خزانة الإنجازات والتحفيز اللحظي', ['Trophy Cabinet & Real-Time Gamification', 'Trophäenschrank & Echtzeit-Motivation']],
  ['إنجازاتك المعتمدة ونقاط الإتقان', ['Verified Achievements & Mastery XP', 'Deine Auszeichnungen & Meisterungs-XP']],
  ['استخراج شهادة مستوى', ['Generate Level Certificate', 'Stufenzertifikat erstellen']],
  ['أوسمة مكتملة في الخزانة', ['Unlocked Badges in Cabinet', 'Freigeschaltete Abzeichen']],
  ['أطول سلسلة متواصلة', ['Current Active Streak', 'Aktuelle Tages-Serie']],
  ['شهادات المهارة المعتمدة', ['Verified Skill Certificates', 'Zertifizierte Sprachnachweise']],
  ['شهادات قابلة للطباعة والحفظ (A1 إلى C1)', ['Printable & Saveable Certificates (A1 to C1)', 'Druck- & speicherbare Zertifikate (A1 bis C1)']],
  ['عرض وطباعة الشهادة', ['View & Print Certificate', 'Zertifikat anzeigen & drucken']],
  ['كمّل الشروط الأول (100 شانك)', ['Complete 100 Chunks First', 'Zuerst 100 Chunks meistern']],

  // Method Screen
  ['الـChunk يبقى تلقائي في الكلام', ['Making German Chunks Automatic in Speech', 'Wie Chunks im Gespräch automatisch werden']],
  ['مش مجرد حفظ — 6 خطوات لكل جملة، وجدول تكرار بيخليها تثبت.', [
    'Not rote memorization — 6 deliberate steps per sentence plus spaced repetition.',
    'Kein stures Auswendiglernen — 6 gezielte Schritte pro Satz mit verteilter Wiederholung.',
  ]],
  ['ابدأ جلسة', ['Start Session', 'Sitzung starten']],
  ['كبّر الصورة', ['Zoom Poster', 'Bild vergrößern']],
  ['جدول الـ30 إنتاج', ['The 30-Production Schedule', 'Der 30-Produktionen-Zeitplan']],
  ['ظبط هدفك اليومي', ['Configure Daily Goal', 'Tagesziel anpassen']],

  // Settings Screen
  ['خلي البرنامج على مزاجك', ['Customize Your Experience', 'Passe die App an deine Bedürfnisse an']],
  ['كل حاجة هنا بتتحفظ فورًا على جهازك.', ['All changes are saved immediately on your device.', 'Alle Einstellungen werden sofort lokal gespeichert.']],
  ['التفضيلات', ['Preferences & Language', 'Einstellungen & Sprache']],
  ['اليومي والواجهة', ['Daily Goals, Theme & Interface Language', 'Tagesziel, Design & Oberflächensprache']],
  ['الوضع الليلي', ['Dark Mode', 'Dunkelmodus']],
  ['ألوان هادية للعين في المذاكرة بالليل', ['Eye-friendly dark palette for night study sessions', 'Augenschonende dunkle Farben für das Lernen am Abend']],
  ['تجربة الصوتيات الاستوديو', ['Studio Sound Experience', 'Studio-Klangwelt']],
  ['المؤثرات الصوتية العامة', ['Master Sound Effects', 'Allgemeine Soundeffekte']],
  ['مستوى صوت المؤثرات', ['Sound Effects Volume', 'Lautstärke der Soundeffekte']],
  ['تنبيهات ومواعيد المراجعة', ['Review Alerts & Reminders', 'Wiederholungs-Benachrichtigungen']],
  ['إشعارات ويندوز للمراجعة', ['Windows Desktop Notifications', 'Windows-Benachrichtigungen']],
  ['المنبه الصوتي الخفيف (تيت تيت)', ['Gentle Review Chime', 'Sanfter Wiederholungs-Ton']],
  ['تجربة الإشعار والصوت', ['Test Notification & Chime', 'Benachrichtigung & Ton testen']],
  ['الصوت الألماني', ['German Speech Engine (TTS)', 'Deutsche Sprachausgabe (TTS)']],
  ['تشغيل الصوت', ['Enable German TTS', 'Sprachausgabe aktivieren']],
  ['سرعة النطق الافتراضية', ['Default Speech Rate', 'Standard-Sprechtempo']],
  ['محرك النطق', ['Voice Engine', 'Stimmenauswahl']],
  ['جرّب الصوت', ['Test German Voice', 'Stimme testen']],
  ['اسمع', ['Listen', 'Anhören']],
  ['التعرف الصوتي الذكي (Whisper AI)', ['Local Speech Recognition (Whisper AI)', 'Lokale Spracherkennung (Whisper AI)']],
  ['البيانات', ['Local Data & Backups', 'Lokale Daten & Backups']],
  ['افتح فولدر البيانات', ['Open Data Folder', 'Datenordner öffnen']],
  ['صدّر نسخة', ['Export Backup', 'Backup exportieren']],
  ['استورد نسخة', ['Import Backup', 'Backup importieren']],
  ['مسح كل التقدم', ['Reset All Progress', 'Gesamten Fortschritt zurücksetzen']],
  ['مسح', ['Reset', 'Zurücksetzen']],
  ['عن التطبيق', ['About the App', 'Über die App']],
  ['شوف المنهج', ['View Method', 'Methode ansehen']],
]);

// Regex rules for dynamic Arabic strings with embedded numbers/variables
const REGEX_RULES = [
  {
    re: /^([A-Z]\d)\s+—\s+(.+)$/,
    en: (_, lv, title) => `${lv} — ${translateText(title.trim(), 'en')}`,
    de: (_, lv, title) => `${lv} — ${translateText(title.trim(), 'de')}`,
  },
  {
    re: /^(\d+)\s+يوم متواصل$/,
    en: (_, n) => `${n} day streak`,
    de: (_, n) => `${n} Tage Serie`,
  },
  {
    re: /^راجع\s+(\d+)\s+مستحق$/,
    en: (_, n) => `Review ${n} Due`,
    de: (_, n) => `${n} Fällige wiederholen`,
  },
  {
    re: /^الخطوة\s+(\d+)\s+من\s+(\d+)\s+·\s+(.+)$/,
    en: (_, s, tot, title) => `Step ${s} of ${tot} · ${translateText(title, 'en')}`,
    de: (_, s, tot, title) => `Schritt ${s} von ${tot} · ${translateText(title, 'de')}`,
  },
  {
    re: /^فاضل\s+(\d+)\s+إنتاج من الخطة$/,
    en: (_, n) => `${n} productions remaining in plan`,
    de: (_, n) => `Noch ${n} Produktionen im Plan`,
  },
  {
    re: /^(\d+)\s+جملة\s+·\s+(\d+)\s+مجموعة منوعة$/,
    en: (_, c, g) => `${c} chunks · ${g} diverse groups`,
    de: (_, c, g) => `${c} Chunks · ${g} gemischte Gruppen`,
  },
  {
    re: /^(\d+)\s+متقن$/,
    en: (_, n) => `${n} mastered`,
    de: (_, n) => `${n} gemeistert`,
  },
  {
    re: /^(\d+)\s+شغال عليه$/,
    en: (_, n) => `${n} in progress`,
    de: (_, n) => `${n} in Arbeit`,
  },
  {
    re: /^من\s+([\d,]+)$/,
    en: (_, n) => `of ${n}`,
    de: (_, n) => `von ${n}`,
  },
  {
    re: /^المجموعة\s+(\d+)$/,
    en: (_, n) => `Group ${n}`,
    de: (_, n) => `Gruppe ${n}`,
  },
  {
    re: /^قالب:\s*(.+)$/,
    en: (_, p) => `Pattern: ${p}`,
    de: (_, p) => `Muster: ${p}`,
  },
  {
    re: /^قالب الجملة:\s*(.+)$/,
    en: (_, p) => `Sentence Pattern: ${p}`,
    de: (_, p) => `Satzmuster: ${p}`,
  },
  {
    re: /^(\d+)\s+جملة مقسمة إلى\s+(\d+)\s+مجموعة منوعة$/,
    en: (_, c, g) => `${c} Chunks organized into ${g} Interleaved Groups`,
    de: (_, c, g) => `${c} Chunks aufgeteilt in ${g} abwechslungsreiche Gruppen`,
  },
  {
    re: /^مجموعات منوعة تدمج قوالب وتراكيب مختلفة لتجنب التكرار الرتيب، مع شرح مصور بالعربي ومرحلة ختامية من 5 تنويعات لكل مجموعة\.$/,
    en: () => 'Interleaved groups combine varied sentence patterns to prevent rote monotony, complete with visual grammar boards and a 5-variation group finale.',
    de: () => 'Abwechslungsreiche Gruppen kombinieren verschiedene Satzmuster gegen Monotonie — inklusive visueller Grammatiktafeln und einem 5-Variationen-Finale.',
  },
  {
    re: /^📐 شرح مصور بالعربي ·\s*(.+)$/,
    en: (_, lv) => `📐 Visual Guides · ${lv}`,
    de: (_, lv) => `📐 Visuelle Grammatiktafeln · ${lv}`,
  },
  {
    re: /^لوحات القواعد وتراكيب الجمل والكلمات للمستوى\s+(.+)$/,
    en: (_, lv) => `Visual Grammar, Sentence Structure & Vocab Boards for Level ${lv}`,
    de: (_, lv) => `Visuelle Grammatik-, Satzbau- & Wortschatztafeln für Stufe ${lv}`,
  },
  {
    re: /^(\d+)\s+لوحة مصورة تشرح قواعد وتراكيب ومفردات\s+([A-Z]\d)\s+بالعربي مع أمثلة جاهزة — اضغط على أي لوحة لتكبيرها فوراً\.$/,
    en: (_, n, lv) => `${n} illustrated boards explaining ${lv} grammar, sentence patterns, and vocabulary with ready examples — click any board to zoom in.`,
    de: (_, n, lv) => `${n} illustrierte Lehrtafeln zu ${lv}-Grammatik, Satzbau und Wortschatz mit Beispielen — klicke auf eine Tafel zum Vergrößern.`,
  },
  {
    re: /^عرض كل اللوحات\s*\((\d+)\)$/,
    en: (_, n) => `Show All Boards (${n})`,
    de: (_, n) => `Alle Tafeln zeigen (${n})`,
  },
  {
    re: /^المجموعات المنوعة\s*\((\d+)\)$/,
    en: (_, n) => `Groups (${n})`,
    de: (_, n) => `Gruppen (${n})`,
  },
  {
    re: /^كل الجمل\s*\((\d+)\)$/,
    en: (_, n) => `All Chunks (${n})`,
    de: (_, n) => `Alle Sätze (${n})`,
  },
  {
    re: /^(\d+)\s+قوالب مختلفة$/,
    en: (_, n) => `${n} distinct patterns`,
    de: (_, n) => `${n} verschiedene Muster`,
  },
  {
    re: /^(\d+)\s+من\s+(\d+)\s+جمل متقنة$/,
    en: (_, a, b) => `${a} of ${b} chunks mastered`,
    de: (_, a, b) => `${a} von ${b} Chunks gemeistert`,
  },
  {
    re: /^ابدأ تدريب المجموعة\s*\((\d+)\s+جمل\)$/,
    en: (_, n) => `Train Group (${n} Chunks)`,
    de: (_, n) => `Gruppe trainieren (${n} Sätze)`,
  },
  {
    re: /^عرض الجمل\s*\((\d+)\)\s*▼$/,
    en: (_, n) => `Show Chunks (${n}) ▼`,
    de: (_, n) => `Sätze zeigen (${n}) ▼`,
  },
  {
    re: /^ابدأ بالترتيب\s*\(([^)]+)\)$/,
    en: (_, id) => `Start in Order (${id})`,
    de: (_, id) => `Der Reihe nach (${id})`,
  },
  {
    re: /^(\d+)\s+مجموعة(?: منوعة| قوالب) تحت الفلتر ده$/,
    en: (_, n) => `${n} groups match this filter`,
    de: (_, n) => `${n} Gruppen entsprechen diesem Filter`,
  },
  {
    re: /^(\d+)\s+لوحة مصورة(?: تحت الفلتر ده)?$/,
    en: (_, n) => `${n} visual boards`,
    de: (_, n) => `${n} Bildtafeln`,
  },
  {
    re: /^(\d+)\s+جملة تحت الفلتر ده$/,
    en: (_, n) => `${n} chunks match this filter`,
    de: (_, n) => `${n} Chunks entsprechen diesem Filter`,
  },
  {
    re: /^عرض المزيد\s*\((\d+)\s+(?:بطاقة متبقية|فاضل)\)$/,
    en: (_, n) => `Load More (${n} remaining)`,
    de: (_, n) => `Mehr laden (${n} verbleibend)`,
  },
  {
    re: /^غير مقروء\s*\((\d+)\)$/,
    en: (_, n) => `Unread (${n})`,
    de: (_, n) => `Ungelesen (${n})`,
  },
  {
    re: /^مقروء\s*\((\d+)\)$/,
    en: (_, n) => `Read (${n})`,
    de: (_, n) => `Gelesen (${n})`,
  },
  {
    re: /^المفضلة\s*\((\d+)\)$/,
    en: (_, n) => `Favorites (${n})`,
    de: (_, n) => `Favoriten (${n})`,
  },
  {
    re: /^لوحات شرح قواعد المستوى\s*\(([^)]+)\)$/,
    en: (_, lv) => `Level ${lv} Visual Grammar Boards`,
    de: (_, lv) => `Visuelle Grammatiktafeln (${lv})`,
  },
  {
    re: /^(\d+)\s+لوحة تعليمية مصورة مقسمة إلى\s+(\d+)\s+قسماً ومرتبطة بالمستويات.+$/,
    en: (_, tot, top) => `${tot} illustrated German learning boards across ${top} topics mapped to CEFR levels (A1–C1): sentence structure, word distinctions, Greek & Egyptian mythology, prophet stories, philosophy, and psychology.`,
    de: (_, tot, top) => `${tot} illustrierte Lehrtafeln in ${top} Themenbereichen für die Stufen A1 bis C1: Satzbau, Grammatik, Wortunterschiede, griechische & ägyptische Mythologie, Philosophie und Psychologie.`,
  },
  // Library topic titles & descriptions
  {
    re: /^مستوى A1 – A2$/,
    en: () => 'Level A1 – A2 Foundation',
    de: () => 'Stufe A1 – A2 Grundlagen',
  },
  {
    re: /^مستوى B1 – B2$/,
    en: () => 'Level B1 – B2 Intermediate',
    de: () => 'Stufe B1 – B2 Mittelstufe',
  },
  {
    re: /^مستوى C1 المتقدم$/,
    en: () => 'Level C1 Advanced',
    de: () => 'Stufe C1 Oberstufe',
  },
  {
    re: /^قواعد الألمانية الشاملة \(Grammatik\)$/,
    en: () => 'Comprehensive Grammar (Grammatik)',
    de: () => 'Umfassende Grammatik',
  },
  {
    re: /^كلمات وفروق لغوية \(Neue Wörter\)$/,
    en: () => 'Vocabulary & Nuances (Neue Wörter)',
    de: () => 'Wortschatz & Nuancen (Neue Wörter)',
  },
  {
    re: /^تعبيرات واصطلاحات \(Redemittel & Idiome\)$/,
    en: () => 'Expressions & Idioms (Redemittel)',
    de: () => 'Redemittel & Idiome',
  },
  {
    re: /^لغة الشارع والحياة اليومية \(Umgangssprache\)$/,
    en: () => 'Everyday & Street German (Umgangssprache)',
    de: () => 'Alltags- & Umgangssprache',
  },
  {
    re: /^ألماني العمل وخدمة العملاء \(Kundenservice\)$/,
    en: () => 'Workplace & Customer Service German',
    de: () => 'Berufsdeutsch & Kundenservice',
  },
  {
    re: /^الأساطير اليونانية \(Griechische Mythologie\)$/,
    en: () => 'Greek Mythology (Griechische Mythologie)',
    de: () => 'Griechische Mythologie',
  },
  {
    re: /^الأساطير المصرية القديمة \(Ägyptische Mythologie\)$/,
    en: () => 'Ancient Egyptian Mythology',
    de: () => 'Ägyptische Mythologie',
  },
  {
    re: /^تاريخ مصر الحضاري \(Ägyptische Geschichte\)$/,
    en: () => 'Egyptian Cultural History',
    de: () => 'Ägyptische Geschichte',
  },
  {
    re: /^قصص الأنبياء والحكمة \(Prophetengeschichten\)$/,
    en: () => 'Prophet Stories & Wisdom',
    de: () => 'Prophetengeschichten',
  },
  {
    re: /^التاريخ والسياسة \(Geschichte & Politik\)$/,
    en: () => 'History & Politics',
    de: () => 'Geschichte & Politik',
  },
  {
    re: /^النظريات السياسية \(Politik & Theorie\)$/,
    en: () => 'Political Theory',
    de: () => 'Politik & Theorie',
  },
  {
    re: /^علم النفس والأعصاب \(Psychologie & Neuro\)$/,
    en: () => 'Psychology & Neuroscience',
    de: () => 'Psychologie & Neurowissenschaft',
  },
  {
    re: /^الفلسفة والتفكير النقدي \(Philosophie\)$/,
    en: () => 'Philosophy & Critical Thinking',
    de: () => 'Philosophie & Kritisches Denken',
  },
  {
    re: /^الفلسفة النفسية \(Psycho-Philosophie\)$/,
    en: () => 'Psycho-Philosophy',
    de: () => 'Psycho-Philosophie',
  },
  {
    re: /^الميتافيزيقا والأنطولوجيا \(Metaphysik\)$/,
    en: () => 'Metaphysics & Ontology',
    de: () => 'Metaphysik & Ontologie',
  },
  {
    re: /^العلم الزائف والتفكير العلمي \(Pseudowissenschaft\)$/,
    en: () => 'Pseudoscience & Scientific Method',
    de: () => 'Pseudowissenschaft',
  },
  {
    re: /^خوارزميات ومنهجيات التعلم \(Lern-Algorithmen\)$/,
    en: () => 'Learning Algorithms & Memory',
    de: () => 'Lern-Algorithmen',
  },
  {
    re: /^أفلام ومسلسلات \(Filme & Serien\)$/,
    en: () => 'Films & Series Analysis',
    de: () => 'Filme & Serien',
  },
  {
    re: /^الأدب والروايات العالمية \(Literatur & Romane\)$/,
    en: () => 'World Literature & Novels',
    de: () => 'Literatur & Romane',
  },
  {
    re: /^اقتباسات وشعر \(Zitate & Poesie\)$/,
    en: () => 'Quotes & Poetry',
    de: () => 'Zitate & Poesie',
  },
  {
    re: /^الثقافة والمجتمع الألماني \(Deutsche Kultur\)$/,
    en: () => 'German Culture & Society',
    de: () => 'Deutsche Kultur',
  },
  {
    re: /^موضوعات متنوعة \(Themen\)$/,
    en: () => 'General Themes (Themen)',
    de: () => 'Allgemeine Themen',
  },
  // Card titles
  {
    re: /^تراكيب جمل ([A-Z]\d)(?: الأساسية)? \(([A-Z]\d - Satzbau)\) — لوحة (\d+)$/,
    en: (_, lv, tag, n) => `${tag} Sentence Structure — Board #${n}`,
    de: (_, lv, tag, n) => `${tag} Satzmuster — Tafel #${n}`,
  },
  {
    re: /^ملخص قواعد وتراكيب A2 — جزء (\d+)$/,
    en: (_, n) => `A2 Grammar & Sentence Structure Summary — Part ${n}`,
    de: (_, n) => `A2 Grammatik- & Satzbau-Übersicht — Teil ${n}`,
  },
  {
    re: /^الفرق بين الجملة الأساسية والفرعية \(Hauptsatz & Nebensatz\)$/,
    en: () => 'Main Clause vs. Subordinate Clause (Hauptsatz & Nebensatz)',
    de: () => 'Unterschied zwischen Hauptsatz & Nebensatz',
  },
  {
    re: /^صيغة الأمر في الألمانية \(Der Imperativ A1–A2\) — لوحة (\d+)$/,
    en: (_, n) => `The Imperative in German (Der Imperativ A1–A2) — Board #${n}`,
    de: (_, n) => `Der Imperativ im Deutschen (A1–A2) — Tafel #${n}`,
  },
  {
    re: /^الماضي المركب مع sein و haben \(Perfekt A1–A2\) — لوحة (\d+)$/,
    en: (_, n) => `Present Perfect with sein & haben (Perfekt A1–A2) — Board #${n}`,
    de: (_, n) => `Perfekt mit sein & haben (A1–A2) — Tafel #${n}`,
  },
  {
    re: /^حروف الجر الزمنية \(um \/ am \/ im \/ seit \/ vor\) — جزء (\d+)$/,
    en: (_, n) => `Temporal Prepositions (um / am / im / seit / vor) — Part ${n}`,
    de: (_, n) => `Temporale Präpositionen (um / am / im / seit / vor) — Teil ${n}`,
  },
  {
    re: /^تراكيب جمل B1 والروابط \(B1 - Satzbau\) — لوحة (\d+)$/,
    en: (_, n) => `B1 Sentence Structure & Connectors (B1 - Satzbau) — Board #${n}`,
    de: (_, n) => `B1 Satzbau & Konnektoren — Tafel #${n}`,
  },
  {
    re: /^تراكيب جمل B2 والمبني للمجهول \(B2 - Satzbau\) — لوحة (\d+)$/,
    en: (_, n) => `B2 Sentence Structure & Passive Voice (B2 - Satzbau) — Board #${n}`,
    de: (_, n) => `B2 Satzbau & Passiv — Tafel #${n}`,
  },
  {
    re: /^تراكيب جمل C1 والكلام غير المباشر \(C1 - Satzbau\) — لوحة (\d+)$/,
    en: (_, n) => `C1 Sentence Structure & Indirect Speech (C1 - Satzbau) — Board #${n}`,
    de: (_, n) => `C1 Satzbau & Indirekte Rede (Konjunktiv I) — Tafel #${n}`,
  },
  {
    re: /^دليل خدمة العملاء بالألمانية — فصل (\d+)(.*)$/,
    en: (_, n, rest) => `German Customer Service Operations Guide — Chapter ${n}${rest}`,
    de: (_, n, rest) => `Leitfaden Kundenservice auf Deutsch — Kapitel ${n}${rest}`,
  },
  {
    re: /^جدول تعبيرات الحياة اليومية \(ألماني - عربي\) — لوحة (\d+)$/,
    en: (_, n) => `Everyday German Expressions Table — Board #${n}`,
    de: (_, n) => `Alltagsausdrücke-Tabelle (Deutsch - Arabisch) — Tafel #${n}`,
  },
  {
    re: /^قاموس تعبيرات الشارع والاختصارات اليومية — صفحة (\d+)$/,
    en: (_, n) => `Colloquial Contractions & Street German Glossary — Page ${n}`,
    de: (_, n) => `Umgangssprachliche Verkürzungen & Partikeln — Seite ${n}`,
  },
  {
    re: /^مصطلحات الشباب ولغة الشارع الألمانية — جزء (\d+)$/,
    en: (_, n) => `Modern Youth & Street German Slang — Part ${n}`,
    de: (_, n) => `Jugendsprache & Street-Deutsch Glossar — Teil ${n}`,
  },
  {
    re: /^مقارنة أزمنة الماضي في الألمانية — لوحة (\d+)$/,
    en: (_, n) => `German Past Tenses Comparison — Board #${n}`,
    de: (_, n) => `Vergleich der deutschen Vergangenheitsformen — Tafel #${n}`,
  },
  {
    re: /^(.+) — (?:لوحة تعليمية|بطاقة) #(\d+)(?: \(صفحة (\d+)\))?$/,
    en: (_, topic, num, page) => `${translateText(topic.trim(), 'en')} — Board #${num}${page ? ` (Page ${page})` : ''}`,
    de: (_, topic, num, page) => `${translateText(topic.trim(), 'de')} — Tafel #${num}${page ? ` (Seite ${page})` : ''}`,
  },
  {
    re: /^عرض البطاقات التعليمية(?:\s+\(مستوى ([A-Z]\d)\))?$/,
    en: (_, lv) => `Showing Visual Learning Boards${lv ? ` (Level ${lv})` : ''}`,
    de: (_, lv) => `Visuelle Lehrtafeln${lv ? ` (Stufe ${lv})` : ''}`,
  },
  {
    re: /^— اضغط على أي بطاقة لتكبيرها وقراءتها بوضوح كامل مع التنقل بالأسهم$/,
    en: () => '— Click any board to open the full-screen zoomable reader with keyboard arrow navigation',
    de: () => '— Klicke auf eine Tafel für die Vollbild-Ansicht mit Zoom und Pfeiltasten-Navigation',
  },
  {
    re: /^(.+) · بطاقة (\d+) من (\d+)$/,
    en: (_, topic, cur, tot) => `${translateText(topic.trim(), 'en')} · Board ${cur} of ${tot}`,
    de: (_, topic, cur, tot) => `${translateText(topic.trim(), 'de')} · Tafel ${cur} von ${tot}`,
  },
];

// Placeholder translations
const PLACEHOLDERS = new Map([
  [
    'ابحث عن موضوع، مستوى (A1, A2, B1, B2, C1)، أساطير، قواعد، أو اسم سلسلة...',
    [
      'Search by topic, level (A1, A2, B1, B2, C1), mythology, grammar, or series...',
      'Suche nach Thema, Stufe (A1–C1), Mythologie, Grammatik oder Serie...',
    ],
  ],
  [
    'دوّر برقم المجموعة أو بالقالب أو بالألماني أو بالعربي',
    [
      'Search by group number, sentence pattern, German, or meaning...',
      'Suche nach Gruppennummer, Satzmuster oder Text...',
    ],
  ],
]);

export function translateText(rawStr, lang = currentLang) {
  if (lang === 'ar' || !rawStr) return rawStr;
  const trimmed = rawStr.trim();
  if (!trimmed) return rawStr;

  const langIdx = lang === 'en' ? 0 : 1;

  if (EXACT_PHRASES.has(trimmed)) {
    const translated = EXACT_PHRASES.get(trimmed)[langIdx];
    return rawStr.replace(trimmed, translated);
  }

  for (const rule of REGEX_RULES) {
    const match = trimmed.match(rule.re);
    if (match) {
      const fn = lang === 'en' ? rule.en : rule.de;
      const translated = fn(...match);
      return rawStr.replace(trimmed, translated);
    }
  }

  return rawStr;
}

/**
 * Translates all text nodes and input placeholders inside a root DOM element
 * when the interface language is English ('en') or German ('de'), while keeping
 * original Arabic values stored in weak memory so switching back to 'ar' is instant and lossless.
 */
const origTextNodeMap = new WeakMap();

export function applyDOMLocalization(root = document.body) {
  if (!root) return;
  const lang = currentLang;

  // Update document attributes
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.lang = lang;

  // Update language switcher pill state in topbar
  document.querySelectorAll('[data-lang-switch]').forEach((btn) => {
    const active = btn.dataset.langSwitch === lang;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  // Walk text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG') return NodeFilter.FILTER_REJECT;
      // Do not alter German example sentences (.de) except pattern chips
      if (parent.classList.contains('de') && !parent.classList.contains('chip')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    if (!origTextNodeMap.has(node)) {
      origTextNodeMap.set(node, node.nodeValue);
    }
    const orig = origTextNodeMap.get(node);
    const nextVal = lang === 'ar' ? orig : translateText(orig, lang);
    if (node.nodeValue !== nextVal) {
      node.nodeValue = nextVal;
    }
  }

  // Translate placeholders and titles
  root.querySelectorAll?.('input[placeholder], textarea[placeholder]').forEach((el) => {
    if (!el.dataset.origPlaceholder) {
      el.dataset.origPlaceholder = el.getAttribute('placeholder') || '';
    }
    const orig = el.dataset.origPlaceholder;
    if (lang === 'ar') {
      el.setAttribute('placeholder', orig);
    } else if (PLACEHOLDERS.has(orig)) {
      el.setAttribute('placeholder', PLACEHOLDERS.get(orig)[lang === 'en' ? 0 : 1]);
    }
  });
}

export function getLang() {
  return currentLang;
}

export function setLang(nextLang, onAfterChange = null) {
  if (!SUPPORTED_LANGS.includes(nextLang)) return;
  currentLang = nextLang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, currentLang);
  } catch {}
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.lang = currentLang;
  if (typeof onAfterChange === 'function') {
    onAfterChange(currentLang);
  }
  applyDOMLocalization(document.body);
}

export function initI18n(onRouteRefresh) {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.lang = currentLang;

  // Observe DOM mutations inside #view, #modal-root, #toast-root, and #lib-lightbox-portal
  let rafId = null;
  const observer = new MutationObserver(() => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      applyDOMLocalization(document.body);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('click', (event) => {
    const langBtn = event.target.closest('[data-lang-switch]');
    if (langBtn) {
      const targetLang = langBtn.dataset.langSwitch;
      setLang(targetLang, onRouteRefresh);
    }
  });

  applyDOMLocalization(document.body);
}
