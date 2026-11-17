import SunriseCanvas from "../components/SunriseCanvas"

/** Edit the letter here — everything on the page below the drawing comes from this. */
const LETTER = {
  eyebrow: "sepucuk surat kecil",
  titleStart: "Hai, kamu yang di ",
  titleMark: "kereta",
  titleEnd: " itu",
  paragraphs: [
    "First of all, maaf banget ya tiba-tiba muncul begini. Maaf juga kalau lancang, aku sempat cari tahu tentang kamu padahal waktu itu kita nggak sempat kenalan sama sekali. Really sorry, my bad.",
    "Obrolan kita cuma sekitar satu jam dari lima jam perjalanan, tapi entah kenapa masih keinget sampai sekarang. Kamu yang nyapa duluan, nanya aku semester berapa, terus semuanya ngalir gitu aja. Kamu humble, ceria, dan energinya positif banget. Aku sampai nggak sadar kamu udah sampai di stasiunmu duluan.",
    "Oh iya, selamat ya buat medali silver-nya! Lomba yang waktu itu kamu ceritain di kereta ternyata beneran kamu bawa pulang. Keren banget, sungguh.",
    "Apa pun yang lagi kamu perjuangkan sekarang, sesusah apa pun itu: there is a will, there is a way. It's okeii kalau kadang capek, ini hidup pertama bagi semua orang. Keep doing what u doing. Hwaiting!!",
  ],
  note: "ini buat ngerayain kamu",
  closing: "u can start again, like the sun does every morning.",
  sign: "dari yang duduk di sebelahmu waktu itu (yang katamu kelihatan kayak udah kerja, hehe)",
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
    <svg width="46" height="34" viewBox="0 0 46 34" fill="none" aria-hidden className="shrink-0">
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
    <main className="untukmu allo min-h-screen overflow-x-clip px-3 pb-24 pt-[68px] text-[#2b2350] sm:px-4">
      <section className="mx-auto flex w-full flex-col items-center">
        <SunriseCanvas />
        <p className="mt-3 max-w-[46rem] text-center text-[12px] leading-snug text-[#2b2350]/60 sm:text-[13px]">
          <span className="font-semibold italic text-[#2b2350]/80">"stasiunmu duluan"</span> · digambar pakai
          javascript: krayon, pensil warna, pastel kapur, gel pen
        </p>
      </section>

      <article className="letter-sheet relative mx-auto mt-12 w-full max-w-[38rem] px-5 py-9 sm:mt-16 sm:px-12 sm:py-14">
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#6b4fa0]">{LETTER.eyebrow}</p>
        <h1 className="mt-3 text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] sm:text-[42px]">
          {LETTER.titleStart}
          <span className="relative inline-block text-[#6b4fa0]">
            {LETTER.titleMark}
            <Scribble />
          </span>
          {LETTER.titleEnd}
        </h1>

        <div className="mt-7 space-y-5 text-[16.5px] leading-[1.7] text-[#2b2350]/90 sm:text-[18px]">
          {LETTER.paragraphs.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>

        <div className="mt-6 flex -rotate-2 items-start gap-2 text-[#d0699c]">
          <span className="-scale-y-100">
            <NoteArrow />
          </span>
          <span className="pt-2 text-[15px] font-semibold italic sm:text-[16px]">{LETTER.note}</span>
        </div>

        <p className="mt-10 text-[24px] font-semibold italic leading-[1.25] tracking-[-0.01em] text-[#2b2350] sm:text-[30px]">
          {LETTER.closing}
        </p>

        <p className="mt-8 text-[14px] italic leading-snug text-[#2b2350]/65 sm:text-[15px]">— {LETTER.sign}</p>
      </article>
    </main>
  )
}
