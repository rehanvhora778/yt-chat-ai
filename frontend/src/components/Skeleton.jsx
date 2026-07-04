/**
 * components/Skeleton.jsx
 * -----------------------
 * Shimmering loading placeholder (uses the .skeleton class from index.css).
 */

const Skeleton = ({ className = "" }) => (
  <div className={`skeleton ${className}`} />
);

export default Skeleton;
