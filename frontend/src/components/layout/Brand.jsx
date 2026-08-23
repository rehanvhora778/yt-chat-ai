/**
 * components/layout/Brand.jsx
 * ---------------------------
 * The wordmark, shared by the sidebar, the top bar and the public header.
 */

import { Link } from "react-router-dom";
import { Youtube } from "lucide-react";

const Brand = ({ to = "/dashboard", onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className="flex items-center gap-2.5"
    aria-label="YT Chat GenAI home"
  >
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-glow">
      <Youtube size={19} />
    </span>
    <span className="text-[17px] font-extrabold tracking-tight text-ink">
      YT Chat <span className="text-accent">GenAI</span>
    </span>
  </Link>
);

export default Brand;
