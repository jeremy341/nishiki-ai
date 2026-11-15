import { useEffect, useState } from "react";

// A single, quiet reveal when a list first appears. Updates and filtering stay still.
export default function StaggerOnce({ children, className = "" }) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ul className={`motion-stagger ${className}`} data-settled={settled ? "" : undefined}>
      {children}
    </ul>
  );
}
