/** Text helpers shared by server and client: search normalization, hijri formatting, durations. */

/** Normalize for search: removes Arabic diacritics/tatweel, unifies alef/ya/ta-marbuta, lowercases (Cyrillic/Latin). */
export function norm(s: string) {
  return s
    .normalize("NFKC")
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/[یې]/g, "ي")
    .replace(/ہ/g, "ه")
    .toLowerCase()
    .replace(/ё/g, "е");
}

const MONTH_ALIASES: Record<string, number> = { "جماد أول": 5, "جماد آخر": 6, "جمادى الأولى": 5, "جمادى الآخرة": 6, "ربيع أول": 3, "ربيع ثان": 4, "ربيع آخر": 4 };
const AR_MONTHS = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];

/** Hijri month of a recording as {key: "1447-05", year, month} — used for the month filter. */
export function hijriMonth(h: string): { key: string; year: string; month: number } | null {
  let m: number | undefined, y: string | undefined;
  let r = /^(\d+)-(\d+)-(14\d\d)$/.exec(h || "");
  if (r) {
    m = +r[2];
    y = r[3];
  } else if ((r = /^(.+?)\s+(14\d\d)$/.exec(h || ""))) {
    y = r[2];
    m = MONTH_ALIASES[r[1]] || AR_MONTHS.indexOf(r[1]) + 1;
  }
  if (!m || m > 12 || !y) return null;
  return { key: `${y}-${String(m).padStart(2, "0")}`, year: y, month: m };
}

/** «7-6-1448» → «7 جمادى الآخرة 1448هـ» using the locale's month names. */
export function formatHijri(h: string, months: string[], suffix: string) {
  if (!h) return "";
  const r = /^(\d+)-(\d+)-(14\d\d)$/.exec(h);
  if (r && +r[2] >= 1 && +r[2] <= 12) return `${+r[1]} ${months[+r[2] - 1]} ${r[3]}${suffix}`;
  const m = hijriMonth(h);
  return m ? `${months[m.month - 1]} ${m.year}${suffix}` : h;
}

export const parseDur = (d: string) => (d || "").split(":").reduce((a, b) => a * 60 + (+b || 0), 0);
export function fmtTime(s: number) {
  s = Math.floor(s || 0);
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    x = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
}

/** The 114 surahs (Arabic). Index + 1 = surah number. */
export const SURAHS_AR =
  "الفاتحة البقرة آل_عمران النساء المائدة الأنعام الأعراف الأنفال التوبة يونس هود يوسف الرعد إبراهيم الحجر النحل الإسراء الكهف مريم طه الأنبياء الحج المؤمنون النور الفرقان الشعراء النمل القصص العنكبوت الروم لقمان السجدة الأحزاب سبأ فاطر يس الصافات ص الزمر غافر فصلت الشورى الزخرف الدخان الجاثية الأحقاف محمد الفتح الحجرات ق الذاريات الطور النجم القمر الرحمن الواقعة الحديد المجادلة الحشر الممتحنة الصف الجمعة المنافقون التغابن الطلاق التحريم الملك القلم الحاقة المعارج نوح الجن المزمل المدثر القيامة الإنسان المرسلات النبأ النازعات عبس التكوير الانفطار المطففين الانشقاق البروج الطارق الأعلى الغاشية الفجر البلد الشمس الليل الضحى الشرح التين العلق القدر البينة الزلزلة العاديات القارعة التكاثر العصر الهمزة الفيل قريش الماعون الكوثر الكافرون النصر المسد الإخلاص الفلق الناس"
    .split(" ")
    .map((x) => x.replace("_", " "));

/** Transliterated names (used for English, Hindi and Russian UIs). */
export const SURAHS_LATIN =
  "Al-Fatihah Al-Baqarah Al_Imran An-Nisa Al-Ma'idah Al-An'am Al-A'raf Al-Anfal At-Tawbah Yunus Hud Yusuf Ar-Ra'd Ibrahim Al-Hijr An-Nahl Al-Isra Al-Kahf Maryam Ta-Ha Al-Anbiya Al-Hajj Al-Mu'minun An-Nur Al-Furqan Ash-Shu'ara An-Naml Al-Qasas Al-Ankabut Ar-Rum Luqman As-Sajdah Al-Ahzab Saba Fatir Ya-Sin As-Saffat Sad Az-Zumar Ghafir Fussilat Ash-Shura Az-Zukhruf Ad-Dukhan Al-Jathiyah Al-Ahqaf Muhammad Al-Fath Al-Hujurat Qaf Adh-Dhariyat At-Tur An-Najm Al-Qamar Ar-Rahman Al-Waqi'ah Al-Hadid Al-Mujadilah Al-Hashr Al-Mumtahanah As-Saff Al-Jumu'ah Al-Munafiqun At-Taghabun At-Talaq At-Tahrim Al-Mulk Al-Qalam Al-Haqqah Al-Ma'arij Nuh Al-Jinn Al-Muzzammil Al-Muddaththir Al-Qiyamah Al-Insan Al-Mursalat An-Naba An-Nazi'at Abasa At-Takwir Al-Infitar Al-Mutaffifin Al-Inshiqaq Al-Buruj At-Tariq Al-A'la Al-Ghashiyah Al-Fajr Al-Balad Ash-Shams Al-Layl Ad-Duha Ash-Sharh At-Tin Al-Alaq Al-Qadr Al-Bayyinah Az-Zalzalah Al-Adiyat Al-Qari'ah At-Takathur Al-Asr Al-Humazah Al-Fil Quraysh Al-Ma'un Al-Kawthar Al-Kafirun An-Nasr Al-Masad Al-Ikhlas Al-Falaq An-Nas"
    .split(" ")
    .map((x) => x.replace("_", " "));

export const surahNo = (name: string) => {
  const k = norm(name).replace(/^سوره\s*/, "");
  return SURAHS_AR.findIndex((x) => norm(x) === k) + 1;
};

/** Surah names mentioned in a recitation title («ما تيسر من سورة الكهف» → ["الكهف"]). */
export function surahsOf(t: string) {
  const out: string[] = [];
  for (const m of t.matchAll(/سور(?:ة|تي)\s+(.+?)(?=\s+(?:في|من|كاملة)(?:\s|$)|\s+وآيات|\s*[–(-]|$)/g)) out.push(...m[1].split(/\s+و(?=ال|[^\s]{2,})/));
  return out.map((x) => x.replace(/[()«»]/g, "").trim()).filter((x) => x && !x.startsWith("آيات"));
}
