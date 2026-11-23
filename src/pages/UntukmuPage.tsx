import alloUrl from "allo-font/fonts/webfonts/AlloVariableFriendly.woff2?url"
import SunriseCanvas from "../components/SunriseCanvas"

// Only this page uses Allo, so the font is registered here instead of globally.
// The "friendly" cut is the variable font at half the file size.
if (typeof FontFace !== "undefined" && ![...document.fonts].some((f) => f.family === "Allo")) {
  const allo = new FontFace("Allo", `url(${alloUrl}) format("woff2")`, { weight: "100 900", display: "swap" })
  document.fonts.add(allo)
  allo.load().catch(() => {})
}

/** Ubah isi surat di sini. Semua teks di bawah lukisan diambil dari objek ini. */
const LETTER = {
  eyebrow: "Sepucuk surat kecil",
  titleStart: "Hai, kamu yang di ",
  titleMark: "kereta",
  titleEnd: " itu",
  paragraphs: [
    "Maaf ya, aku tiba-tiba muncul begini. Maaf juga kalau terasa lancang. Aku sempat mencari tahu tentang kamu, padahal waktu itu kita belum sempat kenalan.",
    "Perjalanannya lima jam, tapi kita cuma mengobrol sekitar satu jam. Anehnya, obrolan itu masih teringat sampai sekarang. Kamu yang menyapa duluan dan bertanya aku semester berapa. Setelah itu, semuanya mengalir begitu saja.",
    "Kamu rendah hati, ceria, dan hangat. Saking nyamannya, aku tidak sadar kamu sudah sampai di stasiunmu.",
    "Selamat ya untuk medali perakmu. Lomba yang kamu ceritakan di kereta ternyata benar-benar kamu menangkan.",
    "Apa pun yang sedang kamu perjuangkan, semoga tetap jalan. Kalau ada kemauan, pasti ada jalan. Kalau sesekali capek, tidak apa-apa. Ini hidup pertama untuk semua orang.",
    "Terus jalani apa yang sedang kamu kerjakan. Semangat!",
  ],
  note: "ini untuk merayakan kamu",
  closing: "Kamu selalu bisa mulai lagi, seperti matahari yang terbit setiap pagi.",
  sign: "Dari orang yang duduk di sebelahmu waktu itu. Yang katamu kelihatan seperti sudah kerja.",
}

/** Hand-drawn underline, like a quick pen stroke under one word. */
function Scribble() {
  return (
    <svg
      className="absolute -bottom-[0.18em] left-[-4%] h-[0.32em] w-[108%]"
      viewBox="0 0 120 12"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 7.5C20 3.5 44 3 62 5.2c18 2.2 38 2.4 56 0.4M8 10.2c26-2.6 62-3 104-1.6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function NoteArrow() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34" fill="none" aria-hidden className="shrink-0 -scale-y-100">
      <path
        d="M43 4C30 3 14 8 6 26M6 26l-3.5-9M6 26l9.5-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function UntukmuPage() {
  return (
    <main className="untukmu allo min-h-screen overflow-x-clip px-3 pb-24 pt-[68px] text-[#3a2a24] sm:px-4">
      <section className="mx-auto flex w-full flex-col items-center">
        <SunriseCanvas />
      </section>

      <article className="letter-sheet relative mx-auto mt-12 w-full max-w-[38rem] px-5 py-9 sm:mt-16 sm:px-12 sm:py-14">
        <p className="text-[14px] font-medium text-[#c05b3c]">{LETTER.eyebrow}</p>
        <h1 className="mt-2 text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] sm:text-[42px]">
          {LETTER.titleStart}
          <span className="relative inline-block text-[#c05b3c]">
            {LETTER.titleMark}
            <Scribble />
          </span>
          {LETTER.titleEnd}
        </h1>

        <div className="mt-7 space-y-5 text-[17px] leading-[1.7] text-[#3a2a24]/90 sm:text-[18px]">
          {LETTER.paragraphs.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>

        <div className="mt-6 flex -rotate-2 items-start gap-2 text-[#e0764f]">
          <NoteArrow />
          <span className="pt-2 text-[15px] font-semibold sm:text-[16px]">{LETTER.note}</span>
        </div>

        <p className="mt-10 text-[24px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#3a2a24] sm:text-[30px]">
          {LETTER.closing}
        </p>

        <p className="mt-8 text-[15px] leading-snug text-[#3a2a24]/65 sm:text-[16px]">— {LETTER.sign}</p>
      </article>
    </main>
  )
}
