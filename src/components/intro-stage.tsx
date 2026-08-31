const BOARD = [
  { name: "AgentPayroll", val: "$1.2M", roast: "Headcount as a service.", hot: false },
  { name: "Mailblast", val: "$640k", roast: "Inbox zero. Revenue zero.", hot: false },
  { name: "DogWalkerDAO", val: "$90k", roast: "Governance for a leash.", hot: false },
  { name: "ProofOfVibes", val: "$2.1M", roast: "Tokenizing a group chat.", hot: false },
  { name: "ForkThis", val: "$410k", roast: "A GitHub star with a pitch.", hot: false },
  { name: "Clapback", val: "$3.4M", roast: "The line that paid rent.", hot: true },
  { name: "QuietLaunch", val: "$55k", roast: "Stealth, then silence.", hot: false },
  { name: "TermSheet", val: "$4.0M", roast: "A PDF with ambition.", hot: false },
] as const;

const TICK = [
  "Rank is $",
  "Steal the line",
  "Never the URL",
  "Two founders",
  "One deal",
  "Pitch. Get roasted.",
] as const;

function loop<T>(items: readonly T[]): T[] {
  return [...items, ...items];
}

export function IntroStage() {
  const rows = loop(BOARD);
  const ticks = loop(TICK);

  return (
    <div className="intro-stage" aria-hidden="true">
      <div className="intro-world">
        <div className="intro-ticker intro-ticker--top">
          <div className="intro-ticker-track">
            {ticks.map((t, i) => (
              <span key={`t-${i}`}>{t}</span>
            ))}
          </div>
        </div>

        <aside className="intro-pillar intro-pillar--left">
          <span className="intro-pillar-bar" />
          <div className="intro-pillar-track">
            <ul className="intro-board">
              {rows.map((row, i) => (
                <li
                  key={`b-${i}`}
                  className={row.hot ? "intro-row intro-row--hot" : "intro-row"}
                >
                  <span className="intro-row-i">
                    {String((i % BOARD.length) + 1).padStart(2, "0")}
                  </span>
                  <span className="intro-row-name">{row.name}</span>
                  <span className="intro-row-val">{row.val}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="intro-spine" />

        <aside className="intro-pillar intro-pillar--right">
          <span className="intro-pillar-bar" />
          <div className="intro-pillar-track">
            <ul className="intro-board intro-board--down">
              {rows.map((row, i) => (
                <li
                  key={`r-${i}`}
                  className={row.hot ? "intro-roast intro-roast--hot" : "intro-roast"}
                >
                  <span>{row.roast}</span>
                  <em>{row.name}</em>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="intro-ticker intro-ticker--bot">
          <div className="intro-ticker-track intro-ticker-track--rev">
            {ticks.map((t, i) => (
              <span key={`b-${i}`}>{t}</span>
            ))}
          </div>
        </div>

        <div className="intro-tape">
          <div className="intro-ticker-track">
            {rows.map((row, i) => (
              <span key={`n-${i}`}>
                {row.name} {row.val}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
