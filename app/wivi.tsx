type WiviMood =
  | "tangled"
  | "pulling"
  | "walking"
  | "resting"
  | "sitting"
  | "comforting"
  | "pointing"
  | "knotting"
  | "happy";

const moodLabels: Record<WiviMood, string> = {
  tangled: "Wivi is carefully holding a tangled travel thread.",
  pulling: "Wivi is pulling the travel thread into a calm route.",
  walking: "Wivi is walking along the route toward the next place.",
  resting: "Wivi is resting peacefully beside the thread.",
  sitting: "Wivi is sitting happily while you enjoy the moment.",
  comforting: "Wivi is keeping the important moments safe as the day changes.",
  pointing: "Wivi is pointing out one thoughtful discovery.",
  knotting: "Wivi is tying a little memory knot in the thread.",
  happy: "Wivi is smiling beside a gently woven travel thread.",
};

export function Wivi({ mood = "happy", small = false }: { mood?: WiviMood; small?: boolean }) {
  return (
    <div
      className={`wivi wivi--${mood}${small ? " wivi--small" : ""}`}
      role="img"
      aria-label={moodLabels[mood]}
    >
      <span className="wivi-shadow" aria-hidden="true" />
      <span className="wivi-tail" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="wivi-backpack" aria-hidden="true">
        <i />
      </span>
      <span className="wivi-body" aria-hidden="true">
        <i className="wivi-pocket" />
      </span>
      <span className="wivi-head" aria-hidden="true">
        <i className="wivi-ear wivi-ear--left" />
        <i className="wivi-ear wivi-ear--right" />
        <i className="wivi-eye wivi-eye--left" />
        <i className="wivi-eye wivi-eye--right" />
        <i className="wivi-cheek" />
      </span>
      <span className="wivi-feet" aria-hidden="true">
        <i />
        <i />
      </span>
      <span className="wivi-arm" aria-hidden="true" />
    </div>
  );
}

